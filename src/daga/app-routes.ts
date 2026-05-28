import { Route } from '@angular/router';
import { BinomialComponent } from './component/binomial.component';
import { BayesComponent } from './component/bayes.component';
import { LandingComponent } from './component/landing/landing.component';

export const appRoutes: Route[] = [
  { path: '', component: LandingComponent },
  { path: 'binomial', component: BinomialComponent },
  { path: 'bayes', component: BayesComponent }
];
