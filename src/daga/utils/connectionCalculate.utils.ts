import {
  Canvas,
  DiagramConnection,
  AddConnectionAction,
  RemoveAction
} from '@metadev/daga-angular';
import { normalizeNodeId } from './generalCalculationNodes.utils';

const PROBABILITY_SCALE = 10_000;
export const AUTO_NORMALIZE_ADJACENT_KEY = 'autoNormalizeAdjacent';

/**
 * Handles explicit probability updates on a valid Connection.
 * Whenever a user manually edits a connection's probability, we apply the change
 * and rebalance the rest of the connections stemming from the same node.
 */
export function handleConnectionUpdateValues(
  canvas: Canvas,
  connection: DiagramConnection,
  normalizedProbability: number,
  probabilityKey: string,
  maxProbability: number,
  forceRebalance: boolean = false,
  autoNormalizeAdjacent: boolean = true
): void {
  const sourceNodeId = getSourceNodeId(connection);
  if (!sourceNodeId || !autoNormalizeAdjacent) {
    overwriteConnectionProbability(connection, probabilityKey, normalizedProbability);
    return;
  }

  if (forceRebalance) {
    rebalanceOutgoingConnections(
      canvas,
      sourceNodeId,
      probabilityKey,
      maxProbability,
      connection.id,
      normalizedProbability
    );
    return;
  }

  const currentValue = Number(connection.valueSet.getValue(probabilityKey));    
  // If the manual modification introduces a numeric delta, trigger rebalancing.
  if (!Number.isFinite(currentValue) || Math.abs(currentValue - normalizedProbability) > 1e-6) {
    rebalanceOutgoingConnections(
      canvas,
      sourceNodeId,
      probabilityKey,
      maxProbability,
      connection.id,
      normalizedProbability
    );
  }
}

/**
 * Hook to react when the diagram structure changes (connections added or removed).
 * Distributes probability equitably across all current siblings of the relevant branch.
 */
export function handleConnectionStructuralChange(
  canvas: Canvas,
  action: AddConnectionAction | RemoveAction,
  probabilityKey: string,
  maxProbability: number,
  removedConnectionSourceNodeIds: string[] = []
): void {
  const modifiedNodes = new Set<string>();

  if (action instanceof AddConnectionAction) {
    // When adding, we strictly care about the source
    const sourceNodeId = normalizeNodeId(action.startId);
    if (sourceNodeId) {
      modifiedNodes.add(sourceNodeId);
    }
  } else if (action instanceof RemoveAction) {
    removedConnectionSourceNodeIds
      .map((nodeId: string) => normalizeNodeId(nodeId))
      .filter((nodeId: string | undefined): nodeId is string => !!nodeId)
      .forEach((nodeId: string) => modifiedNodes.add(nodeId));

    // Fallback for scenarios where removed IDs are unavailable but the connections are currently present.
    if (modifiedNodes.size === 0) {
      action.connectionIds.forEach((connectionId: string) => {
        const connection = canvas.model.connections.get(connectionId);
        const sourceNodeId = connection ? getSourceNodeId(connection) : undefined;
        if (sourceNodeId) {
          modifiedNodes.add(sourceNodeId);
        }
      });
    }
  }

  // Trigger equal rebalancing for the affected branches
  modifiedNodes.forEach(nodeId => {
    rebalanceOutgoingConnections(canvas, nodeId, probabilityKey, maxProbability);
  });
}

/**
 * Rebalances probabilty values so that the sum of all outgoing connections from a node is exactly `maxProbability`.
 * Ensures numeric limits strictly up to 4 decimal places.
 * 
 * @param manualConnectionId - Optional specific ID of the connection the user manually edited
 * @param manualValue - Optional the assigned locked value to respect during the split
 */
