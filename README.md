# ⬡ HIVEMIND
### Swarm Intelligence Debugger & Visualizer

HIVEMIND is a high-performance, real-time visualizer and debugging tool for swarm intelligence algorithms. It provides deep visibility into emergent behaviors through detailed force analysis, spatial partitioning, and temporal control.

![Swarm Simulation](https://via.placeholder.com/1200x600/0d1117/58a6ff?text=HIVEMIND+Swarm+Intelligence+Debugger)

## 🚀 Key Features

### 🧠 Advanced Algorithms
- **Boids (Reynolds Flocking)**: Real-time alignment, cohesion, and separation.
- **ACO (Ant Colony Optimization)**: Pheromone-based pathfinding with food sources and home nests.
- **PSO (Particle Swarm Optimization)**: Global optimization tracking with multi-target convergence.

### 🛠️ Debugger Toolkit
- **Agent Inspector**: Click any agent to analyze its internal state, velocity, and algorithm-specific metadata.
- **Force Vector Overlay**: Multi-colored arrows visualize exactly *why* agents move. Understand the pull of separation vs. the push of obstacle avoidance.
- **Anomaly Detection**: Automatic detection of "stuck" agents or algorithm failures, highlighted in high-contrast red.

### 🕸️ Visual Analysis
- **Voronoi Partitioning**: Real-time discrete Voronoi grid showing agent territories.
- **Heatmap Overlay**: Persistent coverage analysis tracking swarm density over time.
- **Communication Links**: Optimized spatial-hash based relationship visualization.

### ⏳ Time & Data Control
- **Bidirectional Stepping**: Step forward and backward through a 300-tick state history buffer.
- **Cinema Mode**: Ultra-slow 0.1x speed for granular micro-behavior analysis.
- **State Export**: Export complete swarm states to **JSON** or analytical subsets to **CSV**.

## 💻 Tech Stack
- **Frontend**: React, TypeScript, Vite
- **Rendering**: Canvas API (O(n) optimized)
- **State**: Zustand
- **Physics Engine**: Dedicated Web Worker for zero-lag UI
- **Styling**: Vanilla CSS (Glassmorphism 2.0)

## 🛠️ Development

### Core Architecture
HIVEMIND uses a **Main Thread <-> Worker** architecture. The heavy lifting (spatial hashing, algorithm logic, history tracking) happens off-thread to ensure the UI remains responsive at 60fps even with 1000+ agents.

### Adding an Algorithm
1. Implement the `SwarmAlgorithm` interface in `src/algorithms/base.ts`.
2. Add your logic to `src/algorithms/`.
3. Register the algorithm in the `getAlgorithm` factory.

---
*Developed with ♥ by ThryLox*
