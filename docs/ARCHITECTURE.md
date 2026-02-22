# HIVEMIND — Architecture Analysis & Implementation Plan

> Swarm Intelligence Debugger & Visualizer

---

## 1. Feature Specification (MoSCoW)

### Must Have (MVP — Sprint 1-2)

| Feature | Description |
|---|---|
| **Simulation Engine** | Runs N agents with configurable behaviors in a Web Worker, decoupled from rendering |
| **Boids (Reynolds Flocking)** | Separation, alignment, cohesion with tunable weights |
| **2D Canvas Renderer** | Draws agents as triangles/arrows showing position + heading at 60fps |
| **Parameter Controls** | Sliders for all algorithm parameters with live preview |
| **Play/Pause/Step** | Transport controls to run, pause, or single-step the simulation |
| **Agent Count Selector** | Spawn 10 – 2,000 agents |
| **Speed Control** | Simulation speed multiplier (0.25x — 4x) |
| **Dark Theme** | Palantir-inspired dark tactical UI from launch |
| **Obstacle Placement** | Click to place circular/rectangular obstacles agents must avoid |

### Should Have (Sprint 3)

| Feature | Description |
|---|---|
| **Ant Colony Optimization** | Pheromone trails, food sources, nest — foraging behavior |
| **Particle Swarm Optimization** | Global/local best tracking, velocity update visualization |
| **Agent Trails** | Configurable trail length showing recent path history |
| **Communication Topology** | Lines connecting agents within communication range |
| **Coverage Heatmap** | Grid overlay showing visit frequency per cell |
| **Stats Panel** | Real-time metrics: avg speed, cluster count, convergence, coverage % |
| **Scenario Presets** | One-click load of preset configurations (flocking demo, foraging, etc.) |

### Could Have (Sprint 4+)

| Feature | Description |
|---|---|
| **Voronoi Partitions** | Territory visualization showing each agent's "owned" region |
| **Anomaly Detection** | Flags stuck, oscillating, or pathologically clustering agents |
| **Auction-Based Task Allocation** | Agents bid on tasks, visualize allocation dynamics |
| **Data Export** | Download simulation state as CSV/JSON |
| **Scenario Editor** | Save/load custom environments with obstacles and spawn zones |
| **Recording/Replay** | Record simulation runs and replay with scrub bar |

### Won't Have (Deferred to AEGIS/ATLAS)

| Feature | Deferred To |
|---|---|
| Safety scoring & counterfactuals | AEGIS |
| Decision audit logging | AEGIS |
| SLAM / autonomous exploration | ATLAS |
| LLM integration | CORTEX |

---

## 2. Architecture

### High-Level Component Diagram

```mermaid
graph TB
    subgraph Browser["Browser (Single Page App)"]
        subgraph MainThread["Main Thread"]
            UI["React UI Layer"]
            Store["Zustand Store"]
            Renderer["Canvas Renderer"]
            Analytics["Analytics Engine"]
        end
        subgraph WorkerThread["Web Worker"]
            SimEngine["Simulation Engine"]
            AlgoLib["Algorithm Library"]
            SpatialIndex["Spatial Index"]
        end
    end

    UI -->|params, controls| Store
    Store -->|config changes| SimEngine
    SimEngine -->|agent states (ArrayBuffer)| Store
    Store -->|positions + metadata| Renderer
    Store -->|positions + metadata| Analytics
    Analytics -->|metrics| UI
    SimEngine -->|uses| AlgoLib
    SimEngine -->|uses| SpatialIndex

    style Browser fill:#0d1117,stroke:#30363d,color:#c9d1d9
    style MainThread fill:#161b22,stroke:#30363d,color:#c9d1d9
    style WorkerThread fill:#1a1f2b,stroke:#58a6ff,color:#c9d1d9
```

### Data Flow

