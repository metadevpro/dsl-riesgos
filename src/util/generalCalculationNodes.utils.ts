import { ConnectionEndpoints, ConnectionInfo, NodeId, NodeInfo } from '../models/types';
import { normalizeProbability } from './probability.utils';

const STATE_DIAGRAM_NODE_TYPE_ID = 'state-diagram-node';

export function normalizeNodeId(rawId: string): string {
  return rawId.replace(/_port_\d+$/i, '');
}

function toNodeId(candidate: unknown): NodeId | undefined {
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return normalizeNodeId(String(candidate));
  }
  return undefined;
}

export function resolveNodeId(candidate: unknown): string | undefined {
  if (Array.isArray(candidate)) {
    const first = candidate[0];
    const asId = toNodeId(first);
    if (asId) return asId;

    if (first && typeof first === 'object') {
      return resolveNodeId(first);
    }
    return undefined;
  }

  const asId = toNodeId(candidate);
  if (asId) return asId;

  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const obj = candidate as Record<string, unknown>;
  const direct = obj['id'] ?? obj['nodeId'] ?? obj['node'] ?? obj['value'] ?? obj['ref'] ?? obj['element'] ?? obj['elementId'];

  if (typeof direct === 'string' || typeof direct === 'number') {
    return normalizeNodeId(String(direct));
  }

  if (direct && typeof direct === 'object') {
    const nested = direct as Record<string, unknown>;
    const nestedId = nested['id'] ?? nested['nodeId'] ?? nested['elementId'];
    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return normalizeNodeId(String(nestedId));
    }
  }

  return undefined;
}

export function extractConnectionEndpoints(connection: unknown): ConnectionEndpoints {
  if (!connection || typeof connection !== 'object') {
    return {};
  }

  const conn = connection as Record<string, unknown>;

  const startCandidate = conn['startNode'] ?? conn['sourceNode'] ?? conn['fromNode'] ?? conn['from'] ?? conn['source'] ?? conn['start'];
  const endCandidate = conn['endNode'] ?? conn['targetNode'] ?? conn['toNode'] ?? conn['to'] ?? conn['target'] ?? conn['end'];

  return {
    startId: resolveNodeId(startCandidate),
    endId: resolveNodeId(endCandidate)
  };
}

export function getNodeId(node: NodeInfo): NodeId | undefined {
  return toNodeId((node as NodeInfo)?.id);
}

export function buildOutgoingConnections(connections: ConnectionInfo[]): Map<NodeId, ConnectionInfo[]> {
  const outgoing = new Map<NodeId, ConnectionInfo[]>();

  connections.forEach((conn) => {
    const { startId, endId } = extractConnectionEndpoints(conn);
    if (!startId || !endId) return;

    const current = outgoing.get(startId) ?? [];
    current.push(conn);
    outgoing.set(startId, current);
  });

  return outgoing;
}

export function isNodeName(node: NodeInfo, expectedName: string): boolean {
  const normalizedExpected = expectedName.trim().toLowerCase();
  const candidateName = node?.data?.['node name'] ?? node?.data?.['name'] ?? (node as NodeInfo)?.['name'];

  return typeof candidateName === 'string' && candidateName.trim().toLowerCase() === normalizedExpected;
}

export function isNodeTypeLike(node: NodeInfo, fragment: string): boolean {
  const normalizedFragment = fragment.toLowerCase();
  const candidateType = (node as NodeInfo)?.['type'] ?? (node as NodeInfo)?.['nodeType'] ?? node?.data?.['type'];

  return typeof candidateType === 'string' && candidateType.toLowerCase().includes(normalizedFragment);
}

export function findNamedNode(nodes: NodeInfo[], expectedName: string): NodeInfo | undefined {
  return nodes.find((node) => isNodeName(node, expectedName));
}

export function isEndNodeLike(node: NodeInfo): boolean {
  if (node?.data?.['end'] === true) return true;
  if (isNodeName(node, 'end')) return true;
  return isNodeTypeLike(node, 'end');
}

export function findStartNodes(nodes: NodeInfo[], connections: ConnectionInfo[]): NodeInfo[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const nodesWithInput = new Set<NodeId>();
  connections.forEach((conn) => {
    const { endId } = extractConnectionEndpoints(conn);
    if (endId) nodesWithInput.add(endId);
  });

  const startNodes = nodes.filter((node) => {
    const nodeId = getNodeId(node);
    if (!nodeId || nodesWithInput.has(nodeId)) return false;
    if (isEndNodeLike(node)) return false;
    return true;
  });

  return startNodes;
}

export function findStartNode(nodes: NodeInfo[], connections: ConnectionInfo[]): NodeInfo {
  if (!nodes || nodes.length === 0) {
    throw new Error('Diagram has no nodes.');
  }

  const startByName = findNamedNode(nodes, 'start');
  if (startByName) return startByName;

  const startByType = nodes.find((node) => isNodeTypeLike(node, 'start'));
  if (startByType) return startByType;

  const possibleStarts = findStartNodes(nodes, connections);
  return possibleStarts.length > 0 ? possibleStarts[0] : nodes[0];
}

export function findEndNode(nodes: NodeInfo[]): NodeInfo | undefined {
  const endByFlag = nodes.find((node) => node?.data?.['end'] === true);
  if (endByFlag) return endByFlag;

  const endByName = findNamedNode(nodes, 'end');
  if (endByName) return endByName;

  return nodes.find((node) => isNodeTypeLike(node, 'end'));
}

