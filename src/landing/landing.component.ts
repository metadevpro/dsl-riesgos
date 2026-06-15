import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QualityControlComponent } from './examples/binomial/quality-control.component';
import { SupplyChainComponent } from './examples/binomial/supply-chain.component';
import { CybersecurityComponent } from './examples/binomial/cybersecurity.component';
import { CybersecurityExtensionComponent } from './examples/binomial/cybersecurity-extension.component';
import { ClinicalTrialComponent } from './examples/binomial/clinical-trial.component';
import { Falcon9Component } from './examples/bayes/falcon9.component';
import { RocketAbortComponent } from './examples/bayes/rocket-abort.component';
import { CrewDragonComponent } from './examples/bayes/crew-dragon.component';

type BinomialTab = 'quality-control' | 'supply-chain' | 'clinical-trial' | 'cybersecurity' | 'cybersecurity-extension';
type BayesTab = 'falcon9' | 'rocket-abort' | 'crew-dragon';

@Component({
  selector: 'risk-landing',
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  imports: [
    RouterModule,
    QualityControlComponent,
    SupplyChainComponent,
    CybersecurityComponent,
    CybersecurityExtensionComponent,
    ClinicalTrialComponent,
    Falcon9Component,
    RocketAbortComponent,
    CrewDragonComponent
  ]
})
export class LandingComponent {
  readonly binomialTabs = [
    { id: 'quality-control', label: 'In-line Quality Control' },
    { id: 'supply-chain', label: 'Logistics Supply Chain' },
    { id: 'clinical-trial', label: 'Clinical Trial' },
    { id: 'cybersecurity', label: 'Cybersecurity' },
    { id: 'cybersecurity-extension', label: 'Cybersecurity Extension' }
  ] as const;

  readonly bayesTabs = [
    { id: 'falcon9', label: 'Falcon 9 Mission' },
    { id: 'rocket-abort', label: 'Rocket Abort at T-10' },
    { id: 'crew-dragon', label: 'Crew Dragon' }
  ] as const;

  readonly binomialTab = signal<BinomialTab>('quality-control');
  readonly bayesTab = signal<BayesTab>('falcon9');
}
