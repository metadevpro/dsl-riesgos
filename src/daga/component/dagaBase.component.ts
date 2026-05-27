import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
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
import { isStateDiagramNodeLike, normalizeNodeId } from '../utils/generalCalculationNodes.utils';
import { calculateTheoreticalNodeProbabilities, normalizeWeightValue } from '../utils/binomial/binomialWeight.utils';
import { BayesGraph } from '../types';

@Component({
  standalone: true,
  template: `<ng-content />`,
  selector: 'app-daga-base',
  imports: [DagaModule]
})
export class DagaBaseComponent implements AfterViewInit, OnDestroy, OnChanges {
  private canvasProviderService = inject(CanvasProviderService);

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
  private readonly localProbabilityDecoratorSuffix = '-local-probability-decorator';
  private readonly theoreticalProbabilityDecoratorSuffix = '-theoretical-probability-decorator';
  private readonly bayesDecoratorSuffix = '-bayes-decorator';
  private readonly bayesTopDecoratorSuffix = '-bayes-top-decorator';
  private readonly maxProbability = MAX_PROBABILITY;

  private readonly nodeStyleByType: Record<string, { icon: string; solid: string }> = {
    'start-diagram-node': { icon: '/assets/icons/start-icon.svg', solid: '#15A34A' },
    'event-diagram-node': { icon: '/assets/icons/state-icon.svg', solid: '#BA51C5' },
    'state-diagram-node': { icon: '/assets/icons/transition-icon.svg', solid: '#047E9C' },
    'end-diagram-node': { icon: '/assets/icons/end-icon.svg', solid: '#B8475A' }
  };

  private readonly bayesNodeStyleByType: Record<string, { icon: string; solid: string }> = {
    'cause-diagram-node': { icon: '/assets/icons/cause-icon.svg', solid: '#C2410C' },
    'effect-diagram-node': { icon: '/assets/icons/effect-icon.svg', solid: '#047857' },
    'event-diagram-node': { icon: '/assets/icons/event-icon.svg', solid: '#6D28D9' }
  };

  private readonly bayesFallbackStyle = { icon: '/assets/icons/event-icon.svg', solid: '#6D28D9' };

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

  /**
   * Forces decorator/label/source-map refresh after programmatic model mutations
   * (e.g. import). Daga's diagramChange$ does not fire for programmatic changes.
   */
  refreshAfterProgrammaticChange(): void {
    let canvas: Canvas;
    try {
      canvas = this.canvasProviderService.getCanvas();
    } catch {
      return;
    }
    this.refreshConnectionWeightLabels(canvas);
    this.refreshProbabilityDecorators(canvas);
    this.refreshConnectionSourceMap(canvas);
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
    const canvasEl = document.querySelector('daga-diagram');
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
      if (isStateDiagramNodeLike(node)) {
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
      this.raisePortsAboveDecorators();
      return;
    }

    let theoreticalProbabilitiesByNodeId = new Map<string, number>();
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

    canvas.model.nodes
      .all()
      .filter((node: DiagramNode | undefined | null) => this.isNodeRenderable(node))
      .forEach((node: DiagramNode) => {
        try {
          this.drawNodeTopBandDecorator(canvas, node, theoreticalProbabilitiesByNodeId.get(node.id));
          if (node.type?.id === 'event-diagram-node') {
            this.drawNodeBottomChipDecorator(canvas, node);
          }
        } catch (err) {
          console.error('Failed to draw decorators for node', node.id, err);
        }
      });

    this.raisePortsAboveDecorators();
  }

