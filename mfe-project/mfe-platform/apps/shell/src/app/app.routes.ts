// apps/shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';
import { Route } from '@angular/router';
import { RemoteUnavailableComponent } from './remote-unavailable.component';
import { NxWelcome } from './nx-welcome';

// Helper: wraps loadRemote with a fallback on failure
function loadRemoteRoutes(remoteName: string): () => Promise<Route[]> {
  return () =>
    loadRemote<{ remoteRoutes: Route[] }>(`${remoteName}/Routes`)
      .then((m) => m!.remoteRoutes)
      .catch((err) => {
        console.error(`Failed to load ${remoteName}:`, err);
        return [{ path: '**', component: RemoteUnavailableComponent }];
      });
}

export const appRoutes: Route[] = [
  { path: 'products', loadChildren: loadRemoteRoutes('mfe_products') },
  { path: 'orders', loadChildren: loadRemoteRoutes('mfe_orders') },
  { path: 'account', loadChildren: loadRemoteRoutes('mfe_account') },
  { path: '', component: NxWelcome},
];
