# Part 5: Advanced Patterns and Best Practices

---

## Chapter 14: Advanced Patterns

### Exposing Individual Components

Instead of exposing routes, expose individual components for granular composition:

```typescript
// Remote: module-federation.config.ts
const config: ModuleFederationConfig = {
  name: 'mfe-products',
  exposes: {
    './ProductCard':
      'libs/products/feature/src/lib/product-card.component.ts',
    './Routes':
      'apps/mfe-products/src/app/remote-entry/entry.routes.ts',
  },
};
```

> **Path note:** The `exposes` paths are relative to the workspace root. Verify these paths resolve to actual files. A common mistake is pointing to a library's `index.ts` instead of the specific component file.

Load the component in the shell:

```typescript
{
  path: 'featured',
  loadComponent: () =>
    loadRemoteModule('mfe-products', './ProductCard')
      .then((m) => m.ProductCardComponent),
}
```

### Error Handling for Remote Loading

If a remote is down, catch the error instead of crashing the shell:

```typescript
// apps/shell/src/app/app.routes.ts
import { loadRemoteModule } from '@nx/angular/mf';
import { Route } from '@angular/router';
import { RemoteUnavailableComponent } from './remote-unavailable.component';

export const appRoutes: Route[] = [
  {
    path: 'products',
    loadChildren: () =>
      loadRemoteModule('mfe-products', './Routes')
        .then((m) => m.remoteRoutes)
        .catch((err) => {
          console.error('Failed to load mfe-products:', err);
          return [{ path: '**', component: RemoteUnavailableComponent }];
        }),
  },
];
```

```typescript
// apps/shell/src/app/remote-unavailable.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-remote-unavailable',
  standalone: true,
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

### Adding a New Remote to an Existing System

```bash
nx g @nx/angular:remote apps/mfe-notifications \
  --host=shell \
  --prefix=notifications \
  --style=scss
