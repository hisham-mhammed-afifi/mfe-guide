# Part 2: Configuration, Libraries, Providers, and Boundaries

---

## Chapter 3: Understanding the Generated Configuration

The generator created dozens of files across four applications. Let's examine the important ones so you understand exactly how Module Federation is wired.

### Shell: module-federation.config.ts

This file tells Nx and Module Federation about this application's role and its relationships.

```typescript
// apps/shell/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'shell',
  // Nx uses this list during `nx serve` to discover which remotes to build
  remotes: ['mfe-products', 'mfe-orders', 'mfe-account'],
};

export default config;
```

> **Note:** Depending on your workspace configuration, this file may use `module.exports = config` (CommonJS) instead of `export default config` (ESM). Both work. Match whichever syntax Nx generated.

The `remotes` array serves **two purposes**:
- **During `nx serve`:** Nx reads this to discover which remote projects to auto-build (or restore from cache) and serve alongside the shell.
- **At runtime with Dynamic Federation:** This array is ignored. The manifest file takes over.

You do NOT need to empty this array for dynamic mode. Keeping the remote names here is correct and necessary for the dev server to work properly.

### Shell: webpack.config.ts

```typescript
// apps/shell/webpack.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

// withModuleFederation reads the Nx project graph and auto-configures sharing
export default withModuleFederation(config);
```

The `withModuleFederation` helper (imported from `@nx/module-federation/angular`) does the heavy lifting:

1. Reads your `module-federation.config.ts`.
2. Scans the Nx project graph to find all dependencies (npm packages and workspace libraries).
3. Auto-configures the Webpack `ModuleFederationPlugin` with correct `shared` settings (all deps as singletons).
4. Under the hood, this uses the `@module-federation/enhanced/webpack` package.

You never touch this file unless you need advanced customization.

### Shell: main.ts (The Dynamic Bootstrap)

Module Federation must negotiate shared dependencies (like `@angular/core`) before any Angular code runs. That is why the generator splits the bootstrap into two files. The `main.ts` file handles federation setup, then dynamically imports `bootstrap.ts` to start Angular.

```typescript
// apps/shell/src/main.ts
import { setRemoteDefinitions } from '@nx/angular/mf';

// 1. Fetch the manifest to learn where each remote lives
fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  // 2. Register remote URLs with the federation runtime
  .then((definitions) => setRemoteDefinitions(definitions))
  // 3. Only NOW import Angular bootstrap (after federation is ready)
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

**Why the `main.ts` / `bootstrap.ts` split?** The dynamic `import('./bootstrap')` creates an async boundary. This gives Module Federation time to negotiate which version of `@angular/core`, `rxjs`, and other shared packages to use before Angular initializes. Without this split, Angular would start before federation is ready, causing cryptic runtime errors.

> **Tip:** The generated error handling silently logs to console. For production, consider adding user-facing error handling:
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

Each key is a remote name (must match the `name` in the remote's `module-federation.config.ts`). Each value is the base URL where the remote's `remoteEntry.js` file can be fetched.

In production, the URLs point to your CDN or deployment servers. The shell is built once; only this JSON file changes per environment. This is the core of "build once, deploy everywhere."

### Shell: app.routes.ts

```typescript
// apps/shell/src/app/app.routes.ts
import { loadRemoteModule } from '@nx/angular/mf';
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'mfe-products',
    // loadRemoteModule fetches the remote's code and returns the exposed module
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

`loadRemoteModule` (from `@nx/angular/mf`) resolves the remote URL from the definitions set in `main.ts`, fetches the remote's `remoteEntry.js`, and returns the exposed module. From Angular's perspective, this is identical to lazy loading with `loadChildren`.

> **Tip:** You will likely rename the paths from `mfe-products` to `products`, etc. Just update the `path` value. The first argument to `loadRemoteModule` must still match the key in the manifest.

### Remote: module-federation.config.ts

Each remote has its own configuration. Here is `mfe-products`:

