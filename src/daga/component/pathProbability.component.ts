import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DagaModule } from '@metadev/daga-angular';
import { DagaBaseComponent } from './dagaBase.component';
import { calculatepathProbabilityProbability } from '../utils/pathProbabilityCalculationNodes.utils';
import { pathProbability_CONFIG } from '../config/pathProbability.config';
import { GenericComponent } from './generic.component';
import { pathProbabilityCalculationResult, SimulationResult } from '../types';

interface pathProbabilityResult extends SimulationResult {
  pathProbabilityData?: pathProbabilityCalculationResult;
}

@Component({
  standalone: true,
  selector: 'app-risk-pathprobability',
  templateUrl: '../pathProbability.html',
  imports: [DagaModule, CommonModule, DagaBaseComponent]
})
export class pathProbabilityComponent extends GenericComponent {
  pathProbability_config = pathProbability_CONFIG;
  pathProbabilityResults: pathProbabilityResult[] = [];

  override openCalculationDialog(): void {
    this.config = this.pathProbability_config;
    super.openCalculationDialog();
  }

  override executeCalculation(): void {
    // pathProbability doesn't require iterations, execute directly
    this.executepathProbabilityCalculation();
  }

  private executepathProbabilityCalculation(): void {
    if (!this.hasValidModel()) {
      alert('The diagram must contain at least 1 node.');
      return;
    }

    try {
      const result = calculatepathProbabilityProbability(this.myModel, this.probabilityKey, this.maxProbability, this.selectedStartNodeId);

      const pathProbabilityResult: pathProbabilityResult = {
        startNodeId: result.startNodeId,
        startNodeName: result.startNodeName,
        iterations: 1,
        successIterations: 1,
        date: new Date(),
        pathProbabilityData: result
      };

      this.results.push(pathProbabilityResult);
      this.pathProbabilityResults.push(pathProbabilityResult);
      this.selectedResult = this.results.length - 1;
      this.closeCalculationDialog();
      this.openResultsBar();

      console.log('pathProbability calculation completed:', result);
    } catch (error) {
      alert(`Error during pathProbability calculation: ${error}`);
      console.error('Error in calculatepathProbabilityProbability:', error);
    }
  }

  override getpathProbabilityResultAtIndex(index: number): pathProbabilityResult | undefined {
    return this.results[index] as pathProbabilityResult;
  }

  override formatPosteriorProbability(probability: number): string {
    if (!Number.isFinite(probability)) return '0%';
    const percent = probability * 100;
    return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
  }
}
