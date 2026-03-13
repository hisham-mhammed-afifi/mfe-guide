# Part 5: Advanced Patterns and Best Practices

---

## Chapter 14: Advanced Patterns

### Exposing Individual Components

So far, each remote exposes a set of routes (`./Routes`). You can also expose individual components for granular composition. For example, let the shell embed a `ProductCardComponent` from the products remote on the home page.

First, create the component in the products feature library:

```typescript
// libs/products/feature/src/lib/product-card.component.ts
import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Product } from '@mfe-platform/shared-models';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  template: `
    <div class="product-card">
      <img [src]="product().thumbnail" [alt]="product().title" />
      <h3>{{ product().title }}</h3>
      <p>{{ product().price | currency }}</p>
    </div>
  `,
  styles: [`
    .product-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .product-card img {
      max-width: 100%;
      height: 150px;
      object-fit: contain;
    }
  `],
})
export class ProductCardComponent {
  product = input.required<Product>();
}
```

Export it from the library's public API by adding to `libs/products/feature/src/index.ts`:

```typescript
export { ProductCardComponent } from './lib/product-card.component';
```

Now update the remote's federation config to expose this component as an additional entry:

```typescript
// apps/mfe_products/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe_products',
  exposes: {
    // Expose the full route tree (existing)
    './Routes':
      'apps/mfe_products/src/app/remote-entry/entry.routes.ts',
    // Expose a single component (new)
    './ProductCard':
      'libs/products/feature/src/lib/product-card.component.ts',
  },
};

export default config;
```

> **Warning:** The `exposes` paths are relative to the workspace root. Verify these paths resolve to actual files. A common mistake is pointing to a library's `index.ts` instead of the specific component file.

Load the component in the shell's routes:

```typescript
// In the shell's app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';

// Add this route alongside the existing remote routes
{
  path: 'featured',
  loadComponent: () =>
    loadRemote<typeof import('mfe_products/ProductCard')>(
      'mfe_products/ProductCard'
    ).then((m) => m!.ProductCardComponent),
}
```

### Error Handling for Remote Loading

If a remote is down or its CDN is unreachable, the shell should show a fallback instead of crashing. Create a helper function and apply it to all remote routes:

```typescript
// apps/shell/src/app/remote-unavailable.component.ts
import { Component } from '@angular/core';

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
  retry(): void {
    window.location.reload();
  }
}
```

> **Note:** `window.location.reload()` is a simple fallback that causes a full page reload, losing all client-side state (auth tokens in memory, form data, navigation history). For a more robust production pattern, inject `Router` and re-navigate to the current URL instead:
>
> ```typescript
> retry(): void {
>   const url = this.router.url;
>   this.router.navigateByUrl('/', { skipLocationChange: true })
>     .then(() => this.router.navigateByUrl(url));
> }
> ```

```typescript
// apps/shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';
import { Route } from '@angular/router';
import { RemoteUnavailableComponent } from './remote-unavailable.component';

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
];
```

> **Note:** The error handling above covers network-level failures (remote unreachable or CDN down). A separate class of runtime errors occurs *inside* a remote once it loads. The most common is `NG0203: toSignal() can only be used within an injection context`, caused by multiple Angular instances in the Module Federation environment. This is not a loading failure and will not be caught by the `.catch()` above. See Chapter 7, Steps 3 and 4 for the safe `signal()` + `ngOnInit` pattern that avoids it, and Pitfall 14 in Chapter 15 for a full explanation.

### How Do I Add a 4th Remote to an Existing Setup?

Use the `@nx/angular:remote` generator with the `--host` flag to wire it automatically:

```bash
npx nx g @nx/angular:remote apps/mfe_notifications \
  --host=shell \
  --prefix=app \
  --style=scss \
  --no-interactive
```

Then complete these steps:

1. **Add the URL to the manifest.** Edit `apps/shell/public/module-federation.manifest.json`:
   ```json
   {
     "mfe_products": "http://localhost:4201/mf-manifest.json",
     "mfe_orders": "http://localhost:4202/mf-manifest.json",
     "mfe_account": "http://localhost:4203/mf-manifest.json",
     "mfe_notifications": "http://localhost:4204/mf-manifest.json"
   }
   ```

2. **Verify the route was added.** The generator automatically adds a lazy route to the shell's `app.routes.ts`. Check that it is there.

3. **Tag the new project.** Add `"tags": ["scope:notifications", "type:app"]` to `apps/mfe_notifications/project.json`.

4. **Update boundary constraints.** Add a scope rule for `scope:notifications` in `eslint.config.mjs`.

