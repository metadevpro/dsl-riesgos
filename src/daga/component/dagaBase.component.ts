import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import {
  Canvas,
  CanvasProviderService,
  DagaModule,
  DiagramActionMethod,
  DiagramError,
  DiagramModel,
  DiagramNode,
  DiagramConnection,
  DiagramValidator,
  UpdateValuesAction,
  AddConnectionAction,
  RemoveAction
} from '@metadev/daga-angular';
import { Subscription } from 'rxjs';
import { formatProbabilityPercent, normalizeProbability, MAX_PROBABILITY, PROBABILITY_KEY } from '../utils/probability.utils';
import {
  AUTO_NORMALIZE_ADJACENT_KEY,
  handleConnectionStructuralChange,
  handleConnectionUpdateValues,
  isConnectionAutoNormalizeEnabled
} from '../utils/connectionCalculate.utils';
import { normalizeNodeId } from '../utils/generalCalculationNodes.utils';
import { calculateTheoreticalNodeProbabilities, normalizeWeightValue } from '../utils/binomialWeight.utils';
import { BayesGraph } from '../types';

@Component({
  standalone: true,
  template: `<ng-content />`,
  selector: 'daga-base',
  imports: [DagaModule]
})
export class DagaBaseComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() autoNormalizeAdjacent = true;
  @Input() showTheoreticalProbabilities = false;
  @Input() branchValueKey = 'probability';
  @Input() bayesMode = false;
  @Input() bayesGraph: BayesGraph = new Map();
  @Output() nodeDoubleClicked = new EventEmitter<string>();
  @Output() canvasReady = new EventEmitter<Canvas>();

  private diagramSub?: Subscription;
  private dblClickListener?: () => void;
  private readonly connectionSourceByConnectionId = new Map<string, string>();
  private isApplyingConnectionRebalance = false;
  private readonly probabilityKey = PROBABILITY_KEY;
  private readonly autoNormalizeKey = AUTO_NORMALIZE_ADJACENT_KEY;
  private readonly nodeProbabilityDecoratorSuffix = '-probability-decorator';
  private readonly theoreticalProbabilityDecoratorSuffix = '-theoretical-probability-decorator';
  private readonly bayesDecoratorSuffix = '-bayes-decorator';
  private readonly maxProbability = MAX_PROBABILITY;

  constructor(private canvasProviderService: CanvasProviderService) {}

  /* Implementacion de ngAfterViewInit, ocurre cuando el componente ha sido inicializado */
  ngAfterViewInit(): void {
    const canvas = this.canvasProviderService.getCanvas();

    canvas.validators.push(new DagaBaseDiagramValidator());
    this.refreshProbabilityDecorators(canvas);
    this.refreshConnectionSourceMap(canvas);
    this.canvasReady.emit(canvas);

    // Set up double-click handler for Bayes mode
    if (this.bayesMode) {
      this.setupDoubleClickHandler(canvas);
    }

    this.diagramSub = canvas.diagramChange$.subscribe((change: { action: unknown; method: DiagramActionMethod }) => {
      const previousConnectionSourceMap = new Map(this.connectionSourceByConnectionId);

      if (change.action instanceof UpdateValuesAction) {
        this.handleUpdateValuesAction(canvas, change.action, change.method);
      } else if (change.action instanceof AddConnectionAction || change.action instanceof RemoveAction) {
        if (this.autoNormalizeAdjacent && this.branchValueKey === this.probabilityKey && !this.bayesMode) {
          const removedConnectionSourceNodeIds =
            change.action instanceof RemoveAction
              ? this.getRemovedConnectionSourceNodeIds(canvas, change.action, previousConnectionSourceMap)
              : undefined;

          handleConnectionStructuralChange(canvas, change.action, this.probabilityKey, this.maxProbability, removedConnectionSourceNodeIds);
        }
      }

      this.refreshConnectionWeightLabels(canvas);
      this.refreshProbabilityDecorators(canvas);
      this.refreshConnectionSourceMap(canvas);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bayesGraph'] && this.bayesMode) {
      try {
        const canvas = this.canvasProviderService.getCanvas();
        this.refreshProbabilityDecorators(canvas);
      } catch {
        // Canvas not ready yet
      }
    }
  }

  /* Implementacion de ngOnDestroy */
  ngOnDestroy(): void {
    this.diagramSub?.unsubscribe();
    this.connectionSourceByConnectionId.clear();
    if (this.dblClickListener) {
      this.dblClickListener();
    }
  }

  private setupDoubleClickHandler(canvas: Canvas): void {
    const canvasEl = (canvas as any).element?.nativeElement || document.querySelector('daga-diagram');
    if (!canvasEl) return;

    const handler = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as HTMLElement;

      // Walk up to find a node element
      let el: HTMLElement | null = target;
      while (el && !el.getAttribute('data-node-id') && el !== canvasEl) {
        el = el.parentElement;
      }

      if (el && el.getAttribute('data-node-id')) {
        const nodeId = normalizeNodeId(el.getAttribute('data-node-id')!);
        this.nodeDoubleClicked.emit(nodeId);
        return;
      }

      // Alternative: find node by checking canvas model for the clicked position
      const selectedNodes = canvas.model.nodes.all().filter((n: DiagramNode) => n.selected);
      if (selectedNodes.length === 1) {
        const node = selectedNodes[0];
        if (node.id) {
          this.nodeDoubleClicked.emit(normalizeNodeId(node.id));
        }
      }
    };

    canvasEl.addEventListener('dblclick', handler);
    this.dblClickListener = () => canvasEl.removeEventListener('dblclick', handler);
  }

  private refreshConnectionSourceMap(canvas: Canvas): void {
    this.connectionSourceByConnectionId.clear();

    canvas.model.connections.all().forEach((connection: DiagramConnection) => {
      const sourceNodeId = this.getSourceNodeIdFromConnection(connection);
      if (!sourceNodeId || !connection.id) {
        return;
      }

      this.connectionSourceByConnectionId.set(connection.id, sourceNodeId);
    });
  }

  private getRemovedConnectionSourceNodeIds(
    canvas: Canvas,
    action: RemoveAction,
    previousConnectionSourceMap: Map<string, string>
  ): string[] {
    const affectedNodeIds = new Set<string>();

    action.connectionIds.forEach((connectionId: string) => {
      const sourceNodeId = previousConnectionSourceMap.get(connectionId);
      if (sourceNodeId) {
        affectedNodeIds.add(sourceNodeId);
      }
    });

    // Covers implicit removals (e.g. deleting a node removes attached connections).
    const currentConnectionIds = new Set<string>(canvas.model.connections.all().map((connection: DiagramConnection) => connection.id));

    previousConnectionSourceMap.forEach((sourceNodeId: string, connectionId: string) => {
      if (!currentConnectionIds.has(connectionId)) {
        affectedNodeIds.add(sourceNodeId);
      }
    });

    return Array.from(affectedNodeIds);
  }

  private getSourceNodeIdFromConnection(connection: DiagramConnection): string | undefined {
    if (connection.start && typeof connection.start.getNode === 'function') {
      const nodeId = connection.start.getNode()?.id;
      return typeof nodeId === 'string' ? normalizeNodeId(nodeId) : undefined;
    }

    return undefined;
  }

  /* Manejador de la acción de actualización de valores */
  private handleUpdateValuesAction(canvas: Canvas, action: UpdateValuesAction, method: DiagramActionMethod): void {
    if (this.bayesMode) {
      return;
    }

    if (!action.id) {
      return;
    }

    const valuesChangedTo = method !== DiagramActionMethod.Undo ? action.to : action.from;

    // 1. Si el ID corresponde a una conexión, normalizamos probabilidad editada.
    // Si el switch autoNormalizeAdjacent está activo, también recalculamos hermanos.
    const connection = canvas.model.connections.get(action.id);
    if (connection) {
      const actionHasBranchValue = this.branchValueKey in valuesChangedTo || this.probabilityKey in valuesChangedTo;
      const actionHasAutoNormalizeToggle = this.autoNormalizeKey in valuesChangedTo;

      if (!actionHasBranchValue && !actionHasAutoNormalizeToggle) {
        return;
      }

      if (this.branchValueKey !== this.probabilityKey) {
        if (!actionHasBranchValue) {
          return;
        }

        const rawWeight =
          valuesChangedTo[this.branchValueKey] ?? valuesChangedTo[this.probabilityKey] ?? connection.valueSet.getValue(this.branchValueKey);
        const normalizedWeight = normalizeWeightValue(rawWeight);
        if (normalizedWeight === null) {
          return;
        }

        connection.valueSet.overwriteValues({
          ...valuesChangedTo,
          [this.branchValueKey]: normalizedWeight
        });

        return;
      }

      const rawConnectionProbability = actionHasBranchValue
        ? valuesChangedTo[this.probabilityKey]
        : connection.valueSet.getValue(this.probabilityKey);

      const normalizedConnectionProbability = normalizeProbability(rawConnectionProbability, this.maxProbability);
      if (normalizedConnectionProbability === null) {
        return;
      }

      const autoNormalizePerConnection = isConnectionAutoNormalizeEnabled(connection, this.autoNormalizeKey);
      const autoNormalizeAdjacent = this.autoNormalizeAdjacent && autoNormalizePerConnection;
      const shouldApplyConnectionUpdate = actionHasBranchValue || autoNormalizeAdjacent;

      if (!shouldApplyConnectionUpdate) {
        return;
      }

      if (this.isApplyingConnectionRebalance) {
        return;
      }

      this.isApplyingConnectionRebalance = true;
      try {
        handleConnectionUpdateValues(
          canvas,
          connection,
          normalizedConnectionProbability,
          this.probabilityKey,
          this.maxProbability,
          true,
          autoNormalizeAdjacent
        );
      } finally {
        this.isApplyingConnectionRebalance = false;
      }

      return;
    }

    // 2. Extraer los valores modificados primero y validarlos
    if (!(this.probabilityKey in valuesChangedTo)) {
      return;
    }

    const normalized = normalizeProbability(valuesChangedTo[this.probabilityKey], this.maxProbability);
    if (normalized === null) {
      return;
    }

    // 3. Si el ID corresponde a un nodo, escribimos su valor directo
    const node = canvas.model.nodes.get(action.id);
    if (node) {
      if (node.type && node.type.id === 'state-diagram-node') {
        const currentProb = node.valueSet.getValue(this.probabilityKey);
        if (currentProb !== this.maxProbability || valuesChangedTo[this.probabilityKey] !== this.maxProbability) {
          node.valueSet.overwriteValues({
            ...valuesChangedTo,
            [this.probabilityKey]: this.maxProbability
          });
        }
        return;
      }

      const currentValue = Number(node.valueSet.getValue(this.probabilityKey));
      if (!Number.isFinite(currentValue) || Math.abs(currentValue - normalized) > 1e-6) {
        node.valueSet.overwriteValues({
          ...valuesChangedTo,
          [this.probabilityKey]: normalized
        });
      }
    }
  }

  private refreshProbabilityDecorators(canvas: Canvas): void {
    this.removeProbabilityDecorators(canvas);

    if (this.bayesMode) {
      // In Bayes mode, draw the bayesian decorators inside nodes
      canvas.model.nodes
        .all()
        .filter((node: DiagramNode | undefined | null) => this.isNodeRenderable(node))
        .forEach((node: DiagramNode) => {
          this.drawBayesDecorator(canvas, node);
        });
      return;
    }

    let theoreticalProbabilitiesByNodeId = new Map<string, number>();
    if (this.showTheoreticalProbabilities) {
      try {
        theoreticalProbabilitiesByNodeId = calculateTheoreticalNodeProbabilities(
          canvas.model,
          this.probabilityKey,
          this.branchValueKey,
          this.maxProbability
        );
      } catch (err) {
        console.error('Failed to calculate theoretical node probabilities', err);
      }
    }

    canvas.model.nodes
      .all()
      .filter((node: DiagramNode | undefined | null) => this.isNodeRenderable(node))
      .forEach((node: DiagramNode) => {
        try {
          this.drawNodeProbabilityDecorator(canvas, node);

          if (this.showTheoreticalProbabilities) {
            this.drawTheoreticalProbabilityDecorator(canvas, node, theoreticalProbabilitiesByNodeId.get(node.id));
          }
        } catch (err) {
          console.error('Failed to draw decorators for node', node.id, err);
        }
      });
  }

  private refreshConnectionWeightLabels(canvas: Canvas): void {
    const shouldShowWeightLabels = this.branchValueKey !== this.probabilityKey;

    canvas.model.connections.all().forEach((connection: DiagramConnection) => {
      const nextLabel = shouldShowWeightLabels ? this.getConnectionWeightLabel(connection) : '';

      if (connection.endLabel === nextLabel) {
        return;
      }

      connection.endLabel = nextLabel;
      connection.updateInView();
    });
  }

  private getConnectionWeightLabel(connection: DiagramConnection): string {
    const normalizedWeight = normalizeWeightValue(connection.valueSet.getValue(this.branchValueKey));
    return normalizedWeight == null ? '' : String(normalizedWeight);
  }

  private isNodeRenderable(node: DiagramNode | undefined | null): node is DiagramNode {
    if (!node) {
      return false;
    }

    const hasCoords = Array.isArray(node.coords) && node.coords.length >= 2;
    const hasSize = Number.isFinite(node.width) && Number.isFinite(node.height);
    const hasId = typeof node.id === 'string' && node.id.length > 0;
    const hasValueSet = !!node.valueSet;

    return hasCoords && hasSize && hasId && hasValueSet;
  }

  private removeProbabilityDecorators(canvas: Canvas): void {
    canvas.model.decorators
      .all(true)
      .filter((decorator: { id: string }) => {
        return (
          decorator.id &&
          (decorator.id.endsWith(this.nodeProbabilityDecoratorSuffix) ||
            decorator.id.endsWith(this.theoreticalProbabilityDecoratorSuffix) ||
            decorator.id.endsWith(this.bayesDecoratorSuffix))
        );
      })
      .forEach((decorator: { id: string }) => canvas.model.decorators.remove(decorator.id));
  }

  private drawNodeProbabilityDecorator(canvas: Canvas, node: DiagramNode): void {
    if (!this.isNodeRenderable(node)) {
      return;
    }

    if (node.type && node.type.id !== 'event-diagram-node') {
      return;
    }

    let rawProbability: any;
    try {
      rawProbability = node.valueSet.getValue(this.probabilityKey);
    } catch (e) {
      // Fallback to 100% if the node type doesn't have a 'probability' property defined in its schema
      if (node.type && node.type.id === 'state-diagram-node') {
        rawProbability = this.maxProbability;
      }
    }

    const percentageText = formatProbabilityPercent(rawProbability, this.maxProbability);

    const decoratorId = `${node.id}${this.nodeProbabilityDecoratorSuffix}`;
    const safeWidth = Math.max(node.width, 10);
    const labelHtml = `<text x="${Math.max(safeWidth / 2, 12)}" y="24" text-anchor="middle" font-size="16" fill="#000">${percentageText}</text>`;

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    canvas.model.decorators.new(node, [node.coords[0], node.coords[1] + node.height], safeWidth, 40, priority, labelHtml, decoratorId);
  }

  private drawTheoreticalProbabilityDecorator(canvas: Canvas, node: DiagramNode, theoreticalProbability: number | undefined): void {
    if (theoreticalProbability == null || !Number.isFinite(theoreticalProbability)) {
      return;
    }

    const totalLabel = formatProbabilityPercent(theoreticalProbability, this.maxProbability);
    const decoratorId = `${node.id}${this.theoreticalProbabilityDecoratorSuffix}`;
    const decoratorWidth = Math.max(node.width, 10);
    const decoratorHeight = 24;
    const labelHtml = `<text x="${Math.max(decoratorWidth / 2, 12)}" y="16" text-anchor="middle" font-size="15" fill="#b71c1c">${totalLabel}</text>`;

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    canvas.model.decorators.new(
      node,
      [node.coords[0], node.coords[1] - decoratorHeight + 4],
      decoratorWidth,
      decoratorHeight,
      priority,
      labelHtml,
      decoratorId
    );
  }

  /**
   * Draws the Bayesian decorator INSIDE the node.
   * Shows: two probability bars (Sí/No) with percentages and an evidence badge.
   * Positioned below the node name label to avoid overlap.
   */
  private drawBayesDecorator(canvas: Canvas, node: DiagramNode): void {
    if (!this.isNodeRenderable(node)) return;

    const nodeId = normalizeNodeId(node.id);
    const bayesNode = this.bayesGraph.get(nodeId);

    const pSi = bayesNode?.marginals?.si ?? 0.5;
    const pNo = bayesNode?.marginals?.no ?? 0.5;
    const evidence = bayesNode?.evidence ?? null;

    const pSiPct = (pSi * 100).toFixed(3);
    const pNoPct = (pNo * 100).toFixed(3);
    const barWidthSi = Math.max(pSi * 100, 0.5);
    const barWidthNo = Math.max(pNo * 100, 0.5);

    // Evidence badge
    let badgeColor = '#888';
    let badgeBg = '#f0f0f0';
    let badgeText = '? sin evidencia';
    if (evidence === 'si') {
      badgeColor = '#27500A';
      badgeBg = '#EAF3DE';
      badgeText = 'Evidencia: Sí';
    } else if (evidence === 'no') {
      badgeColor = '#791F1F';
      badgeBg = '#FCEBEB';
      badgeText = 'Evidencia: No';
    }

    const decoratorId = `${node.id}${this.bayesDecoratorSuffix}`;
    const decoratorWidth = node.width - 8;
    const decoratorHeight = 70;
    const offsetY = 28; // Below the node name

    const labelHtml = `
      <foreignObject x="4" y="0" width="${decoratorWidth}" height="${decoratorHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;padding:2px 4px;">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">
            <span style="color:#888;min-width:18px;font-size:10px;">Sí</span>
            <div style="flex:1;height:4px;background:#eee;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${barWidthSi}%;background:#E24B4A;border-radius:2px;transition:width .4s;"></div></div>
            <span style="color:#A32D2D;font-weight:600;min-width:36px;text-align:right;font-size:10px;">${pSiPct}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;">
            <span style="color:#888;min-width:18px;font-size:10px;">No</span>
            <div style="flex:1;height:4px;background:#eee;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${barWidthNo}%;background:#E24B4A;border-radius:2px;transition:width .4s;"></div></div>
            <span style="color:#A32D2D;font-weight:600;min-width:36px;text-align:right;font-size:10px;">${pNoPct}%</span>
          </div>
          <div style="display:inline-block;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:500;background:${badgeBg};color:${badgeColor};">${badgeText}</div>
        </div>
      </foreignObject>
    `;

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    canvas.model.decorators.new(
      node,
      [node.coords[0], node.coords[1] + offsetY],
      node.width,
      decoratorHeight,
      priority,
      labelHtml,
      decoratorId
    );
  }
}

class DagaBaseDiagramValidator implements DiagramValidator {
  validate(model: DiagramModel): DiagramError[] {
    const errors: DiagramError[] = [];
    if (model.nodes.length === 0) {
      errors.push({ message: 'Diagram is empty!' });
    }
    return errors;
  }
}
