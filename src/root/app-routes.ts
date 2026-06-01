import { Route } from '@angular/router';
import { LandingComponent } from '../landing/landing.component';
import { BayesComponent } from '../models/bayes/bayes.component';
import { BinomialComponent } from '../models/binomial/binomial.component';
import { DocComponent } from '../doc/doc.component';

export const appRoutes: Route[] = [
  { path: '', component: LandingComponent },
  { path: 'binomial', component: BinomialComponent },
  { path: 'bayes', component: BayesComponent },
  { path: 'doc', component: DocComponent }
];
