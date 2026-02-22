// ─── Stats Panel ────────────────────────────────────────────────

import { useStore } from '../core/store';
import { AlgorithmType } from '../core/types';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export function StatsPanel() {
    const analytics = useStore((s) => s.analytics);
    const agents = useStore((s) => s.agents);
    const tick = useStore((s) => s.tick);
    const algorithm = useStore((s) => s.config.algorithm);

    const speedData = analytics.speedHistory.slice(-60).map((v, i) => ({ i, v }));
    const coverageData = analytics.coverageHistory.slice(-60).map((v, i) => ({ i, v }));

    // Count active vs returning/converged agents
    const activeCount = agents.filter((a) => a.state === 0).length;
    const stuckCount = agents.length - activeCount;

    // Algorithm-specific label
    const stuckLabel =
        algorithm === AlgorithmType.AntColony
            ? 'RETURN'
            : algorithm === AlgorithmType.PSO
                ? 'CONVGD'
                : 'STUCK';

    return (
        <div className="stats-panel">
            <div className="stats-grid">
                <MetricCard
                    label="AGENTS"
                    value={agents.length.toString()}
                    color="#58a6ff"
                />
                <MetricCard
                    label="ACTIVE"
                    value={activeCount.toString()}
                    color="#3fb950"
                />
                <MetricCard
                    label={stuckLabel}
                    value={stuckCount.toString()}
                    color="#d29922"
                />
                <MetricCard
                    label="AVG SPEED"
                    value={analytics.avgSpeed.toFixed(2)}
                    color="#3fb950"
                />
                <MetricCard
                    label="CLUSTERS"
                    value={analytics.clusterCount.toString()}
                    color="#d29922"
                />
                <MetricCard
                    label="COVERAGE"
                    value={`${analytics.coveragePercent.toFixed(1)}%`}
                    color="#bc8cff"
                />
                <MetricCard
                    label="TICK"
                    value={tick.toString()}
                    color="#8b949e"
                />
            </div>

            {/* Sparklines */}
            <div className="sparkline-row">
                {speedData.length > 2 && (
                    <div className="sparkline-container">
                        <span className="sparkline-label">Speed</span>
                        <ResponsiveContainer width="100%" height={36}>
                            <LineChart data={speedData}>
                                <YAxis hide domain={['dataMin', 'dataMax']} />
                                <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke="#3fb950"
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {coverageData.length > 2 && (
                    <div className="sparkline-container">
                        <span className="sparkline-label">Coverage</span>
                        <ResponsiveContainer width="100%" height={36}>
                            <LineChart data={coverageData}>
                                <YAxis hide domain={[0, 100]} />
                                <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke="#bc8cff"
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="shortcuts-hint">
                <span>Space = Play/Pause</span>
                <span>R=Reset</span>
                <span>→=Step</span>
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="metric-card">
            <span className="metric-value" style={{ color }}>{value}</span>
            <span className="metric-label">{label}</span>
        </div>
    );
}
