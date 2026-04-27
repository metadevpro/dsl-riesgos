import { extractConnectionEndpoints } from '../generalCalculationNodes.utils';

// ─── Types ───────────────────────────────────────────────────────────────────

import {
  BayesEvidence,
  BayesCPTEntry,
  BayesCPT,
  BayesNodeInfo,
  BayesGraph,
  CPTTableRow,
} from '../../types';
import { DiagramModel, DiagramNode } from '@metadev/daga';

// ─── Constants ───────────────────────────────────────────────────────────────

export const BAYES_EVIDENCE_KEY = 'bayes_evidence';
export const BAYES_CPT_KEY = 'bayes_cpt';
export const BAYES_P_SI_KEY = 'bayes_pSi';
export const BAYES_P_NO_KEY = 'bayes_pNo';

const STATES: readonly string[] = ['si', 'no'] as const;

// ─── CPT Utilities ───────────────────────────────────────────────────────────

/**
 * Generates a uniform default CPT for a node given its parent IDs.
 * Root nodes get a `prior` key; others get one row per parent-state combination.
 */
export function generateDefaultCPT(
  parentIds: string[],
  parentNames: Map<string, string>,
): BayesCPT {
  if (parentIds.length === 0) {
    return { prior: { si: 0.5, no: 0.5 } };
  }

  const cpt: BayesCPT = {};
  const combis = getParentCombinations(parentIds);

  for (const combi of combis) {
    const key = combi.map((c) => c.parentId + '_' + c.state).join('|');
    cpt[key] = { si: 0.5, no: 0.5 };
  }

  return cpt;
}

/**
 * Recalculates a CPT when parents change.
 * Tries to preserve values for combinations that still exist.
 */
export function recalcCPTOnParentChange(
  oldCPT: BayesCPT,
  oldParents: string[],
  newParents: string[],
  parentNames: Map<string, string>,
): BayesCPT {
  if (newParents.length === 0) {
    // Node became a root — try to keep from old prior if it exists
    if (oldCPT['prior']) {
      return { prior: { ...oldCPT['prior'] } };
    }
    return { prior: { si: 0.5, no: 0.5 } };
  }

  const newCPT: BayesCPT = {};
  const newCombis = getParentCombinations(newParents);

  for (const combi of newCombis) {
    const key = combi.map((c) => c.parentId + '_' + c.state).join('|');
    // Try to reuse existing value
    if (oldCPT[key]) {
      newCPT[key] = { ...oldCPT[key] };
    } else {
      newCPT[key] = { si: 0.5, no: 0.5 };
    }
  }

  return newCPT;
}

/**
 * Validates that every row of a CPT sums to ~1.0.
 * Returns an array of invalid keys.
 */
export function validateCPT(cpt: BayesCPT): string[] {
  const invalidKeys: string[] = [];

  for (const [key, entry] of Object.entries(cpt)) {
    const sum = entry.si + entry.no;
    if (Math.abs(sum - 1.0) > 0.01) {
      invalidKeys.push(key);
    }
  }

  return invalidKeys;
}

// ─── Combination Generation ──────────────────────────────────────────────────

interface ParentStateCombi {
  parentId: string;
  state: string;
}

/**
 * Generates all possible combinations of parent states.
 * For N parents with 2 states each, it produces 2^N combinations.
 */
export function getParentCombinations(parentIds: string[]): ParentStateCombi[][] {
  if (parentIds.length === 0) return [[]];

  const [first, ...rest] = parentIds;
  const restCombis = getParentCombinations(rest);

  return STATES.flatMap((state) => restCombis.map((rc) => [{ parentId: first, state }, ...rc]));
}

// ─── Graph Building ──────────────────────────────────────────────────────────

/**
 * Builds the complete Bayesian graph from a daga DiagramModel.
 * Nodes read their stored CPT/evidence from `node.data`, or get defaults.
 */
