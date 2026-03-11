# Part 2: Configuration, Libraries, Providers, and Boundaries

---

## Chapter 3: Understanding the Generated Configuration

Let's examine every key file that the generator created to understand how Module Federation is wired.

### Shell: module-federation.config.ts

```typescript
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: ['mfe-products', 'mfe-orders', 'mfe-account'],
};

export default config;
```

> **Note on CommonJS vs. ESM:** Depending on your workspace configuration, this file may use `module.exports = config` (CommonJS) instead of `export default config` (ESM). Both work. Match whichever syntax Nx generated for your workspace.

The `remotes` array serves **two purposes:**
- **During `nx serve`:** Nx reads this to discover which remote projects to auto-build (or restore from cache) and serve statically.
- **At runtime with Dynamic Federation:** This array is ignored. The manifest takes over.

You do NOT need to empty this array for dynamic mode. Keeping the remote names here is correct and necessary for the dev server to work properly.

### Shell: webpack.config.ts

```typescript
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default withModuleFederation(config);
```

The `withModuleFederation` helper:

1. Reads your `module-federation.config.ts`.
2. Scans the Nx project graph to find all dependencies (npm and workspace libraries).
3. Auto-configures the Webpack `ModuleFederationPlugin` with correct `shared` settings (all deps as singletons).
4. Under the hood, this uses `@module-federation/enhanced/webpack`.

> **How this differs from `@angular-architects/module-federation`:** That community package uses an explicit `shareAll()` call. Nx's `withModuleFederation` does this implicitly by analyzing your import graph. If you have read other tutorials using `shareAll`, Nx's approach is the automatic equivalent.

### Shell: main.ts (Dynamic Bootstrap)

