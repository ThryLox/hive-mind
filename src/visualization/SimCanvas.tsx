// ─── Canvas Renderer Component ──────────────────────────────────
// Renders agents, trails, obstacles, communication links, heatmap,
// algorithm-specific markers, force vectors, and selected agent highlight.

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../core/store';
import type { Agent, Obstacle, SimConfig, AgentDebugInfo } from '../core/types';
import { AgentState, AlgorithmType } from '../core/types';
import { SpatialHash } from '../utils/spatialHash';

const AGENT_SIZE = 6;
const TRAIL_ALPHA = 0.3;
const COMM_ALPHA = 0.08;
const COMM_MAX_AGENTS = 1200; // performance ceiling for links

export function SimCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const agents = useStore((s) => s.agents);
    const obstacles = useStore((s) => s.obstacles);
    const layers = useStore((s) => s.layers);
    const config = useStore((s) => s.config);
    const addObstacle = useStore((s) => s.addObstacle);
    const selectedAgentId = useStore((s) => s.selectedAgentId);
    const setSelectedAgentId = useStore((s) => s.setSelectedAgentId);
    const debugInfo = useStore((s) => s.debugInfo);

    // Trail history buffer
    const trailBuffer = useRef<Map<number, Array<{ x: number; y: number }>>>(new Map());

    // Spatial hash for main-thread rendering optimizations (links, etc.)
    const renderHash = useMemo(() => new SpatialHash(config.communicationRange || 50), [config.communicationRange]);

    // Handle click: select agent (if near one) or place obstacle
    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            // Check if click is near an agent
            const currentAgents = useStore.getState().agents;
            let closestId = -1;
            let closestDist = 15 * 15;
            for (let i = 0; i < currentAgents.length; i++) {
                const a = currentAgents[i];
                const dx = a.x - clickX;
                const dy = a.y - clickY;
                const d2 = dx * dx + dy * dy;
                if (d2 < closestDist) {
                    closestDist = d2;
                    closestId = a.id;
                }
            }

            if (closestId >= 0) {
                const currentSel = useStore.getState().selectedAgentId;
                setSelectedAgentId(currentSel === closestId ? null : closestId);
            } else {
                addObstacle(clickX, clickY);
            }
        },
        [addObstacle, setSelectedAgentId],
    );

    // Update spatial hash and trail buffer on each tick
    useEffect(() => {
        // Update hash for links
        if (layers.communication && agents.length <= COMM_MAX_AGENTS) {
            renderHash.insertAll(agents);
        }

        // Update trails
        if (layers.trails) {
            const buf = trailBuffer.current;
            for (const agent of agents) {
                let trail = buf.get(agent.id);
                if (!trail) {
                    trail = [];
                    buf.set(agent.id, trail);
                }
                trail.push({ x: agent.x, y: agent.y });
                if (trail.length > config.trailLength) {
                    trail.shift();
                }
            }
        }
    }, [agents, layers.trails, layers.communication, config.trailLength, renderHash]);

    // Heatmap visit grid
    const HEATMAP_CELL = 20;
    const heatmapCols = Math.ceil(config.worldWidth / HEATMAP_CELL);
    const heatmapRows = Math.ceil(config.worldHeight / HEATMAP_CELL);
    const visitGrid = useRef<Uint16Array>(new Uint16Array(heatmapCols * heatmapRows));

    useEffect(() => {
        if (!layers.heatmap) return;
        const grid = visitGrid.current;
        for (let i = 0; i < agents.length; i++) {
            const cx = Math.floor(agents[i].x / HEATMAP_CELL);
            const cy = Math.floor(agents[i].y / HEATMAP_CELL);
            const idx = cy * heatmapCols + cx;
            if (idx >= 0 && idx < grid.length && grid[idx] < 65535) {
                grid[idx]++;
            }
        }
    }, [agents, layers.heatmap, heatmapCols, HEATMAP_CELL]);

    // Build debug lookup for force vectors
    const debugMap = useMemo(() => {
        const m = new Map<number, AgentDebugInfo>();
        for (const d of debugInfo) {
            m.set(d.id, d);
        }
        return m;
    }, [debugInfo]);

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = config.worldWidth;
        canvas.height = config.worldHeight;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, config.worldWidth, config.worldHeight);

        if (layers.heatmap) {
            drawHeatmap(ctx, visitGrid.current, heatmapCols, heatmapRows, HEATMAP_CELL);
        }

        drawAlgorithmMarkers(ctx, config);

        if (layers.voronoi && agents.length > 0) {
            drawVoronoi(ctx, config.worldWidth, config.worldHeight, renderHash);
        }

        if (layers.obstacles) {
            drawObstacles(ctx, obstacles);
        }

        if (layers.communication && agents.length <= COMM_MAX_AGENTS) {
            drawCommunication(ctx, agents, config.communicationRange, renderHash);
        }

        if (layers.trails) {
            drawTrails(ctx, trailBuffer.current);
        }

        if (layers.agents) {
            drawAgents(ctx, agents, selectedAgentId);
        }

        if (layers.forceVectors && debugMap.size > 0) {
            drawForceVectors(ctx, agents, debugMap);
        }

        if (selectedAgentId !== null) {
            const selected = agents.find(a => a.id === selectedAgentId);
            if (selected) {
                drawSelectedHighlight(ctx, selected);
                const selDebug = debugMap.get(selectedAgentId);
                if (selDebug) {
                    drawAgentForceDetail(ctx, selected, selDebug);
                }
            }
        }
    }, [agents, obstacles, layers, config, selectedAgentId, debugMap, heatmapCols, heatmapRows, HEATMAP_CELL, renderHash]);

    return (
        <div className="canvas-container">
            <canvas
                ref={canvasRef}
                className="sim-canvas"
                onClick={handleClick}
                title="Click agent to inspect, click empty space to place obstacle"
            />
        </div>
    );
}

