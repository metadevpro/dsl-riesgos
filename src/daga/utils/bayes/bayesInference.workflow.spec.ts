import {
  buildBayesGraph,
  generateDefaultCPT,
  getCPTKeyLabel,
  getCPTTableRows,
  getParentCombinations,
  getParentNames,
  hasCycle,
  recalcAllMarginals,
  recalcCPTOnParentChange,
  topologicalSort,
  validateCPT,
  BAYES_CPT_KEY,
  BAYES_EVIDENCE_KEY
} from './bayesInference.utils';
import { BayesGraph } from '../../types';

describe('Bayes Workflow — CPT building blocks', () => {
  it('generateDefaultCPT returns a uniform prior for a root node', () => {
    const cpt = generateDefaultCPT([]);
    expect(cpt).toEqual({ prior: { si: 0.5, no: 0.5 } });
  });

  it('generateDefaultCPT produces 2^N rows for N parents', () => {
    const cpt = generateDefaultCPT(['P1', 'P2', 'P3']);
    expect(Object.keys(cpt)).toHaveLength(8);
    for (const row of Object.values(cpt)) {
      expect(row.si + row.no).toBeCloseTo(1, 5);
    }
  });

  it('getParentCombinations enumerates every parent-state combination', () => {
    const combis = getParentCombinations(['A', 'B']);
    expect(combis).toHaveLength(4);

    const keys = combis.map((c) => c.map((cc) => `${cc.parentId}_${cc.state}`).join('|')).sort();
    expect(keys).toEqual(['A_no|B_no', 'A_no|B_si', 'A_si|B_no', 'A_si|B_si'].sort());
  });

  it('validateCPT flags rows whose probabilities do not sum to 1', () => {
    const invalid = validateCPT({
      good: { si: 0.4, no: 0.6 },
      bad: { si: 0.3, no: 0.3 }
    });
    expect(invalid).toEqual(['bad']);
  });

  it('recalcCPTOnParentChange preserves matching rows and fills gaps', () => {
    const oldCPT = {
      'A_si': { si: 0.8, no: 0.2 },
      'A_no': { si: 0.1, no: 0.9 }
    };

    const newCPT = recalcCPTOnParentChange(oldCPT, ['A', 'B']);
    expect(Object.keys(newCPT)).toHaveLength(4);
    expect(newCPT['A_si|B_si']).toEqual({ si: 0.5, no: 0.5 });

    const backToRoot = recalcCPTOnParentChange(oldCPT, []);
    expect(backToRoot).toEqual({ prior: { si: 0.5, no: 0.5 } });
  });
});

describe('Bayes Workflow — Graph topology', () => {
  function makeChainGraph(): BayesGraph {
    const g: BayesGraph = new Map();
    g.set('R', { id: 'R', name: 'R', parents: [], children: ['S'], evidence: null, cpt: { prior: { si: 0.4, no: 0.6 } }, marginals: { si: 0, no: 0 } });
    g.set('S', { id: 'S', name: 'S', parents: ['R'], children: ['T'], evidence: null, cpt: { R_si: { si: 0.9, no: 0.1 }, R_no: { si: 0.2, no: 0.8 } }, marginals: { si: 0, no: 0 } });
    g.set('T', { id: 'T', name: 'T', parents: ['S'], children: [], evidence: null, cpt: { S_si: { si: 0.7, no: 0.3 }, S_no: { si: 0.05, no: 0.95 } }, marginals: { si: 0, no: 0 } });
    return g;
  }

  it('topologicalSort orders parents before children', () => {
    const order = topologicalSort(makeChainGraph());
    expect(order.indexOf('R')).toBeLessThan(order.indexOf('S'));
    expect(order.indexOf('S')).toBeLessThan(order.indexOf('T'));
  });

  it('hasCycle detects a 2-node loop', () => {
    const g: BayesGraph = new Map();
    g.set('X', { id: 'X', name: 'X', parents: ['Y'], children: ['Y'], evidence: null, cpt: { Y_si: { si: 0.5, no: 0.5 }, Y_no: { si: 0.5, no: 0.5 } }, marginals: { si: 0, no: 0 } });
    g.set('Y', { id: 'Y', name: 'Y', parents: ['X'], children: ['X'], evidence: null, cpt: { X_si: { si: 0.5, no: 0.5 }, X_no: { si: 0.5, no: 0.5 } }, marginals: { si: 0, no: 0 } });
    expect(hasCycle(g)).toBe(true);
  });

  it('hasCycle returns false for a DAG', () => {
    expect(hasCycle(makeChainGraph())).toBe(false);
  });
});

