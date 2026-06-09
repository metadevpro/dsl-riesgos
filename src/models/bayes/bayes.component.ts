import { CommonModule } from '@angular/common';
import { afterNextRender, ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DagaConnection, DagaExporter, DagaModel, DagaNode } from '@metadev/daga';
import { AddConnectionAction, AddNodeAction, Canvas, DagaModule, DiagramPort, Side } from '@metadev/daga-angular';
import {
  applyRiskFileToCanvas,
  downloadRiskFile,
  exportCanvasToFile,
  loadRiskFileFromUrl,
  overlayBayesSchemaOnGraph,
  readRiskFile,
  RiskFile,
  serializeBayesGraph
} from '../../util/importExport.utils';
import { normalizeProbability, formatSignificantPercent, MAX_DISPLAY_DECIMALS } from '../../util/probability.utils';
import { DagaBaseComponent } from '../dagaBase.component';
import { GenericComponent } from '../generic.component';
import { ModelToolbarHost, ToolbarButton } from '../model-toolbar';
import { BayesCPTEntry, BayesEvidence, BayesGraph, CPTTableRow, LearningResult, MCResult } from '../types';
import { bayes_CONFIG } from './bayes.config';
import {
  buildBayesGraph,
  getCPTTableRows,
  getParentNames,
  recalcAllMarginals,
  recalcCPTOnParentChange,
  validateCPT
} from './util/bayesInference.utils';
import { BayesCausalLayout } from './util/causalLayout';
import { analizarCSV, CSVAnalysis, extraerComentarios, parsearCSV, parsearEdgesDesdeComentarios } from './util/csv.utils';
import { aprenderEM } from './util/em.utils';
import { aprenderMLE } from './util/mle.utils';
import { calcularError, ejecutarMonteCarlo, marginalesExactos } from './util/montecarlo.utils';
import { generarDatosSinteticos } from './util/syntheticData.utils';

@Component({
  standalone: true,
  selector: 'risk-bayes',
  templateUrl: 'bayes.component.html',
  styleUrls: ['bayes.component.scss', '../models-shared.scss'],
  imports: [DagaModule, CommonModule, FormsModule, DagaBaseComponent]
})
export class BayesComponent extends GenericComponent implements OnDestroy, ModelToolbarHost {
  private cdr = inject(ChangeDetectorRef);

  bayes_config = bayes_CONFIG;

  // ── Bayesian state ──
  bayesGraph: BayesGraph = new Map();
  showNodePopup = false;
  selectedNodeId: string | null = null;
  selectedNodeName = '';
  selectedNodeParentNames: string[] = [];
  selectedNodeEvidence: BayesEvidence = null;
  selectedNodeMarginals: BayesCPTEntry = { si: 0.5, no: 0.5 };
  selectedNodeCPTRows: CPTTableRow[] = [];
  selectedNodeHasTooManyRows = false;
  cptValidationErrors: string[] = [];
  autoNormalizeCPT = false;
  isNetworkTooLarge = false;
  private tooLargeAlerted = false;
  private recalcTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly RECALC_DEBOUNCE_MS = 200;
  csvImportMessage: string | null = null;
  creatingNodes = false;
  creationSummary: {
    createdNodes: string[];
    createdEdges: number;
    totalNodes: number;
    totalConnections: number;
    missingEdgesWarning: boolean;
    pending: { datos: Record<string, string>[]; headers: string[] };
  } | null = null;
  private canvas: Canvas | null = null;
  private pendingImport: RiskFile | null = null;

  private readonly route = inject(ActivatedRoute);

  @ViewChild(DagaBaseComponent) private dagaBase?: DagaBaseComponent;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  get toolbarButtons(): ToolbarButton[] {
    return [
      {
        label: 'Import',
        testId: 'import',
        variant: 'secondary',
        icon: 'assets/icons/feature-icons/import-icon.svg',
        action: () => this.triggerImport()
      },
      {
        label: 'Export',
        testId: 'export',
        variant: 'secondary',
        icon: 'assets/icons/feature-icons/export-icon.svg',
        action: () => this.downloadRiskFile()
      },
      {
        label: 'Import CSV',
        testId: 'import-csv',
        variant: 'primary',
        action: () => this.toggleLearningPanel()
      },
      {
        label: 'Generate CSV',
        testId: 'generate-csv',
        variant: 'primary',
        action: () => this.abrirDialogoCSV()
      },
      {
        label: 'Monte Carlo',
        testId: 'monte-carlo',
        variant: 'primary',
        action: () => this.toggleMCPanel()
      },
      {
        label: 'View Results',
        variant: 'primary',
        visible: this.hasHistory,
        action: () => this.openMCHistory()
      }
    ];
  }

