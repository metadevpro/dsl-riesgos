import { bootstrapApplication } from '@angular/platform-browser';
import { simpleAppConfig } from './daga/prob.app.config';
import { AppComponent } from './daga/component/app/app.component';

bootstrapApplication(AppComponent, simpleAppConfig).catch((err) => console.error(err));
