# Part 5: Advanced Patterns and Best Practices

---

## Chapter 14: Advanced Patterns

### Exposing Individual Components

So far, each remote exposes a set of routes (`./Routes`). You can also expose individual components for granular composition. For example, let the shell embed a `ProductCardComponent` from the products remote on the home page.

Update the remote's federation config to expose an additional entry:

```typescript
// apps/mfe-products/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe-products',
  exposes: {
    // Expose the full route tree (existing)
    './Routes':
      'apps/mfe-products/src/app/remote-entry/entry.routes.ts',
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
    loadRemote<typeof import('mfe-products/ProductCard')>(
      'mfe-products/ProductCard'
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
  { path: 'products', loadChildren: loadRemoteRoutes('mfe-products') },
  { path: 'orders', loadChildren: loadRemoteRoutes('mfe-orders') },
  { path: 'account', loadChildren: loadRemoteRoutes('mfe-account') },
];
```

### How Do I Add a 4th Remote to an Existing Setup?

Use the `@nx/angular:remote` generator with the `--host` flag to wire it automatically:

```bash
npx nx g @nx/angular:remote apps/mfe-notifications \
  --host=shell \
  --prefix=notifications \
  --style=scss
```

Then complete these steps:

1. **Add the URL to the manifest.** Edit `apps/shell/src/assets/module-federation.manifest.json`:
   ```json
   {
     "mfe-products": "http://localhost:4201",
     "mfe-orders": "http://localhost:4202",
     "mfe-account": "http://localhost:4203",
     "mfe-notifications": "http://localhost:4204"
   }
   ```

2. **Verify the route was added.** The generator automatically adds a lazy route to the shell's `app.routes.ts`. Check that it is there.

3. **Tag the new project.** Add `"tags": ["scope:notifications", "type:app"]` to `apps/mfe-notifications/project.json`.

4. **Update boundary constraints.** Add a scope rule for `scope:notifications` in `eslint.config.js`.

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
npx nx g @nx/angular:convert-to-rspack mfe-products
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

### 13 Common Pitfalls

| # | Pitfall | Cause | Solution |
|---|---|---|---|
| 1 | `NullInjectorError: No provider for HttpClient` | Shell's `app.config.ts` missing `provideHttpClient()` | Add `provideHttpClient(withInterceptorsFromDi())` to the shell's config |
| 2 | Multiple Angular instances loaded | Shared config missing `singleton: true` | Nx handles this by default. Check Network tab for duplicate `@angular/core` chunks |
| 3 | Service not shared across MFEs | Library not in Nx project graph | Verify `tsconfig.base.json` has a path alias for the library. Run `npx nx graph` to check |
| 4 | Module-level signals not syncing | Library loaded as separate copy per MFE | Use `@Injectable({ providedIn: 'root' })` services for shared state instead |
| 5 | Remote works standalone but blank in shell | Missing `<router-outlet>` in shell or remote entry component | Verify the shell's `AppComponent` has `<router-outlet>`. If the remote has child routes, its entry component needs one too |
| 6 | Styles leaking between MFEs | `ViewEncapsulation.None` or global CSS in remote | Use default encapsulation. No global CSS in remotes. Use CSS custom properties for theming |
| 7 | `nx serve shell` does not load remotes | `remotes` array empty in `module-federation.config.ts` | Keep remote names in the config. Nx uses it for dev server discovery |
| 8 | CORS errors loading `remoteEntry.js` in production | CDN missing CORS response headers | Ask your DevOps team to add `Access-Control-Allow-Origin` for the shell's domain on each remote's CDN |
| 9 | Stale `remoteEntry.js` after deploy | CloudFront default cache TTL too long | Ask your DevOps team to create a cache behavior for `/remoteEntry.js` with 60s TTL and invalidate on deploy |
| 10 | Webpack required but esbuild is default | Angular 21 defaults to esbuild | The `@nx/angular:host` generator uses Webpack automatically. If you created the app differently, use `@nx/angular:convert-to-rspack` or reconfigure |
| 11 | Circular dependency between MFEs | Remote A imports from Remote B's library | Enforce scope boundaries. Extract shared code into a `scope:shared` library |
| 12 | Docker build slow or no cache | `COPY . .` before `npm ci` | Use multi-stage builds. Copy `package.json` first, run `npm ci`, then copy source. Ask your DevOps team to verify |
| 13 | Manifest not updated after deploy | Shell built with dev manifest, no injection step | Ask your DevOps team to always inject the environment manifest after build, before S3 sync or container start |

