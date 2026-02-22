// ─── Zustand Store ──────────────────────────────────────────────
// Central state management with selective subscriptions.

import { create } from 'zustand';
import type { Agent, SimConfig, Obstacle, LayerVisibility, AnalyticsState, AgentDebugInfo } from './types';
import { DEFAULT_CONFIG, DEFAULT_LAYERS, SimStatus } from './types';
import type { WorkerInMessage } from '../workers/protocol';

interface HivemindStore {
    // ─── Sim Config ─────────────────────────────────
    config: SimConfig;
    setConfig: (partial: Partial<SimConfig>) => void;

    // ─── Sim State ──────────────────────────────────
    agents: Agent[];
    tick: number;
    status: SimStatus;
    agentsHistory: Agent[][];
    setAgents: (agents: Agent[], tick: number) => void;
    setStatus: (status: SimStatus) => void;
    stepBack: () => void;

    // ─── Obstacles ──────────────────────────────────
    obstacles: Obstacle[];
    addObstacle: (x: number, y: number) => void;
    clearObstacles: () => void;

    // ─── Layers ─────────────────────────────────────
    layers: LayerVisibility;
    toggleLayer: (layer: keyof LayerVisibility) => void;

    // ─── Analytics ──────────────────────────────────
    analytics: AnalyticsState;
    updateAnalytics: (partial: Partial<AnalyticsState>) => void;

    // ─── Debug / Inspector ──────────────────────────
    selectedAgentId: number | null;
    setSelectedAgentId: (id: number | null) => void;
    debugInfo: AgentDebugInfo[];
    setDebugInfo: (info: AgentDebugInfo[]) => void;

    // ─── Worker Ref ─────────────────────────────────
    worker: Worker | null;
    setWorker: (worker: Worker) => void;
    sendToWorker: (msg: WorkerInMessage) => void;

    // ─── Actions ────────────────────────────────────
    play: () => void;
    pause: () => void;
    step: () => void;
    reset: () => void;
}

let nextObstacleId = 0;

export const useStore = create<HivemindStore>((set, get) => ({
    // ─── Config ──────────────────────────────────────
    config: { ...DEFAULT_CONFIG },
    setConfig: (partial) => {
        set((s) => {
            const newConfig = { ...s.config, ...partial };
            s.worker?.postMessage({ type: 'UPDATE_CONFIG', config: partial });
            return { config: newConfig };
        });
    },

    // ─── Simulation State ────────────────────────────
    agents: [],
    tick: 0,
    status: SimStatus.Stopped,
    agentsHistory: [],
    setAgents: (agents, tick) => {
        set((s) => {
            const nextHistory = [...s.agentsHistory, agents];
            if (nextHistory.length > 300) nextHistory.shift(); // cap history
            return { agents, tick, agentsHistory: nextHistory };
        });
    },
    setStatus: (status) => set({ status }),
    stepBack: () => {
        const { agentsHistory, worker } = get();
        if (agentsHistory.length <= 1) return;

        // Pop last 2 (current and previous) and restore previous
        const newHistory = [...agentsHistory];
        newHistory.pop(); // discard current
        const previousState = newHistory[newHistory.length - 1];

        set({
            agents: previousState,
            agentsHistory: newHistory,
            tick: Math.max(0, get().tick - 1),
            status: SimStatus.Paused,
        });

        worker?.postMessage({ type: 'SET_AGENTS', agents: previousState });
        worker?.postMessage({ type: 'PAUSE' });
    },

    // ─── Obstacles ───────────────────────────────────
    obstacles: [],
    addObstacle: (x, y) => {
        set((s) => {
            const obs: Obstacle = {
                id: nextObstacleId++,
                x, y,
                radius: 30,
                type: 'circle',
            };
            const obstacles = [...s.obstacles, obs];
            s.worker?.postMessage({ type: 'UPDATE_OBSTACLES', obstacles });
            return { obstacles };
        });
    },
    clearObstacles: () => {
        set({ obstacles: [] });
        get().worker?.postMessage({ type: 'UPDATE_OBSTACLES', obstacles: [] });
    },

    // ─── Layers ──────────────────────────────────────
    layers: { ...DEFAULT_LAYERS },
    toggleLayer: (layer) =>
        set((s) => ({
            layers: { ...s.layers, [layer]: !s.layers[layer] },
        })),

    // ─── Analytics ───────────────────────────────────
    analytics: {
        avgSpeed: 0,
        clusterCount: 0,
        coveragePercent: 0,
        convergence: 0,
        speedHistory: [],
        coverageHistory: [],
    },
    updateAnalytics: (partial) =>
        set((s) => ({ analytics: { ...s.analytics, ...partial } })),

    // ─── Debug / Inspector ───────────────────────────
    selectedAgentId: null,
    setSelectedAgentId: (id) => set({ selectedAgentId: id }),
    debugInfo: [],
    setDebugInfo: (info) => set({ debugInfo: info }),

    // ─── Worker ──────────────────────────────────────
    worker: null,
    setWorker: (worker) => set({ worker }),
    sendToWorker: (msg) => get().worker?.postMessage(msg),

    // ─── Actions ─────────────────────────────────────
    play: () => {
        set({ status: SimStatus.Running });
        get().worker?.postMessage({ type: 'PLAY' });
    },
    pause: () => {
        set({ status: SimStatus.Paused });
        get().worker?.postMessage({ type: 'PAUSE' });
    },
    step: () => {
        set({ status: SimStatus.Paused });
        get().worker?.postMessage({ type: 'STEP' });
    },
    reset: () => {
        const config = get().config;
        set({
            status: SimStatus.Stopped,
            tick: 0,
            agents: [],
            agentsHistory: [],
            selectedAgentId: null,
            debugInfo: [],
            analytics: {
                avgSpeed: 0,
                clusterCount: 0,
                coveragePercent: 0,
                convergence: 0,
                speedHistory: [],
                coverageHistory: [],
            },
        });
        get().worker?.postMessage({ type: 'RESET', config });
    },
}));
