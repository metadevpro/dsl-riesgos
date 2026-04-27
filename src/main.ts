import { bootstrapApplication } from '@angular/platform-browser';
import { simpleAppConfig } from './daga/prob.app.config';
import { SimpleComponent } from './daga/component/prob.component';

bootstrapApplication(SimpleComponent, simpleAppConfig).catch((err) => console.error(err));