// ─── Drawing Functions ─────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.3)';
    ctx.lineWidth = 0.5;
    const cellSize = 50;

    for (let x = 0; x <= w; x += cellSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += cellSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
}

function drawAgents(ctx: CanvasRenderingContext2D, agents: Agent[], selectedId: number | null) {
    for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.heading);
        ctx.beginPath();
        ctx.moveTo(AGENT_SIZE, 0);
        ctx.lineTo(-AGENT_SIZE * 0.6, -AGENT_SIZE * 0.5);
        ctx.lineTo(-AGENT_SIZE * 0.6, AGENT_SIZE * 0.5);
        ctx.closePath();

        let color = a.state === AgentState.Anomaly ? '#f85149'
            : a.state === AgentState.Stuck ? '#d29922'
                : '#58a6ff';
        if (a.id === selectedId) color = '#ffffff';

        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowColor = color;
        ctx.shadowBlur = a.id === selectedId ? 10 : 4;
        ctx.fill();
        ctx.restore();
    }
}

function drawSelectedHighlight(ctx: CanvasRenderingContext2D, agent: Agent) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ID:${agent.id}`, agent.x, agent.y - 22);
    ctx.restore();
}

function drawForceVectors(
    ctx: CanvasRenderingContext2D,
    agents: Agent[],
    debugMap: Map<number, AgentDebugInfo>,
) {
    const forceScale = 30;
    const maxAgentsToDraw = 300; // Cap for overlay to preserve FPS

    for (let i = 0; i < Math.min(agents.length, maxAgentsToDraw); i++) {
        const agent = agents[i];
        const info = debugMap.get(agent.id);
        if (!info) continue;

        for (const f of info.forces) {
            const mag = Math.sqrt(f.x * f.x + f.y * f.y);
            if (mag < 0.05) continue;
            const endX = agent.x + f.x * forceScale;
            const endY = agent.y + f.y * forceScale;
            ctx.save();
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.moveTo(agent.x, agent.y); ctx.lineTo(endX, endY); ctx.stroke();
            const angle = Math.atan2(f.y, f.x);
            const hl = 4;
            ctx.beginPath(); ctx.moveTo(endX, endY);
            ctx.lineTo(endX - hl * Math.cos(angle - 0.4), endY - hl * Math.sin(angle - 0.4));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - hl * Math.cos(angle + 0.4), endY - hl * Math.sin(angle + 0.4));
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawAgentForceDetail(ctx: CanvasRenderingContext2D, agent: Agent, info: AgentDebugInfo) {
    const forceScale = 50;
    let labelOffset = 0;
    for (const f of info.forces) {
        const mag = Math.sqrt(f.x * f.x + f.y * f.y);
        if (mag < 0.001) continue;
        const endX = agent.x + f.x * forceScale;
        const endY = agent.y + f.y * forceScale;
        ctx.save();
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(agent.x, agent.y); ctx.lineTo(endX, endY); ctx.stroke();
        const angle = Math.atan2(f.y, f.x);
        const hl = 7;
        ctx.beginPath(); ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle - 0.4), endY - hl * Math.sin(angle - 0.4));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle + 0.4), endY - hl * Math.sin(angle + 0.4));
        ctx.stroke();
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = f.color;
        ctx.textAlign = 'left';
        ctx.fillText(`${f.label} ${mag.toFixed(2)}`, endX + 4, endY + labelOffset);
        labelOffset += 10;
        ctx.restore();
    }
}

function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[]) {
    for (const obs of obstacles) {
        ctx.beginPath(); ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(248, 81, 73, 0.15)'; ctx.fill();
        ctx.strokeStyle = 'rgba(248, 81, 73, 0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(248, 81, 73, 0.8)'; ctx.lineWidth = 2; const s = 5;
        ctx.beginPath(); ctx.moveTo(obs.x - s, obs.y - s); ctx.lineTo(obs.x + s, obs.y + s);
        ctx.moveTo(obs.x + s, obs.y - s); ctx.lineTo(obs.x - s, obs.y + s); ctx.stroke();
    }
}

function drawTrails(ctx: CanvasRenderingContext2D, trails: Map<number, Array<{ x: number; y: number }>>) {
    ctx.lineWidth = 1;
    trails.forEach((trail) => {
        if (trail.length < 2) return;
        ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(88, 166, 255, ${TRAIL_ALPHA})`; ctx.stroke();
    });
}