  triggerImport(): void {
    this.fileInput?.nativeElement.click();
  }

  constructor() {
    super();
    // Browser-only: auto-import the example referenced by ?example=<file-stem>.
    afterNextRender(() => {
      const name = this.route.snapshot.queryParamMap.get('example');
      if (!name || !/^[\w.-]+$/.test(name)) return;
      loadRiskFileFromUrl(`/assets/examples/bayes/${name}.json`)
        .then((file) => this.applyImport(file))
        .catch((err) => console.error('No se pudo cargar el ejemplo:', err));
    });
  }

  get hasResults(): boolean {
    return this.results.length > 0;
  }
  get hasHistory(): boolean {
    return this.mcHistory.length > 0;
  }

  downloadRiskFile(): void {
    const file = this.exportCurrent();
    if (file) {
      downloadRiskFile(file);
    }
  }

  onCanvasReady(canvas: Canvas): void {
    this.canvas = canvas;
    if (this.pendingImport) {
      const pending = this.pendingImport;
      this.pendingImport = null;
      this.runImport(pending);
    }
  }

  applyImport(file: RiskFile): void {
    if (!this.canvas) {
      this.pendingImport = file;
      return;
    }
    this.runImport(file);
  }

  exportCurrent(): RiskFile | null {
    if (!this.canvas) {
      alert('The diagram is not ready yet. Try again in a few seconds.');
      return null;
    }
    const file = exportCanvasToFile(this.canvas, 'bayes');
    file.bayes = serializeBayesGraph(this.bayesGraph);
    return file;
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    let parsed: RiskFile;
    try {
      parsed = await readRiskFile(file);
    } catch (err) {
      alert(`No se pudo importar el archivo: ${err instanceof Error ? err.message : String(err)}`);
      input.value = '';
      return;
    }

    setTimeout(() => {
      this.applyImport(parsed);
      input.value = '';
    }, 0);
  }

  private runImport(file: RiskFile): void {
    if (!this.canvas) return;
    applyRiskFileToCanvas(this.canvas, file);
    this.dagaBase?.refreshAfterProgrammaticChange();

    const exported = new DagaExporter().export(this.canvas.model);
    this.myModel = exported;
    this.bayesGraph = buildBayesGraph(exported);
    overlayBayesSchemaOnGraph(this.bayesGraph, file.bayes);
    recalcAllMarginals(this.bayesGraph);
    this.bayesGraph = new Map(this.bayesGraph);
    this.cdr.markForCheck();
  }

  // ── Monte Carlo state ──
  showMCPanel = false;
  mcIteraciones = 1000;
  mcResult: MCResult | null = null;
  mcError: Record<string, Record<string, number>> | null = null;
  mcRunning = false;
  mcHistory: {
    date: Date;
    iteraciones: number;
    result: MCResult;
    error: Record<string, Record<string, number>>;
  }[] = [];
  showMCHistory = false;
  selectedMCHistory = -1;

  // ── Learning state ──
  showLearningPanel = false;
  csvAnalysis: (CSVAnalysis & { filas: number }) | null = null;
  csvDatos: Record<string, string>[] = [];
  learningRunning = false;
  emProgress: { iter: number; delta: number } | null = null;
  learningResult: LearningResult | null = null;
  graphBeforeLearning: BayesGraph | null = null;

  private previousModelJson = '';

  override openCalculationDialog(): void {
    // Bayes doesn't use the generic calculation dialog.
    // The interaction is via double-click on nodes.
  }

  override executeCalculation(): void {
    // No-op: Bayes uses live inference, not batch calculation
  }

