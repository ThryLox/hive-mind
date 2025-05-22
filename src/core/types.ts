// ─── Core Types ─────────────────────────────────────────────────

export interface Vec2 {
    x: number;
    y: number;
}

export interface Agent {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    heading: number; // radians
    state: AgentState;
}

export const AgentState = {
    Active: 0,
    Stuck: 1,
    Anomaly: 2,
} as const;
export type AgentState = (typeof AgentState)[keyof typeof AgentState];

export const AlgorithmType = {
    Boids: 'boids',
    AntColony: 'antColony',
    PSO: 'pso',
} as const;
export type AlgorithmType = (typeof AlgorithmType)[keyof typeof AlgorithmType];

export interface Obstacle {
    id: number;
    x: number;
    y: number;
    radius: number;
    type: 'circle' | 'rect';
    width?: number;
    height?: number;
}

export interface SimConfig {
    algorithm: AlgorithmType;
    agentCount: number;
    worldWidth: number;
    worldHeight: number;
    maxSpeed: number;
    maxForce: number;

    // Boids params
    separationWeight: number;
    alignmentWeight: number;
    cohesionWeight: number;
    separationRadius: number;
    neighborRadius: number;

    // General
    communicationRange: number;
    trailLength: number;
    speedMultiplier: number;
}

export const SimStatus = {
    Stopped: 'stopped',
    Running: 'running',
    Paused: 'paused',
} as const;
export type SimStatus = (typeof SimStatus)[keyof typeof SimStatus];

export interface SimState {
    agents: Agent[];
    tick: number;
    status: SimStatus;
}

export interface AnalyticsState {
    avgSpeed: number;
    clusterCount: number;
    coveragePercent: number;
    convergence: number;
    speedHistory: number[];
    coverageHistory: number[];
}

// ─── Debug / Force Vector Types ─────────────────────────────────

/** A single named force acting on an agent */
export interface ForceVector {
    label: string;
    x: number;
    y: number;
    color: string;
}

/** Debug info for a single agent, returned by algorithms */
export interface AgentDebugInfo {
    id: number;
    forces: ForceVector[];
    /** Algorithm-specific key-value metadata */
    meta: Record<string, string | number>;
}

// ─── Visualization Layers ───────────────────────────────────────
export interface LayerVisibility {
    agents: boolean;
    trails: boolean;
    communication: boolean;
    heatmap: boolean;
    obstacles: boolean;
    forceVectors: boolean;
    voronoi: boolean;
}

export const DEFAULT_CONFIG: SimConfig = {
    algorithm: AlgorithmType.Boids,
    agentCount: 200,
    worldWidth: 1200,
    worldHeight: 800,
    maxSpeed: 3,
    maxForce: 0.15,
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    separationRadius: 30,
    neighborRadius: 60,
    communicationRange: 80,
    trailLength: 30,
    speedMultiplier: 1.0,
};

export const DEFAULT_LAYERS: LayerVisibility = {
    agents: true,
    trails: false,
    communication: false,
    heatmap: false,
    obstacles: true,
    forceVectors: false,
    voronoi: false,
};