export function getNodeMap(nodes: NodeInfo[]): Map<NodeId, NodeInfo> {
  const nodeMap = new Map<NodeId, NodeInfo>();

  nodes.forEach((node) => {
    const nodeId = getNodeId(node);
    if (nodeId) nodeMap.set(nodeId, node);
  });

  return nodeMap;
}

export function getNextNodeFromConnection(connection: ConnectionInfo, nodeMap: Map<NodeId, NodeInfo>): NodeInfo | null {
  const { endId } = extractConnectionEndpoints(connection);
  return endId ? (nodeMap.get(endId) ?? null) : null;
}

/**
 * Detects a cycle in the directed graph defined by nodes + connections.
 * Returns the list of node ids that form the cycle (first repeated node included at both ends),
 * or null if the graph is acyclic.
 */
export function detectCycle(nodes: NodeInfo[], connections: ConnectionInfo[]): NodeId[] | null {
  const adjacency = new Map<NodeId, NodeId[]>();

  connections.forEach((conn) => {
    const { startId, endId } = extractConnectionEndpoints(conn);
    if (!startId || !endId) return;
    const list = adjacency.get(startId) ?? [];
    list.push(endId);
    adjacency.set(startId, list);
  });

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<NodeId, number>();
  const parent = new Map<NodeId, NodeId | null>();

  const nodeIds: NodeId[] = [];
  nodes.forEach((node) => {
    const id = getNodeId(node);
    if (id) {
      nodeIds.push(id);
      color.set(id, WHITE);
    }
  });

  for (const id of adjacency.keys()) {
    if (!color.has(id)) {
      nodeIds.push(id);
      color.set(id, WHITE);
    }
  }

  const buildCyclePath = (from: NodeId, to: NodeId): NodeId[] => {
    const path: NodeId[] = [to];
    let cursor: NodeId | null = from;
    while (cursor && cursor !== to) {
      path.push(cursor);
      cursor = parent.get(cursor) ?? null;
    }
    path.push(to);
    return path.reverse();
  };

  const stack: { id: NodeId; iter: Iterator<NodeId> }[] = [];

  for (const root of nodeIds) {
    if (color.get(root) !== WHITE) continue;

    color.set(root, GRAY);
    parent.set(root, null);
    stack.push({ id: root, iter: (adjacency.get(root) ?? [])[Symbol.iterator]() });

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const next = frame.iter.next();

      if (next.done) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }

      const neighbor = next.value;
      const neighborColor = color.get(neighbor) ?? WHITE;

      if (neighborColor === GRAY) {
        return buildCyclePath(frame.id, neighbor);
      }
      if (neighborColor === WHITE) {
        color.set(neighbor, GRAY);
        parent.set(neighbor, frame.id);
        stack.push({ id: neighbor, iter: (adjacency.get(neighbor) ?? [])[Symbol.iterator]() });
      }
    }
  }

  return null;
}

/**
 * Returns true for any node whose `type` resolves to `state-diagram-node`,
 * supporting both the string form and the daga object form `{ id: 'state-diagram-node' }`.
 */
export function isStateDiagramNodeLike(node: NodeInfo | { type?: unknown } | null | undefined): boolean {
  if (!node || typeof node !== 'object') return false;
  const nodeType = (node as Record<string, unknown>)['type'];
  if (typeof nodeType === 'string') {
    return nodeType === STATE_DIAGRAM_NODE_TYPE_ID;
  }
  if (nodeType && typeof nodeType === 'object') {
    const nodeTypeId = (nodeType as Record<string, unknown>)['id'];
    return typeof nodeTypeId === 'string' && nodeTypeId === STATE_DIAGRAM_NODE_TYPE_ID;
  }
  return false;
}

/**
 * Effective probability of a node in the probability scale (0..maxProbability).
 * `state-diagram-node` always evaluates to `maxProbability` (the node is a
 * deterministic transition). For other nodes, reads `data[probabilityKey]` /
 * `valueSet.getValue(probabilityKey)` and normalizes. Falls back to `maxProbability`
 * when the value is missing or unparseable.
 */
export function getEffectiveNodeProbability(node: NodeInfo, probabilityKey: string, maxProbability: number): number {
  if (isStateDiagramNodeLike(node)) return maxProbability;

  const nodeRecord = node as Record<string, unknown>;
  const data = nodeRecord['data'];
  let raw: unknown;
  if (data && typeof data === 'object') {
    raw = (data as Record<string, unknown>)[probabilityKey];
  }
  if (raw === undefined) {
    const valueSet = nodeRecord['valueSet'];
    if (valueSet && typeof (valueSet as { getValue?: (k: string) => unknown }).getValue === 'function') {
      try {
        raw = (valueSet as { getValue: (k: string) => unknown }).getValue(probabilityKey);
      } catch {
        raw = undefined;
      }
    } else if (valueSet && typeof valueSet === 'object') {
      const values = (valueSet as Record<string, unknown>)['values'];
      if (values && typeof values === 'object') {
        raw = (values as Record<string, unknown>)[probabilityKey];
      }
    }
  }

  return normalizeProbability(raw, maxProbability) ?? maxProbability;
}

export function getNodeDisplayName(node: NodeInfo | undefined): string | undefined {
  if (!node) return undefined;
  const name = node?.data?.['node name'] ?? node?.data?.['name'] ?? (node as NodeInfo)?.['name'];
  return typeof name === 'string' && name.trim().length > 0 ? name : undefined;
}