describe('Bayes Workflow — Inference behaviour', () => {
  it('cycle in graph yields neutral marginals (0.5 / 0.5)', () => {
    const g: BayesGraph = new Map();
    g.set('X', { id: 'X', name: 'X', parents: ['Y'], children: ['Y'], evidence: null, cpt: { Y_si: { si: 0.5, no: 0.5 }, Y_no: { si: 0.5, no: 0.5 } }, marginals: { si: 0, no: 0 } });
    g.set('Y', { id: 'Y', name: 'Y', parents: ['X'], children: ['X'], evidence: null, cpt: { X_si: { si: 0.5, no: 0.5 }, X_no: { si: 0.5, no: 0.5 } }, marginals: { si: 0, no: 0 } });

    recalcAllMarginals(g);
    expect(g.get('X')!.marginals).toEqual({ si: 0.5, no: 0.5 });
    expect(g.get('Y')!.marginals).toEqual({ si: 0.5, no: 0.5 });
  });

  it('evidence on a node forces its marginal to 1/0', () => {
    const g: BayesGraph = new Map();
    g.set('R', { id: 'R', name: 'R', parents: [], children: ['S'], evidence: 'si', cpt: { prior: { si: 0.4, no: 0.6 } }, marginals: { si: 0, no: 0 } });
    g.set('S', { id: 'S', name: 'S', parents: ['R'], children: [], evidence: null, cpt: { R_si: { si: 0.9, no: 0.1 }, R_no: { si: 0.2, no: 0.8 } }, marginals: { si: 0, no: 0 } });

    recalcAllMarginals(g);
    expect(g.get('R')!.marginals).toEqual({ si: 1, no: 0 });
    expect(g.get('S')!.marginals.si).toBeCloseTo(0.9, 5);
  });

  it('child evidence updates parent posterior (Bayes update)', () => {
    const g: BayesGraph = new Map();
    g.set('R', { id: 'R', name: 'R', parents: [], children: ['S'], evidence: null, cpt: { prior: { si: 0.4, no: 0.6 } }, marginals: { si: 0, no: 0 } });
    g.set('S', { id: 'S', name: 'S', parents: ['R'], children: [], evidence: 'si', cpt: { R_si: { si: 0.9, no: 0.1 }, R_no: { si: 0.2, no: 0.8 } }, marginals: { si: 0, no: 0 } });

    recalcAllMarginals(g);
    // P(R=si | S=si) = (0.9*0.4) / (0.9*0.4 + 0.2*0.6) = 0.36 / 0.48 = 0.75
    expect(g.get('R')!.marginals.si).toBeCloseTo(0.75, 4);
  });
});

describe('Bayes Workflow — Build from diagram model', () => {
  it('buildBayesGraph wires parents, children, evidence, and CPT from node.data', () => {
    const model = {
      nodes: [
        { id: 'A', data: { 'node name': 'Rain', [BAYES_CPT_KEY]: { prior: { si: 0.3, no: 0.7 } } } },
        { id: 'B', data: { 'node name': 'WetGrass', [BAYES_EVIDENCE_KEY]: 'si' } }
      ],
      connections: [{ startNode: 'A', endNode: 'B' }]
    };

    const graph = buildBayesGraph(model);
    expect(graph.size).toBe(2);

    const a = graph.get('A')!;
    const b = graph.get('B')!;
    expect(a.children).toEqual(['B']);
    expect(b.parents).toEqual(['A']);
    expect(b.evidence).toBe('si');
    expect(a.cpt['prior']).toEqual({ si: 0.3, no: 0.7 });
    // B got default CPT for 1 parent (2 rows)
    expect(Object.keys(b.cpt)).toHaveLength(2);
  });

  it('buildBayesGraph parses stringified CPT in node.data', () => {
    const model = {
      nodes: [{ id: 'X', data: { [BAYES_CPT_KEY]: JSON.stringify({ prior: { si: 0.7, no: 0.3 } }) } }],
      connections: []
    };

    const g = buildBayesGraph(model);
    expect(g.get('X')!.cpt['prior']).toEqual({ si: 0.7, no: 0.3 });
  });

  it('returns an empty graph for a missing model', () => {
    expect(buildBayesGraph(null).size).toBe(0);
    expect(buildBayesGraph({}).size).toBe(0);
  });
});

describe('Bayes Workflow — Display helpers', () => {
  let graph: BayesGraph;

  beforeEach(() => {
    graph = new Map();
    graph.set('F', { id: 'F', name: 'Fumador', parents: [], children: ['C'], evidence: null, cpt: { prior: { si: 0.3, no: 0.7 } }, marginals: { si: 0, no: 0 } });
    graph.set('C', {
      id: 'C',
      name: 'Cancer',
      parents: ['F'],
      children: [],
      evidence: null,
      cpt: { F_si: { si: 0.4, no: 0.6 }, F_no: { si: 0.05, no: 0.95 } },
      marginals: { si: 0, no: 0 }
    });
  });

  it('getParentNames returns parent node names', () => {
    expect(getParentNames('C', graph)).toEqual(['Fumador']);
    expect(getParentNames('F', graph)).toEqual([]);
  });

  it('getCPTKeyLabel formats keys using parent names and Sí/No labels', () => {
    expect(getCPTKeyLabel('F_si', graph)).toBe('Fumador=Sí');
  });

  it('getCPTTableRows returns one row for a root and 2^N for children', () => {
    expect(getCPTTableRows('F', graph)).toHaveLength(1);
    expect(getCPTTableRows('C', graph)).toHaveLength(2);
    expect(getCPTTableRows('C', graph)[0].isValid).toBe(true);
  });
});
