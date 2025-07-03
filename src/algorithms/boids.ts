// ─── Reynolds Boids Algorithm ───────────────────────────────────
// Classic separation + alignment + cohesion flocking.
// Now tracks per-agent force breakdowns for the debugger.

import type { SwarmAlgorithm } from './base';
import type { Agent, SimConfig, Obstacle, Vec2, AgentDebugInfo, ForceVector } from '../core/types';
import { AgentState } from '../core/types';
import type { SpatialHash } from '../utils/spatialHash';
import { add, sub, scale, normalize, limit, mag, heading, zero, distSq } from '../utils/vector';

export class BoidsAlgorithm implements SwarmAlgorithm {
    private lastDebugInfo: AgentDebugInfo[] = [];

    tick(
        agents: Agent[],
        config: SimConfig,
        obstacles: Obstacle[],
        spatialHash: SpatialHash,
    ): Agent[] {
        const updated: Agent[] = new Array(agents.length);
        const debugInfo: AgentDebugInfo[] = new Array(agents.length);

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];

            // Find neighbors using spatial hash
            const neighbors = spatialHash.queryRadius(
                agent.x, agent.y, config.neighborRadius, agent.id,
            );

            // Compute steering forces
            const sep = this.separation(agent, neighbors, config);
            const ali = this.alignment(agent, neighbors, config);
            const coh = this.cohesion(agent, neighbors, config);
            const obs = this.avoidObstacles(agent, obstacles, config);

            // Weighted forces
            const sepW = scale(sep, config.separationWeight);
            const aliW = scale(ali, config.alignmentWeight);
            const cohW = scale(coh, config.cohesionWeight);
            const obsW = scale(obs, 3.0);

            // Store force breakdown for debugger
            const forces: ForceVector[] = [
                { label: 'SEP', x: sepW.x, y: sepW.y, color: '#f85149' },
                { label: 'ALI', x: aliW.x, y: aliW.y, color: '#3fb950' },
                { label: 'COH', x: cohW.x, y: cohW.y, color: '#58a6ff' },
            ];
            if (mag(obsW) > 0.01) {
                forces.push({ label: 'OBS', x: obsW.x, y: obsW.y, color: '#d29922' });
            }

            debugInfo[i] = {
                id: agent.id,
                forces,
                meta: {
                    neighbors: neighbors.length,
                    speed: Math.sqrt(agent.vx * agent.vx + agent.vy * agent.vy).toFixed(2) as unknown as number,
                },
            };

            // Weighted sum of forces
            let force: Vec2 = zero();
            force = add(force, sepW);
            force = add(force, aliW);
            force = add(force, cohW);
            force = add(force, obsW);

            force = limit(force, config.maxForce);

            let newVx = agent.vx + force.x;
            let newVy = agent.vy + force.y;

            const vel: Vec2 = limit({ x: newVx, y: newVy }, config.maxSpeed);
            newVx = vel.x;
            newVy = vel.y;

            let newX = agent.x + newVx * config.speedMultiplier;
            let newY = agent.y + newVy * config.speedMultiplier;

            // Wrap around world edges
            if (newX < 0) newX += config.worldWidth;
            if (newX >= config.worldWidth) newX -= config.worldWidth;
            if (newY < 0) newY += config.worldHeight;
            if (newY >= config.worldHeight) newY -= config.worldHeight;

            updated[i] = {
                id: agent.id,
                x: newX,
                y: newY,
                vx: newVx,
                vy: newVy,
                heading: heading(vel),
                state: AgentState.Active,
            };
        }

        this.lastDebugInfo = debugInfo;
        return updated;
    }

    getDebugInfo(): AgentDebugInfo[] {
        return this.lastDebugInfo;
    }

    private separation(agent: Agent, neighbors: Agent[], config: SimConfig): Vec2 {
        let steer: Vec2 = zero();
        let count = 0;
        const sepRadSq = config.separationRadius * config.separationRadius;

        for (let i = 0; i < neighbors.length; i++) {
            const n = neighbors[i];
            const dsq = distSq(agent, n);
            if (dsq > 0 && dsq < sepRadSq) {
                let diff = sub(agent, n);
                diff = normalize(diff);
                diff = scale(diff, 1 / Math.sqrt(dsq));
                steer = add(steer, diff);
                count++;
            }
        }

        if (count > 0) {
            steer = scale(steer, 1 / count);
            if (mag(steer) > 0) {
                steer = normalize(steer);
                steer = scale(steer, config.maxSpeed);
                steer = sub(steer, { x: agent.vx, y: agent.vy });
                steer = limit(steer, config.maxForce);
            }
        }

        return steer;
    }

    private alignment(agent: Agent, neighbors: Agent[], config: SimConfig): Vec2 {
        if (neighbors.length === 0) return zero();

        let avg: Vec2 = zero();
        for (let i = 0; i < neighbors.length; i++) {
            avg = add(avg, { x: neighbors[i].vx, y: neighbors[i].vy });
        }
        avg = scale(avg, 1 / neighbors.length);

        if (mag(avg) > 0) {
            avg = normalize(avg);
            avg = scale(avg, config.maxSpeed);
            avg = sub(avg, { x: agent.vx, y: agent.vy });
            avg = limit(avg, config.maxForce);
        }

        return avg;
    }

    private cohesion(agent: Agent, neighbors: Agent[], config: SimConfig): Vec2 {
        if (neighbors.length === 0) return zero();

        let center: Vec2 = zero();
        for (let i = 0; i < neighbors.length; i++) {
            center = add(center, { x: neighbors[i].x, y: neighbors[i].y });
        }
        center = scale(center, 1 / neighbors.length);

        let desired = sub(center, { x: agent.x, y: agent.y });
        if (mag(desired) > 0) {
            desired = normalize(desired);
            desired = scale(desired, config.maxSpeed);
            desired = sub(desired, { x: agent.vx, y: agent.vy });
            desired = limit(desired, config.maxForce);
        }

        return desired;
    }

    private avoidObstacles(agent: Agent, obstacles: Obstacle[], config: SimConfig): Vec2 {
        let steer: Vec2 = zero();
        const avoidRadius = 50;

        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const dx = agent.x - obs.x;
            const dy = agent.y - obs.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const boundary = obs.radius + avoidRadius;

            if (d < boundary && d > 0) {
                let away = normalize({ x: dx, y: dy });
                away = scale(away, config.maxSpeed * (1 - d / boundary));
                steer = add(steer, away);
            }
        }

        return limit(steer, config.maxForce);
    }
}
