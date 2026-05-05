import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DagaModule } from '@metadev/daga-angular';
import { DagaBaseComponent } from './dagaBase.component';
import { calculateBinomialProbability, buildEndNodeIdSet } from '../utils/binomialCalculationNodes.utils';
import { calculateTheoreticalNodeProbabilities } from '../utils/binomialWeight.utils';
import { GenericComponent } from './generic.component';
import { NodeInfo } from '../types';

@Component({
  standalone: true,
  selector: 'app-risk-simple',
  templateUrl: '../binomial.html',
  imports: [DagaModule, CommonModule, DagaBaseComponent]
})
export class BinomialComponent extends GenericComponent {
  branchValueKey = 'weight';
  showTheoreticalProbabilities = true;

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
