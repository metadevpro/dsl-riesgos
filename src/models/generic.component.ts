import { ChangeDetectorRef, inject } from '@angular/core';
import { DiagramConfig, DagaModel } from '@metadev/daga-angular';

import { NodeInfo, ConnectionInfo, SimulationResult } from './types';
import { findStartNodes, getNodeId, extractConnectionEndpoints } from '../util/generalCalculationNodes.utils';
import { PROBABILITY_KEY, MAX_PROBABILITY, normalizeProbability, formatSignificantPercent } from '../util/probability.utils';
import { PROB_CONFIG } from './binomial/binomial.config';

export abstract class GenericComponent {
  config: DiagramConfig = PROB_CONFIG;
  myModel: DagaModel | null = null;
  isSidebarCollapsed = false;
  selectedModel = 'none';

  showCalculationDialog = false;
  showResultsBar = false;

  availableStartNodes: NodeInfo[] = [];
  selectedStartNodeId = '';

  results: SimulationResult[] = [];
  selectedResult = -1;

  nodeStats = {
    total: 0,
    connected: 0
  };

  protected readonly probabilityKey = PROBABILITY_KEY;
  protected readonly maxProbability = MAX_PROBABILITY;

  protected readonly cdr = inject(ChangeDetectorRef);

  /** See `ModelToolbarHost.markForCheck`. Lets the header toolbar re-render this routed component. */
  markForCheck(): void {
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  selectModel(modelKey: string): void {
    this.selectedModel = modelKey;
  }

  openCalculationDialog(): void {
    if (!this.myModel || !this.myModel.nodes || this.myModel.nodes.length === 0) {
      alert('The diagram is empty. Please create at least one node.');
      return;
    }

    const nodes = (this.myModel.nodes as unknown as NodeInfo[]) || [];
    const connections = (this.myModel.connections as unknown as ConnectionInfo[]) || [];
    this.availableStartNodes = findStartNodes(nodes, connections);

    if (this.availableStartNodes.length > 0) {
      this.selectedStartNodeId = getNodeId(this.availableStartNodes[0]) || '';
    } else {
      this.selectedStartNodeId = '';
    }

    this.updateNodeStats();
    this.showCalculationDialog = true;
  }

  closeCalculationDialog(): void {
    this.showCalculationDialog = false;
  }

  openResultsBar(): void {
    this.showResultsBar = true;
    if (this.results.length > 0 && this.selectedResult === -1) {
      this.selectedResult = this.results.length - 1;
    }
  }

  closeResultsBar(): void {
    this.showResultsBar = false;
  }

  selectResult(index: number): void {
    this.selectedResult = index;
  }

  formatPercentage(successIterations: number, iterations: number): string {
    if (!iterations || iterations <= 0) return '0%';
    return `${formatSignificantPercent(successIterations / iterations)}%`;
  }

  /** Display a 0..1 fraction as a percent (e.g. marginals). Display-only rounding. */
  formatPctFraction(fraction: number): string {
    return `${formatSignificantPercent(fraction)}%`;
  }

  /** Display a value already on the 0..100 percent scale (e.g. theoretical probability). */
  formatPctValue(percent: number): string {
    return `${formatSignificantPercent(percent / 100)}%`;
  }

  protected hasValidModel(): boolean {
    return !!(this.myModel && this.myModel.nodes && this.myModel.nodes.length > 0);
  }

  protected pushResult(
    iterations: number,
    successIterations: number,
    startNodeId?: string,
    startNodeName?: string,
    theoreticalProbability?: number
  ): void {
    this.results.push({
      startNodeId,
      startNodeName,
      iterations,
      successIterations,
      theoreticalProbability,
      date: new Date()
    });

    this.selectedResult = this.results.length - 1;
    this.closeCalculationDialog();
    this.openResultsBar();
  }

  private updateNodeStats(): void {
    if (!this.myModel || !this.myModel.nodes) {
      this.nodeStats = { total: 0, connected: 0 };
      return;
    }

    const totalNodes = this.myModel.nodes.length;
    let connectedNodesCount = 0;

    if (this.myModel.connections) {
      const connectedNodes = new Set<string>();

      this.myModel.connections.forEach((conn: unknown) => {
        const { endId } = extractConnectionEndpoints(conn);
        if (endId) connectedNodes.add(endId);
      });

      connectedNodesCount = connectedNodes.size;
    }

    this.nodeStats = {
      total: totalNodes,
      connected: connectedNodesCount
    };
  }

  getProcessedDiagram() {
    if (!this.myModel || !this.myModel.nodes) {
      console.warn('The diagram is empty. Create at least one node.');
      return null;
    }

    const nodesWithError: string[] = [];
    const finalModel = JSON.parse(JSON.stringify(this.myModel));

    finalModel.nodes.forEach((node: NodeInfo) => {
      if (node.data && node.data[this.probabilityKey] !== undefined) {
        const normalizedValue = normalizeProbability(node.data[this.probabilityKey], this.maxProbability);
        if (normalizedValue === null) {
          const nodeName = (node.data['node name'] as string) || `ID ${node.id}`;
          nodesWithError.push(nodeName);
        } else {
          node.data[this.probabilityKey] = normalizedValue;
          node.data['probabilidadImplicita'] = normalizedValue;
        }
      }
    });

    if (nodesWithError.length > 0) {
      const message = `Cannot save the diagram.\n\nProbability must be numeric, non-negative, and at most ${this.maxProbability}.\n\nPlease review these nodes:\n\n- ${nodesWithError.join('\n- ')}`;
      alert(message);
      return null;
    }

    console.log('Processed Diagram:', finalModel);
    alert('Diagram Validated and ready!');
    return finalModel;
  }

  formatPosteriorProbability(_probability: number): string {
    return '0%';
  }

  abstract executeCalculation(iterationsStr: string): void;
}
