import { NodeInfo, ConnectionInfo, ConnectionEndpoints, NodeId } from '../types';

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
  return toNodeId((node as any)?.id);
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
  const candidateName = node?.data?.['node name'] ?? node?.data?.name ?? (node as any)?.name;

  return typeof candidateName === 'string' && candidateName.trim().toLowerCase() === normalizedExpected;
}

export function isNodeTypeLike(node: NodeInfo, fragment: string): boolean {
  const normalizedFragment = fragment.toLowerCase();
  const candidateType = (node as any)?.type ?? (node as any)?.nodeType ?? node?.data?.type;

  return typeof candidateType === 'string' && candidateType.toLowerCase().includes(normalizedFragment);
}

export function findNamedNode(nodes: NodeInfo[], expectedName: string): NodeInfo | undefined {
  return nodes.find((node) => isNodeName(node, expectedName));
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
    return !!nodeId && !nodesWithInput.has(nodeId);
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
