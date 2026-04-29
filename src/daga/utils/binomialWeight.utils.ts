import { normalizeProbability } from './probability.utils';
import {
  buildOutgoingConnections,
  findStartNode,
  findStartNodes,
  getNodeId,
  getNodeMap,
  getNextNodeFromConnection
} from './generalCalculationNodes.utils';
import { ConnectionInfo, NodeId, NodeInfo } from '../types';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const collection = value as { all?: () => T[] };
    if (typeof collection.all === 'function') {
      return collection.all() ?? [];
    }
  }

  return [];
}

function normalizeNumericInput(rawValue: string): string {
  const compact = rawValue.replace(/\s+/g, '');
  const hasComma = compact.includes(',');
  const hasDot = compact.includes('.');

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(',');
    const lastDot = compact.lastIndexOf('.');

    if (lastComma > lastDot) {
      return compact.replace(/\./g, '').replace(',', '.');
    }

    return compact.replace(/,/g, '');
  }

  if (hasComma) {
    return compact.replace(',', '.');
  }

  return compact;
}

export function normalizeWeightValue(rawValue: unknown): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) && rawValue >= 0 ? Number(rawValue.toFixed(4)) : null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const numericValue = Number(normalizeNumericInput(trimmed));
    return Number.isFinite(numericValue) && numericValue >= 0 ? Number(numericValue.toFixed(4)) : null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Number(numericValue.toFixed(4)) : null;
}

function readConnectionValue(connection: ConnectionInfo, keys: string[]): unknown {
  if (!connection || typeof connection !== 'object') {
    return undefined;
  }

  const conn = connection as Record<string, unknown>;
  const data = conn['data'];
  const valueSet = conn['valueSet'];

  if (data && typeof data === 'object') {
    const dataObject = data as Record<string, unknown>;
    for (const key of keys) {
      if (dataObject[key] !== undefined) {
        return dataObject[key];
      }
    }
  }

  if (valueSet && typeof valueSet === 'object') {
    const valueSetObject = valueSet as Record<string, unknown>;
    const values = valueSetObject['values'];

    if (values && typeof values === 'object') {
      const valuesObject = values as Record<string, unknown>;
      for (const key of keys) {
        if (valuesObject[key] !== undefined) {
          return valuesObject[key];
        }
      }
    }

    for (const key of keys) {
      if (valueSetObject[key] !== undefined) {
        return valueSetObject[key];
      }
    }
  }

  for (const key of keys) {
    if (conn[key] !== undefined) {
      return conn[key];
    }
  }

  return undefined;
}

function readNodeValue(node: NodeInfo, keys: string[]): unknown {
  if (!node || typeof node !== 'object') {
    return undefined;
  }

  const nodeRecord = node as Record<string, unknown>;
  const data = nodeRecord['data'];
  const valueSet = nodeRecord['valueSet'];

  if (data && typeof data === 'object') {
    const dataObject = data as Record<string, unknown>;
    for (const key of keys) {
      if (dataObject[key] !== undefined) {
        return dataObject[key];
      }
    }
  }

  if (valueSet && typeof valueSet === 'object') {
    const valueSetObject = valueSet as Record<string, unknown>;
    const values = valueSetObject['values'];

    if (values && typeof values === 'object') {
      const valuesObject = values as Record<string, unknown>;
      for (const key of keys) {
        if (valuesObject[key] !== undefined) {
          return valuesObject[key];
        }
      }
    }

    for (const key of keys) {
      if (valueSetObject[key] !== undefined) {
        return valueSetObject[key];
      }
    }
  }

  for (const key of keys) {
    if (nodeRecord[key] !== undefined) {
      return nodeRecord[key];
    }
  }

  return undefined;
}

function resolveConnectionWeight(connection: ConnectionInfo, branchValueKey: string): number {
  const rawValue = readConnectionValue(connection, [branchValueKey, 'weight', 'probability', 'chance']);
  return normalizeWeightValue(rawValue) ?? 1;
}