function rebalanceOutgoingConnections(
  canvas: Canvas,
  sourceNodeId: string,
  probabilityKey: string,
  maxProbability: number,
  manualConnectionId?: string,
  manualValue?: number
): void {
  const outgoingConnections = canvas.model.connections.all().filter((c: DiagramConnection) => {
    return getSourceNodeId(c) === sourceNodeId;
  });

  if (outgoingConnections.length === 0) {
    return; // No child connections to manage
  }

  const totalProbabilityUnits = toProbabilityUnits(maxProbability, maxProbability);

  // Manual split scenario: the user locked a connection into a specific fraction:
  if (manualConnectionId && manualValue !== undefined) {
    const others = outgoingConnections.filter((c: DiagramConnection) => c.id !== manualConnectionId);

    // If there were no other siblings, just force the max probability bounds on this connection explicitly
    if (others.length === 0) {
      const onlyConn = outgoingConnections[0];
      onlyConn.valueSet.overwriteValues({
        [probabilityKey]: fromProbabilityUnits(totalProbabilityUnits)
      });
      return;
    }

    const safeManualUnits = toProbabilityUnits(manualValue, maxProbability);
    const manualConn = outgoingConnections.find((c: DiagramConnection) => c.id === manualConnectionId);
    if (!manualConn) {
      applyDistributedProbabilities(
        outgoingConnections,
        distributeProbabilityUnits(outgoingConnections.length, totalProbabilityUnits),
        probabilityKey
      );
      return;
    }

    manualConn.valueSet.overwriteValues({
      [probabilityKey]: fromProbabilityUnits(safeManualUnits)
    });

    // Split remaining units and assign residue to one branch so the total is exact.
    const remainingUnits = Math.max(0, totalProbabilityUnits - safeManualUnits);
    const distributedOtherUnits = distributeProbabilityUnits(others.length, remainingUnits);
    applyDistributedProbabilities(others, distributedOtherUnits, probabilityKey);

  } else {
    const distributedUnits = distributeProbabilityUnits(outgoingConnections.length, totalProbabilityUnits);
    applyDistributedProbabilities(outgoingConnections, distributedUnits, probabilityKey);
  }
}

function applyDistributedProbabilities(
  connections: DiagramConnection[],
  unitsByConnection: number[],
  probabilityKey: string
): void {
  connections.forEach((connection: DiagramConnection, index: number) => {
    const units = unitsByConnection[index] ?? 0;
    connection.valueSet.overwriteValues({
      [probabilityKey]: fromProbabilityUnits(units)
    });
  });
}

function overwriteConnectionProbability(
  connection: DiagramConnection,
  probabilityKey: string,
  value: number
): void {
  const safeValue = Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
  connection.valueSet.overwriteValues({
    [probabilityKey]: safeValue
  });
}

function distributeProbabilityUnits(connectionCount: number, totalUnits: number): number[] {
  if (connectionCount <= 0) {
    return [];
  }

  const baseUnits = Math.floor(totalUnits / connectionCount);
  const remainderUnits = totalUnits - (baseUnits * connectionCount);
  const distribution = new Array<number>(connectionCount).fill(baseUnits);

  if (remainderUnits > 0) {
    distribution[0] += remainderUnits;
  }

  return distribution;
}

function toProbabilityUnits(value: number, maxProbability: number): number {
  const clamped = Math.min(Math.max(0, Number.isFinite(value) ? value : 0), maxProbability);
  return Math.round(clamped * PROBABILITY_SCALE);
}

function fromProbabilityUnits(units: number): number {
  return Number((units / PROBABILITY_SCALE).toFixed(4));
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

export function isConnectionAutoNormalizeEnabled(
  connection: DiagramConnection,
  autoNormalizeKey: string = AUTO_NORMALIZE_ADJACENT_KEY
): boolean {
  const rawValue = connection.valueSet.getValue(autoNormalizeKey);
  const parsed = parseBooleanLike(rawValue);

  return parsed ?? true;
}

/**
 * Safely extracts the source Node's string ID from a connection endpoint
 */
function getSourceNodeId(connection: DiagramConnection): string | undefined {
  if (connection.start && typeof connection.start.getNode === 'function') {     
    return connection.start.getNode()?.id;
  }
  return undefined;
}