5. **Build and test.** Run `npx nx serve shell` to verify the new remote loads.

### How Do I Share an Auth Service Across MFEs?

This was covered in detail in Chapter 4. The summary:

1. Create the service in a shared library (e.g., `libs/shared/data-access-auth`).
2. Use `@Injectable({ providedIn: 'root' })`.
3. Export it from the library's `index.ts`.
4. Import it in any MFE via `@mfe-platform/shared-data-access-auth`.
5. Nx auto-shares the library as a singleton. Every MFE gets the same instance.

### The Rspack Alternative

Nx 22 supports converting Angular projects from Webpack to **Rspack**, a Rust-based Webpack-compatible bundler that supports Module Federation with significantly faster build times (2-3x improvement):

```bash
npx nx g @nx/angular:convert-to-rspack shell
npx nx g @nx/angular:convert-to-rspack mfe_products
```

Rspack uses the same Module Federation API, so the config files stay almost identical. The trade-off is a smaller plugin ecosystem. If your setup uses standard Module Federation without exotic Webpack plugins, Rspack is worth evaluating.

> **Note:** Nx is developing a new `NxModuleFederationPlugin` that replaces `withModuleFederation` for Rspack-based projects. As of March 2026, this plugin is available for React but not yet for Angular. When Angular support arrives, the migration path from Webpack will become smoother. For now, Angular MFE projects should continue using Webpack with `withModuleFederation`.

### Nx Project Graph

```bash
npx nx graph
```

Opens an interactive browser visualization of how the shell, remotes, and shared libraries connect. Use it to:

- Verify boundary rules are working (no unexpected edges).
- Explain architecture to the team.
- Debug "why did this app rebuild?" questions.

Now let's close with the practices and pitfalls that will keep your MFE architecture healthy over time. That's Chapter 15.

---

## Chapter 15: Best Practices and Pitfalls

### 10 Best Practices

1. **Use Dynamic Federation for everything.** Static federation requires rebuilds for URL changes. Dynamic federation reads URLs from a manifest at runtime.

2. **One team per remote.** If two teams need to change the same remote frequently, the domain boundary is wrong. Split the remote or adjust ownership.

3. **Keep the shell thin.** The shell owns layout, navigation, global providers, and global error handling. Feature logic lives in remotes and their libraries.

4. **Enforce boundaries from day one.** Tag every project with `scope:*` and `type:*`. Set the ESLint rule to `'error'`. Retrofitting boundaries on an existing codebase with violations is painful.

5. **Provide global services in the shell's `app.config.ts`.** `provideHttpClient()`, `provideRouter()`, `provideAnimationsAsync()` go in the shell. Remotes inherit these. Also add them to each remote's `app.config.ts` for standalone mode.

6. **Align versions.** All apps share one `package.json`. Run `npx nx migrate latest` regularly. After migrating, rebuild and redeploy all affected apps.

7. **Cache aggressively.** Connect Nx Cloud for remote caching. Enable caching for build, test, and lint targets. Typical CI time reduction: 50-80%.

8. **Test the composed system.** Unit tests per project are necessary but not sufficient. Run integration tests with Docker Compose that load all remotes in the shell (as described in Chapter 13).

9. **Inject the manifest at deploy time, never at build time.** Build the shell once. Swap `module-federation.manifest.json` per environment. This is the core of "build once, deploy everywhere."

10. **Know what to hand off to DevOps.** You own the build commands, output paths, manifest format, and cache-busting requirements. DevOps owns the Docker, CI, and AWS infrastructure. Use the checklist from Chapter 11 to communicate clearly.

### 15 Common Pitfalls

