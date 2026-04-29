import { DiagramConfig } from '@metadev/daga-angular';
import { PROB_CONFIG } from '../config/prob.config';
import { MAX_PROBABILITY, PROBABILITY_KEY, normalizeProbability } from '../utils/probability.utils';
import { extractConnectionEndpoints, findStartNodes, getNodeId } from '../utils/generalCalculationNodes.utils';

import { NodeInfo, SimulationResult } from '../types';

export abstract class GenericComponent {
  config: DiagramConfig = PROB_CONFIG;
  myModel: any;
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

    const nodes = this.myModel.nodes || [];
    const connections = this.myModel.connections || [];
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

    const percent = (successIterations / iterations) * 100;
    return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
  }

  protected hasValidModel(): boolean {
    return !!(this.myModel && this.myModel.nodes && this.myModel.nodes.length > 0);
  }

  protected pushResult(iterations: number, successIterations: number, startNodeId?: string, startNodeName?: string): void {
    this.results.push({
      startNodeId,
      startNodeName,
      iterations,
      successIterations,
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

      this.myModel.connections.forEach((conn: any) => {
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
          const nodeName = node.data['node name'] || `ID ${node.id}`;
          nodesWithError.push(nodeName);
        } else {
          node.data[this.probabilityKey] = normalizedValue;
          node.data.probabilidadImplicita = normalizedValue;
        }
      }
    });

    if (nodesWithError.length > 0) {
      const message = `Cannot save the diagram.\n\nProbability must be numeric and non-negative.\nIf you enter a value greater than ${this.maxProbability}, it gets interpreted as a percentage and divided by 100.\n\nPlease review these nodes:\n\n- ${nodesWithError.join('\n- ')}`;
      alert(message);
      return null;
    }

    console.log('Processed Diagram:', finalModel);
    alert('Diagram Validated and ready!');
    return finalModel;
  }

  getpathProbabilityResultAtIndex(index: number): any {
    return undefined;
  }

  formatPosteriorProbability(probability: number): string {
    return '0%';
  }

  abstract executeCalculation(iterationsStr: string): void;
}