```
1. User adjusts parameter slider
2. React dispatches to Zustand store
3. Store sends config update to Web Worker via postMessage
4. Web Worker runs simulation tick:
   a. Update spatial index
   b. For each agent: query neighbors → apply algorithm → compute new velocity/position
   c. Write all agent states into a SharedArrayBuffer (or transferable ArrayBuffer)
5. Worker posts updated state back to main thread
6. Main thread:
   a. Zustand updates agent state slice
   b. Canvas renderer draws frame via requestAnimationFrame
   c. Analytics engine computes metrics (avg speed, clusters, coverage)
   d. React UI re-renders stats panel (throttled to 10fps)
```

### Key Design Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| **Sim thread** | Web Worker | Prevents simulation math from blocking UI/rendering |
| **Data transfer** | Transferable ArrayBuffer | Zero-copy transfer between threads; 2,000 agents × 7 floats (x, y, vx, vy, heading, id, state) = ~56KB per frame — trivial |
| **Rendering** | Raw Canvas 2D | Sufficient for ≤2,000 agents; no library dependency; simple triangle/circle draw. Upgrade to PixiJS only if we exceed 5,000+ agents |
| **State management** | Zustand | Minimal boilerplate, fine-grained subscriptions (sim state ≠ UI state), 18ms avg render, ~1KB bundle |
| **Spatial indexing** | Grid-based hash | O(1) neighbor queries for uniform-density swarms; simpler than quadtree, fast enough for 2K agents |
| **Build tool** | Vite | Instant HMR, native TS/Worker support, tiny config |
| **Language** | TypeScript | Type safety for complex sim state, algorithm interfaces |

---

## 3. Technology Evaluation

### Rendering Engine Evaluation

| Criteria | Raw Canvas 2D | PixiJS | Three.js |
|---|---|---|---|
| **Agent capacity** | ~2-3K (optimized) | ~10-50K (ParticleContainer) | ~100K+ (GPU shaders) |
| **Setup complexity** | None | npm install | npm install + scene/camera setup |
| **Bundle size** | 0 KB | ~200 KB | ~600 KB |
| **2D drawing ease** | ✅ Native | ✅ Designed for 2D | ⚠️ 3D lib forced into 2D |
| **Learning curve** | Low | Low-Medium | Medium-High |
| **Overlay drawing** (trails, heatmaps) | ✅ Easy | ✅ Easy | ⚠️ Custom shaders needed |

> **Decision: Start with Raw Canvas 2D.** It handles our target of ≤2,000 agents with zero dependencies. If we later need 5K+ agents (Could Have features), we swap in **PixiJS** — the API shapes are compatible.

### State Management Evaluation

| Criteria | Zustand | Redux Toolkit | Jotai |
|---|---|---|---|
| **Boilerplate** | Minimal | Medium | Minimal |
| **Bundle size** | ~1.1 KB | ~11 KB | ~3 KB |
| **Real-time perf** | 18ms avg render | 45ms avg render | 35ms avg render |
| **DevTools** | Basic (via middleware) | Excellent | Basic |
| **Learning curve** | Low | Medium | Low |
| **Fits our pattern** | ✅ (single store, selective subscribe) | ⚠️ (overkill) | ⚠️ (too atomic for sim state blob) |

> **Decision: Zustand.** Our state naturally splits into ~3-4 slices (simConfig, agentState, uiState, analyticsState). Zustand's selective subscription prevents the stats panel from causing map re-renders. Minimal bundle, minimal boilerplate.

### Spatial Indexing Evaluation

| Criteria | Grid Hash | Quadtree | K-D Tree |
|---|---|---|---|
| **Best for** | Uniform density | Variable density | Static point sets |
| **Insert/query** | O(1) amortized | O(log n) | O(log n) |
| **Rebuild cost** | O(n) — cheap | O(n log n) | O(n log n) |
| **Implementation** | ~50 lines | ~200 lines | ~150 lines |
| **Memory** | Fixed grid | Dynamic nodes | Balanced tree |

