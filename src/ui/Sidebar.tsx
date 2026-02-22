// ─── Sidebar Controls ───────────────────────────────────────────

import { useStore } from '../core/store';
import { AlgorithmType, SimStatus } from '../core/types';
import type { SimConfig } from '../core/types';

// ─── Scenario Presets ───────────────────────────────────────────
interface Preset {
    name: string;
    icon: string;
    description: string;
    config: Partial<SimConfig>;
}

const PRESETS: Preset[] = [
    {
        name: 'Classic Flock',
        icon: 'FL',
        description: 'Reynolds flocking with balanced forces',
        config: {
            algorithm: AlgorithmType.Boids,
            agentCount: 200,
            separationWeight: 1.5,
            alignmentWeight: 1.0,
            cohesionWeight: 1.0,
            maxSpeed: 3,
            speedMultiplier: 1.0,
        },
    },
    {
        name: 'Tight Swarm',
        icon: 'SW',
        description: 'High cohesion, tight clustering',
        config: {
            algorithm: AlgorithmType.Boids,
            agentCount: 400,
            separationWeight: 0.8,
            alignmentWeight: 1.5,
            cohesionWeight: 3.0,
            maxSpeed: 2.5,
            speedMultiplier: 1.0,
            neighborRadius: 100,
        },
    },
    {
        name: 'Chaos Mode',
        icon: 'CX',
        description: 'High separation, fast — barely coherent',
        config: {
            algorithm: AlgorithmType.Boids,
            agentCount: 500,
            separationWeight: 4.0,
            alignmentWeight: 0.2,
            cohesionWeight: 0.1,
            maxSpeed: 6,
            speedMultiplier: 2.0,
        },
    },
    {
        name: 'Ant Foragers',
        icon: 'AC',
        description: 'Ants search for food and lay pheromone trails',
        config: {
            algorithm: AlgorithmType.AntColony,
            agentCount: 150,
            maxSpeed: 2,
            speedMultiplier: 1.5,
        },
    },
    {
        name: 'PSO Search',
        icon: 'PS',
        description: 'Particles converging to fitness minima',
        config: {
            algorithm: AlgorithmType.PSO,
            agentCount: 100,
            maxSpeed: 4,
            speedMultiplier: 1.0,
        },
    },
];

