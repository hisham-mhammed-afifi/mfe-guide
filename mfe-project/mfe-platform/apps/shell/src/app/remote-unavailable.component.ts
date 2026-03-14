// apps/shell/src/app/remote-unavailable.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-remote-unavailable',
  template: `
    <div style="text-align:center; padding:40px;">
      <h2>Feature Temporarily Unavailable</h2>
      <p>This section could not be loaded. Please try again later.</p>
      <button (click)="retry()">Retry</button>
    </div>
  `,
})
export class RemoteUnavailableComponent {
  private readonly router = inject(Router);

  retry(): void {
    // Re-navigate to the current URL without a full page reload.
    // This preserves in-memory state (auth tokens, etc.) held by the shell.
    const url = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigateByUrl(url));
  }
}