```

Then:
1. Add the URL to `module-federation.manifest.json`.
2. Verify the route was added to the shell's `app.routes.ts` (the generator does this automatically).
3. Tag the new project in `project.json`.
4. Build and deploy.

### Angular Rspack as an Alternative Bundler

Nx 22 supports **Angular Rspack**, a Rust-based Webpack-compatible bundler that supports Module Federation with faster build times (2-3x improvement over Webpack):

```bash
nx g @nx/angular-rspack:configuration shell
nx g @nx/angular-rspack:configuration mfe-products
```

Rspack uses the same `ModuleFederationPlugin` API, so the config files stay almost identical. The trade-off is a smaller plugin ecosystem. If your setup uses standard Module Federation without exotic Webpack plugins, Rspack is worth evaluating.

### Nx Project Graph

```bash
nx graph
```

Opens an interactive browser visualization of how the shell, remotes, and shared libraries connect. Use it to verify boundaries and explain architecture to the team.

---

## Chapter 15: Best Practices and Pitfalls

### Best Practices

1. **Use Dynamic Federation for everything.** Static federation requires rebuilds for URL changes. Dynamic federation reads URLs at runtime.

2. **One team per remote.** If two teams need to change the same remote, the domain boundary is wrong.

3. **Keep the shell thin.** The shell owns layout, navigation, global providers, and global services. Feature logic lives in remotes and their libraries.

4. **Enforce boundaries from day one.** Tag every project with `scope:*` and `type:*`. Set the ESLint rule to `'error'`. Retrofitting is painful.

5. **Provide global services in the shell's `app.config.ts`.** `provideHttpClient()`, `provideRouter()`, `provideAnimationsAsync()` go in the shell. Remotes inherit these. Also add them to each remote's `app.config.ts` for standalone mode.

6. **Align versions.** All apps share one `package.json`. Run `nx migrate` regularly.

7. **Cache aggressively.** Connect Nx Cloud. Enable caching for build, test, lint. Typical CI reduction: 50-80%.

8. **Test the composed system.** Unit tests per project are necessary but not sufficient. Run integration tests that load all remotes in the shell.

9. **Use Docker for reproducible builds.** A single multi-stage Dockerfile with `ARG APP_NAME` builds any MFE consistently across local, CI, and staging. Use `docker compose` for full-system integration tests before deploying to AWS.

10. **Inject the manifest at deploy time, never at build time.** Build the shell once. Swap `module-federation.manifest.json` per environment (via file replacement for S3, or entrypoint script for ECS). This is the core of "build once, deploy everywhere."

### Common Pitfalls

| Pitfall | Cause | Solution |
|---|---|---|
| `NullInjectorError: No provider for HttpClient` | Shell's `app.config.ts` missing `provideHttpClient()` | Add `provideHttpClient(withInterceptorsFromDi())` to the shell's config |
| Multiple Angular instances loaded | Shared config missing `singleton: true` | Nx handles this by default. Check Network tab for duplicate `@angular/core` chunks |
| Service not shared across MFEs | Library not in Nx project graph | Verify `tsconfig.base.json` has a path alias for the library. Run `nx graph` to check the dependency edge |
| Module-level signals not syncing | Library loaded as separate copy | Use `@Injectable` services for shared state. Verify `singleton: true` for the library |
| Styles leaking between MFEs | `ViewEncapsulation.None` or global CSS in remote | Use default encapsulation. No global CSS in remotes. Use CSS custom properties |
| CORS errors in production | CloudFront missing response headers policy | Add a CORS response headers policy to each remote's CloudFront distribution |
| Stale `remoteEntry.js` | CloudFront default cache TTL too long | Create a cache behavior for `/remoteEntry.js` with 60s TTL. Invalidate on deploy |
| `nx serve shell` does not build remotes | `remotes` array empty in MF config | Keep remote names in the config (Nx uses it for dev server discovery) |
| Webpack required but esbuild is default | Angular 21 defaults to esbuild | Use `--preset=apps` then `@nx/angular:host` (always uses Webpack). Or use Rspack |
| Circular dependency between MFEs | Remote A imports Remote B's library | Enforce scope boundaries. Extract shared code into `scope:shared` |
| Docker build slow / no cache | COPY . . before npm ci | Use multi-stage builds. Copy `package.json` first, run `npm ci`, then copy source |
| Manifest not updated after deploy | Shell built with dev manifest, no injection step | Always inject the environment manifest after build, before S3 sync or container start |
| CloudFront serving stale index.html | No invalidation after deploy | Invalidate `/index.html` and `/assets/module-federation.manifest.json` after every S3 sync |

### Performance Tips

- **Prefetch critical remotes:** Call `loadRemoteModule()` in the background after shell load for routes the user is likely to visit.
- **Use `@defer` blocks:** Combine deferrable views with remote loading for viewport-triggered loading.
- **Code-split within remotes:** Remotes can have their own lazy routes.
- **Monitor bundles:** Use `nx build mfe-products --statsJson` and analyze with `webpack-bundle-analyzer`.
- **Prefer static remotes during dev:** Only use `--devRemotes` for the remote you are actively editing.
- **Check for duplicates:** Open the Network tab, filter for `@angular/core`. More than one means sharing is broken.

---

## v3 Changelog: Fixes Applied in This Version

| # | Issue Found in v2 Review | Fix Applied |
|---|---|---|
| 1 | `setup-mf` approach is more complex than needed; contradicts Nx's recommended path | Replaced with `@nx/angular:host --dynamic --remotes=...` (single command) |
| 2 | `--dynamic` flag was incorrectly removed in v2 | Restored. Confirmed it exists on `@nx/angular:host` per Nx docs |
| 3 | `--preset=angular-monorepo --bundler=webpack` may not work | Changed to `--preset=apps` + install `@nx/angular` + host generator |
| 4 | No mention of `@module-federation/enhanced` | Added to Ch1 architecture table and explained in Ch3 |
| 5 | Contradictory "empty remotes then put them back" in v2 Ch3 | Eliminated. Generator creates the correct config; no manual editing needed |
| 6 | Remote bootstrap didn't match Nx generation (`AppComponent` + `app.config.ts`) | Fixed Ch5 to show `app.config.ts` pattern matching actual Nx output |
| 7 | Bundling behavior when `entry.routes.ts` imports libs not explained | Added note in Ch3 under the `exposes` section |
| 8 | Contract test import paths won't resolve in Jest | Added tsconfig path aliases + explanation of how to wire them |
| 9 | CommonJS vs ESM config file not mentioned | Added note in Ch3 under `module-federation.config.ts` |
| 10 | Library generation `--directory` flag behavior not clarified | Added explicit `--directory` to all `nx g` commands in Ch4 |
| 11 | Ch9 (now Ch8) inaccurate about how Nx discovers remotes in dynamic mode | Corrected: Nx uses the `remotes` array in config for dev server, not the manifest |
| 12 | `nrwl/nx-set-shas@v4` not verified | Confirmed still correct as of Nx 22 |
| 13 | Deployment was generic (placeholder S3 commands) | Replaced with full Docker multi-stage build, nginx.conf, docker-compose.yml, manifest injection (file swap + entrypoint approaches) |
| 14 | No CI/CD pipeline for AWS | Added complete GitHub Actions pipeline with matrix deploy, OIDC AWS auth, affected check, manifest injection, S3 sync + CloudFront invalidation |
| 15 | No CloudFront configuration guidance | Added CORS response headers policy, cache behavior table for remoteEntry.js vs. hashed chunks |
| 16 | No ECS/ECR container deployment option | Added ECR push + ECS update-service flow with env-var-based manifest injection |
| 17 | No docker-compose for local integration testing | Added docker-compose.yml running all 4 MFEs, integration test commands |
| 18 | Pitfalls table missing Docker/AWS-specific issues | Added 3 new pitfalls: Docker cache, manifest not injected, CloudFront stale index.html |
