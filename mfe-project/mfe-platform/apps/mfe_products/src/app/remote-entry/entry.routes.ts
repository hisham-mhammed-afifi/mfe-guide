// apps/mfe_products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
    // Lazy-load the list component from the feature library
    loadComponent: () =>
      import('@mfe-platform/products-feature')
        .then((m) => m.ProductListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@mfe-platform/products-feature')
        .then((m) => m.ProductDetailComponent),
  },
];