```typescript
// apps/mfe-products/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe-products',
  exposes: {
    // This is what the shell can import from this remote
    './Routes': 'apps/mfe-products/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

- **`name`**: Must match the key in the manifest and the Nx project name.
- **`exposes`**: Declares what this remote shares with the outside world. The `'./Routes'` key is an alias that the shell references when calling `loadRemoteModule('mfe-products', './Routes')`. The value is the file path, **relative to the workspace root**.

When Module Federation builds this remote, it bundles `entry.routes.ts` and follows its imports. If `entry.routes.ts` imports from a shared library (like `@mfe-platform/products-feature`), that library code is included in the remote's federated chunk. However, since Nx configured the library as a shared singleton, it will be loaded only once at runtime and reused across all microfrontends.

### Remote: entry.routes.ts and entry.component.ts

These are the federated entry point, the files that the shell actually loads:

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
  // Placeholder: you will replace this with real feature routes in Chapter 7
  template: `<p>mfe-products remote entry works!</p>`,
})
export class RemoteEntryComponent {}
```

When the shell navigates to `/products`, Module Federation loads `entry.routes.ts` from the remote, and Angular renders `RemoteEntryComponent` inside the shell's `<router-outlet>`.

---

## Chapter 4: Shared Libraries

Shared libraries hold reusable code that multiple apps consume. Nx and Module Federation work together to ensure these libraries are loaded once at runtime as singletons (a **singleton** means exactly one instance exists in the browser, shared by all microfrontends).

### Generating Shared Libraries

```bash
# Shared UI components (buttons, cards, layout)
npx nx g @nx/angular:library shared-ui \
  --directory=libs/shared/ui \
  --standalone --changeDetection=OnPush

# Shared data access (AuthService, guards, interceptors)
npx nx g @nx/angular:library shared-data-access-auth \
  --directory=libs/shared/data-access-auth

# Shared TypeScript interfaces (no Angular dependency needed)
npx nx g @nx/js:library shared-models \
  --directory=libs/shared/models

# Shared utility functions
npx nx g @nx/js:library shared-utils \
  --directory=libs/shared/utils

# Domain-specific feature libraries
npx nx g @nx/angular:library products-feature \
  --directory=libs/products/feature
npx nx g @nx/angular:library products-data-access \
  --directory=libs/products/data-access
npx nx g @nx/angular:library orders-feature \
  --directory=libs/orders/feature
npx nx g @nx/angular:library orders-data-access \
  --directory=libs/orders/data-access
npx nx g @nx/angular:library account-feature \
  --directory=libs/account/feature
npx nx g @nx/angular:library account-data-access \
  --directory=libs/account/data-access
```

> **Warning:** In Nx 22, always use `--directory` to control where the library is placed. Without it, the library name alone determines the path, which may not produce the folder structure you expect.

### Updated Workspace Layout

After generating all libraries, your workspace looks like this:

```
mfe-platform/
  apps/
    shell/
    shell-e2e/
    mfe-products/
    mfe-orders/
    mfe-account/
  libs/
    shared/
      ui/                     # Design system components (buttons, cards)
      data-access-auth/       # AuthService, guards, interceptors
      models/                 # TypeScript interfaces (User, Product, Order)
      utils/                  # Pure utility functions, pipes
    products/
      feature/                # Smart components for mfe-products
      data-access/            # ProductService, product state
    orders/
      feature/                # Smart components for mfe-orders
      data-access/            # OrderService, order state
    account/
      feature/                # Smart components for mfe-account
      data-access/            # AccountService, profile state
```

### How Nx Auto-Shares Libraries via Module Federation

When Nx builds a host or remote, the `withModuleFederation` helper:

1. Scans the Nx project graph for all dependencies of the current app.
2. Identifies all workspace libraries imported via tsconfig path mappings (like `@mfe-platform/shared-ui`).
3. Identifies all npm packages used (like `@angular/core`, `rxjs`).
4. Configures ALL of these as **shared singletons** in the `ModuleFederationPlugin`.
5. Sets `requiredVersion` to the version from `package.json` for npm packages.

**Result:** You never manually configure shared dependencies. Angular core, RxJS, your shared libraries: everything is shared as singletons across all microfrontends without duplication.

