// ─── Simulation Web Worker ──────────────────────────────────────
// Runs the simulation loop off the main thread.
// Receives config/commands, posts agent states each tick.

import type { Agent, SimConfig, Obstacle } from '../core/types';
import { AgentState } from '../core/types';
import { SpatialHash } from '../utils/spatialHash';
import { getAlgorithm } from '../algorithms/index';
import type { SwarmAlgorithm } from '../algorithms/base';
import type { WorkerInMessage, WorkerOutMessage } from './protocol';
import { heading, random } from '../utils/vector';

let agents: Agent[] = [];
let config: SimConfig | null = null;
let obstacles: Obstacle[] = [];
let algorithm: SwarmAlgorithm | null = null;
let spatialHash: SpatialHash | null = null;
let tick = 0;
let running = false;
let debugEnabled = false;
let animFrameId: ReturnType<typeof setTimeout> | null = null;

function spawnAgents(cfg: SimConfig): Agent[] {
    const spawned: Agent[] = [];
    for (let i = 0; i < cfg.agentCount; i++) {
        const vel = random(cfg.maxSpeed * 0.5);
        spawned.push({
            id: i,
            x: Math.random() * cfg.worldWidth,
            y: Math.random() * cfg.worldHeight,
            vx: vel.x,
            vy: vel.y,
            heading: heading(vel),
            state: AgentState.Active,
        });
    }
    return spawned;
}

const ANOMALY_WINDOW = 40;
const posHistory = new Map<number, Array<{ x: number; y: number }>>();

function simTick(): void {
    if (!config || !algorithm || !spatialHash) return;

    // Rebuild spatial hash
    spatialHash.insertAll(agents);

    // Run algorithm
    agents = algorithm.tick(agents, config, obstacles, spatialHash);
    tick++;

    // ─── Anomaly Detection ──────────────────────────────
    // Track position history and mark agents as anomalous
    // if they're stuck (barely moving over ANOMALY_WINDOW ticks)
    for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        let h = posHistory.get(a.id);
        if (!h) { h = []; posHistory.set(a.id, h); }
        h.push({ x: a.x, y: a.y });
        if (h.length > ANOMALY_WINDOW) h.shift();

        if (h.length >= ANOMALY_WINDOW) {
            const oldest = h[0];
            const dx = a.x - oldest.x;
            const dy = a.y - oldest.y;
            const displacement = Math.sqrt(dx * dx + dy * dy);

            // Stuck = barely moved in 40 ticks
            if (displacement < 8) {
                agents[i] = { ...a, state: AgentState.Anomaly };
            }
        }
    }

    // Post results back to main thread
    const msg: WorkerOutMessage = { type: 'TICK', agents, tick };

    // Include debug info only when debug mode is active
    if (debugEnabled) {
        msg.debugInfo = algorithm.getDebugInfo();
    }

    self.postMessage(msg);
}

function simLoop(): void {
    if (!running) return;
    simTick();
    animFrameId = setTimeout(simLoop, 16);
}

function startLoop(): void {
    running = true;
    simLoop();
}

function stopLoop(): void {
    running = false;
    if (animFrameId !== null) {
        clearTimeout(animFrameId);
        animFrameId = null;
    }
}

// ─── Message Handler ───────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'INIT': {
            config = msg.config;
            obstacles = msg.obstacles;
            algorithm = getAlgorithm(config.algorithm);
            spatialHash = new SpatialHash(config.neighborRadius);
            agents = msg.agents.length > 0 ? msg.agents : spawnAgents(config);
            tick = 0;

            const ready: WorkerOutMessage = { type: 'READY' };
            self.postMessage(ready);

            const initial: WorkerOutMessage = { type: 'TICK', agents, tick };
            self.postMessage(initial);
            break;
        }

        case 'UPDATE_CONFIG': {
            if (config) {
                config = { ...config, ...msg.config };
                if (msg.config.algorithm) {
                    algorithm = getAlgorithm(config.algorithm);
                }
                if (msg.config.neighborRadius) {
                    spatialHash = new SpatialHash(config.neighborRadius);
                }
            }
            break;
        }

        case 'UPDATE_OBSTACLES': {
            obstacles = msg.obstacles;
            break;
        }

        case 'SET_DEBUG': {
            debugEnabled = msg.enabled;
            break;
        }

        case 'SET_AGENTS': {
            agents = msg.agents;
            posHistory.get(agents[0]?.id)?.fill({ x: agents[0]?.x, y: agents[0]?.y }); // crude fix to prevent immediate anomaly
            break;
        }

        case 'PLAY': {
            startLoop();
            break;
        }

        case 'PAUSE': {
            stopLoop();
            break;
        }

        case 'STEP': {
            stopLoop();
            simTick();
            break;
        }

        case 'RESET': {
            stopLoop();
            config = msg.config;
            algorithm = getAlgorithm(config.algorithm);
            spatialHash = new SpatialHash(config.neighborRadius);
            agents = spawnAgents(config);
            posHistory.clear();
            // Note: obstacles are intentionally preserved across resets
            tick = 0;

            const resetMsg: WorkerOutMessage = { type: 'TICK', agents, tick };
            self.postMessage(resetMsg);
            break;
        }
    }
};
