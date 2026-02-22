// ─── Agent Inspector Panel ──────────────────────────────────────
// Shows detailed debug information for the selected agent.
// Click on an agent in the canvas to select, press Escape to deselect.

import { useStore } from '../core/store';
import { AgentState, AlgorithmType } from '../core/types';

export function InspectorPanel() {
    const selectedId = useStore((s) => s.selectedAgentId);
    const agents = useStore((s) => s.agents);
    const debugInfo = useStore((s) => s.debugInfo);
    const config = useStore((s) => s.config);
    const setSelectedAgentId = useStore((s) => s.setSelectedAgentId);

    if (selectedId === null) return null;

    const agent = agents.find((a) => a.id === selectedId);
    if (!agent) return null;

    const debug = debugInfo.find((d) => d.id === selectedId);

    const stateLabel =
        agent.state === AgentState.Anomaly ? 'ANOMALY' :
            agent.state === AgentState.Stuck ? (
                config.algorithm === AlgorithmType.AntColony ? 'RETURNING' :
                    config.algorithm === AlgorithmType.PSO ? 'CONVERGED' : 'STUCK'
            ) : 'ACTIVE';

    const stateColor =
        agent.state === AgentState.Anomaly ? '#f85149' :
            agent.state === AgentState.Stuck ? '#d29922' : '#3fb950';

    return (
        <aside className="inspector-panel">
            <div className="inspector-header">
                <h3>Agent Inspector</h3>
                <button
                    className="inspector-close"
                    onClick={() => setSelectedAgentId(null)}
                    title="Close (Esc)"
                >
                    X
                </button>
            </div>

            <div className="inspector-section">
                <div className="inspector-row">
                    <span className="inspector-label">ID</span>
                    <span className="inspector-value">{agent.id}</span>
                </div>
                <div className="inspector-row">
                    <span className="inspector-label">STATE</span>
                    <span className="inspector-value" style={{ color: stateColor, fontWeight: 700 }}>
                        {stateLabel}
                    </span>
                </div>
                <div className="inspector-row">
                    <span className="inspector-label">POS</span>
                    <span className="inspector-value">
                        ({agent.x.toFixed(0)}, {agent.y.toFixed(0)})
                    </span>
                </div>
                <div className="inspector-row">
                    <span className="inspector-label">VEL</span>
                    <span className="inspector-value">
                        ({agent.vx.toFixed(2)}, {agent.vy.toFixed(2)})
                    </span>
                </div>
                <div className="inspector-row">
                    <span className="inspector-label">SPEED</span>
                    <span className="inspector-value">
                        {Math.sqrt(agent.vx ** 2 + agent.vy ** 2).toFixed(2)}
                    </span>
                </div>
                <div className="inspector-row">
                    <span className="inspector-label">HEADING</span>
                    <span className="inspector-value">
                        {(agent.heading * 180 / Math.PI).toFixed(0)} deg
                    </span>
                </div>
            </div>

            {debug && (
                <>
                    <div className="inspector-section">
                        <h4 className="inspector-subtitle">Forces</h4>
                        {debug.forces.map((f, i) => {
                            const mag = Math.sqrt(f.x * f.x + f.y * f.y);
                            return (
                                <div className="inspector-row" key={i}>
                                    <span className="inspector-label" style={{ color: f.color }}>
                                        {f.label}
                                    </span>
                                    <span className="inspector-value">
                                        {mag.toFixed(3)}
                                    </span>
                                    <div
                                        className="force-bar"
                                        style={{
                                            width: `${Math.min(mag * 40, 100)}%`,
                                            backgroundColor: f.color,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {Object.keys(debug.meta).length > 0 && (
                        <div className="inspector-section">
                            <h4 className="inspector-subtitle">Metadata</h4>
                            {Object.entries(debug.meta).map(([key, val]) => (
                                <div className="inspector-row" key={key}>
                                    <span className="inspector-label">{key.toUpperCase()}</span>
                                    <span className="inspector-value">{String(val)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="inspector-hint">
                Click another agent to switch / Esc to close
            </div>
        </aside>
    );
}