  /**
   * Called by the template when the model changes.
   * Rebuilds the graph, detects structural changes, and recalculates.
   */
  onModelChange(model: DagaModel): void {
    this.myModel = model;

    if (!model || !model.nodes) {
      this.bayesGraph = new Map();
      return;
    }

    const modelJson = JSON.stringify({
      nodes: (model.nodes || []).map((n: DagaNode) => n.id),
      connections: (model.connections || []).map((c: DagaConnection) => ({
        start: c.start,
        end: c.end
      }))
    });

    // Rebuild graph on structural changes
    const oldGraph = this.bayesGraph;
    this.bayesGraph = buildBayesGraph(model);

    // Restore evidence and CPTs from old graph where nodes still exist
    for (const [id, node] of this.bayesGraph) {
      const oldNode = oldGraph.get(id);
      if (oldNode) {
        node.evidence = oldNode.evidence;

        // Check if parents changed
        const oldParents = [...oldNode.parents].sort().join(',');
        const newParents = [...node.parents].sort().join(',');

        if (oldParents === newParents) {
          // Parents unchanged — keep old CPT
          node.cpt = oldNode.cpt;
        } else {
          // Parents changed — migrate CPT
          const nameMap = new Map<string, string>();
          for (const [nid, nnode] of this.bayesGraph) {
            nameMap.set(nid, nnode.name);
          }
          node.cpt = recalcCPTOnParentChange(oldNode.cpt, node.parents);
        }
      }
    }

    this.previousModelJson = modelJson;

    this.isNetworkTooLarge = this.bayesGraph.size > 20;

    if (this.isNetworkTooLarge) {
      if (!this.tooLargeAlerted) {
        this.tooLargeAlerted = true;
        alert(
          `The network has ${this.bayesGraph.size} nodes. Exact inference is O(2^N) and is blocked above 20 nodes. ` +
            'Marginal calculation is disabled until you reduce the network. Use Monte Carlo for approximate inference.'
        );
      }
    } else {
      this.tooLargeAlerted = false;
      recalcAllMarginals(this.bayesGraph);
    }

    // Create new Map reference to trigger Angular change detection in DagaBaseComponent
    this.bayesGraph = new Map(this.bayesGraph);

    // Persist marginals back to model data for the decorator

    // If popup is open, refresh it
    if (this.showNodePopup && this.selectedNodeId) {
      this.refreshPopupData();
    }
  }

  /**
   * Opens the node detail popup on double-click.
   */
  onNodeDoubleClick(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.showNodePopup = true;
    this.refreshPopupData();
  }

  /**
   * Closes the popup, saving valid data.
   */
  closeNodePopup(): void {
    this.showNodePopup = false;
    this.selectedNodeId = null;
  }

