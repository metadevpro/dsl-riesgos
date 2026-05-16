import {
  buildOutgoingConnections,
  findEndNode,
  findStartNode,
  getEffectiveNodeProbability,
  getNodeId,
  getNodeMap,
  getNextNodeFromConnection,
  isNodeTypeLike,
  isStateDiagramNodeLike
} from '../generalCalculationNodes.utils';
import { normalizeWeightValue } from './binomialWeight.utils';

import { ConnectionInfo, NodeId, NodeInfo, CalculationResult } from '../../types';

function readConnectionFieldByKey(connection: ConnectionInfo, key: string): unknown {
  if (!connection || typeof connection !== 'object') return undefined;

  const conn = connection as Record<string, unknown>;
  const data = conn['data'];
  if (data && typeof data === 'object') {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined) return value;
  }

  const valueSet = conn['valueSet'];
  if (valueSet && typeof valueSet === 'object') {
    const valueSetObject = valueSet as Record<string, unknown>;
    const values = valueSetObject['values'];
    if (values && typeof values === 'object') {
      const value = (values as Record<string, unknown>)[key];
      if (value !== undefined) return value;
    }
    if (valueSetObject[key] !== undefined) return valueSetObject[key];
  }

  return conn[key];
}

function resolveTransitionWeight(connection: ConnectionInfo, branchValueKey: string): number {
  const rawValue = readConnectionFieldByKey(connection, branchValueKey);
  const normalized = normalizeWeightValue(rawValue);
  return normalized ?? 1;
}

interface NextNodeSelection {
  node: NodeInfo;
  usedWeightedChoice: boolean;
}