export function buildBayesGraph(model: DiagramModel): BayesGraph {
  const graph: BayesGraph = new Map();

  if (!model || !model.nodes) return graph;

  const nodes = model.nodes;
  const connections = model.connections || [];

  // Build parent/child maps from connections
  const parentsMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();

  for (const conn of connections) {
    const { startId, endId } = extractConnectionEndpoints(conn);
    if (!startId || !endId) continue;

    if (!parentsMap.has(endId)) parentsMap.set(endId, []);
    if (!childrenMap.has(startId)) childrenMap.set(startId, []);

    const parents = parentsMap.get(endId)!;
    if (!parents.includes(startId)) parents.push(startId);

    const children = childrenMap.get(startId)!;
    if (!children.includes(endId)) children.push(endId);
  }

  // Build name map for display
  const nameMap = new Map<string, string>();
  for (const node of nodes) {
    const id = getNodeIdSafe(node);
    if (!id) continue;
    nameMap.set(id, getNodeName(node));
  }

  // Create BayesNodeInfo for each node
  for (const node of nodes) {
    const id = getNodeIdSafe(node);
    if (!id) continue;

    const parents = parentsMap.get(id) || [];
    const children = childrenMap.get(id) || [];
    const name = nameMap.get(id) || id;

    // Read stored data or create defaults
    // Config stores default as the string 'null', convert to actual null
    const rawEvidence = node.valueSet.getValue(BAYES_EVIDENCE_KEY);
    const evidence: BayesEvidence =
      rawEvidence === 'si' || rawEvidence === 'no' ? rawEvidence : null;
    let storedCPT: BayesCPT | null = null;

    if (node.valueSet.getValue(BAYES_CPT_KEY)) {
      try {
        const raw = node.valueSet.getValue(BAYES_CPT_KEY);
        storedCPT = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        storedCPT = null;
      }
    }

    const cpt = storedCPT || generateDefaultCPT(parents, nameMap);

    graph.set(id, {
      id,
      name,
      parents,
      children,
      evidence,
      cpt,
      marginals: { si: 0.5, no: 0.5 },
    });
  }

  return graph;
}

// ─── Inference Engine ────────────────────────────────────────────────────────

interface WorldState {
  states: Record<string, 'si' | 'no'>;
  weight: number;
}

function enumerateWorlds(
  graph: BayesGraph,
  order: string[],
  evidence: Record<string, 'si' | 'no'>,
  idx: number,
  currentWorld: Record<string, 'si' | 'no'>,
): WorldState[] {
  if (idx === order.length) {
    return [{ states: { ...currentWorld }, weight: 1 }];
  }

  const nodeId = order[idx];
  const node = graph.get(nodeId)!;
  const worlds: WorldState[] = [];

  for (const state of ['si', 'no'] as ('si' | 'no')[]) {
    if (evidence[nodeId] && evidence[nodeId] !== state) continue;

    let prob = 0;
    if (node.parents.length === 0) {
      prob = node.cpt['prior']?.[state] ?? 0;
    } else {
      const cptKey = node.parents.map((p) => `${p}_${currentWorld[p]}`).join('|');
      prob = node.cpt[cptKey]?.[state] ?? 0;
    }

    if (prob === 0) continue;

    const subWorlds = enumerateWorlds(graph, order, evidence, idx + 1, {
      ...currentWorld,
      [nodeId]: state,
    });
    for (const sw of subWorlds) {
      sw.weight *= prob;
    }
    worlds.push(...subWorlds);
  }
  return worlds;
}

/**
 * Returns true if the graph contains a cycle.
 * Uses topological sort: if sorted output has fewer nodes than the graph, there's a cycle.
 */
export function hasCycle(graph: BayesGraph): boolean {
  return topologicalSort(graph).length < graph.size;
}

/**
 * Recalculates marginals for ALL nodes in the graph using exact joint probability enumeration.
 * Returns the updated graph (mutates in place).
 */
