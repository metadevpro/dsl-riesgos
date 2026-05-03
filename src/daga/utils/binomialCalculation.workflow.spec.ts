import { calculateBinomialProbability } from './binomialCalculationNodes.utils';
import { calculateTheoreticalNodeProbabilities, normalizeWeightValue } from './binomialWeight.utils';

const PROB_KEY = 'probability';
const BRANCH_KEY = 'probability';
const MAX_PROB = 1;

function makeNode(id: string, data: Record<string, unknown> = {}, type?: string) {
  return { id, type, data };
}

function makeConn(start: string, end: string, data: Record<string, unknown> = {}) {
  return { startNode: start, endNode: end, data };
}

describe('Binomial Workflow — normalizeWeightValue', () => {
  it('parses plain numbers', () => {
    expect(normalizeWeightValue(0.5)).toBe(0.5);
    expect(normalizeWeightValue(7)).toBe(7);
  });

  it('parses comma decimals', () => {
    expect(normalizeWeightValue('0,75')).toBe(0.75);
  });

  it('parses mixed thousand/decimal formats', () => {
    expect(normalizeWeightValue('1.234,5')).toBe(1234.5);
    expect(normalizeWeightValue('1,234.5')).toBe(1234.5);
  });

  it('rejects negatives, NaN, and empty strings', () => {
    expect(normalizeWeightValue(-3)).toBeNull();
    expect(normalizeWeightValue(NaN)).toBeNull();
    expect(normalizeWeightValue('')).toBeNull();
    expect(normalizeWeightValue('abc')).toBeNull();
  });
});

describe('Binomial Workflow — calculateBinomialProbability (Monte Carlo)', () => {
  it('throws when the model has no nodes', () => {
    expect(() => calculateBinomialProbability({ nodes: [] }, 10, PROB_KEY, MAX_PROB)).toThrow(/at least 1 node/);
  });

  it('throws when iterations < 1', () => {
    const model = { nodes: [makeNode('start', {}, 'start')], connections: [] };
    expect(() => calculateBinomialProbability(model, 0, PROB_KEY, MAX_PROB)).toThrow(/iterations/);
  });

  it('always succeeds when every node has probability=100 and an end exists', () => {
    const model = {
      nodes: [
        makeNode('S', { 'node name': 'start' }, 'start'),
        makeNode('A', { [PROB_KEY]: 1 }),
        makeNode('E', { 'node name': 'end', end: true })
      ],
      connections: [makeConn('S', 'A'), makeConn('A', 'E')]
    };

    const result = calculateBinomialProbability(model, 50, PROB_KEY, MAX_PROB);
    expect(result.iterations).toBe(50);
    expect(result.successIterations).toBe(50);
  });

  it('never succeeds when the only intermediate node has probability=0', () => {
    const model = {
      nodes: [
        makeNode('S', { 'node name': 'start' }, 'start'),
        makeNode('A', { [PROB_KEY]: 0 }),
        makeNode('E', { 'node name': 'end', end: true })
      ],
      connections: [makeConn('S', 'A'), makeConn('A', 'E')]
    };

    const result = calculateBinomialProbability(model, 30, PROB_KEY, MAX_PROB);
    expect(result.successIterations).toBe(0);
  });

  it('respects a fixed startNodeId override', () => {
    const model = {
      nodes: [
        makeNode('S', { 'node name': 'start' }, 'start'),
        makeNode('A', { [PROB_KEY]: 1 }),
        makeNode('E', { 'node name': 'end', end: true })
      ],
      connections: [makeConn('S', 'A'), makeConn('A', 'E')]
    };

    const result = calculateBinomialProbability(model, 10, PROB_KEY, MAX_PROB, 'A');
    expect(result.startNodeId).toBe('A');
  });

  it('approximates expected probability across enough iterations', () => {
    // Single intermediate node with 50% chance to reach end.
    const model = {
      nodes: [
        makeNode('S', { 'node name': 'start' }, 'start'),
        makeNode('A', { [PROB_KEY]: 0.5 }),
        makeNode('E', { 'node name': 'end', end: true })
      ],
      connections: [makeConn('S', 'A'), makeConn('A', 'E')]
    };

    const iterations = 4000;
    const result = calculateBinomialProbability(model, iterations, PROB_KEY, MAX_PROB);
    const empirical = result.successIterations / iterations;
    expect(empirical).toBeGreaterThan(0.42);
    expect(empirical).toBeLessThan(0.58);
  });
});

describe('Binomial Workflow — calculateTheoreticalNodeProbabilities', () => {
  it('returns empty map when the model is missing nodes', () => {
    expect(calculateTheoreticalNodeProbabilities(null, PROB_KEY, BRANCH_KEY, MAX_PROB).size).toBe(0);
    expect(calculateTheoreticalNodeProbabilities({ nodes: [] }, PROB_KEY, BRANCH_KEY, MAX_PROB).size).toBe(0);
  });

  it('propagates node probability down a linear chain', () => {
    const model = {
      nodes: [
        makeNode('S', { [PROB_KEY]: 1 }, 'start'),
        makeNode('A', { [PROB_KEY]: 0.5 }),
        makeNode('B', { [PROB_KEY]: 0.8 })
      ],
      connections: [makeConn('S', 'A'), makeConn('A', 'B')]
    };

    const results = calculateTheoreticalNodeProbabilities(model, PROB_KEY, BRANCH_KEY, MAX_PROB);
    expect(results.get('S')).toBeCloseTo(1, 5);
    expect(results.get('A')).toBeCloseTo(0.5, 5);
    expect(results.get('B')).toBeCloseTo(0.4, 5);
  });

  it('splits flow across branches according to connection weights', () => {
    const model = {
      nodes: [
        makeNode('S', {}, 'start'),
        makeNode('L', { [PROB_KEY]: 1 }),
        makeNode('R', { [PROB_KEY]: 1 })
      ],
      connections: [
        makeConn('S', 'L', { [BRANCH_KEY]: 3 }),
        makeConn('S', 'R', { [BRANCH_KEY]: 1 })
      ]
    };

    const results = calculateTheoreticalNodeProbabilities(model, PROB_KEY, BRANCH_KEY, MAX_PROB);
    expect(results.get('L')).toBeCloseTo(0.75, 5);
    expect(results.get('R')).toBeCloseTo(0.25, 5);
  });

  it('multiple disjoint roots both contribute', () => {
    const model = {
      nodes: [
        makeNode('R1', {}, 'start'),
        makeNode('R2', {}, 'start'),
        makeNode('Shared', { [PROB_KEY]: 1 })
      ],
      connections: [makeConn('R1', 'Shared'), makeConn('R2', 'Shared')]
    };

    const results = calculateTheoreticalNodeProbabilities(model, PROB_KEY, BRANCH_KEY, MAX_PROB);
    expect(results.get('Shared')).toBeCloseTo(2, 5);
  });
});
