// ─── Grid-based Spatial Hash ────────────────────────────────────
// O(1) neighbor queries for uniform-density swarms.
// Cell size = communication/neighbor radius for optimal performance.

import type { Agent } from '../core/types';

export class SpatialHash {
    private cellSize: number;
    private grid: Map<string, Agent[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    private key(cx: number, cy: number): string {
        return `${cx},${cy}`;
    }

    private cellCoords(x: number, y: number): [number, number] {
        return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
    }

    clear(): void {
        this.grid.clear();
    }

    insert(agent: Agent): void {
        const [cx, cy] = this.cellCoords(agent.x, agent.y);
        const k = this.key(cx, cy);
        const cell = this.grid.get(k);
        if (cell) {
            cell.push(agent);
        } else {
            this.grid.set(k, [agent]);
        }
    }

    insertAll(agents: Agent[]): void {
        this.clear();
        for (let i = 0; i < agents.length; i++) {
            this.insert(agents[i]);
        }
    }

    /** Query all agents within `radius` of point (x, y), excluding agent with `excludeId`. */
    queryRadius(x: number, y: number, radius: number, excludeId: number = -1): Agent[] {
        const results: Agent[] = [];
        const r2 = radius * radius;
        const [cx, cy] = this.cellCoords(x, y);
        // How many cells to check based on radius
        const span = Math.ceil(radius / this.cellSize);

        for (let dx = -span; dx <= span; dx++) {
            for (let dy = -span; dy <= span; dy++) {
                const cell = this.grid.get(this.key(cx + dx, cy + dy));
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) {
                    const a = cell[i];
                    if (a.id === excludeId) continue;
                    const ddx = a.x - x;
                    const ddy = a.y - y;
                    if (ddx * ddx + ddy * ddy <= r2) {
                        results.push(a);
                    }
                }
            }
        }

        return results;
    }
}