function resolveNodeProbability(node: NodeInfo, probabilityKey: string, maxProbability: number): number {
  const nodeType = (node as Record<string, unknown>)?.['type'];
  if (typeof nodeType === 'string' && nodeType === 'state-diagram-node') {
    return 1;
  }
  if (nodeType && typeof nodeType === 'object') {
    const nodeTypeId =
      typeof (nodeType as Record<string, unknown>)['id'] === 'string' ? String((nodeType as Record<string, unknown>)['id']) : '';

    if (nodeTypeId === 'state-diagram-node') {
      return 1;
    }
  }

  const rawValue = readNodeValue(node, [probabilityKey, 'probability', 'chance']);
  return normalizeProbability(rawValue, maxProbability) ?? 1;
}

function addProbabilityContribution(target: Map<NodeId, number>, nodeId: NodeId, probability: number): void {
  const current = target.get(nodeId) ?? 0;
  target.set(nodeId, Number((current + probability).toFixed(6)));
}

function walkTheoreticalProbabilities(
  currentNode: NodeInfo,
  accumulatedProbability: number,
  outgoingConnections: Map<NodeId, ConnectionInfo[]>,
  nodeMap: Map<NodeId, NodeInfo>,
  results: Map<NodeId, number>,
  visited: Set<NodeId>,
  startNodeId: NodeId | undefined,
  probabilityKey: string,
  branchValueKey: string,
  maxProbability: number
): void {
  const currentId = getNodeId(currentNode);
  if (!currentId) {
    return;
  }

  const nodeProbabilityFactor = currentId === startNodeId ? 1 : resolveNodeProbability(currentNode, probabilityKey, maxProbability);
  const nodeProbability = Number((accumulatedProbability * nodeProbabilityFactor).toFixed(6));
  addProbabilityContribution(results, currentId, nodeProbability);

  const outgoing = outgoingConnections.get(currentId) ?? [];
  if (outgoing.length === 0) {
    return;
  }

  const branchWeights = outgoing.map((connection) => resolveConnectionWeight(connection, branchValueKey));
  const totalWeight = branchWeights.reduce((acc, weight) => acc + weight, 0);
  if (totalWeight <= 0) {
    return;
  }

  outgoing.forEach((connection, index) => {
    const branchWeight = branchWeights[index] ?? 0;
    if (branchWeight <= 0) {
      return;
    }

    const nextNode = getNextNodeFromConnection(connection, nodeMap);
    const nextId = nextNode ? getNodeId(nextNode) : undefined;
    if (!nextNode || !nextId || visited.has(nextId)) {
      return;
    }

    visited.add(nextId);
    walkTheoreticalProbabilities(
      nextNode,
      nodeProbability * (branchWeight / totalWeight),
      outgoingConnections,
      nodeMap,
      results,
      visited,
      startNodeId,
      probabilityKey,
      branchValueKey,
      maxProbability
    );
    visited.delete(nextId);
  });
}

export function calculateTheoreticalNodeProbabilities(
  model: any,
  probabilityKey: string,
  branchValueKey: string,
  maxProbability: number
): Map<NodeId, number> {
  const results = new Map<NodeId, number>();

  if (!model) {
    return results;
  }

  const nodes: NodeInfo[] = toArray<NodeInfo>(model.nodes);
  const connections: ConnectionInfo[] = toArray<ConnectionInfo>(model.connections);

  if (nodes.length === 0) {
    return results;
  }

  const startNodes = findStartNodes(nodes, connections);

  if (startNodes.length === 0) {
    return results;
  }

  const nodeMap = getNodeMap(nodes);
  const outgoingConnections = buildOutgoingConnections(connections);

  for (const startNode of startNodes) {
    const startNodeId = getNodeId(startNode);
    if (!startNodeId) continue;

    walkTheoreticalProbabilities(
      startNode,
      1,
      outgoingConnections,
      nodeMap,
      results,
      new Set<NodeId>([startNodeId]),
      startNodeId,
      probabilityKey,
      branchValueKey,
      maxProbability
    );
  }

  return results;
}