function drawCommunication(ctx: CanvasRenderingContext2D, agents: Agent[], range: number, hash: SpatialHash) {
    ctx.strokeStyle = `rgba(139, 148, 158, ${COMM_ALPHA})`; ctx.lineWidth = 0.5;
    for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        const neighbors = hash.queryRadius(a.x, a.y, range, a.id);
        for (let j = 0; j < neighbors.length; j++) {
            const nb = neighbors[j];
            if (a.id < nb.id) {
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
            }
        }
    }
}

function drawHeatmap(ctx: CanvasRenderingContext2D, grid: Uint16Array, cols: number, rows: number, cellSize: number) {
    let maxVal = 1;
    for (let i = 0; i < grid.length; i++) if (grid[i] > maxVal) maxVal = grid[i];
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const val = grid[cy * cols + cx];
            if (val === 0) continue;
            const t = Math.min(val / maxVal, 1);
            let r: number, g: number, b: number;
            if (t < 0.25) { const s = t / 0.25; r = 0; g = Math.floor(s * 255); b = 255; }
            else if (t < 0.5) { const s = (t - 0.25) / 0.25; r = 0; g = 255; b = Math.floor(255 * (1 - s)); }
            else if (t < 0.75) { const s = (t - 0.5) / 0.25; r = Math.floor(s * 255); g = 255; b = 0; }
            else { const s = (t - 0.75) / 0.25; r = 255; g = Math.floor(255 * (1 - s)); b = 0; }
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
            ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
        }
    }
}

