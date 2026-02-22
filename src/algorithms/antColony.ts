// ─── Ant Colony Optimization Algorithm ──────────────────────────
// Ants forage from nest to food sources, laying pheromone trails.
// Probabilistic trail following prevents convergence to a single food source.

import type { SwarmAlgorithm } from './base';
import type { Agent, SimConfig, Obstacle, Vec2, AgentDebugInfo, ForceVector } from '../core/types';
import { AgentState } from '../core/types';
import type { SpatialHash } from '../utils/spatialHash';
import { add, sub, scale, normalize, limit, mag, heading, zero, dist } from '../utils/vector';

interface FoodSource {
    x: number;
    y: number;
    radius: number;
}

interface AntMemory {
    mode: 'search' | 'return';
    wanderAngle: number;
    targetFoodIdx: number; // which food this ant found (-1 = none)
    stepsSearching: number; // how long searching without finding food
}

export class AntColonyAlgorithm implements SwarmAlgorithm {
    private pheromoneGrid: Float32Array = new Float32Array(0);
    private gridCols = 0;
    private gridRows = 0;
    private cellSize = 8;
    private nestX = 0;
    private nestY = 0;
    private foodSources: FoodSource[] = [];
    private ants: Map<number, AntMemory> = new Map();
    private initialized = false;
    private tickCount = 0;
    private lastDebugInfo: AgentDebugInfo[] = [];

    private init(config: SimConfig) {
        this.gridCols = Math.ceil(config.worldWidth / this.cellSize);
        this.gridRows = Math.ceil(config.worldHeight / this.cellSize);
        this.pheromoneGrid = new Float32Array(this.gridCols * this.gridRows);

        this.nestX = config.worldWidth * 0.12;
        this.nestY = config.worldHeight * 0.5;

        // Spread food sources across the world at varied distances
        this.foodSources = [
            { x: config.worldWidth * 0.85, y: config.worldHeight * 0.2, radius: 25 },
            { x: config.worldWidth * 0.80, y: config.worldHeight * 0.8, radius: 25 },
            { x: config.worldWidth * 0.55, y: config.worldHeight * 0.12, radius: 20 },
            { x: config.worldWidth * 0.60, y: config.worldHeight * 0.88, radius: 20 },
            { x: config.worldWidth * 0.45, y: config.worldHeight * 0.5, radius: 15 },
        ];

        this.initialized = true;
    }

    tick(
        agents: Agent[],
        config: SimConfig,
        obstacles: Obstacle[],
        _spatialHash: SpatialHash,
    ): Agent[] {
        if (!this.initialized) this.init(config);
        this.tickCount++;

        // Evaporate pheromones — faster decay prevents trail lock-in
        for (let i = 0; i < this.pheromoneGrid.length; i++) {
            this.pheromoneGrid[i] *= 0.993;
            if (this.pheromoneGrid[i] < 0.01) this.pheromoneGrid[i] = 0;
        }

        // Diffuse pheromones (every 4th tick)
        if (this.tickCount % 4 === 0) {
            this.diffusePheromones();
        }

        const updated: Agent[] = new Array(agents.length);
        const debugInfo: AgentDebugInfo[] = new Array(agents.length);

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];

            if (!this.ants.has(agent.id)) {
                this.ants.set(agent.id, {
                    mode: 'search',
                    wanderAngle: Math.random() * Math.PI * 2,
                    targetFoodIdx: -1,
                    stepsSearching: 0,
                });
            }

            const mem = this.ants.get(agent.id)!;
            let force: Vec2 = zero();

            if (mem.mode === 'search') {
                mem.stepsSearching++;

                // Check if found any food
                let foundFood = false;
                for (let fi = 0; fi < this.foodSources.length; fi++) {
                    const food = this.foodSources[fi];
                    if (dist(agent, food) < food.radius) {
                        mem.mode = 'return';
                        mem.targetFoodIdx = fi;
                        mem.stepsSearching = 0;
                        foundFood = true;
                        break;
                    }
                }

                if (!foundFood) {
                    // EXPLORATION RATE: 30% of ants ignore pheromones and wander randomly
                    // This prevents all ants converging on the same trail
                    const isExplorer = (agent.id % 10) < 3;

                    if (isExplorer || mem.stepsSearching < 50) {
                        // Pure wander — explores new areas
                        force = this.wanderForce(agent, mem);
                        force = scale(force, 1.5);
                    } else {
                        // Follow pheromones probabilistically
                        const phero = this.senseAndSteerPheromone(agent, mem);
                        const wander = this.wanderForce(agent, mem);

                        if (mag(phero) > 0.05) {
                            force = add(scale(phero, 1.5), scale(wander, 0.8));
                        } else {
                            force = scale(wander, 1.2);
                        }
                    }

                    // After 300 steps without finding food, do a big random turn
                    if (mem.stepsSearching > 300 && mem.stepsSearching % 50 === 0) {
                        mem.wanderAngle += (Math.random() - 0.5) * Math.PI;
                    }
                }
            }

            if (mem.mode === 'return') {
                // Lay pheromone while returning — strength inversely proportional to
                // distance from food (shorter paths get stronger trails)
                const foodDist = mem.targetFoodIdx >= 0
                    ? dist(agent, this.foodSources[mem.targetFoodIdx])
                    : 100;
                const strength = Math.max(0.5, 3.0 - foodDist * 0.005);
                this.depositPheromone(agent.x, agent.y, strength);

                // Head to nest
                const toNest = sub({ x: this.nestX, y: this.nestY }, agent);
                const nestDist = mag(toNest);

                if (nestDist < 15) {
                    // Arrived at nest — search again with random heading
                    mem.mode = 'search';
                    mem.targetFoodIdx = -1;
                    mem.stepsSearching = 0;
                    // Fan out in random direction, not back the way we came
                    mem.wanderAngle = Math.random() * Math.PI * 2;
                    force = { x: Math.cos(mem.wanderAngle) * 2, y: Math.sin(mem.wanderAngle) * 2 };
                } else {
                    force = scale(normalize(toNest), config.maxSpeed * 0.9);
                    // Wobble
                    const wobble = (Math.random() - 0.5) * 0.4;
                    force = add(force, {
                        x: Math.cos(heading(toNest) + Math.PI / 2) * wobble,
                        y: Math.sin(heading(toNest) + Math.PI / 2) * wobble,
                    });
                }
            }

