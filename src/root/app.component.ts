import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ModelToolbarHost, ToolbarButton } from '../models/model-toolbar';

@Component({
  selector: 'risk-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [RouterModule]
})
export class AppComponent {
  activeModel: ModelToolbarHost | null = null;

  onActivate(cmp: unknown): void {
    this.activeModel = cmp && typeof cmp === 'object' && 'toolbarButtons' in cmp ? (cmp as ModelToolbarHost) : null;
  }

  onDeactivate(): void {
    this.activeModel = null;
  }

  /**
   * Run a toolbar button's action, then mark the routed component for check.
   * The button lives in this header's template, so the click only dirties
   * AppComponent; without this the routed component's state change (e.g. opening
   * a dialog) would never re-render under zoneless change detection.
   */
  runAction(btn: ToolbarButton): void {
    btn.action();
    this.activeModel?.markForCheck();
  }
}