> **Note:** Adding a new shared library later is automatic. Create the library with `nx g`, import it in your apps, and rebuild. Nx's project graph analysis picks it up in the next build. No manual config changes needed.

### The AuthService Pattern

A shared authentication service is the most common cross-MFE need. Here is the complete, compilable code.

First, define the models it depends on:

```typescript
// libs/shared/models/src/lib/user.interface.ts
export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
```

```typescript
// libs/shared/models/src/index.ts
export { User, LoginRequest } from './lib/user.interface';
```

Now the service itself:

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
  // Writable signal: only this service can update it
  private readonly currentUser = signal<User | null>(null);

  /** Read-only signal for consuming components */
  readonly user = this.currentUser.asReadonly();

  /** Computed convenience signal: true when a user is logged in */
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

Because Angular runs as a singleton and the library is shared as a singleton, every microfrontend that injects `AuthService` gets the **exact same instance**. When the user logs in from one MFE, all others see the authenticated state immediately through the `user` and `isAuthenticated` signals.

> **What just happened?**
>
> - [x] Generated 10 shared libraries organized by scope and type
> - [x] Nx automatically shares all workspace libraries as singletons via Module Federation
> - [x] Built a complete `AuthService` with signals that works across all microfrontends
> - [x] No manual Module Federation configuration was needed

---

## Chapter 5: Angular Providers and Routing in MFE

This chapter covers the most common source of runtime errors in Angular microfrontend setups.

### The Provider Problem

In Angular 21, you configure providers via `app.config.ts` and pass it to `bootstrapApplication()`. With Module Federation, the **shell's bootstrap** creates the root Angular injector (the **injector** is Angular's dependency injection container that holds service instances). Since Angular runs as a singleton, this root injector is shared across all remotes.

This creates a rule you must follow:

- **The shell must provide all global services:** `provideHttpClient()`, `provideRouter()`, `provideAnimationsAsync()`, etc.
- **Remotes do NOT provide these** when loaded inside the shell. They inherit from the root injector.
- **BUT** each remote needs its own providers when running **standalone** for development.

### Shell: app.config.ts (The Source of Truth)

```typescript
// apps/shell/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // These providers are available to ALL microfrontends at runtime
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

### Remote: app.config.ts (For Standalone Development Only)

Each remote has its own `app.config.ts` used only when running standalone with `nx serve mfe-products`:

```typescript
// apps/mfe-products/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Mirror the shell's providers for standalone development
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
  ],
};
```

> **Note:** When the remote is loaded inside the shell, its `bootstrap.ts` is never executed. Module Federation loads only the exposed `entry.routes.ts`. The remote's bootstrap and `app.config.ts` are used only during standalone development.

### The `NullInjectorError: No provider for HttpClient` Problem

This is the **#1 runtime error** in Angular MFE setups. It happens when:

1. The shell's `app.config.ts` is missing `provideHttpClient()`.
2. A remote has a service that injects `HttpClient`, but the root injector has no provider for it.

The error message looks like: `NullInjectorError: R3InjectorError(Environment)[HttpClient -> HttpClient]: NullInjectorError: No provider for HttpClient!`

**Fix:** Always ensure `provideHttpClient()` is in the shell's `app.config.ts`. Verify it is there before debugging anything else. If you add a new global provider to any remote, you must also add it to the shell.

### Dual Routing: Shell Routes vs. Remote Routes

Each remote has **two routing contexts**:

| Context | File | Used When |
|---|---|---|
| Loaded inside shell | `entry.routes.ts` (exposed via Module Federation) | The shell lazy-loads `./Routes` |
| Running standalone | `app.routes.ts` (used by `bootstrapApplication`) | Developer runs `nx serve mfe-products` |

**entry.routes.ts** (exposed to the shell):

```typescript
// apps/mfe-products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  { path: '', component: ProductListComponent },
  { path: ':id', component: ProductDetailComponent },
];
```

**app.routes.ts** (for standalone mode, reuses the same routes):

```typescript
// apps/mfe-products/src/app/app.routes.ts
import { Route } from '@angular/router';
import { remoteRoutes } from './remote-entry/entry.routes';