```typescript
import { setRemoteDefinitions } from '@nx/angular/mf';

fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

**Why the main/bootstrap split?** Module Federation must negotiate shared dependencies (like `@angular/core`) before any Angular code runs. The dynamic `import('./bootstrap')` ensures this negotiation completes first.

> **Improving error handling for production:** The generated code silently fails if the manifest fetch fails. For production, wrap with proper error handling:
> ```typescript
> fetch('/assets/module-federation.manifest.json')
>   .then((res) => {
>     if (!res.ok) throw new Error(`Manifest load failed: ${res.status}`);
>     return res.json();
>   })
>   .then((definitions) => setRemoteDefinitions(definitions))
>   .then(() => import('./bootstrap'))
>   .catch((err) => {
>     console.error('Federation init failed:', err);
>     document.body.innerHTML =
>       '<h1 style="color:red;text-align:center;margin-top:40vh">'
>       + 'Application failed to load. Please try refreshing.</h1>';
>   });
> ```

### Shell: module-federation.manifest.json

Located at `apps/shell/src/assets/module-federation.manifest.json`:

```json
{
  "mfe-products": "http://localhost:4201",
  "mfe-orders": "http://localhost:4202",
  "mfe-account": "http://localhost:4203"
}
```

> **Naming consistency:** This file is always called `module-federation.manifest.json`. The fetch path in `main.ts` is `/assets/module-federation.manifest.json`. Use this exact name everywhere, including production.

In production, the URLs point to your CDN or deployment servers. The shell is built once; only this JSON file changes per environment.

### Shell: app.routes.ts (Auto-Generated)

```typescript
import { loadRemoteModule } from '@nx/angular/mf';
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'mfe-products',
    loadChildren: () =>
      loadRemoteModule('mfe-products', './Routes')
        .then((m) => m.remoteRoutes),
  },
  {
    path: 'mfe-orders',
    loadChildren: () =>
      loadRemoteModule('mfe-orders', './Routes')
        .then((m) => m.remoteRoutes),
  },
  {
    path: 'mfe-account',
    loadChildren: () =>
      loadRemoteModule('mfe-account', './Routes')
        .then((m) => m.remoteRoutes),
  },
];
```

`loadRemoteModule` (from `@nx/angular/mf`) resolves the remote URL from the definitions set in `main.ts`, fetches the remote's `remoteEntry.js`, and returns the exposed module. From Angular's perspective, this is identical to lazy loading.

> **You will likely rename the paths** from `mfe-products` to `products`, etc. Just update the `path` value; the first argument to `loadRemoteModule` must still match the key in the manifest.

### Remote: module-federation.config.ts (e.g., mfe-products)

```typescript
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe-products',
  exposes: {
    './Routes': 'apps/mfe-products/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

- **`name`**: Must match the key in the manifest and the Nx project name.
- **`exposes`**: Declares what this remote shares. The path is **relative to the workspace root**. When Module Federation builds this remote, it bundles `entry.routes.ts` and follows its imports. If `entry.routes.ts` imports from a shared library (like `@mfe-platform/products/feature`), that library code is bundled into the remote's federated chunk. However, since Nx configured the library as a shared singleton, it will be loaded only once at runtime and reused across all MFEs.

### Remote: entry.routes.ts and entry.component.ts

```typescript
// apps/mfe-products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';
import { RemoteEntryComponent } from './entry.component';

export const remoteRoutes: Route[] = [
  { path: '', component: RemoteEntryComponent },
];
```

```typescript
// apps/mfe-products/src/app/remote-entry/entry.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'products-entry',
  template: `<p>mfe-products remote entry works!</p>`,
})
export class RemoteEntryComponent {}
```

This is the entry point for the remote feature. `RemoteEntryComponent` renders when the shell navigates to `/products`. You will replace this placeholder with real feature components in Chapter 7.

---

## Chapter 4: Shared Libraries

Shared libraries hold reusable code that multiple apps consume. Nx and Module Federation work together to ensure these libraries are loaded once at runtime as singletons.

### Generating Shared Libraries

```bash
# Shared UI components (buttons, cards, layout)
nx g @nx/angular:library shared-ui \
  --directory=libs/shared/ui \
  --standalone --changeDetection=OnPush

# Shared data access (AuthService, guards)
nx g @nx/angular:library shared-data-access-auth \
  --directory=libs/shared/data-access-auth

# Shared TypeScript interfaces
nx g @nx/js:library shared-models \
  --directory=libs/shared/models

# Shared utility functions
nx g @nx/js:library shared-utils \
  --directory=libs/shared/utils

# Domain-specific libraries
nx g @nx/angular:library products-feature \
  --directory=libs/products/feature
nx g @nx/angular:library products-data-access \
  --directory=libs/products/data-access
nx g @nx/angular:library orders-feature \
  --directory=libs/orders/feature
nx g @nx/angular:library orders-data-access \
  --directory=libs/orders/data-access
nx g @nx/angular:library account-feature \
  --directory=libs/account/feature
nx g @nx/angular:library account-data-access \
  --directory=libs/account/data-access
```

> **The `--directory` flag:** In Nx 22, always use `--directory` to control where the library is placed. Without it, the library name alone determines the path, which may not produce the folder structure you expect.

### Recommended Workspace Layout

```
libs/
  shared/
    ui/                 # Design system components
    data-access-auth/   # AuthService, guards, interceptors
    models/             # TypeScript interfaces (User, Product, Order)
    utils/              # Pure utility functions, pipes
  products/
    feature/            # Smart components for mfe-products
    data-access/        # ProductService, product state
  orders/
    feature/            # Smart components for mfe-orders
    data-access/        # OrderService, order state
  account/
    feature/            # Smart components for mfe-account
    data-access/        # AccountService, profile state
```

### How Nx Shares Libraries via Module Federation

When Nx builds a host or remote, `withModuleFederation`:

1. Scans the Nx project graph for all dependencies of the current app.
2. Identifies all workspace libraries imported via tsconfig path mappings (like `@mfe-platform/shared-ui`).
3. Identifies all npm packages used (like `@angular/core`, `rxjs`).
4. Configures ALL of these as shared singletons in the `ModuleFederationPlugin`.
5. Sets `requiredVersion` to the version from `package.json` for npm packages.

**Result:** You never manually configure shared dependencies. Angular core, RxJS, your shared libraries: everything is shared as singletons across all MFEs without duplication.

> **Adding a new shared library later:** Just create the library with `nx g`, import it in your apps, and rebuild. Nx's project graph analysis picks it up automatically in the next build. No manual config changes needed.

### Custom Sharing Logic

If you need to exclude a library from sharing, use the `shared` callback:

```typescript
// module-federation.config.ts
const config: ModuleFederationConfig = {
  name: 'mfe-products',
  exposes: { './Routes': '...' },
  shared: (libraryName, sharedConfig) => {
    if (libraryName === 'lodash') {
      return false; // Don't share; let each remote tree-shake it
    }
  },
};
```

### The AuthService Pattern (Critical Example)

A shared authentication service is the most common cross-MFE need. Here is the **complete, compilable** code:

```typescript
// libs/shared/data-access-auth/src/lib/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User, LoginRequest } from '@mfe-platform/shared-models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = signal<User | null>(null);

  /** Read-only signal for consuming components */
  readonly user = this.currentUser.asReadonly();

  /** Computed convenience signal */
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<User>('/api/auth/login', credentials).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  logout(): void {
    this.currentUser.set(null);
  }
}
```

Export from the library's public API:

```typescript
// libs/shared/data-access-auth/src/index.ts
export { AuthService } from './lib/auth.service';
```

Because Angular runs as a singleton and the library is shared as a singleton, every MFE that injects `AuthService` gets the exact same instance. When the user logs in from one MFE, all others see the authenticated state immediately.

---

## Chapter 5: Angular Providers and Routing in MFE

This chapter covers the most common source of runtime errors in Angular microfrontend setups.

### The Provider Problem

In Angular 21 standalone apps, you configure providers via `app.config.ts` and pass it to `bootstrapApplication()`. With Module Federation, the **shell's bootstrap** creates the root Angular injector. Since Angular runs as a singleton, this root injector is shared across all remotes.

- **Shell must provide all global services:** `provideHttpClient()`, `provideRouter()`, `provideAnimations()`, etc.
- **Remotes do NOT provide these** when loaded inside the shell (they inherit from the root injector).
- **BUT** each remote needs its own providers when running **standalone** for development.

### Shell: app.config.ts (The Source of Truth)

```typescript
// apps/shell/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
  ],
};
```

```typescript
// apps/shell/src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

### Remote: app.config.ts (For Standalone Development)

Each remote has its own `app.config.ts` used only when running standalone (`nx serve mfe-products`):

```typescript
// apps/mfe-products/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
  ],
};
```

```typescript
// apps/mfe-products/src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

