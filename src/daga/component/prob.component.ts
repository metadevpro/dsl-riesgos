import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { pathProbabilityComponent } from './pathProbability.component';
import { BinomialComponent } from './binomial.component';
import { BayesComponent } from './bayes.component';
import { downloadRiskFile, readRiskFile, RiskFile } from '../utils/importExport.utils';

@Component({
  standalone: true,
  selector: 'risk-root',
  templateUrl: '../dagaIndex.html',
  imports: [CommonModule, BinomialComponent, pathProbabilityComponent, BayesComponent]
})
export class SimpleComponent {
  isSidebarCollapsed = false;
  selectedModel: 'binomial' | 'pathProbability' | 'bayes' = 'binomial';

  @ViewChild(BinomialComponent) private binomial?: BinomialComponent;
  @ViewChild(BayesComponent) private bayes?: BayesComponent;

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  selectModel(modelKey: 'binomial' | 'pathProbability' | 'bayes'): void {
    this.selectedModel = modelKey;
  }

  exportCurrent(): void {
    if (this.selectedModel === 'pathProbability') {
      alert('Exportar/Importar no soportado en el modelo Path.');
      return;
    }
    const file =
      this.selectedModel === 'binomial' ? this.binomial?.exportCurrent() ?? null : this.bayes?.exportCurrent() ?? null;
    if (file) {
      downloadRiskFile(file);
    }
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

    this.selectModel(parsed.modelType);

    // Wait for the @if block to render the target component before applying.
    setTimeout(() => {
      if (parsed.modelType === 'binomial') {
        this.binomial?.applyImport(parsed);
      } else {
        this.bayes?.applyImport(parsed);
      }
      input.value = '';
    }, 0);
  }
}