export function recalcAllMarginals(graph: BayesGraph): BayesGraph {
  if (hasCycle(graph)) {
    console.warn('[Bayes] Graph contains a cycle \u2014 inference aborted.');
    for (const [, node] of graph) node.marginals = { si: 0.5, no: 0.5 };
    return graph;
  }

  // We do not skip inference here based on graph.size anymore.
  // We only log a warning. The UI component will handle showing a banner.
  if (graph.size > 20) {
    console.warn('[Bayes] Graph exceeds 20 nodes \u2014 exact inference may freeze the browser.');
  }

  const order = topologicalSort(graph);
  const evidence: Record<string, 'si' | 'no'> = {};
  for (const [id, node] of graph) {
    if (node.evidence) evidence[id] = node.evidence;
  }

  const worlds = enumerateWorlds(graph, order, evidence, 0, {});
  const totalWeight = worlds.reduce((sum, w) => sum + w.weight, 0);

  for (const [nodeId, node] of graph) {
    if (node.evidence) {
      node.marginals = {
        si: node.evidence === 'si' ? 1 : 0,
        no: node.evidence === 'no' ? 1 : 0,
      };
    } else if (totalWeight === 0) {
      node.marginals = { si: 0.5, no: 0.5 };
    } else {
      const weightSi = worlds
        .filter((w) => w.states[nodeId] === 'si')
        .reduce((s, w) => s + w.weight, 0);
      node.marginals = {
        si: weightSi / totalWeight,
        no: 1 - weightSi / totalWeight,
      };
    }
  }

  return graph;
}

/**
 * Computes a topological order of the graph (Kahn's algorithm).
 * Useful for processing parents before children.
 */
export function topologicalSort(graph: BayesGraph): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const [id, node] of graph) {
    inDegree.set(id, node.parents.length);
    adj.set(id, node.children);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const child of adj.get(current) || []) {
      const newDeg = (inDegree.get(child) || 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  return sorted;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeIdSafe(node: DiagramNode): string | undefined {
  if (!node) return undefined;
  const raw = node.id;
  if (typeof raw === 'string') return raw.replace(/_port_\d+$/i, '');
  if (typeof raw === 'number') return String(raw);
  return undefined;
}

function getNodeName(node: DiagramNode): string {
  return node.valueSet.getValue('node name') || node.name || node.id || 'unnamed';
}

/**
 * Returns the parent names for display purposes.
 */
export function getParentNames(nodeId: string, graph: BayesGraph): string[] {
  const node = graph.get(nodeId);
  if (!node) return [];

  return node.parents.map((pid) => {
    const parent = graph.get(pid);
    return parent?.name || pid;
  });
}

/**
 * Returns the CPT key label for display, replacing IDs with names.
 */
export function getCPTKeyLabel(cptKey: string, graph: BayesGraph): string {
  // Key format: "parentId_state|parentId_state"
  return cptKey
    .split('|')
    .map((part) => {
      const lastUnderscore = part.lastIndexOf('_');
      if (lastUnderscore === -1) return part;
      const parentId = part.substring(0, lastUnderscore);
      const state = part.substring(lastUnderscore + 1);
      const parentNode = graph.get(parentId);
      const parentName = parentNode?.name || parentId;
      const stateLabel = state === 'si' ? 'Sí' : 'No';
      return `${parentName}=${stateLabel}`;
    })
    .join(', ');
}

/**
 * Parse CPT data for rendering a table for a given node.
 * Returns rows with parent state labels and P(Sí)/P(No) values.
 */

export function getCPTTableRows(nodeId: string, graph: BayesGraph): CPTTableRow[] {
  const node = graph.get(nodeId);
  if (!node) return [];

  if (node.parents.length === 0) {
    const prior = node.cpt['prior'] || { si: 0.5, no: 0.5 };
    return [
      {
        key: 'prior',
        parentStates: [],
        pSi: prior.si,
        pNo: prior.no,
        isValid: Math.abs(prior.si + prior.no - 1.0) <= 0.01,
      },
    ];
  }

  const combis = getParentCombinations(node.parents);
  const rows: CPTTableRow[] = [];

  for (const combi of combis) {
    const key = combi.map((c) => c.parentId + '_' + c.state).join('|');
    const entry = node.cpt[key] || { si: 0.5, no: 0.5 };

    rows.push({
      key,
      parentStates: combi.map((c) => {
        const parent = graph.get(c.parentId);
        return {
          parentName: parent?.name || c.parentId,
          stateLabel: c.state === 'si' ? 'Sí' : 'No',
        };
      }),
      pSi: entry.si,
      pNo: entry.no,
      isValid: Math.abs(entry.si + entry.no - 1.0) <= 0.01,
    });
  }

  return rows;
}