/** Picks the next node using weighted random selection across all outgoing paths. */
function getNextNode(
  currentNode: NodeInfo,
  outgoingConnections: Map<NodeId, ConnectionInfo[]>,
  nodeMap: Map<NodeId, NodeInfo>,
  branchValueKey: string
): NextNodeSelection | null {
  const currentId = getNodeId(currentNode);
  if (!currentId) return null;

  const currentConns = outgoingConnections.get(currentId) ?? [];
  if (currentConns.length === 0) return null;

  const candidates = currentConns
    .map((connection) => {
      const nextNode = getNextNodeFromConnection(connection, nodeMap);
      if (!nextNode) return null;

      return {
        node: nextNode,
        weight: resolveTransitionWeight(connection, branchValueKey)
      };
    })
    .filter((candidate): candidate is { node: NodeInfo; weight: number } => !!candidate);

  if (candidates.length === 0) return null;

  const usedWeightedChoice = candidates.length > 1;

  const totalWeight = candidates.reduce((acc, candidate) => acc + candidate.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let threshold = Math.random() * totalWeight;
  for (const candidate of candidates) {
    threshold -= candidate.weight;
    if (threshold <= 0) {
      return {
        node: candidate.node,
        usedWeightedChoice
      };
    }
  }

  return {
    node: candidates[candidates.length - 1].node,
    usedWeightedChoice
  };
}

/** Skips non-probability Start node to get the true initial evaluable element. */
function getFirstProbabilityNode(
  startNode: NodeInfo,
  outgoingConnections: Map<NodeId, ConnectionInfo[]>,
  nodeMap: Map<NodeId, NodeInfo>,
  branchValueKey: string
): NextNodeSelection | null {
  const nextNode = getNextNode(startNode, outgoingConnections, nodeMap, branchValueKey);
  if (nextNode) return nextNode;

  if (isNodeTypeLike(startNode, 'start')) return null;

  return {
    node: startNode,
    usedWeightedChoice: false
  };
}

function isEndNodeLike(node: NodeInfo): boolean {
  if (node?.data?.['end'] === true) return true;

  const nodeName = node?.data?.['node name'] ?? node?.data?.['name'] ?? node?.['name'];
  if (typeof nodeName === 'string' && nodeName.trim().toLowerCase() === 'end') return true;

  return isNodeTypeLike(node, 'end');
}

export function buildEndNodeIdSet(nodes: NodeInfo[]): Set<NodeId> {
  const endNodeIds = new Set<NodeId>();

  for (const node of nodes) {
    const nodeId = getNodeId(node);
    if (!nodeId) continue;

    if (isEndNodeLike(node)) {
      endNodeIds.add(nodeId);
    }
  }

  return endNodeIds;
}

/**
 * Calculates Monte Carlo binomial probability across graph paths
 *
 * @param model Diagram model definition containing nodes and connections
 * @param iterations The amount of runs/loops to test
 * @param probabilityKey Prop key matching node probabilistic values
 * @param maxProbability Range maximum (usually 100 for percentage)
 * @returns An object matching SimulationResult pattern
 */
export function calculateBinomialProbability(
  model: unknown,
  iterations: number,
  probabilityKey: string,
  maxProbability: number,
  startNodeId?: string
): CalculationResult {
  if (!model || !(model as Record<string, unknown>)['nodes'] || ((model as Record<string, unknown>)['nodes'] as NodeInfo[]).length === 0) {
    throw new Error('Diagram must have at least 1 node.');
  }

  if (iterations < 1) {
    throw new Error('Number of iterations must be equal or greater than 1.');
  }

  const nodes: NodeInfo[] = (model as Record<string, unknown>)['nodes'] as NodeInfo[];
  const connections: ConnectionInfo[] = ((model as Record<string, unknown>)['connections'] as ConnectionInfo[]) || [];

  const nodeMap = getNodeMap(nodes);
  const endNodeIds = buildEndNodeIdSet(nodes);
  const hasEndNode = !!findEndNode(nodes) || endNodeIds.size > 0;

  const outgoingConnections = buildOutgoingConnections(connections);
  let successIterations = 0;

  let startNodeToUse: NodeInfo;
  if (startNodeId && nodeMap.has(startNodeId)) {
    startNodeToUse = nodeMap.get(startNodeId)!;
  } else {
    startNodeToUse = findStartNode(nodes, connections);
  }

  const startNodeName =
    ((startNodeToUse.data?.['node name'] as string | undefined) ||
    (startNodeToUse.data?.['name'] as string | undefined) ||
    `Node ${getNodeId(startNodeToUse)}`) as string;

  for (let i = 0; i < iterations; i++) {
    const result = simulateIteration(startNodeToUse, outgoingConnections, nodeMap, endNodeIds, hasEndNode, probabilityKey, maxProbability);

    if (result.isSuccess) successIterations++;
  }

  return {
    startNodeId: getNodeId(startNodeToUse),
    startNodeName,
    iterations,
    successIterations
  };
}

/**
 * Simulates exactly one flow evaluation pass across node conditions.
 */
function simulateIteration(
  startNode: NodeInfo,
  outgoingConnections: Map<NodeId, ConnectionInfo[]>,
  nodeMap: Map<NodeId, NodeInfo>,
  endNodeIds: Set<NodeId>,
  hasEndNode: boolean,
  probabilityKey: string,
  maxProbability: number
): { isSuccess: boolean } {
  const firstSelection: NextNodeSelection | null = getFirstProbabilityNode(startNode, outgoingConnections, nodeMap, probabilityKey);
  if (!firstSelection) return { isSuccess: false };

  let currentNode: NodeInfo | null = firstSelection.node;
  let arrivedByWeightedChoice = firstSelection.usedWeightedChoice;

  let steps = 0;
  const maxSteps = Math.max(nodeMap.size + 1, 2);

  while (currentNode) {
    steps++;
    if (steps > maxSteps) return { isSuccess: false };

    const currentId = getNodeId(currentNode);
    const reachedEndNode = !!currentId && endNodeIds.has(currentId);
    if (hasEndNode && reachedEndNode) {
      return { isSuccess: true };
    }

    const outgoingCount = currentId ? (outgoingConnections.get(currentId)?.length ?? 0) : 0;

    if (hasEndNode && outgoingCount === 0) {
      return { isSuccess: false };
    }

    if (outgoingCount === 0 && arrivedByWeightedChoice) {
      return { isSuccess: true };
    }

    let probability = getEffectiveNodeProbability(currentNode, probabilityKey, maxProbability) / maxProbability;
    if (isNodeTypeLike(currentNode, 'transition') || isStateDiagramNodeLike(currentNode)) {
      probability = 1;
    }

    const randomRoll = Math.random();
    const nodeSucceeded = randomRoll < probability;

    if (nodeSucceeded) {
      const nextSelection = getNextNode(currentNode, outgoingConnections, nodeMap, probabilityKey);
      const nextNode = nextSelection?.node ?? null;

      if (nextNode) {
        currentNode = nextNode;
        arrivedByWeightedChoice = nextSelection?.usedWeightedChoice ?? false;
      } else {
        return { isSuccess: outgoingCount === 0 ? !hasEndNode : false };
      }
    } else {
      return { isSuccess: false };
    }
  }

  return { isSuccess: true };
}