> **When the remote is loaded inside the shell**, `bootstrap.ts` is never executed. Module Federation loads only the exposed `entry.routes.ts`. The remote's bootstrap is only used during standalone development.

### The `NullInjectorError: No provider for HttpClient` Problem

This is the **#1 runtime error** in Angular MFE setups. It happens when:
1. The shell's `app.config.ts` is missing `provideHttpClient()`.
2. The remote has a service that injects `HttpClient`, but the root injector has no provider.

**Fix:** Always ensure `provideHttpClient()` is in the shell's `app.config.ts`. Verify it is there before debugging anything else.

### Dual Routing: Shell Routes vs. Remote Routes

Each remote has **two routing contexts:**

| Context | File | Used When |
|---|---|---|
| Loaded inside shell | `entry.routes.ts` (exposed via MF) | The shell lazy-loads `./Routes` |
| Running standalone | `app.routes.ts` (used by bootstrap) | Developer runs `nx serve mfe-products` |

**entry.routes.ts** (exposed to the shell):
```typescript
export const remoteRoutes: Route[] = [
  { path: '', component: ProductListComponent },
  { path: ':id', component: ProductDetailComponent },
];
```

**app.routes.ts** (for standalone mode, reuses the same routes):
```typescript
import { Route } from '@angular/router';
import { remoteRoutes } from './remote-entry/entry.routes';

export const appRoutes: Route[] = [
  { path: '', children: remoteRoutes },
];
```

