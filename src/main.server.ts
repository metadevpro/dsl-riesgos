import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { SimpleComponent } from './daga/component/prob.component';
import { simpleAppConfig } from './daga/prob.app.config';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(SimpleComponent, simpleAppConfig, context);

export default bootstrap;