  private raisePortsAboveDecorators(): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('daga-diagram g.diagram-port').forEach(el => el.parentNode?.appendChild(el));
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
            decorator.id.endsWith(this.localProbabilityDecoratorSuffix) ||
            decorator.id.endsWith(this.theoreticalProbabilityDecoratorSuffix) ||
            decorator.id.endsWith(this.bayesTopDecoratorSuffix) ||
            decorator.id.endsWith(this.bayesDecoratorSuffix))
        );
      })
      .forEach((decorator: { id: string }) => canvas.model.decorators.remove(decorator.id));
  }

  private drawNodeTopBandDecorator(canvas: Canvas, node: DiagramNode, globalProbability: number | undefined): void {
    if (!this.isNodeRenderable(node)) {
      return;
    }

    const typeId = node.type?.id ?? '';
    const style = this.nodeStyleByType[typeId];
    if (!style) {
      return;
    }

    const width = Math.max(node.width, 1);
    const bandHeight = 32;

    const globalText =
      globalProbability != null && Number.isFinite(globalProbability)
        ? formatProbabilityPercent(globalProbability, this.maxProbability)
        : '—';

    const decoratorId = `${node.id}${this.nodeProbabilityDecoratorSuffix}`;
    const labelHtml = `
      <foreignObject x="0" y="0" width="${width}" height="${bandHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="height:${bandHeight}px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;box-sizing:border-box;background:transparent;pointer-events:none;font-family:'WonderUnitSans', sans-serif;">
          <img src="${style.icon}" width="22" height="22" style="display:block;" />
          <span style="color:${style.solid};font-weight:700;font-size:13px;">${globalText}</span>
        </div>
      </foreignObject>
    `;

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    canvas.model.decorators.new(node, [node.coords[0], node.coords[1]], width, bandHeight, priority, labelHtml, decoratorId);
  }

  private drawNodeBottomChipDecorator(canvas: Canvas, node: DiagramNode): void {
    if (!this.isNodeRenderable(node)) {
      return;
    }

    const width = Math.max(node.width, 1);
    const chipBandHeight = 28;

    const rawLocal = node.valueSet.getValue(this.probabilityKey);
    const localText = formatProbabilityPercent(rawLocal, this.maxProbability);

    const decoratorId = `${node.id}${this.localProbabilityDecoratorSuffix}`;
    const labelHtml = `
      <foreignObject x="0" y="0" width="${width}" height="${chipBandHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="height:${chipBandHeight}px;display:flex;align-items:center;justify-content:center;background:transparent;pointer-events:none;font-family:'WonderUnitSans', sans-serif;">
          <span style="background:#EEEEEE;color:#333;font-size:12px;border-radius:999px;padding:2px 12px;font-weight:500;">${localText}</span>
        </div>
      </foreignObject>
    `;

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    canvas.model.decorators.new(
      node,
      [node.coords[0], node.coords[1] + node.height - chipBandHeight],
      width,
      chipBandHeight,
      priority,
      labelHtml,
      decoratorId
    );
  }

  /**
   * Draws the Bayesian decorators INSIDE the node:
   *   • Top band: type icon (left) + Yes% (right), tinted by node type.
   *   • Body: centered node name + Yes/No bars + evidence pill.
   */
  private drawBayesDecorator(canvas: Canvas, node: DiagramNode): void {
    if (!this.isNodeRenderable(node)) return;

    const typeId = node.type?.id ?? '';
    const style = this.bayesNodeStyleByType[typeId] ?? this.bayesFallbackStyle;

    const nodeId = normalizeNodeId(node.id);
    const bayesNode = this.bayesGraph.get(nodeId);

    const pSi = bayesNode?.marginals?.si ?? 0.5;
    const pNo = bayesNode?.marginals?.no ?? 0.5;
    const evidence = bayesNode?.evidence ?? null;

    const pSiPct = (pSi * 100).toFixed(3);
    const pNoPct = (pNo * 100).toFixed(3);
    const barWidthSi = Math.max(pSi * 100, 0.5);
    const barWidthNo = Math.max(pNo * 100, 0.5);

    let badgeColor = '#6B7280';
    let badgeBg = '#F3F4F6';
    let badgeIcon = '?';
    let badgeText = 'no evidence';
    if (evidence === 'si') {
      badgeColor = '#27500A';
      badgeBg = '#EAF3DE';
      badgeIcon = '✓';
      badgeText = 'evidence: Yes';
    } else if (evidence === 'no') {
      badgeColor = '#791F1F';
      badgeBg = '#FCEBEB';
      badgeIcon = '✕';
      badgeText = 'evidence: No';
    }

    const priority = typeof node.getPriority === 'function' ? node.getPriority() : 0;

    // ── Top band: icon + Yes% ──
    const topBandHeight = 32;
    const topDecoratorId = `${node.id}${this.bayesTopDecoratorSuffix}`;
    const topHtml = `
      <foreignObject x="0" y="0" width="${node.width}" height="${topBandHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="height:${topBandHeight}px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;box-sizing:border-box;background:transparent;pointer-events:none;font-family:'WonderUnitSans', sans-serif;">
          <img src="${style.icon}" width="22" height="22" style="display:block;" alt="" />
          <span style="color:${style.solid};font-weight:700;font-size:13px;">${pSiPct}%</span>
        </div>
      </foreignObject>
    `;
    canvas.model.decorators.new(node, [node.coords[0], node.coords[1]], node.width, topBandHeight, priority, topHtml, topDecoratorId);

    // ── Body: name + bars + evidence pill ──
    const bodyOffsetY = topBandHeight;
    const bodyHeight = Math.max(node.height - topBandHeight, 1);
    const bodyDecoratorId = `${node.id}${this.bayesDecoratorSuffix}`;
    const bodyHtml = `
      <foreignObject x="0" y="0" width="${node.width}" height="${bodyHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="height:${bodyHeight}px;display:flex;flex-direction:column;justify-content:space-between;padding:30px 14px 10px;box-sizing:border-box;background:transparent;pointer-events:none;font-family:'WonderUnitSans', sans-serif;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#6B7280;min-width:22px;font-size:11px;">Yes</span>
              <div style="flex:1;height:4px;background:#EEEEEE;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${barWidthSi}%;background:#E24B4A;border-radius:2px;transition:width .4s;"></div></div>
              <span style="color:#1F2937;font-weight:500;min-width:54px;text-align:right;font-size:11px;">${pSiPct}%</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#6B7280;min-width:22px;font-size:11px;">No</span>
              <div style="flex:1;height:4px;background:#EEEEEE;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${barWidthNo}%;background:#E24B4A;border-radius:2px;transition:width .4s;"></div></div>
              <span style="color:#1F2937;font-weight:500;min-width:54px;text-align:right;font-size:11px;">${pNoPct}%</span>
            </div>
          </div>
          <div style="display:flex;justify-content:center;">
            <div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 10px;border-radius:999px;font-weight:500;background:${badgeBg};color:${badgeColor};">
              <span style="font-weight:700;">${badgeIcon}</span>${badgeText}
            </div>
          </div>
        </div>
      </foreignObject>
    `;
    canvas.model.decorators.new(node, [node.coords[0], node.coords[1] + bodyOffsetY], node.width, bodyHeight, priority, bodyHtml, bodyDecoratorId);
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
