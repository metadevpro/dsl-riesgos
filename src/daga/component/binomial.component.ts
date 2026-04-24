import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DagaModule } from '@metadev/daga-angular';
import { ExampleComponent } from './dagaExample.component';
import { calculateBinomialProbability } from '../utils/binomialCalculationNodes.utils';
import { GenericComponent } from './generic.component';

@Component({
    standalone: true,
    selector: 'daga-tutorial-simple',
    templateUrl: '../binomial.html',
    imports: [DagaModule, ExampleComponent, CommonModule]
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

            this.pushResult(result.iterations, result.successIterations, result.startNodeId, result.startNodeName);
            console.log('Calculation completed:', result);
        } catch (error) {
            alert(`Error during calculation: ${error}`);
            console.error('Error in calculateBinomialProbability:', error);
        }
    }
}
