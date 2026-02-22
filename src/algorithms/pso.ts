// ─── Particle Swarm Optimization Algorithm ──────────────────────
// Particles chase multiple fast-moving targets across the world.
// Creates dynamic convergence/divergence as targets shift positions.

import type { SwarmAlgorithm } from './base';
import type { Agent, SimConfig, Obstacle, Vec2, AgentDebugInfo, ForceVector } from '../core/types';
import { AgentState } from '../core/types';
import type { SpatialHash } from '../utils/spatialHash';
import { sub, scale, limit, heading, dist, normalize } from '../utils/vector';

interface ParticleMemory {
    personalBestX: number;
    personalBestY: number;
    personalBestFitness: number;
}

interface Target {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export class PSOAlgorithm implements SwarmAlgorithm {
    private globalBestFitness = Infinity;
    private particles: Map<number, ParticleMemory> = new Map();
    private targets: Target[] = [];
    private initialized = false;
    private tickCount = 0;
    private lastDebugInfo: AgentDebugInfo[] = [];

    private init(config: SimConfig) {
        this.targets = [
            { x: config.worldWidth * 0.25, y: config.worldHeight * 0.25, vx: 2.5, vy: 1.8 },
            { x: config.worldWidth * 0.75, y: config.worldHeight * 0.75, vx: -2.0, vy: 2.2 },
            { x: config.worldWidth * 0.5, y: config.worldHeight * 0.15, vx: 1.5, vy: -1.5 },
        ];
        this.globalBestFitness = Infinity;
        this.particles.clear();
        this.initialized = true;
    }

    private fitness(x: number, y: number): number {
        let best = Infinity;
        for (const t of this.targets) {
            const dx = x - t.x;
            const dy = y - t.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < best) best = d;
        }
        return best;
    }

    // Find the nearest target to a position
    private nearestTarget(x: number, y: number): Target {
        let best = this.targets[0];
        let bestD = Infinity;
        for (const t of this.targets) {
            const d = (x - t.x) ** 2 + (y - t.y) ** 2;
            if (d < bestD) { bestD = d; best = t; }
        }
        return best;
    }

    tick(
        agents: Agent[],
        config: SimConfig,
        obstacles: Obstacle[],
        _spatialHash: SpatialHash,
    ): Agent[] {
        if (!this.initialized) this.init(config);
        this.tickCount++;

        // Move targets — FAST bouncing so particles have to chase
        for (const t of this.targets) {
            t.x += t.vx;
            t.y += t.vy;
            if (t.x < 40 || t.x > config.worldWidth - 40) {
                t.vx *= -1;
                t.x = Math.max(40, Math.min(config.worldWidth - 40, t.x));
            }
            if (t.y < 40 || t.y > config.worldHeight - 40) {
                t.vy *= -1;
                t.y = Math.max(40, Math.min(config.worldHeight - 40, t.y));
            }
        }

        // Every 120 ticks: teleport one target far away, full memory wipe
        if (this.tickCount % 120 === 0) {
            const idx = this.tickCount / 120 % this.targets.length | 0;
            this.targets[idx].x = 80 + Math.random() * (config.worldWidth - 160);
            this.targets[idx].y = 80 + Math.random() * (config.worldHeight - 160);
            // Randomize velocity direction and speed
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2.0;
            this.targets[idx].vx = Math.cos(angle) * speed;
            this.targets[idx].vy = Math.sin(angle) * speed;

            // Wipe ALL memory so particles re-explore
            this.particles.clear();
            this.globalBestFitness = Infinity;
        }

        const updated: Agent[] = new Array(agents.length);
        const debugInfo: AgentDebugInfo[] = new Array(agents.length);

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];

            // Init particle memory
            if (!this.particles.has(agent.id)) {
                const fit = this.fitness(agent.x, agent.y);
                this.particles.set(agent.id, {
                    personalBestX: agent.x,
                    personalBestY: agent.y,
                    personalBestFitness: fit,
                });
                if (fit < this.globalBestFitness) {
                    this.globalBestFitness = fit;
                }
            }

