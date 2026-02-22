// ─── Swarm Algorithm Interface ──────────────────────────────────

import type { Agent, SimConfig, Obstacle, AgentDebugInfo } from '../core/types';
import type { SpatialHash } from '../utils/spatialHash';

export interface SwarmAlgorithm {
    /** Compute updated agents for one simulation tick. */
    tick(
        agents: Agent[],
        config: SimConfig,
        obstacles: Obstacle[],
        spatialHash: SpatialHash,
    ): Agent[];

    /**
     * Return debug info (force breakdown + metadata) for all agents.
     * Called after tick() when debug mode is active.
     * Returns empty array if not implemented.
     */
    getDebugInfo(): AgentDebugInfo[];
}