            // Obstacle avoidance
            for (const obs of obstacles) {
                const d = dist(agent, obs);
                const boundary = obs.radius + 30;
                if (d < boundary && d > 0) {
                    const away = normalize(sub(agent, obs));
                    force = add(force, scale(away, config.maxSpeed * 2 * (1 - d / boundary)));
                }
            }

            // Wall avoidance
            const margin = 25;
            if (agent.x < margin) force = add(force, { x: 2, y: 0 });
            if (agent.x > config.worldWidth - margin) force = add(force, { x: -2, y: 0 });
            if (agent.y < margin) force = add(force, { x: 0, y: 2 });
            if (agent.y > config.worldHeight - margin) force = add(force, { x: 0, y: -2 });

            force = limit(force, config.maxForce * 3);

            let newVx = agent.vx * 0.8 + force.x;
            let newVy = agent.vy * 0.8 + force.y;
            const speed = mem.mode === 'return' ? config.maxSpeed * 0.8 : config.maxSpeed * 0.6;
            const vel = limit({ x: newVx, y: newVy }, speed);
            newVx = vel.x;
            newVy = vel.y;

            let newX = agent.x + newVx * config.speedMultiplier;
            let newY = agent.y + newVy * config.speedMultiplier;

            newX = Math.max(1, Math.min(config.worldWidth - 1, newX));
            newY = Math.max(1, Math.min(config.worldHeight - 1, newY));

            // Force breakdown for debugger
            const debugForces: ForceVector[] = [
                { label: mem.mode === 'return' ? 'RETURN' : 'SEARCH', x: force.x, y: force.y, color: mem.mode === 'return' ? '#d29922' : '#58a6ff' },
            ];
            const pLevel = this.samplePheromone(agent.x, agent.y);
            debugInfo[i] = {
                id: agent.id,
                forces: debugForces,
                meta: {
                    mode: mem.mode,
                    food: mem.targetFoodIdx >= 0 ? `F${mem.targetFoodIdx + 1}` : 'none',
                    pheromone: +pLevel.toFixed(2),
                    steps: mem.stepsSearching,
                },
            };

            updated[i] = {
                id: agent.id,
                x: newX,
                y: newY,
                vx: newVx,
                vy: newVy,
                heading: heading(vel),
                state: mem.mode === 'return' ? AgentState.Stuck : AgentState.Active,
            };
        }

        this.lastDebugInfo = debugInfo;
        return updated;
    }

    getDebugInfo(): AgentDebugInfo[] {
        return this.lastDebugInfo;
    }

    private depositPheromone(x: number, y: number, strength: number) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of offsets) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
                const idx = ny * this.gridCols + nx;
                const s = dx === 0 && dy === 0 ? strength : strength * 0.3;
                this.pheromoneGrid[idx] = Math.min(this.pheromoneGrid[idx] + s, 12);
            }
        }
    }

    private diffusePheromones() {
        const newGrid = new Float32Array(this.pheromoneGrid.length);
        for (let y = 0; y < this.gridRows; y++) {
            for (let x = 0; x < this.gridCols; x++) {
                const idx = y * this.gridCols + x;
                let sum = this.pheromoneGrid[idx] * 0.6;
                let count = 0.6;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
                            sum += this.pheromoneGrid[ny * this.gridCols + nx] * 0.05;
                            count += 0.05;
                        }
                    }
                }
                newGrid[idx] = sum / count;
            }
        }
        this.pheromoneGrid = newGrid;
    }

    private senseAndSteerPheromone(agent: Agent, mem: AntMemory): Vec2 {
        const senseAngle = 0.6;
        const senseDistance = 30;

        const angles = [
            mem.wanderAngle - senseAngle,
            mem.wanderAngle,
            mem.wanderAngle + senseAngle,
        ];

        const values: number[] = [];
        for (const angle of angles) {
            const sx = agent.x + Math.cos(angle) * senseDistance;
            const sy = agent.y + Math.sin(angle) * senseDistance;
            values.push(this.samplePheromone(sx, sy));
        }

        const [left, center, right] = values;

        // Probabilistic steering — don't always pick max
        const total = left + center + right;
        if (total < 0.1) return zero();

        const rand = Math.random() * total;
        if (rand < left) {
            mem.wanderAngle -= 0.25;
        } else if (rand < left + center) {
            // straight
        } else {
            mem.wanderAngle += 0.25;
        }

        const strength = Math.max(left, center, right);
        return {
            x: Math.cos(mem.wanderAngle) * Math.min(strength, 1),
            y: Math.sin(mem.wanderAngle) * Math.min(strength, 1),
        };
    }

    private samplePheromone(x: number, y: number): number {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        if (cx < 0 || cx >= this.gridCols || cy < 0 || cy >= this.gridRows) return 0;
        return this.pheromoneGrid[cy * this.gridCols + cx];
    }

    private wanderForce(_agent: Agent, mem: AntMemory): Vec2 {
        mem.wanderAngle += (Math.random() - 0.5) * 0.9;
        return {
            x: Math.cos(mem.wanderAngle) * 0.8,
            y: Math.sin(mem.wanderAngle) * 0.8,
        };
    }
}