> **Decision: Grid Hash.** Our agents have a uniform communication radius and roughly uniform density. Grid cells sized to the communication radius give O(1) neighbor lookups. Dead simple to implement.

### Charting Library Evaluation

| Criteria | Recharts | Chart.js | D3.js | Lightweight custom |
|---|---|---|---|---|
| **React integration** | ✅ Native | ⚠️ Wrapper needed | ⚠️ Manual | ✅ Native |
| **Bundle size** | ~45 KB | ~65 KB | ~80 KB | 0 KB |
| **Real-time updates** | ✅ Good | ✅ Good | ✅ Best | ✅ Best |
| **Chart types needed** | Line, bar, gauge | Line, bar, gauge | Anything | Line, bar, gauge |

> **Decision: Recharts** for stats panels (line charts, bar charts). Lightweight enough, native React, looks great with dark theme out of the box. For the coverage heatmap, we draw directly on a second Canvas layer.

---

## 4. Module Breakdown

```
hivemind/
├── docs/
│   └── ARCHITECTURE.md          ← this document
├── public/
│   └── index.html
├── src/
│   ├── main.tsx                 ← entry point
│   ├── App.tsx                  ← root layout
│   │
│   ├── core/
│   │   ├── types.ts             ← Agent, SimConfig, SimState, AlgorithmType
│   │   ├── constants.ts         ← defaults, limits, colors
│   │   └── store.ts             ← Zustand store (simConfig, agents, ui, analytics slices)
│   │
│   ├── algorithms/
│   │   ├── index.ts             ← algorithm registry
│   │   ├── base.ts              ← SwarmAlgorithm interface
│   │   ├── boids.ts             ← Reynolds flocking (separation, alignment, cohesion)
│   │   ├── antColony.ts         ← ACO with pheromone grid
│   │   └── pso.ts               ← Particle Swarm Optimization
│   │
│   ├── workers/
│   │   ├── simulation.worker.ts ← Web Worker: runs sim loop, posts agent states
│   │   └── protocol.ts          ← Message types between main ↔ worker
│   │
│   ├── visualization/
│   │   ├── SimCanvas.tsx        ← Main canvas renderer component
│   │   ├── renderers/
│   │   │   ├── agentRenderer.ts     ← Draw agents (triangles with heading)
│   │   │   ├── trailRenderer.ts     ← Agent path trails
│   │   │   ├── obstacleRenderer.ts  ← Obstacle shapes
│   │   │   ├── heatmapRenderer.ts   ← Coverage heatmap overlay
│   │   │   └── topologyRenderer.ts  ← Communication links between agents
│   │   └── layers.ts            ← Layer management (z-order, toggle visibility)
│   │
│   ├── ui/
│   │   ├── Layout.tsx           ← Main grid layout (sidebar + canvas + stats)
│   │   ├── Sidebar/
│   │   │   ├── AlgorithmSelector.tsx
│   │   │   ├── ParameterSliders.tsx
│   │   │   ├── TransportControls.tsx     ← Play/Pause/Step/Speed
│   │   │   ├── ObstacleTools.tsx
│   │   │   └── LayerToggles.tsx
│   │   ├── StatsPanel/
│   │   │   ├── MetricsCards.tsx          ← Agent count, avg speed, clusters
│   │   │   ├── ConvergenceChart.tsx      ← Line chart over time
│   │   │   └── CoverageGauge.tsx         ← % of area visited
│   │   ├── PresetBar.tsx                 ← Scenario quick-load buttons
│   │   └── theme.ts                      ← Dark theme tokens
│   │
│   └── utils/
│       ├── spatialHash.ts       ← Grid-based spatial index
│       ├── vector.ts            ← Vec2 math (add, sub, normalize, limit, dist)
│       └── analytics.ts         ← Cluster detection, coverage calc, convergence metrics
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 5. Performance Budget

| Metric | Target | How |
|---|---|---|
| **Frame rate** | 60fps with ≤1,000 agents, 30fps+ with 2,000 | Web Worker decouples sim from render |
| **Sim tick** | <8ms for 1,000 agents | Grid hash O(1) neighbors, typed arrays |
| **Data transfer** | <100KB per frame | 2,000 agents × 28 bytes = 56KB |
| **Initial load** | <500KB JS bundle | Vite tree-shaking, no heavy libs |
| **Memory** | <150MB | No retained history beyond trail buffer |
| **Stats panel updates** | 10fps (throttled) | Separate subscription, requestAnimationFrame throttle |

---

## 6. Sprint Plan

### Sprint 1 (Days 1-5) — Simulation Core
- [ ] Init Vite + React + TS project
- [ ] Implement `Vec2` utilities and `SpatialHash`  
- [ ] Define core types (`Agent`, `SimConfig`, `SimState`)
- [ ] Build Zustand store with slices
- [ ] Implement Boids algorithm
- [ ] Build simulation Web Worker with tick loop
- [ ] Main thread ↔ Worker message protocol
- [ ] Basic Canvas renderer (agents as triangles)
- [ ] Play/Pause/Step controls

### Sprint 2 (Days 6-10) — UI & Interactivity
- [ ] Dark theme with CSS variables
- [ ] Parameter sliders (separation, alignment, cohesion, speed, radius)
- [ ] Agent count selector
- [ ] Speed multiplier control
- [ ] Obstacle placement (click to add circles/rects)
- [ ] Agent trails renderer
- [ ] Communication topology lines
- [ ] Stats panel with Recharts (avg speed, cluster count)

### Sprint 3 (Days 11-15) — Algorithms & Analytics
- [ ] Ant Colony Optimization algorithm
- [ ] Particle Swarm Optimization algorithm
- [ ] Algorithm selector dropdown
- [ ] Coverage heatmap overlay
- [ ] Scenario presets (one-click demos)
- [ ] Convergence chart
- [ ] Glassmorphism UI polish
- [ ] README and docs

### Sprint 4 (Days 16-20) — Polish & AEGIS Prep
- [ ] Voronoi partition overlay
- [ ] Anomaly detection (stuck/oscillating agents)
- [ ] Data export (CSV/JSON)  
- [ ] Recording/replay stub (lay groundwork for AEGIS)
- [ ] Performance optimization pass
- [ ] Responsive layout
- [ ] Final UI polish & micro-animations

---

## 7. Verification Plan

### Automated Tests
Since this is a new project, we'll write tests as we build:

1. **Unit tests** (Vitest — comes with Vite):
   ```bash
   npx vitest run
   ```
   - `vector.test.ts` — Vec2 math operations
   - `spatialHash.test.ts` — Insert, query neighbors, edge cases
   - `boids.test.ts` — Given N agents in known positions, verify computed forces
   - `antColony.test.ts` — Pheromone decay, deposit, trail following
   - `pso.test.ts` — Velocity update, personal/global best tracking

2. **Performance benchmark** (custom script):
   ```bash
   npx vitest bench
   ```
   - Sim tick with 1,000 agents < 8ms
   - Sim tick with 2,000 agents < 16ms
   - Spatial hash query < 0.1ms per agent

### Manual / Browser Verification
1. **Run dev server and open in browser:**
   ```bash
   cd hivemind && npm run dev
   ```
2. **Visual checks:**
   - Agents rendered as triangles with visible heading direction
   - Adjusting slider immediately changes swarm behavior
   - Play/Pause/Step all work correctly
   - Obstacles block agent movement
   - Stats panel updates in real-time
   - Dark theme renders correctly with no white flashes
3. **Performance check:**
   - Open Chrome DevTools → Performance tab
   - Record 5 seconds with 1,000 agents
   - Verify frame rate stays above 55fps