  /**
   * Handles click on the popup backdrop.
   */
  onBackdropClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('bayes-popup-backdrop')) {
      this.closeNodePopup();
    }
  }

  /**
   * Sets the evidence for the selected node and recalculates.
   */
  setEvidence(value: BayesEvidence): void {
    if (!this.selectedNodeId) return;

    const node = this.bayesGraph.get(this.selectedNodeId);
    if (!node) return;

    node.evidence = value;
    this.selectedNodeEvidence = value;

    this.scheduleRecalc();
  }

  /**
   * Updates a CPT cell value.
   */
  updateCPTCell(rowKey: string, field: 'si' | 'no', value: string | number): void {
    if (!this.selectedNodeId) return;

    const node = this.bayesGraph.get(this.selectedNodeId);
    if (!node) return;

    const normalized = normalizeProbability(value, 1, null); // 0..1 fraction, exact precision
    if (normalized === null) return;

    if (node.cpt[rowKey]) {
      node.cpt[rowKey][field] = normalized;

      if (this.autoNormalizeCPT) {
        const complementaryField = field === 'si' ? 'no' : 'si';
        node.cpt[rowKey][complementaryField] = Math.max(0, 1 - normalized);
      }
    }

    this.scheduleRecalc();
  }

  /**
   * Debounces recalcAllMarginals so that bursts of UI edits (typing in a CPT
   * cell, rapid evidence toggles) collapse into a single recompute.
   * Bypasses the recompute when the network exceeds MAX_EXACT_INFERENCE_NODES.
   */
  private scheduleRecalc(): void {
    if (this.recalcTimer !== null) {
      clearTimeout(this.recalcTimer);
      this.recalcTimer = null;
    }

    if (this.isNetworkTooLarge) return;

    this.recalcTimer = setTimeout(() => {
      this.recalcTimer = null;
      recalcAllMarginals(this.bayesGraph);
      this.bayesGraph = new Map(this.bayesGraph);
      if (this.showNodePopup && this.selectedNodeId) {
        this.refreshPopupData();
      }
      this.cdr.markForCheck();
    }, BayesComponent.RECALC_DEBOUNCE_MS);
  }

  /**
   * Gets the CSS class for the evidence badge on a node.
   */
  getEvidenceClass(nodeId: string): string {
    const node = this.bayesGraph.get(nodeId);
    if (!node) return 'ev-null';
    if (node.evidence === 'si') return 'ev-si';
    if (node.evidence === 'no') return 'ev-no';
    return 'ev-null';
  }

  /**
   * Gets the evidence text for a node.
   */
  getEvidenceText(nodeId: string): string {
    const node = this.bayesGraph.get(nodeId);
    if (!node) return '? no evidence';
    if (node.evidence === 'si') return 'evidence: Yes';
    if (node.evidence === 'no') return 'evidence: No';
    return '? no evidence';
  }

  /**
   * Gets the border class for a node based on its evidence.
   */
  getNodeBorderClass(nodeId: string): string {
    const node = this.bayesGraph.get(nodeId);
    if (!node) return '';
    if (node.evidence === 'si') return 'evidencia-si';
    if (node.evidence === 'no') return 'evidencia-no';
    return '';
  }

  cptPct(p: number): number {
    // Full precision: show exactly what the user entered, float noise cleaned.
    // Storage stays exact via updateCPTCell.
    return Number(formatSignificantPercent(p, MAX_DISPLAY_DECIMALS));
  }

  // ── Private helpers ──

  private refreshPopupData(): void {
    if (!this.selectedNodeId) return;

    const node = this.bayesGraph.get(this.selectedNodeId);
    if (!node) {
      this.closeNodePopup();
      return;
    }

    this.selectedNodeName = node.name;
    this.selectedNodeParentNames = getParentNames(this.selectedNodeId, this.bayesGraph);
    this.selectedNodeEvidence = node.evidence;
    this.selectedNodeMarginals = { ...node.marginals };
    this.selectedNodeCPTRows = getCPTTableRows(this.selectedNodeId, this.bayesGraph);
    this.selectedNodeHasTooManyRows = this.selectedNodeCPTRows.length > 16;
    this.cptValidationErrors = validateCPT(node.cpt);
  }

  // ── Monte Carlo ──────────────────────────────────────────────────────────

  toggleMCPanel(): void {
    this.showMCPanel = !this.showMCPanel;
    if (!this.showMCPanel) {
      this.mcResult = null;
      this.mcError = null;
    }
  }

  openMCHistory(): void {
    this.showMCHistory = true;
    if (this.mcHistory.length > 0 && this.selectedMCHistory === -1) {
      this.selectedMCHistory = this.mcHistory.length - 1;
    }
  }

  closeMCHistory(): void {
    this.showMCHistory = false;
  }

  ejecutarMC(): void {
    if (this.bayesGraph.size === 0) return;
    this.mcRunning = true;

    const evidencias: Record<string, BayesEvidence> = {};
    for (const [id, nodo] of this.bayesGraph) {
      evidencias[id] = nodo.evidence;
    }

    setTimeout(() => {
      this.mcResult = ejecutarMonteCarlo(this.bayesGraph, evidencias, this.mcIteraciones);
      const exactos = marginalesExactos(this.bayesGraph);
      this.mcError = calcularError(exactos, this.mcResult!.probabilidades);
      this.mcRunning = false;
      this.mcHistory.push({
        date: new Date(),
        iteraciones: this.mcIteraciones,
        result: this.mcResult!,
        error: this.mcError
      });
      this.selectedMCHistory = this.mcHistory.length - 1;
      this.openMCHistory();
      this.cdr.detectChanges();
    }, 0);
  }

  getMCNodeIds(): string[] {
    return this.mcResult ? Object.keys(this.mcResult.probabilidades) : [];
  }

  getNodeName(nodeId: string): string {
    return this.bayesGraph.get(nodeId)?.name ?? nodeId;
  }

  csvFilas = 500;
  showCSVDialog = false;

  abrirDialogoCSV(): void {
    if (this.bayesGraph.size === 0) return;
    this.showCSVDialog = true;
  }

  cerrarDialogoCSV(): void {
    this.showCSVDialog = false;
  }

  onCSVBackdropClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('csv-dialog-backdrop')) {
      this.cerrarDialogoCSV();
    }
  }

  generarCSV(): void {
    if (this.bayesGraph.size === 0) return;
    const n = Math.max(1, Math.floor(Number(this.csvFilas) || 0));
    const csv = generarDatosSinteticos(this.bayesGraph, n);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos_sinteticos.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showCSVDialog = false;
  }

  // ── Learning (CSV Import) ─────────────────────────────────────────────────

  toggleLearningPanel(): void {
    this.showLearningPanel = !this.showLearningPanel;
    if (!this.showLearningPanel) {
      this.csvAnalysis = null;
      this.csvDatos = [];
      this.learningResult = null;
      this.emProgress = null;
      this.csvImportMessage = null;
      this.creatingNodes = false;
      this.creationSummary = null;
    }
  }

  onCSVFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target?.result as string;
      const datos = parsearCSV(texto);
      if (datos.length === 0) return;

      const headers = Object.keys(datos[0]);
      const firstDataLine = texto.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('#')) || '';
      const originalHeaders: string[] = firstDataLine
        .split(',')
        .map((h: string) => h.trim())
        .filter((h: string) => h.length > 0);

      const comentarios = extraerComentarios(texto);
      const edgesFromComments = parsearEdgesDesdeComentarios(comentarios);

      const existingNames = new Set<string>();
      for (const [, n] of this.bayesGraph) existingNames.add(n.name.toLowerCase());
      const missingOriginals = originalHeaders.filter((h: string) => !existingNames.has(h.toLowerCase()));

      this.csvImportMessage = null;

      if (missingOriginals.length > 0 && this.canvas) {
        this.creatingNodes = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          const edgesCreated = this.autoCreateNodesAndRelations(missingOriginals, edgesFromComments);
          const missingEdgesWarning = edgesFromComments.length === 0 && missingOriginals.length >= 2;
          this.creatingNodes = false;
          this.creationSummary = {
            createdNodes: missingOriginals,
            createdEdges: edgesCreated,
            totalNodes: this.canvas?.model.nodes.all().length ?? 0,
            totalConnections: this.canvas?.model.connections.all().length ?? 0,
            missingEdgesWarning,
            pending: { datos, headers }
          };
          if (missingEdgesWarning) {
            this.csvImportMessage =
              'CSV does not contain direction info (edges). Only nodes were created. Add a line "# edges: Parent->Child; Parent->Child" at the start of the CSV to define relationships.';
          }
          this.cdr.detectChanges();
        }, 100);
        return;
      }

      const analysis = analizarCSV(this.bayesGraph, headers);
      this.csvDatos = datos;
      this.csvAnalysis = { ...analysis, filas: datos.length };
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  proceedToAnalysis(): void {
    if (!this.creationSummary) return;
    const { datos, headers } = this.creationSummary.pending;
    const analysis = analizarCSV(this.bayesGraph, headers);
    this.csvDatos = datos;
    this.csvAnalysis = { ...analysis, filas: datos.length };
    this.creationSummary = null;
    this.csvImportMessage = null;
    this.cdr.detectChanges();
  }

  cancelCreationSummary(): void {
    this.creationSummary = null;
    this.csvImportMessage = null;
  }

  private autoCreateNodesAndRelations(missingOriginalNames: string[], edges: [string, string][]): number {
    const canvas = this.canvas;
    if (!canvas) return 0;

    const nodeType =
      canvas.model.nodes.types.get('event-diagram-node') ??
      canvas.model.nodes.types.get('cause-diagram-node') ??
      canvas.model.nodes.types.get('effect-diagram-node') ??
      canvas.model.nodes.types.get('diagram-node') ??
      canvas.model.nodes.types.all()[0];
    const connType = canvas.model.connections.types.get('diagram-connection');
    if (!nodeType || !connType) return 0;

    const COLS = 4;
    const DX = 260;
    const DY = 180;
    const baseX = 100;
    const baseY = 100;
    const existingCount = canvas.model.nodes.all().length;

    const nameToNodeId = new Map<string, string>();
    for (const n of canvas.model.nodes.all()) {
      const name = String(n.valueSet.getValue('node name') || n.label?.text || '').toLowerCase();
      if (name) nameToNodeId.set(name, n.id);
    }

    missingOriginalNames.forEach((name, idx) => {
      const slot = existingCount + idx;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const coords: [number, number] = [baseX + col * DX, baseY + row * DY];
      const action = new AddNodeAction(canvas, nodeType, coords, undefined, undefined, undefined, undefined, name, { 'node name': name });
      action.do();
      canvas.actionStack.add(action);
      nameToNodeId.set(name.toLowerCase(), action.id);
    });

    let edgesCreated = 0;
    if (edges.length > 0) {
      const pickPort = (nodeId: string, side: Side): string | undefined => {
        const node = canvas.model.nodes.get(nodeId);
        if (!node) return undefined;
        const port = node.ports.find((p: DiagramPort) => p.direction === side) || node.ports[0];
        return port?.id;
      };
      for (const [parent, child] of edges) {
        const startNodeId = nameToNodeId.get(parent.toLowerCase());
        const endNodeId = nameToNodeId.get(child.toLowerCase());
        if (!startNodeId || !endNodeId) continue;
        const startPortId = pickPort(startNodeId, Side.Bottom);
        const endPortId = pickPort(endNodeId, Side.Top);
        if (!startPortId || !endPortId) continue;
        const connAction = new AddConnectionAction(canvas, connType, startPortId, endPortId);
        connAction.do();
        canvas.actionStack.add(connAction);
        edgesCreated++;
      }
    }

    new BayesCausalLayout().apply(canvas.model);

    canvas.updateModelInView();
    return edgesCreated;
  }

  async confirmarAprendizaje(): Promise<void> {
    if (!this.csvAnalysis || this.csvDatos.length === 0) return;

    this.learningRunning = true;
    this.emProgress = null;
    this.graphBeforeLearning = new Map(this.bayesGraph);
    this.cdr.detectChanges();

    if (this.csvAnalysis.ocultos.length === 0) {
      const nuevaRed = aprenderMLE(this.bayesGraph, this.csvDatos);
      recalcAllMarginals(nuevaRed);
      this.learningResult = { metodo: 'MLE', graph: nuevaRed, ocultos: [] };
      this.learningRunning = false;
      this.cdr.detectChanges();
    } else {
      const nuevaRed = await aprenderEM(this.bayesGraph, this.csvDatos, {
        onProgreso: (iter, delta) => {
          this.emProgress = { iter, delta };
          this.cdr.detectChanges();
        }
      });
      recalcAllMarginals(nuevaRed);
      this.learningResult = {
        metodo: 'EM',
        graph: nuevaRed,
        ocultos: this.csvAnalysis.ocultos
      };
      this.learningRunning = false;
      this.cdr.detectChanges();
    }
  }

  aceptarCPTs(): void {
    if (!this.learningResult) return;
    this.bayesGraph = this.learningResult.graph;
    recalcAllMarginals(this.bayesGraph);
    this.bayesGraph = new Map(this.bayesGraph);
    this.showLearningPanel = false;
    this.learningResult = null;
    this.csvAnalysis = null;
    this.csvDatos = [];
    this.graphBeforeLearning = null;
  }

  descartarCPTs(): void {
    this.learningResult = null;
    this.csvAnalysis = null;
    this.csvDatos = [];
    this.emProgress = null;
  }

  getLearningNodeIds(): string[] {
    return this.learningResult ? [...this.learningResult.graph.keys()] : [];
  }

  getCPTSi(graph: BayesGraph, nodeId: string): number {
    return graph.get(nodeId)?.marginals.si ?? 0;
  }

  ngOnDestroy(): void {
    if (this.recalcTimer !== null) {
      clearTimeout(this.recalcTimer);
      this.recalcTimer = null;
    }
    this.bayesGraph.clear();
  }
}