### Performance Tips

- **Prefetch critical remotes:** Call `loadRemote()` in the background after shell load for routes the user is likely to visit next.
- **Use `@defer` blocks:** Angular's deferrable views can be combined with remote loading for viewport-triggered loading.
- **Code-split within remotes:** Remotes can have their own lazy-loaded child routes, further reducing initial bundle size.
- **Monitor bundles:** Use `npx nx build mfe-products --statsJson` and analyze with `webpack-bundle-analyzer`.
- **Prefer static remotes during dev:** Only use `--devRemotes` for the remote you are actively editing. Static remotes are served from cache instantly.
- **Check for duplicates:** Open the Network tab, filter for `@angular/core`. If more than one chunk appears, sharing is broken.

---

## Appendix A: Quick Reference Card

The 10 most common Nx and Module Federation commands (all explained in the chapters above):

| Command | What It Does |
|---|---|
| `npx nx serve shell` | Serve the shell with all remotes (static) |
| `npx nx serve shell --devRemotes=mfe-products` | Serve shell with products in HMR mode |
| `npx nx serve mfe-products` | Serve a remote standalone on its own port |
| `npx nx build shell --configuration=production` | Production build of the shell |
| `npx nx build mfe-products --configuration=production` | Production build of a remote |
| `npx nx test mfe-products` | Run Vitest unit tests for a project |
| `npx nx affected -t lint test build` | Lint, test, and build only affected projects |
| `npx nx g @nx/angular:remote apps/mfe-new --host=shell` | Add a new remote wired to the shell |
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
npx nx build mfe-products --configuration=production
npx nx build mfe-orders --configuration=production
npx nx build mfe-account --configuration=production
```

**Output directory per app:**
`dist/apps/<app-name>/browser/` containing `index.html`, JS chunks, CSS, and assets.

**Manifest file (shell only):**
Located at `dist/apps/shell/browser/assets/module-federation.manifest.json`. Must be replaced with environment-specific URLs after building, before deploying. Format:
```json
{
  "mfe-products": "https://products.mfe.example.com",
  "mfe-orders": "https://orders.mfe.example.com",
  "mfe-account": "https://account.mfe.example.com"
}
```

**CORS requirements:**
Each remote's CDN must set `Access-Control-Allow-Origin: https://app.example.com` (the shell's domain) and `Access-Control-Allow-Methods: GET, OPTIONS`.

**Cache-busting rules:**
- `remoteEntry.js`: short TTL (60 seconds). This file changes on every deploy but its filename does NOT change.
- All other `.js` and `.css` files: 1 year cache. These are content-hashed (filename changes when content changes).
- `index.html`: always revalidate (TTL 0).
- After every deploy: invalidate `/index.html` and `/assets/module-federation.manifest.json` in CloudFront.

**SPA routing:**
nginx or CloudFront must return `index.html` for all routes that do not match a static file.

**Docker build (if using containers):**
```
docker build --build-arg APP_NAME=shell -t mfe-shell:latest .
docker build --build-arg APP_NAME=mfe-products -t mfe-products:latest .
docker build --build-arg APP_NAME=mfe-orders -t mfe-orders:latest .
docker build --build-arg APP_NAME=mfe-account -t mfe-account:latest .
```

**Environment variables (for ECS/EKS container deploy):**
The shell container uses an entrypoint script that reads `MFE_PRODUCTS_URL`, `MFE_ORDERS_URL`, and `MFE_ACCOUNT_URL` to generate the manifest at startup.
