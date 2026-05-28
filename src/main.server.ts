import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { simpleAppConfig } from './prob.app.config';
import { AppComponent } from './root/app.component';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, simpleAppConfig, context);

export default bootstrap;