            const mem = this.particles.get(agent.id)!;
            const currentFitness = this.fitness(agent.x, agent.y);

            // Update personal best
            if (currentFitness < mem.personalBestFitness) {
                mem.personalBestX = agent.x;
                mem.personalBestY = agent.y;
                mem.personalBestFitness = currentFitness;
            }

            // Update global best
            if (currentFitness < this.globalBestFitness) {
                this.globalBestFitness = currentFitness;
            }

            const r1 = Math.random();
            const r2 = Math.random();

            // Instead of pulling to global best (causes single-point collapse),
            // pull toward the NEAREST target's local best (emergent sub-swarms)
            const nearest = this.nearestTarget(agent.x, agent.y);
            const toTarget = sub(nearest, agent);
            const targetPull = scale(toTarget, 0.02 * r2);

            // Cognitive: gentle pull toward personal best
            const toPersonal = sub({ x: mem.personalBestX, y: mem.personalBestY }, agent);
            const cognitive = scale(toPersonal, 0.015 * r1);

            // Strong exploration noise
            const noise: Vec2 = {
                x: (Math.random() - 0.5) * 1.2,
                y: (Math.random() - 0.5) * 1.2,
            };

            // High inertia keeps particles sweeping, not hovering
            const inertia = 0.75;
            let newVx = inertia * agent.vx + cognitive.x + targetPull.x + noise.x;
            let newVy = inertia * agent.vy + cognitive.y + targetPull.y + noise.y;

            // Obstacle avoidance
            for (const obs of obstacles) {
                const d = dist(agent, obs);
                const boundary = obs.radius + 40;
                if (d < boundary && d > 0) {
                    const away = normalize(sub(agent, obs));
                    newVx += away.x * config.maxSpeed * (1 - d / boundary);
                    newVy += away.y * config.maxSpeed * (1 - d / boundary);
                }
            }

            const vel = limit({ x: newVx, y: newVy }, config.maxSpeed);
            newVx = vel.x;
            newVy = vel.y;

            let newX = agent.x + newVx * config.speedMultiplier;
            let newY = agent.y + newVy * config.speedMultiplier;

            // Wall bounce
            if (newX < 10) { newVx = Math.abs(newVx); newX = 10; }
            if (newX > config.worldWidth - 10) { newVx = -Math.abs(newVx); newX = config.worldWidth - 10; }
            if (newY < 10) { newVy = Math.abs(newVy); newY = 10; }
            if (newY > config.worldHeight - 10) { newVy = -Math.abs(newVy); newY = config.worldHeight - 10; }

            // Near target = converging (amber)
            const nearTarget = dist({ x: newX, y: newY }, nearest) < 35;

            // Debug force breakdown
            const debugForces: ForceVector[] = [
                { label: 'INERTIA', x: inertia * agent.vx, y: inertia * agent.vy, color: '#8b949e' },
                { label: 'COGNITIVE', x: cognitive.x, y: cognitive.y, color: '#58a6ff' },
                { label: 'SOCIAL', x: targetPull.x, y: targetPull.y, color: '#3fb950' },
                { label: 'NOISE', x: noise.x, y: noise.y, color: '#d29922' },
            ];
            debugInfo[i] = {
                id: agent.id,
                forces: debugForces,
                meta: {
                    fitness: +currentFitness.toFixed(1),
                    pBest: +mem.personalBestFitness.toFixed(1),
                    targetDist: +dist({ x: newX, y: newY }, nearest).toFixed(0),
                    nearTarget: nearTarget ? 'yes' : 'no',
                },
            };

            updated[i] = {
                id: agent.id,
                x: newX,
                y: newY,
                vx: newVx,
                vy: newVy,
                heading: heading(vel),
                state: nearTarget ? AgentState.Stuck : AgentState.Active,
            };
        }

        this.lastDebugInfo = debugInfo;
        return updated;
    }

    getDebugInfo(): AgentDebugInfo[] {
        return this.lastDebugInfo;
    }
}
