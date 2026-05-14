import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { BinomialComponent } from './binomial.component';
import { BayesComponent } from './bayes.component';
import { downloadRiskFile, readRiskFile, RiskFile } from '../utils/importExport.utils';

@Component({
  standalone: true,
  selector: 'risk-root',
  templateUrl: '../dagaIndex.html',
  imports: [CommonModule, BinomialComponent, BayesComponent]
})
export class SimpleComponent {
  selectedModel: 'binomial' | 'bayes' = 'binomial';

  @ViewChild(BinomialComponent) private binomial?: BinomialComponent;
  @ViewChild(BayesComponent) private bayes?: BayesComponent;

  selectModel(modelKey: 'binomial' | 'bayes'): void {
    this.selectedModel = modelKey;
  }

  exportCurrent(): void {
    const file =
      this.selectedModel === 'binomial' ? this.binomial?.exportCurrent() ?? null : this.bayes?.exportCurrent() ?? null;
    if (file) {
      downloadRiskFile(file);
    }
  }

  triggerCalculate(): void {
    this.binomial?.openCalculationDialog();
  }

  triggerImportCSV(): void {
    this.bayes?.toggleLearningPanel();
  }

  triggerGenerateCSV(): void {
    this.bayes?.abrirDialogoCSV();
  }

  triggerMonteCarlo(): void {
    this.bayes?.toggleMCPanel();
  }

  get hasBinomialResults(): boolean {
    return (this.binomial?.results?.length ?? 0) > 0;
  }

  get hasBayesHistory(): boolean {
    return (this.bayes?.mcHistory?.length ?? 0) > 0;
  }

  openBinomialResults(): void {
    this.binomial?.openResultsBar();
  }

  openBayesHistory(): void {
    this.bayes?.openMCHistory();
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

    if (parsed.modelType !== this.selectedModel) {
      const labels: Record<'binomial' | 'bayes', string> = {
        binomial: 'Binomial',
        bayes: 'Bayes'
      };
      alert(
        `El archivo corresponde al modelo "${labels[parsed.modelType]}" pero estás en la pestaña "${labels[this.selectedModel]}". ` +
          `Cambia a la pestaña correcta antes de importar.`
      );
      input.value = '';
      return;
    }

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