function drawVoronoi(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    hash: SpatialHash
) {
    const cellSize = 40;
    const cols = Math.ceil(w / cellSize);
    const rows = Math.ceil(h / cellSize);

    ctx.save();
    ctx.globalAlpha = 0.08;

    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const px = (cx + 0.5) * cellSize;
            const py = (cy + 0.5) * cellSize;

            // Query a large enough area to find a neighbor
            const neighbors = hash.queryRadius(px, py, 150);
            if (neighbors.length === 0) continue;

            let nearest = neighbors[0];
            let minDist2 = Infinity;

            for (let i = 0; i < neighbors.length; i++) {
                const n = neighbors[i];
                const dx = n.x - px;
                const dy = n.y - py;
                const d2 = dx * dx + dy * dy;
                if (d2 < minDist2) {
                    minDist2 = d2;
                    nearest = n;
                }
            }

            // Color based on agent state
            const color = nearest.state === AgentState.Anomaly ? '#f85149'
                : nearest.state === AgentState.Stuck ? '#d29922'
                    : '#58a6ff';

            ctx.fillStyle = color;
            ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
        }
    }
    ctx.restore();
}

function drawAlgorithmMarkers(ctx: CanvasRenderingContext2D, config: SimConfig) {
    if (config.algorithm === AlgorithmType.AntColony) drawACOMarkers(ctx, config);
    else if (config.algorithm === AlgorithmType.PSO) drawPSOMarkers(ctx, config);
}

function drawACOMarkers(ctx: CanvasRenderingContext2D, config: SimConfig) {
    const nestX = config.worldWidth * 0.12, nestY = config.worldHeight * 0.5;
    ctx.save();
    ctx.beginPath(); ctx.arc(nestX, nestY, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210, 153, 34, 0.15)'; ctx.fill();
    ctx.strokeStyle = 'rgba(210, 153, 34, 0.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke();
    ctx.fillStyle = '#d29922'; ctx.font = 'bold 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('NEST', nestX, nestY - 24); ctx.beginPath(); ctx.arc(nestX, nestY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210, 153, 34, 0.6)'; ctx.fill(); ctx.restore();
    const foodSources = [
        { x: config.worldWidth * 0.85, y: config.worldHeight * 0.2, r: 25 },
        { x: config.worldWidth * 0.80, y: config.worldHeight * 0.8, r: 25 },
        { x: config.worldWidth * 0.55, y: config.worldHeight * 0.12, r: 20 },
        { x: config.worldWidth * 0.60, y: config.worldHeight * 0.88, r: 20 },
        { x: config.worldWidth * 0.45, y: config.worldHeight * 0.5, r: 15 },
    ];
    for (let fi = 0; fi < foodSources.length; fi++) {
        const food = foodSources[fi];
        ctx.save(); ctx.beginPath(); ctx.arc(food.x, food.y, food.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(63, 185, 80, 0.1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(63, 185, 80, 0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke();
        ctx.fillStyle = 'rgba(63, 185, 80, 0.9)'; ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText('F' + (fi + 1), food.x, food.y); ctx.restore();
    }
}

function drawPSOMarkers(ctx: CanvasRenderingContext2D, config: SimConfig) {
    const labelPositions = [
        { label: 'T1', x: config.worldWidth * 0.25, y: config.worldHeight * 0.25 },
        { label: 'T2', x: config.worldWidth * 0.75, y: config.worldHeight * 0.75 },
        { label: 'T3', x: config.worldWidth * 0.5, y: config.worldHeight * 0.15 },
    ];
    for (const t of labelPositions) {
        ctx.save(); ctx.strokeStyle = 'rgba(188, 140, 255, 0.2)'; ctx.lineWidth = 1; const size = 15;
        ctx.beginPath(); ctx.moveTo(t.x - size, t.y); ctx.lineTo(t.x + size, t.y);
        ctx.moveTo(t.x, t.y - size); ctx.lineTo(t.x, t.y + size); ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(188, 140, 255, 0.15)'; ctx.stroke();
        ctx.fillStyle = 'rgba(188, 140, 255, 0.3)'; ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillText(t.label, t.x, t.y - 16); ctx.restore();
    }
}
