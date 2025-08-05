// ─── Worker Message Protocol ────────────────────────────────────
// Type-safe messages between main thread and simulation Web Worker.

import type { SimConfig, Obstacle, Agent, AgentDebugInfo } from '../core/types';

// Main → Worker messages
export type WorkerInMessage =
    | { type: 'INIT'; config: SimConfig; agents: Agent[]; obstacles: Obstacle[] }
    | { type: 'UPDATE_CONFIG'; config: Partial<SimConfig> }
    | { type: 'UPDATE_OBSTACLES'; obstacles: Obstacle[] }
    | { type: 'SET_DEBUG'; enabled: boolean }
    | { type: 'SET_AGENTS'; agents: Agent[] }
    | { type: 'PLAY' }
    | { type: 'PAUSE' }
    | { type: 'STEP' }
    | { type: 'RESET'; config: SimConfig };

// Worker → Main messages
export type WorkerOutMessage =
    | { type: 'TICK'; agents: Agent[]; tick: number; debugInfo?: AgentDebugInfo[] }
    | { type: 'READY' };
