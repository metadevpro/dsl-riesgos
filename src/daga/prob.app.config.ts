import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

export const simpleAppConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners()
    ]
};
