// ─── Analytics Utilities ────────────────────────────────────────

import type { Agent } from '../core/types';
import { mag } from './vector';

/** Compute average speed of all agents. */
export function computeAvgSpeed(agents: Agent[]): number {
    if (agents.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < agents.length; i++) {
        total += mag({ x: agents[i].vx, y: agents[i].vy });
    }
    return total / agents.length;
}

/** Simple cluster count via connected components with distance threshold. */
export function computeClusterCount(agents: Agent[], radius: number): number {
    if (agents.length === 0) return 0;

    const visited = new Set<number>();
    let clusters = 0;
    const r2 = radius * radius;

    function bfs(startIdx: number) {
        const queue: number[] = [startIdx];
        visited.add(startIdx);

        while (queue.length > 0) {
            const idx = queue.pop()!;
            const a = agents[idx];

            for (let i = 0; i < agents.length; i++) {
                if (visited.has(i)) continue;
                const b = agents[i];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                if (dx * dx + dy * dy <= r2) {
                    visited.add(i);
                    queue.push(i);
                }
            }
        }
    }

    for (let i = 0; i < agents.length; i++) {
        if (!visited.has(i)) {
            bfs(i);
            clusters++;
        }
    }

    return clusters;
}

/** Compute what % of the world grid cells have been visited. */
export function computeCoverage(
    visitGrid: Uint16Array,
    gridCols: number,
    gridRows: number,
): number {
    let visited = 0;
    const total = gridCols * gridRows;
    for (let i = 0; i < total; i++) {
        if (visitGrid[i] > 0) visited++;
    }
    return (visited / total) * 100;
}

/** Update the visit grid with current agent positions. */
export function updateVisitGrid(
    agents: Agent[],
    visitGrid: Uint16Array,
    cellSize: number,
    gridCols: number,
): void {
    for (let i = 0; i < agents.length; i++) {
        const cx = Math.floor(agents[i].x / cellSize);
        const cy = Math.floor(agents[i].y / cellSize);
        const idx = cy * gridCols + cx;
        if (idx >= 0 && idx < visitGrid.length) {
            // Cap at max Uint16 to prevent overflow
            if (visitGrid[idx] < 65535) visitGrid[idx]++;
        }
    }
}
