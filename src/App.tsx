// ─── App Root ───────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from './core/store';
import { SimCanvas } from './visualization/SimCanvas';
import { Sidebar } from './ui/Sidebar';
import { StatsPanel } from './ui/StatsPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import type { WorkerOutMessage } from './workers/protocol';
import { computeAvgSpeed, computeClusterCount, computeCoverage, updateVisitGrid } from './utils/analytics';
import { AgentState } from './core/types';

const COVERAGE_CELL_SIZE = 20;

export default function App() {
  const config = useStore((s) => s.config);
  const setAgents = useStore((s) => s.setAgents);
  const setWorker = useStore((s) => s.setWorker);
  const updateAnalytics = useStore((s) => s.updateAnalytics);
  const setDebugInfo = useStore((s) => s.setDebugInfo);
  const obstacles = useStore((s) => s.obstacles);
  const play = useStore((s) => s.play);
  const pause = useStore((s) => s.pause);
  const reset = useStore((s) => s.reset);
  const step = useStore((s) => s.step);
  const selectedAgentId = useStore((s) => s.selectedAgentId);

  // Coverage grid
  const gridCols = Math.ceil(config.worldWidth / COVERAGE_CELL_SIZE);
  const gridRows = Math.ceil(config.worldHeight / COVERAGE_CELL_SIZE);
  const visitGrid = useRef(new Uint16Array(gridCols * gridRows));

  // Analytics throttle
  const analyticsCounter = useRef(0);

  // Reset heatmap when sim resets
  const prevTick = useRef(0);

  // Anomaly detection: track position history per agent
  // REMOVED: Now handled by worker

  // ─── Keyboard Shortcuts ───────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          const status = useStore.getState().status;
          status === 'running' ? pause() : play();
          break;
        }
        case 'KeyR': {
          e.preventDefault();
          reset();
          break;
        }
        case 'Period':
        case 'ArrowRight': {
          e.preventDefault();
          step();
          break;
        }
        case 'Escape': {
          useStore.getState().setSelectedAgentId(null);
          break;
        }
      }
    },
    [play, pause, reset, step],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ─── Debug Mode Toggle ────────────────────────────────────────
  // Enable debug data when force vectors are on or an agent is selected
  const layers = useStore((s) => s.layers);
  const prevDebugRef = useRef(false);

  useEffect(() => {
    const shouldDebug = layers.forceVectors || selectedAgentId !== null;
    if (shouldDebug !== prevDebugRef.current) {
      prevDebugRef.current = shouldDebug;
      const worker = useStore.getState().worker;
      worker?.postMessage({ type: 'SET_DEBUG', enabled: shouldDebug });
    }
  }, [layers.forceVectors, selectedAgentId]);

  // Initialize Web Worker
  useEffect(() => {
    const existing = useStore.getState().worker;
    if (existing) existing.terminate();

    const worker = new Worker(
      new URL('./workers/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      if (msg.type === 'TICK') {
        // Detect reset
        if (msg.tick <= 1 && prevTick.current > 1) {
          visitGrid.current.fill(0);
        }
        prevTick.current = msg.tick;

        const agents = msg.agents;

        // Store debug info if present
        if (msg.debugInfo) {
          setDebugInfo(msg.debugInfo);
        }

        setAgents(agents, msg.tick);

        // Update coverage grid
        updateVisitGrid(agents, visitGrid.current, COVERAGE_CELL_SIZE, gridCols);

        // Throttled analytics
        analyticsCounter.current++;
        if (analyticsCounter.current % 6 === 0) {
          const avgSpeed = computeAvgSpeed(agents);
          const clusterCount = computeClusterCount(agents, 60);
          const coveragePercent = computeCoverage(visitGrid.current, gridCols, gridRows);

          const store = useStore.getState();
          const speedHistory = [...store.analytics.speedHistory, avgSpeed].slice(-120);
          const coverageHistory = [...store.analytics.coverageHistory, coveragePercent].slice(-120);

          updateAnalytics({
            avgSpeed,
            clusterCount,
            coveragePercent,
            speedHistory,
            coverageHistory,
          });
        }
      }
    };

    setWorker(worker);

    worker.postMessage({
      type: 'INIT',
      config,
      agents: [],
      obstacles,
    });

    return () => {
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <SimCanvas />
        <StatsPanel />
      </main>
      <InspectorPanel />
    </div>
  );
}
