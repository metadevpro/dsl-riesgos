import { normalizeProbability } from './probability.utils';
import {
    buildOutgoingConnections,
    findEndNode,
    findStartNode,
    getNodeId,
    getNodeMap,
    getNextNodeFromConnection,
    isNodeTypeLike
} from './generalCalculationNodes.utils';
import { ConnectionInfo, NodeId, NodeInfo, pathProbabilityPathResult, pathProbabilityCalculationResult } from '../types';

function clampProbability(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), 1);
}

function resolveNodeProbability(node: NodeInfo, probabilityKey: string, maxProbability: number): number {
    if (isNodeTypeLike(node, 'transition')) {
        return 1;
    }
    const raw = node?.data?.[probabilityKey];
    return normalizeProbability(raw, maxProbability) ?? 1;
}

function calculatePathProbability(
    nodePath: NodeInfo[],
    probabilityKey: string,
    maxProbability: number
): number {
    if (nodePath.length === 0) return 0;

    const innerPath = nodePath.slice(1, nodePath.length - 1);
    if (innerPath.length === 0) return 1;

    return clampProbability(
        innerPath.reduce((acc, node) => acc * resolveNodeProbability(node, probabilityKey, maxProbability), 1)
    );
}

function combinePathProbabilities(pathProbabilities: number[]): number {
    if (pathProbabilities.length === 0) return 0;
    if (pathProbabilities.length === 1) return clampProbability(pathProbabilities[0]);

    const complementaryFailure = pathProbabilities.reduce((acc, pathProbability) => {
        return acc * (1 - clampProbability(pathProbability));
    }, 1);

    return clampProbability(1 - complementaryFailure);
}

function findAllSimplePaths(
    startNode: NodeInfo,
    endNode: NodeInfo,
    outgoingConnections: Map<NodeId, ConnectionInfo[]>,
    nodeMap: Map<NodeId, NodeInfo>
): NodeInfo[][] {
    const startId = getNodeId(startNode);
    const endId = getNodeId(endNode);
    if (!startId || !endId) return [];

    const maxDepth = Math.max(nodeMap.size + 1, 2);
    const results: NodeInfo[][] = [];

    const dfs = (currentNode: NodeInfo, path: NodeInfo[], visited: Set<NodeId>): void => {
        const currentId = getNodeId(currentNode);
        if (!currentId) return;

        if (path.length > maxDepth) return;

        if (currentId === endId) {
            results.push([...path]);
            return;
        }

        const outgoing = outgoingConnections.get(currentId) ?? [];
        for (const connection of outgoing) {
            const nextNode = getNextNodeFromConnection(connection, nodeMap);
            const nextId = nextNode ? getNodeId(nextNode) : undefined;
            if (!nextNode || !nextId || visited.has(nextId)) continue;

            visited.add(nextId);
            path.push(nextNode);
            dfs(nextNode, path, visited);
            path.pop();
            visited.delete(nextId);
        }
    };

    dfs(startNode, [startNode], new Set<NodeId>([startId]));
    return results;
}

export function calculatepathProbabilityProbability(
    model: any,
    probabilityKey: string,
    maxProbability: number,
    selectedStartNodeId?: string
): pathProbabilityCalculationResult {
    if (!model || !Array.isArray(model.nodes) || model.nodes.length === 0) {
        throw new Error('Diagram must have at least 1 node.');
    }

    const nodes: NodeInfo[] = model.nodes;
    const connections: ConnectionInfo[] = model.connections || [];

    const nodeMap = getNodeMap(nodes);
    let startNodeToUse: NodeInfo;

    if (selectedStartNodeId && nodeMap.has(selectedStartNodeId)) {
        startNodeToUse = nodeMap.get(selectedStartNodeId)!;
    } else {
        startNodeToUse = findStartNode(nodes, connections);
    }

    const endNode = findEndNode(nodes);

    if (!endNode) {
        throw new Error('Diagram must define an end node (name "end" or type containing "end").');
    }

    const startNodeId = getNodeId(startNodeToUse);
    const startNodeName = startNodeToUse.data?.['node name'] || startNodeToUse.data?.name || `Node ${startNodeId}`;
    const endNodeId = getNodeId(endNode);

    if (!startNodeId || !endNodeId) {
        throw new Error('Start/End nodes must have valid IDs.');
    }

    const outgoingConnections = buildOutgoingConnections(connections);
    const pathsAsNodes = findAllSimplePaths(startNodeToUse, endNode, outgoingConnections, nodeMap);

    if (pathsAsNodes.length === 0) {
        return {
            startNodeId,
            startNodeName,
            endNodeId,
            posteriorProbability: 0,
            pathCount: 0,
            paths: []
        };
    }

    const paths: pathProbabilityPathResult[] = pathsAsNodes.map(path => ({
        nodeIds: path.map(node => getNodeId(node)).filter((id): id is NodeId => !!id),
        probability: calculatePathProbability(path, probabilityKey, maxProbability)
    }));

    const posteriorProbability = combinePathProbabilities(paths.map(path => path.probability));

    return {
        startNodeId,
        startNodeName,
        endNodeId,
        posteriorProbability,
        pathCount: paths.length,
        paths
    };
}