| # | Pitfall | Cause | Solution |
|---|---|---|---|
| 1 | `NullInjectorError: No provider for HttpClient` | Shell's `app.config.ts` missing `provideHttpClient()` | Add `provideHttpClient(withInterceptorsFromDi())` to the shell's config |
| 2 | Multiple Angular instances loaded | Shared config missing `singleton: true` | Nx handles this by default. Check Network tab for duplicate `@angular/core` chunks |
| 3 | Service not shared across MFEs | Library not in Nx project graph | Verify `tsconfig.base.json` has a path alias for the library. Run `npx nx graph` to check |
| 4 | Module-level signals not syncing | Library loaded as separate copy per MFE | Use `@Injectable({ providedIn: 'root' })` services for shared state instead |
| 5 | Remote works standalone but blank in shell | Missing `<router-outlet>` in shell or remote entry component | Verify the shell's `App` component has `<router-outlet>`. If the remote has child routes, its entry component needs one too |
| 6 | Styles leaking between MFEs | `ViewEncapsulation.None` or global CSS in remote | Use default encapsulation. No global CSS in remotes. Use CSS custom properties for theming |
| 7 | `nx serve shell` does not load remotes | Nx cannot discover remote projects | Verify remotes were generated with correct `--host` relationship. Check the project graph with `npx nx graph`. |
| 8 | CORS errors loading `mf-manifest.json` in production | CDN missing CORS response headers | Ask your DevOps team to add `Access-Control-Allow-Origin` for the shell's domain on each remote's CDN |
| 9 | Stale `remoteEntry.mjs` or `mf-manifest.json` after deploy | CloudFront default cache TTL too long | Ask your DevOps team to create a cache behavior for `/remoteEntry.mjs` and `/mf-manifest.json` with 60s TTL and invalidate on deploy |
| 10 | Webpack required but esbuild is default | Angular 21 defaults to esbuild | The `@nx/angular:host` generator uses Webpack automatically. If you created the app differently, use `@nx/angular:convert-to-rspack` or reconfigure |
| 11 | Circular dependency between MFEs | Remote A imports from Remote B's library | Enforce scope boundaries. Extract shared code into a `scope:shared` library |
| 12 | Docker build slow or no cache | `COPY . .` before `npm ci` | Use multi-stage builds. Copy `package.json` first, run `npm ci`, then copy source. Ask your DevOps team to verify |
| 13 | Manifest not updated after deploy | Shell built with dev manifest, no injection step | Ask your DevOps team to always inject the environment manifest after build, before S3 sync or container start |
| 14 | `NG0203: toSignal() can only be used within an injection context` in a remote | Multiple Angular instances in Module Federation break the DI context that `toSignal()` requires | Replace `toSignal()` with `signal()` + `ngOnInit` subscription. See Chapter 7, Steps 3–4 and Pitfall 14 below |
| 15 | `Uncaught SyntaxError: Cannot use 'import.meta' outside a module` in `styles.js` | `withModuleFederation` sets `outputModule: true` + `publicPath: 'auto'`; Angular injects `styles.js` as a classic script that cannot contain `import.meta` | Override `output.publicPath: '/'` in the shell's `webpack.config.ts`. See Chapter 3 and Pitfall 15 below |

### Pitfall 14: toSignal() throws NG0203 in Module Federation Remotes

**Symptom:** The browser console shows `ERROR RuntimeError: NG0203: toSignal() can only be used within an injection context` when navigating to a remote route. The stack trace points to the remote component's constructor or a class field initializer.

**Root cause (brief):** Module Federation can load multiple Angular instances — one in the shell and one in the remote. `toSignal()` checks the injection context of its own Angular instance, which is never activated for the remote's components. The failure occurs whether `toSignal()` is called in a class field initializer or in the constructor, because neither context is valid across the instance boundary.

**Fix:** Replace `toSignal()` with a plain `signal()` and subscribe manually in `ngOnInit`. `signal()` is a pure reactive primitive with no DI dependency; the subscription in `ngOnInit` runs after the component is fully initialized in the correct DI tree.

```typescript
// Do NOT use this pattern in remote components — causes NG0203:
import { toSignal } from '@angular/core/rxjs-interop';

export class ProductListComponent {
  private readonly productService = inject(ProductService);
  readonly products = toSignal(this.productService.getAll(), { initialValue: [] });
}

// Use this pattern instead — safe in all Module Federation contexts:
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';

export class ProductListComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  readonly products = signal<Product[]>([]);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.productService.getAll().subscribe(p => this.products.set(p));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
```

This also applies to `toObservable()` and any other helper from `@angular/core/rxjs-interop` that requires an injection context. See Chapter 7, Steps 3 and 4 for the complete working components (`ProductListComponent` and `ProductDetailComponent`).

### Pitfall 15: styles.js throws 'Cannot use import.meta outside a module'

**Symptom:** The browser console shows `Uncaught SyntaxError: Cannot use 'import.meta' outside a module (at styles.js:...)` immediately on page load of the shell. No user action or remote navigation is needed to trigger it.

**Root cause (brief):** `withModuleFederation` sets both `experiments.outputModule: true` and `output.publicPath: 'auto'`. This causes Webpack to emit `import.meta.url` in every chunk — including `styles.js` — so it can resolve the public path at runtime. However, Angular hardcodes `styles.js` as a classic `<script defer>` tag (not `type="module"`), and `import.meta` is a parse-time syntax error in classic scripts.