// Wrap the remote routes so they work as a standalone app
export const appRoutes: Route[] = [
  { path: '', children: remoteRoutes },
];
```

### Router Outlets: Where Remote Content Renders

The shell must have a `<router-outlet>` in its layout. This is where remote content appears:

```typescript
// apps/shell/src/app/app.component.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

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
      <!-- Remote content renders HERE -->
      <router-outlet />
    </main>
  `,
})
export class AppComponent {}
```

> **Warning:** If a remote loads but shows a blank page inside the shell, the most common cause is a missing `<router-outlet>`. Verify the shell's `AppComponent` template includes one.

If a remote has **child routes**, its entry component needs its own `<router-outlet>`:

```typescript
// apps/mfe-products/src/app/remote-entry/products-shell.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'products-entry',
  standalone: true,
  imports: [RouterOutlet],
  // This outlet renders the remote's child routes
  template: `<router-outlet />`,
})
export class ProductsShellComponent {}
```

```typescript
// apps/mfe-products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';
import { ProductsShellComponent } from './products-shell.component';
import { ProductListComponent } from '@mfe-platform/products-feature';
import { ProductDetailComponent } from '@mfe-platform/products-feature';

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

Without boundaries, microfrontends start importing each other's internal code. One remote imports a component from another remote's library, creating invisible coupling. Nx's tag-based boundary system prevents this.

### Tagging Projects

Add tags to each project's `project.json`. Tags have two dimensions: **scope** (which domain owns this code) and **type** (what kind of code it is).

```jsonc
// apps/shell/project.json          -> "tags": ["scope:shell", "type:app"]
// apps/mfe-products/project.json   -> "tags": ["scope:products", "type:app"]
// apps/mfe-orders/project.json     -> "tags": ["scope:orders", "type:app"]
// apps/mfe-account/project.json    -> "tags": ["scope:account", "type:app"]
// libs/products/feature             -> "tags": ["scope:products", "type:feature"]
// libs/products/data-access         -> "tags": ["scope:products", "type:data-access"]
// libs/shared/ui                    -> "tags": ["scope:shared", "type:ui"]
// libs/shared/data-access-auth      -> "tags": ["scope:shared", "type:data-access"]
// libs/shared/models                -> "tags": ["scope:shared", "type:util"]
// libs/shared/utils                 -> "tags": ["scope:shared", "type:util"]
```

### Configuring Constraints

Add the boundary rules to your ESLint configuration:

```javascript
// eslint.config.js (relevant excerpt)
'@nx/enforce-module-boundaries': ['error', {
  depConstraints: [
    // === SCOPE RULES: who can depend on whom ===
    { sourceTag: 'scope:products',
      onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'] },
    { sourceTag: 'scope:orders',
      onlyDependOnLibsWithTags: ['scope:orders', 'scope:shared'] },
    { sourceTag: 'scope:account',
      onlyDependOnLibsWithTags: ['scope:account', 'scope:shared'] },
    { sourceTag: 'scope:shell',
      onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'] },

    // === TYPE RULES: layered architecture ===
    // Apps can use feature, data-access, ui, util (NOT other apps)
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

> **Warning:** The `type:app` rule is critical. Without it, apps have no type-level restrictions and could import directly from other apps' libraries. This rule ensures apps can only depend on libraries, never on other apps.

### Dependency Flow

The type rules create a layered architecture where dependencies only flow downward:

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

A `feature` library can import from `data-access`, `ui`, and `util`. A `data-access` library can only import from `util`. No layer can import from a layer above it, and no app can import from another app.

### Verify Boundaries

```bash
npx nx lint shell
npx nx lint mfe-products
```

If you accidentally import a products library from the orders remote, the linter produces a clear error:

```
A project tagged with "scope:orders" can only depend on libs tagged with
"scope:orders", "scope:shared"
```

> **Tip:** Enforce boundaries from day one. Adding them to an existing codebase with existing violations is painful. Setting them up now prevents coupling before it starts.

Now that the workspace is structured with shared libraries and enforced boundaries, we can build real features. That's Chapter 7.
