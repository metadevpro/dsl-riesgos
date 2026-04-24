import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { pathProbabilityComponent } from './pathProbability.component';
import { BinomialComponent } from './binomial.component';
import { BayesComponent } from './bayes.component';

@Component({
	standalone: true,
	selector: 'daga-tutorial-root',
	templateUrl: '../dagaIndex.html',
	imports: [CommonModule, BinomialComponent, pathProbabilityComponent, BayesComponent]
})
export class SimpleComponent {
	isSidebarCollapsed = false;
	selectedModel: 'binomial' | 'pathProbability' | 'bayes' = 'binomial';

	toggleSidebar(): void {
		this.isSidebarCollapsed = !this.isSidebarCollapsed;
	}

	selectModel(modelKey: 'binomial' | 'pathProbability' | 'bayes'): void {
		this.selectedModel = modelKey;
	}
}