**Fix:** Override `output.publicPath` to `'/'` in the shell's `webpack.config.ts`. With a static path, Webpack does not need to generate `import.meta.url` in any chunk. See Chapter 3 for the complete shell `webpack.config.ts` with this override applied.

> **Note:** This error affects only the shell, not remotes. Remote apps expose `remoteEntry.mjs`, which Angular injects as `type="module"` — `import.meta` is valid there. Remote `styles.js` files are never injected into the shell's HTML when loaded as federated modules, so remotes must keep `publicPath: 'auto'` to resolve their own chunks correctly.

### Performance Tips

- **Prefetch critical remotes:** Call `loadRemote()` in the background after shell load for routes the user is likely to visit next.
- **Use `@defer` blocks:** Angular's deferrable views can be combined with remote loading for viewport-triggered loading.
- **Code-split within remotes:** Remotes can have their own lazy-loaded child routes, further reducing initial bundle size.
- **Monitor bundles:** Use `npx nx build mfe_products --statsJson` and analyze with `webpack-bundle-analyzer`.
- **Prefer static remotes during dev:** Only use `--devRemotes` for the remote you are actively editing. Static remotes are served from cache instantly.
- **Check for duplicates:** Open the Network tab, filter for `@angular/core`. If more than one chunk appears, sharing is broken.

---

## Appendix A: Quick Reference Card

The most common Nx and Module Federation commands (all explained in the chapters above):

| Command | What It Does |
|---|---|
| `npx nx serve shell` | Serve the shell with all remotes (static) |
| `npx nx serve shell --devRemotes=mfe_products` | Serve shell with products in HMR mode |
| `npx nx serve mfe_products` | Serve a remote standalone on its own port |
| `npx nx build shell --configuration=production` | Production build of the shell |
| `npx nx build mfe_products --configuration=production` | Production build of a remote |
| `npx nx test mfe_products` | Run Vitest unit tests for a project |
| `npx nx affected -t lint test build` | Lint, test, and build only affected projects |
| `npx nx g @nx/angular:remote apps/mfe_new --host=shell` | Add a new remote wired to the shell |
| `npx nx g @nx/angular:library --directory=libs/shared/my-lib --name=my-lib --importPath=@mfe-platform/my-lib` | Generate a shared library |
| `npx nx graph` | Visualize the project dependency graph |
| `npx nx migrate latest` | Update Nx, Angular, and all plugins |

---

## Appendix B: DevOps Handoff Checklist

Copy this into a Slack message or Jira ticket for your DevOps team.

---

**Microfrontend Deployment Requirements**

**Build commands (one per app):**
```
npx nx build shell --configuration=production
npx nx build mfe_products --configuration=production
npx nx build mfe_orders --configuration=production
npx nx build mfe_account --configuration=production
```

**Output directory per app:**
`dist/apps/<app-name>/` containing `index.html`, JS chunks, CSS, and assets.

**Manifest file (shell only):**
Located at `dist/apps/shell/module-federation.manifest.json`. Must be replaced with environment-specific URLs after building, before deploying. Format:
```json
{
  "mfe_products": "https://products.mfe.example.com/mf-manifest.json",
  "mfe_orders": "https://orders.mfe.example.com/mf-manifest.json",
  "mfe_account": "https://account.mfe.example.com/mf-manifest.json"
}
```

**CORS requirements:**
Each remote's CDN must set `Access-Control-Allow-Origin: https://app.example.com` (the shell's domain) and `Access-Control-Allow-Methods: GET, OPTIONS`.

**Cache-busting rules:**
- `remoteEntry.mjs` and `mf-manifest.json`: short TTL (60 seconds). These files change on every deploy but their filenames do NOT change.
- All other `.js` and `.css` files: 1 year cache. These are content-hashed (filename changes when content changes).
- `index.html`: always revalidate (TTL 0).
- After every deploy: invalidate `/index.html` and `/module-federation.manifest.json` in CloudFront.

**SPA routing:**
nginx or CloudFront must return `index.html` for all routes that do not match a static file.

**Docker build (if using containers):**
```
docker build --build-arg APP_NAME=shell -t mfe-shell:latest .
docker build --build-arg APP_NAME=mfe_products -t mfe-products:latest .
docker build --build-arg APP_NAME=mfe_orders -t mfe-orders:latest .
docker build --build-arg APP_NAME=mfe_account -t mfe-account:latest .
```

**Environment variables (for ECS/EKS container deploy):**
The shell container uses an entrypoint script that reads `MFE_PRODUCTS_URL`, `MFE_ORDERS_URL`, and `MFE_ACCOUNT_URL` to generate the mf-manifest.json format manifest at startup.
