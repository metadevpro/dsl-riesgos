import { bootstrapApplication } from '@angular/platform-browser';
import { simpleAppConfig } from './prob.app.config';
import { AppComponent } from './root/app.component';

bootstrapApplication(AppComponent, simpleAppConfig).catch((err) => console.error(err));
