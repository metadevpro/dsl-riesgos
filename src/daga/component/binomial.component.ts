import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Canvas, DagaModule } from '@metadev/daga-angular';
import { DagaBaseComponent } from './dagaBase.component';
import { calculateBinomialProbability, buildEndNodeIdSet } from '../utils/binomialCalculationNodes.utils';
import { calculateTheoreticalNodeProbabilities } from '../utils/binomialWeight.utils';
import { GenericComponent } from './generic.component';
import { NodeInfo } from '../types';
import { applyRiskFileToCanvas, exportCanvasToFile, RiskFile } from '../utils/importExport.utils';

@Component({
  standalone: true,
  selector: 'app-risk-simple',
  templateUrl: '../binomial.html',
  imports: [DagaModule, CommonModule, DagaBaseComponent]
})
export class BinomialComponent extends GenericComponent {
  branchValueKey = 'weight';
  showTheoreticalProbabilities = true;

  @ViewChild(DagaBaseComponent) private dagaBase?: DagaBaseComponent;

  private canvas: Canvas | null = null;
  private pendingImport: RiskFile | null = null;

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
      alert('El diagrama todavía no está listo. Inténtalo de nuevo en unos segundos.');
      return null;
    }
    return exportCanvasToFile(this.canvas, 'binomial');
  }

  private runImport(file: RiskFile): void {
    if (!this.canvas) return;
    applyRiskFileToCanvas(this.canvas, file);
    this.dagaBase?.refreshAfterProgrammaticChange();
  }

  override executeCalculation(iterationsStr: string): void {
    const iterations = parseInt(iterationsStr, 10);

    if (!iterations || iterations < 1) {
      alert('Please enter a valid number of iterations (minimum 1).');
      return;
    }

    if (!this.hasValidModel()) {
      alert('The diagram must contain at least 1 node.');
      return;
    }

    try {
      const result = calculateBinomialProbability(
        this.myModel,
        iterations,
        this.probabilityKey,
        this.maxProbability,
        this.selectedStartNodeId
      );

      const theoreticalMap = calculateTheoreticalNodeProbabilities(
        this.myModel, this.probabilityKey, this.branchValueKey, this.maxProbability
      );
      const nodes = (this.myModel?.nodes as unknown as NodeInfo[]) ?? [];
      const endNodeIds = buildEndNodeIdSet(nodes);
      let theoreticalProbability = 0;
      for (const nodeId of endNodeIds) {
        theoreticalProbability += theoreticalMap.get(nodeId) ?? 0;
      }

      this.pushResult(result.iterations, result.successIterations, result.startNodeId, result.startNodeName, theoreticalProbability);
      console.log('Calculation completed:', result);
    } catch (error) {
      alert(`Error during calculation: ${error}`);
      console.error('Error in calculateBinomialProbability:', error);
    }
  }
}