export function Sidebar() {
    const config = useStore((s) => s.config);
    const setConfig = useStore((s) => s.setConfig);
    const status = useStore((s) => s.status);
    const play = useStore((s) => s.play);
    const pause = useStore((s) => s.pause);
    const step = useStore((s) => s.step);
    const stepBack = useStore((s) => s.stepBack);
    const reset = useStore((s) => s.reset);
    const layers = useStore((s) => s.layers);
    const toggleLayer = useStore((s) => s.toggleLayer);
    const clearObstacles = useStore((s) => s.clearObstacles);
    const tick = useStore((s) => s.tick);
    const agents = useStore((s) => s.agents);
    const obstacles = useStore((s) => s.obstacles);

    const handleAlgorithmChange = (algo: AlgorithmType) => {
        setConfig({ algorithm: algo });
        // Auto-reset so the new algorithm starts fresh
        setTimeout(() => reset(), 50);
    };

    const applyPreset = (preset: Preset) => {
        setConfig(preset.config);
        setTimeout(() => reset(), 50);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="logo">
                    <span className="logo-icon">⬡</span>
                    HIVEMIND
                </h1>
                <span className="version">v0.2.0</span>
            </div>

            {/* Transport Controls */}
            <section className="panel">
                <h3 className="panel-title">Controls</h3>
                <div className="transport-controls">
                    {status !== SimStatus.Running ? (
                        <button className="btn btn-primary" onClick={play} title="Play">
                            ▶ Play
                        </button>
                    ) : (
                        <button className="btn btn-warning" onClick={pause} title="Pause">
                            ⏸ Pause
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={stepBack} title="Step Back (Ctrl+←)">
                        ⏮ Back
                    </button>
                    <button className="btn btn-secondary" onClick={step} title="Step Forward (Ctrl+→)">
                        ⏭ Step
                    </button>
                    <button className="btn btn-danger" onClick={reset} title="Reset">
                        ↺ Reset
                    </button>
                </div>
                <div className="status-bar">
                    <span className={`status-dot ${status}`} />
                    <span className="status-label">{status.toUpperCase()}</span>
                    <span className="tick-counter">Tick: {tick}</span>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className={`btn ${config.speedMultiplier === 0.1 ? 'btn-warning' : 'btn-secondary'}`}
                        style={{ fontSize: '10px', padding: '4px 8px', flex: 1 }}
                        onClick={() => setConfig({ speedMultiplier: config.speedMultiplier === 0.1 ? 1.0 : 0.1 })}
                    >
                        🎬 Cinema (0.1x)
                    </button>
                </div>
            </section>

            {/* Algorithm Selection */}
            <section className="panel">
                <h3 className="panel-title">Algorithm</h3>
                <select
                    className="select"
                    value={config.algorithm}
                    onChange={(e) => handleAlgorithmChange(e.target.value as AlgorithmType)}
                >
                    <option value={AlgorithmType.Boids}>Boids (Reynolds Flocking)</option>
                    <option value={AlgorithmType.AntColony}>Ant Colony Optimization</option>
                    <option value={AlgorithmType.PSO}>Particle Swarm Optimization (PSO)</option>
                </select>
            </section>

            {/* Scenario Presets */}
            <section className="panel">
                <h3 className="panel-title">Scenarios</h3>
                <div className="presets-grid">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.name}
                            className="preset-btn"
                            onClick={() => applyPreset(preset)}
                            title={preset.description}
                        >
                            <span className="preset-icon">{preset.icon}</span>
                            <span className="preset-name">{preset.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Parameters */}
            <section className="panel">
                <h3 className="panel-title">Parameters</h3>

                <SliderControl
                    label="Agents"
                    value={config.agentCount}
                    min={10} max={2000} step={10}
                    onChange={(v) => setConfig({ agentCount: v })}
                    disabled={status === SimStatus.Running}
                />
                <SliderControl
                    label="Speed"
                    value={config.speedMultiplier}
                    min={0.1} max={4} step={0.1}
                    onChange={(v) => setConfig({ speedMultiplier: v })}
                />
                <SliderControl
                    label="Max Speed"
                    value={config.maxSpeed}
                    min={0.5} max={8} step={0.5}
                    onChange={(v) => setConfig({ maxSpeed: v })}
                />

                {/* Boids-specific parameters */}
                {config.algorithm === AlgorithmType.Boids && (
                    <>
                        <div className="param-divider" />
                        <p className="param-section-title">Boids Forces</p>
                        <SliderControl
                            label="Separation"
                            value={config.separationWeight}
                            min={0} max={5} step={0.1}
                            onChange={(v) => setConfig({ separationWeight: v })}
                        />
                        <SliderControl
                            label="Alignment"
                            value={config.alignmentWeight}
                            min={0} max={5} step={0.1}
                            onChange={(v) => setConfig({ alignmentWeight: v })}
                        />
                        <SliderControl
                            label="Cohesion"
                            value={config.cohesionWeight}
                            min={0} max={5} step={0.1}
                            onChange={(v) => setConfig({ cohesionWeight: v })}
                        />
                        <SliderControl
                            label="Sep. Radius"
                            value={config.separationRadius}
                            min={5} max={100} step={5}
                            onChange={(v) => setConfig({ separationRadius: v })}
                        />
                        <SliderControl
                            label="Neighbor Radius"
                            value={config.neighborRadius}
                            min={10} max={200} step={10}
                            onChange={(v) => setConfig({ neighborRadius: v })}
                        />
                    </>
                )}

                {/* ACO info */}
                {config.algorithm === AlgorithmType.AntColony && (
                    <>
                        <div className="param-divider" />
                        <p className="param-section-title">Ant Colony</p>
                        <p className="hint">
                            Amber = returning to nest with food<br />
                            Blue = searching for food<br />
                            Red = stuck (anomaly detected)
                        </p>
                    </>
                )}

                {/* PSO info */}
                {config.algorithm === AlgorithmType.PSO && (
                    <>
                        <div className="param-divider" />
                        <p className="param-section-title">Particle Swarm</p>
                        <p className="hint">
                            Amber = converged near target<br />
                            Blue = still searching<br />
                            Red = stuck (anomaly detected)
                        </p>
                    </>
                )}
            </section>

            {/* Visualization Layers */}
            <section className="panel">
                <h3 className="panel-title">Layers</h3>
                <LayerToggle label="Agents" active={layers.agents} onToggle={() => toggleLayer('agents')} />
                <LayerToggle label="Trails" active={layers.trails} onToggle={() => toggleLayer('trails')} />
                <LayerToggle label="Communication" active={layers.communication} onToggle={() => toggleLayer('communication')} />
                <LayerToggle label="Heatmap" active={layers.heatmap} onToggle={() => toggleLayer('heatmap')} />
                <LayerToggle label="Obstacles" active={layers.obstacles} onToggle={() => toggleLayer('obstacles')} />
                <LayerToggle label="Force Vectors" active={layers.forceVectors} onToggle={() => toggleLayer('forceVectors')} />
                <LayerToggle label="Voronoi Partition" active={layers.voronoi} onToggle={() => toggleLayer('voronoi')} />
            </section>

            {/* Obstacles */}
            <section className="panel">
                <h3 className="panel-title">Obstacles</h3>
                <p className="hint">Click on the canvas to place obstacles</p>
                <button className="btn btn-secondary btn-full" onClick={clearObstacles}>
                    Clear All Obstacles
                </button>
            </section>
            {/* Data Export */}
            <section className="panel">
                <h3 className="panel-title">Data Export</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={exportJSON}>
                        ⬇ JSON
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={exportCSV}>
                        ⬇ CSV
                    </button>
                </div>
                <p className="hint-text" style={{ marginTop: '8px' }}>
                    Export current swarm state.
                </p>
            </section>
        </aside>
    );

    function exportJSON() {
        const data = JSON.stringify({
            config,
            tick,
            agents,
            obstacles,
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hivemind-state-${tick}.json`;
        a.click();
    }

    function exportCSV() {
        const headers = 'id,x,y,heading,state\n';
        const rows = agents.map(a => `${a.id},${a.x.toFixed(2)},${a.y.toFixed(2)},${a.heading.toFixed(4)},${a.state}`).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hivemind-swarm-${tick}.csv`;
        a.click();
    }
}

// ─── Sub-components ─────────────────────────────────────────────

function SliderControl({
    label,
    value,
    min,
    max,
    step,
    onChange,
    disabled,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="slider-control">
            <div className="slider-header">
                <span className="slider-label">{label}</span>
                <span className="slider-value">{value.toFixed(step < 1 ? 1 : 0)}</span>
            </div>
            <input
                type="range"
                className="slider"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                disabled={disabled}
            />
        </div>
    );
}

function LayerToggle({
    label,
    active,
    onToggle,
}: {
    label: string;
    active: boolean;
    onToggle: () => void;
}) {
    return (
        <label className="layer-toggle">
            <input type="checkbox" checked={active} onChange={onToggle} />
            <span className={`toggle-indicator ${active ? 'active' : ''}`} />
            <span className="toggle-label">{label}</span>
        </label>
    );
}
