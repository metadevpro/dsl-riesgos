import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProbComponent } from "../prob.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [RouterModule, ProbComponent]
})
export class AppComponent {}
