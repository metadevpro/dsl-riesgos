import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { simpleAppConfig } from './daga/prob.app.config';
import { AppComponent } from './daga/component/app/app.component';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, simpleAppConfig, context);

export default bootstrap;
