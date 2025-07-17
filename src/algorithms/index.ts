// ─── Algorithm Registry ─────────────────────────────────────────

import type { SwarmAlgorithm } from './base';
import { AlgorithmType } from '../core/types';
import { BoidsAlgorithm } from './boids';
import { AntColonyAlgorithm } from './antColony';
import { PSOAlgorithm } from './pso';

const algorithms: Record<AlgorithmType, () => SwarmAlgorithm> = {
    [AlgorithmType.Boids]: () => new BoidsAlgorithm(),
    [AlgorithmType.AntColony]: () => new AntColonyAlgorithm(),
    [AlgorithmType.PSO]: () => new PSOAlgorithm(),
};

export function getAlgorithm(type: AlgorithmType): SwarmAlgorithm {
    return algorithms[type]();
}

export type { SwarmAlgorithm } from './base';
