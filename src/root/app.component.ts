import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ModelToolbarHost } from '../models/model-toolbar';

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
}
