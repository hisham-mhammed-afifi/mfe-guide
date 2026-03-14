import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-shared-ui',
  imports: [],
  templateUrl: './shared-ui.html',
  styleUrl: './shared-ui.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedUi {}