### Router Outlets

The **shell** must have a `<router-outlet>` in its layout:

```typescript
// apps/shell/src/app/app.component.ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav>
      <a routerLink="/products">Products</a>
      <a routerLink="/orders">Orders</a>
      <a routerLink="/account">Account</a>
    </nav>
    <main>
      <router-outlet />  <!-- Remote content renders HERE -->
    </main>
  `,
})
export class AppComponent {}
```

If a remote has **child routes**, its entry component needs its own `<router-outlet>`:

```typescript
@Component({
  selector: 'products-entry',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class ProductsShellComponent {}

export const remoteRoutes: Route[] = [
  {
    path: '',
    component: ProductsShellComponent,
    children: [
      { path: '', component: ProductListComponent },
      { path: ':id', component: ProductDetailComponent },
    ],
  },
];
```

---

## Chapter 6: Enforcing Module Boundaries

Without boundaries, MFEs start importing each other's internal code. Nx's tag-based boundary system prevents this.

### Tagging Projects

Add tags to each project's `project.json`:

```jsonc
// apps/shell/project.json          ->  ["scope:shell", "type:app"]
// apps/mfe-products/project.json   ->  ["scope:products", "type:app"]
// apps/mfe-orders/project.json     ->  ["scope:orders", "type:app"]
// apps/mfe-account/project.json    ->  ["scope:account", "type:app"]
// libs/products/feature             ->  ["scope:products", "type:feature"]
// libs/products/data-access         ->  ["scope:products", "type:data-access"]
// libs/shared/ui                    ->  ["scope:shared", "type:ui"]
// libs/shared/data-access-auth      ->  ["scope:shared", "type:data-access"]
// libs/shared/models                ->  ["scope:shared", "type:util"]
// libs/shared/utils                 ->  ["scope:shared", "type:util"]
```

### Configuring Constraints

```javascript
// eslint.config.js (relevant excerpt)
'@nx/enforce-module-boundaries': ['error', {
  depConstraints: [
    // === SCOPE RULES ===
    { sourceTag: 'scope:products',
      onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'] },
    { sourceTag: 'scope:orders',
      onlyDependOnLibsWithTags: ['scope:orders', 'scope:shared'] },
    { sourceTag: 'scope:account',
      onlyDependOnLibsWithTags: ['scope:account', 'scope:shared'] },
    { sourceTag: 'scope:shell',
      onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'] },

    // === TYPE RULES ===
    // Apps can depend on feature, data-access, ui, util (not other apps!)
    { sourceTag: 'type:app',
      onlyDependOnLibsWithTags:
        ['type:feature', 'type:data-access', 'type:ui', 'type:util'] },
    { sourceTag: 'type:feature',
      onlyDependOnLibsWithTags:
        ['type:data-access', 'type:ui', 'type:util'] },
    { sourceTag: 'type:data-access',
      onlyDependOnLibsWithTags: ['type:util'] },
    { sourceTag: 'type:ui',
      onlyDependOnLibsWithTags: ['type:util'] },
    { sourceTag: 'type:util',
      onlyDependOnLibsWithTags: ['type:util'] },
  ],
}]
```

> **The `type:app` rule is critical.** Without it, apps have no type-level restrictions and could import from other apps' libraries. This rule ensures apps can only depend on libraries, never on other apps directly.

### Dependency Flow

```
  [app]
    |
    v
  [feature]
    |
    v
  [data-access]  [ui]
    |               |
    v               v
  [util] <---------+
```

### Verify Boundaries

```bash
nx lint shell
nx lint mfe-products
```

Violations produce a clear error message telling you which boundary was crossed.
