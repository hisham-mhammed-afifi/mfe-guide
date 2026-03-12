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
  remotes: [],
};

export default config;
```

> **Note:** Depending on your workspace configuration, this file may use `module.exports = config` (CommonJS) instead of `export default config` (ESM). Both work. Match whichever syntax Nx generated.

The `remotes` array is empty by default. Nx discovers which remotes belong to this host by reading the `--host` relationships set during generation. You do not need to list remote names here manually. Nx resolves them automatically from the project graph during `nx serve`.

### Shell: webpack.config.ts

```typescript
// apps/shell/webpack.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

// withModuleFederation reads the Nx project graph and auto-configures sharing
export default withModuleFederation(config, { dts: false });
```

The `withModuleFederation` helper (imported from `@nx/module-federation/angular`) does the heavy lifting:

1. Reads your `module-federation.config.ts`.
2. Scans the Nx project graph to find all dependencies (npm packages and workspace libraries).
3. Auto-configures the Webpack `ModuleFederationPlugin` with correct `shared` settings (all deps as singletons).
4. Under the hood, this uses the `@module-federation/enhanced/webpack` package.

The `{ dts: false }` option disables automatic TypeScript declaration generation for federated modules. Nx includes this by default.

You never touch this file unless you need advanced customization. Each remote also gets a `webpack.prod.config.ts` for production build overrides. The shell does not have one; it uses the same `webpack.config.ts` for both development and production.

The generated `webpack.prod.config.ts` for each remote is minimal:

```typescript
// apps/mfe_products/webpack.prod.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default withModuleFederation(config, { dts: false });
```

In most projects this file is identical to `webpack.config.ts`. It exists as a separate entry point so you can add production-only Webpack plugins (such as bundle analyzers) without affecting development builds.

### Shell: main.ts (The Dynamic Bootstrap)

Module Federation must negotiate shared dependencies (like `@angular/core`) before any Angular code runs. That is why the generator splits the bootstrap into two files. The `main.ts` file handles federation setup, then dynamically imports `bootstrap.ts` to start Angular.

```typescript
// apps/shell/src/main.ts
import { registerRemotes } from '@module-federation/enhanced/runtime';

// 1. Fetch the manifest to learn where each remote lives
fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    // 2. Convert manifest entries into the format registerRemotes expects
    Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
  )
  // 3. Register remote URLs with the federation runtime
  .then((remotes) => registerRemotes(remotes))
  // 4. Only NOW import Angular bootstrap (after federation is ready)
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

**Why the `main.ts` / `bootstrap.ts` split?** The dynamic `import('./bootstrap')` creates an async boundary. This gives Module Federation time to negotiate which version of `@angular/core`, `rxjs`, and other shared packages to use before Angular initializes. Without this split, Angular would start before federation is ready, causing cryptic runtime errors.

> **Tip:** The generated error handling silently logs to console. For production, consider adding user-facing error handling:
> ```typescript
> fetch('/module-federation.manifest.json')
>   .then((res) => {
>     if (!res.ok) throw new Error(`Manifest load failed: ${res.status}`);
>     return res.json();
>   })
>   .then((remotes: Record<string, string>) =>
>     Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
>   )
>   .then((remotes) => registerRemotes(remotes))
>   .then(() => import('./bootstrap'))
>   .catch((err) => {
>     console.error('Federation init failed:', err);
>     document.body.innerHTML =
>       '<h1 style="color:red;text-align:center;margin-top:40vh">'
>       + 'Application failed to load. Please try refreshing.</h1>';
>   });
> ```

### Shell: module-federation.manifest.json

Located at `apps/shell/public/module-federation.manifest.json`:

```json
{
  "mfe_products": "http://localhost:4201/mf-manifest.json",
  "mfe_orders": "http://localhost:4202/mf-manifest.json",
  "mfe_account": "http://localhost:4203/mf-manifest.json"
}
```

Each key is a remote name (must match the `name` in the remote's `module-federation.config.ts`). Each value is the full URL to the remote's `mf-manifest.json` file. This JSON file (generated by Module Federation during the build) describes what the remote exposes and what shared dependencies it needs. The shell's `main.ts` code uses these URLs directly when calling `registerRemotes`.

In production, the URLs point to your CDN (Content Delivery Network, a globally distributed file server that delivers assets quickly to users worldwide) or deployment servers, with the `mf-manifest.json` path updated accordingly. The shell is built once; only this JSON file changes per environment. This is the core of "build once, deploy everywhere."

### Shell: app.routes.ts

```typescript
// apps/shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'products',
    // loadRemote fetches the remote's mf-manifest.json and returns the exposed module
    loadChildren: () =>
      loadRemote<typeof import('mfe_products/Routes')>('mfe_products/Routes')
        .then((m) => m!.remoteRoutes),
  },
  {
    path: 'orders',
    loadChildren: () =>
      loadRemote<typeof import('mfe_orders/Routes')>('mfe_orders/Routes')
        .then((m) => m!.remoteRoutes),
  },
  {
    path: 'account',
    loadChildren: () =>
      loadRemote<typeof import('mfe_account/Routes')>('mfe_account/Routes')
        .then((m) => m!.remoteRoutes),
  },
];
```

> **Note:** The generator creates route paths that match the remote names (e.g., `path: 'mfe_products'`). We rename them to user-friendly paths like `products`, `orders`, and `account`. The route path does not need to match the remote name; the `loadRemote` string must still use the registered remote name.

> **Note:** The generated routes also include a default route `{ path: '', component: NxWelcome }` and an `NxWelcome` import. You can remove these once you add your own home page component.

> **Note:** The generic type `typeof import('mfe_products/Routes')` is a TypeScript feature called a **type-only import**. It tells TypeScript: "the return type of `loadRemote` should match the shape of the module at `mfe_products/Routes`." This is NOT a real import that runs at build time. It is purely for type-checking. TypeScript resolves it using declaration files (`.d.ts`) generated by Module Federation. At runtime, `loadRemote` fetches the module over the network. The string inside `typeof import(...)` is a virtual module path that only Module Federation understands. The `m!` (non-null assertion) after `.then((m) =>` tells TypeScript "I guarantee this value is not null." If the remote fails to load, `m` could be `undefined`, which would cause a runtime error. Chapter 14 shows how to add error handling with `.catch()` to prevent this.

`loadRemote` (from `@module-federation/enhanced/runtime`) resolves the remote URL from the definitions registered in `main.ts`, fetches the remote's `mf-manifest.json`, and returns the exposed module. The string `'mfe_products/Routes'` means: "from the remote named `mfe_products`, load the module exposed as `./Routes`." From Angular's perspective, this is identical to **lazy loading** (loading code on demand when a route is visited, rather than upfront).

### Remote: module-federation.config.ts

Each remote has its own configuration. Here is `mfe_products`:

```typescript
// apps/mfe_products/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'mfe_products',
  exposes: {
    // This is what the shell can import from this remote
    './Routes': 'apps/mfe_products/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

- **`name`**: Must match the key in the manifest and the Nx project name.
- **`exposes`**: Declares what this remote shares with the outside world. The `'./Routes'` key is an alias that the shell references via `loadRemote('mfe_products/Routes')`. The value is the file path, **relative to the workspace root**.

When Module Federation builds this remote, it bundles `entry.routes.ts` and follows its imports. If `entry.routes.ts` imports from a shared library (like `@mfe-platform/products-feature`), that library code is included in the remote's federated chunk. However, since Nx configured the library as a shared singleton, it will be loaded only once at runtime and reused across all microfrontends.

### Remote: entry.routes.ts and entry.ts

These are the federated entry point, the files that the shell actually loads:

```typescript
// apps/mfe_products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';
import { RemoteEntry } from './entry';

export const remoteRoutes: Route[] = [
  // Placeholder route: you will replace this with real features in Chapter 7
  { path: '', component: RemoteEntry },
];
```

```typescript
// apps/mfe_products/src/app/remote-entry/entry.ts
import { Component } from '@angular/core';

@Component({
  // No `standalone: true` needed: it is the default since Angular 19
  selector: 'app-mfe_products-entry',
  template: `<p>mfe_products remote entry works!</p>`,
})
export class RemoteEntry {}
```

> **Note:** The generator also includes an `NxWelcome` component in the entry template. This is a placeholder welcome page from Nx. You will remove it when you replace the entry component with real features in Chapter 7.

When the shell navigates to `/products`, Module Federation loads `entry.routes.ts` from the remote, and Angular renders `RemoteEntry` inside the shell's `<router-outlet>`.

> **What just happened?**
>
> - [x] Examined every key generated file: MF config, webpack config, main.ts, manifest, routes, remote entry
> - [x] Learned that `withModuleFederation` auto-configures sharing from the Nx project graph
> - [x] Understood why `main.ts` and `bootstrap.ts` are split (async boundary for federation negotiation)
> - [x] Learned that `registerRemotes` and `loadRemote` from `@module-federation/enhanced/runtime` are the runtime APIs
> - [x] Understood that the `remotes` array in config is for dev server, while the manifest is for runtime

Now that you understand the generated configuration, let's add shared libraries so the remotes can reuse code without duplication. That's Chapter 4.

---

## Chapter 4: Shared Libraries

Shared libraries hold reusable code that multiple apps consume. Nx and Module Federation work together to ensure these libraries are loaded once at runtime as singletons.

### Generating Shared Libraries

```bash
# Shared UI components (buttons, cards, layout)
npx nx g @nx/angular:library \
  --directory=libs/shared/ui \
  --name=shared-ui \
  --importPath=@mfe-platform/shared-ui \
  --changeDetection=OnPush

# Shared data access (AuthService, guards, interceptors)
npx nx g @nx/angular:library \
  --directory=libs/shared/data-access-auth \
  --name=shared-data-access-auth \
  --importPath=@mfe-platform/shared-data-access-auth

# Shared TypeScript interfaces (no Angular dependency needed)
npx nx g @nx/js:library \
  --directory=libs/shared/models \
  --name=shared-models \
  --importPath=@mfe-platform/shared-models

# Shared utility functions
npx nx g @nx/js:library \
  --directory=libs/shared/utils \
  --name=shared-utils \
  --importPath=@mfe-platform/shared-utils

# Domain-specific libraries
npx nx g @nx/angular:library --directory=libs/products/feature \
  --name=products-feature --importPath=@mfe-platform/products-feature
npx nx g @nx/angular:library --directory=libs/products/data-access \
  --name=products-data-access --importPath=@mfe-platform/products-data-access
npx nx g @nx/angular:library --directory=libs/orders/feature \
  --name=orders-feature --importPath=@mfe-platform/orders-feature
npx nx g @nx/angular:library --directory=libs/orders/data-access \
  --name=orders-data-access --importPath=@mfe-platform/orders-data-access
npx nx g @nx/angular:library --directory=libs/account/feature \
  --name=account-feature --importPath=@mfe-platform/account-feature
npx nx g @nx/angular:library --directory=libs/account/data-access \
  --name=account-data-access --importPath=@mfe-platform/account-data-access
```

> **Note:** Two different generators are used above. `@nx/angular:library` creates a library that includes Angular infrastructure (component scaffolding, Angular-aware build config). Use it for libraries that contain Angular components, directives, pipes, or services. `@nx/js:library` creates a plain TypeScript library with no Angular dependency. Use it for pure data (interfaces, types) and utility functions that have no Angular imports. The shared models and utils libraries use `@nx/js:library` because they contain only TypeScript interfaces and pure functions.

> **Note:** `@nx/js:library` generates Jest configuration by default, while `@nx/angular:library` generates Vitest configuration. Your pure TypeScript libraries (`shared-models`, `shared-utils`) will use Jest for testing. This works fine alongside Vitest in the same workspace.

> **Warning:** In Nx 22, always use `--directory`, `--name`, and `--importPath` together. The `--directory` flag controls the folder location, `--name` sets the project name, and `--importPath` sets the TypeScript path alias in `tsconfig.base.json`. Without `--importPath`, Nx derives a default that may not match what you expect.

After generating all libraries, verify they appear in the project graph:

```bash
npx nx graph
```

This opens an interactive browser visualization. Confirm you see all 10 libraries: `shared-ui`, `shared-data-access-auth`, `shared-models`, `shared-utils`, `products-feature`, `products-data-access`, `orders-feature`, `orders-data-access`, `account-feature`, and `account-data-access`. If any are missing, check the generator command for typos in `--directory` or `--importPath`.

### Updated Workspace Layout

After generating all libraries, your workspace looks like this:

```
mfe-platform/
  apps/
    shell/
    shell-e2e/
    mfe_products/
    mfe_orders/
    mfe_account/
  libs/
    shared/
      ui/                     # Design system components (buttons, cards)
      data-access-auth/       # AuthService, guards, interceptors
      models/                 # TypeScript interfaces (User, Product, Order)
      utils/                  # Pure utility functions, pipes
    products/
      feature/                # Smart components for mfe_products
      data-access/            # ProductService, product state
    orders/
      feature/                # Smart components for mfe_orders
      data-access/            # OrderService, order state
    account/
      feature/                # Smart components for mfe_account
      data-access/            # AccountService, profile state
```

### How Nx Auto-Shares Libraries via Module Federation

When Nx builds a host or remote, the `withModuleFederation` helper:

1. Scans the Nx project graph for all dependencies of the current app.
2. Identifies all workspace libraries imported via tsconfig path mappings (like `@mfe-platform/shared-ui`).
3. Identifies all npm packages used (like `@angular/core`, `rxjs`).
4. Configures Angular core packages and workspace libraries as **shared singletons** in the `ModuleFederationPlugin`. Other npm dependencies are shared but not necessarily marked as singleton.
5. Sets `requiredVersion` to the version from `package.json` for npm packages.

**Result:** You never manually configure shared dependencies. Angular core packages, RxJS, and your workspace libraries are shared as singletons across all microfrontends. Other npm packages are shared to avoid duplication where possible, but may not be forced to a single instance.

> **Note:** Adding a new shared library later is automatic. Create the library with `nx g`, import it in your apps, and rebuild. Nx's project graph analysis picks it up in the next build. No manual config changes needed.

### The AuthService Pattern

A shared authentication service is the most common cross-MFE need. Here is the complete, compilable code.

First, define the models it depends on. Create the file `user.interface.ts` in `libs/shared/models/src/lib/`:

```typescript
// libs/shared/models/src/lib/user.interface.ts
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}
```

```typescript
// libs/shared/models/src/index.ts
export type { User, LoginRequest } from './lib/user.interface';
```

> **Note:** Angular 21 enables `isolatedModules` by default in its TypeScript configuration. When re-exporting types or interfaces, you must use `export type` instead of `export`. Failing to do so causes `TS1205` errors during build.

Now the service itself. Create the file `auth.service.ts` in `libs/shared/data-access-auth/src/lib/`:

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
    return this.http
      .post<User>('https://dummyjson.com/auth/login', credentials)
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    this.currentUser.set(null);
  }
}
```

> **Note:** This `AuthService` stores the current user in an in-memory signal. On page refresh, the user is logged out. A production implementation would persist tokens (e.g., in `localStorage` or HTTP-only cookies) and restore them on initialization.

> **Note:** This guide uses [DummyJSON](https://dummyjson.com) as a free public API for development. You can log in with any user from `https://dummyjson.com/users` (e.g., username: `emilys`, password: `emilyspass`). In a real application, replace the DummyJSON URL with your own backend.

Export from the library's public API:

```typescript
// libs/shared/data-access-auth/src/index.ts
export { AuthService } from './lib/auth.service';
```

Because Angular runs as a singleton and the library is shared as a singleton, every microfrontend that injects `AuthService` gets the **exact same instance**. When the user logs in from one MFE, all others see the authenticated state immediately through the `user` and `isAuthenticated` signals.

> **What just happened?**
>
> - [x] Generated 10 shared libraries organized by scope and type
> - [x] Each library has an explicit `--importPath` ensuring consistent TypeScript aliases
> - [x] Nx automatically shares all workspace libraries as singletons via Module Federation
> - [x] Built a complete `AuthService` with signals that works across all microfrontends
> - [x] No manual Module Federation configuration was needed

> **Note:** Since all apps share one workspace, breaking changes to shared libraries (like renaming a field in `Product`) are caught at build time. Use `npx nx affected -t build` in CI to identify and rebuild every app affected by the change. If you deploy only some affected apps and miss others, those deployed MFEs will have a stale version of the shared library. Always deploy all affected apps together.

With shared libraries in place, we need to wire up Angular's providers and routing correctly across the shell and remotes. That's the trickiest part, and it's Chapter 5.

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

> **Important:** The generator only includes `provideBrowserGlobalErrorListeners()` and `provideRouter(appRoutes)` in the shell's `app.config.ts`. You must manually add `provideHttpClient(withInterceptorsFromDi())`, `provideAnimationsAsync()`, and any other global providers your application needs. These are required for remotes to function correctly when loaded inside the shell.

Open `apps/shell/src/app/app.config.ts` and replace its contents with the following:

```typescript
// apps/shell/src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Generated by default:
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Add these manually for MFE support:
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
  ],
};
```

> **Note:** `provideBrowserGlobalErrorListeners()` is new in Angular 21. It registers global error and unhandled rejection listeners so Angular can report them through its error handling infrastructure. The generator includes it by default.

> **Note:** `withComponentInputBinding()` enables a router feature that automatically binds route parameters to component inputs. For example, if a route has `:id` and the component has an `@Input() id!: string`, Angular populates it automatically without needing `ActivatedRoute`. This is optional but convenient for simple parameter passing.

> **Note:** `withInterceptorsFromDi()` enables support for HTTP interceptors registered via Angular's dependency injection (the class-based interceptor pattern). If you do not use class-based interceptors, you can omit it and use `provideHttpClient()` alone, or use `withInterceptors()` with functional interceptors instead. Angular's documentation flags `withInterceptorsFromDi()` for potential future phase-out in favor of `withInterceptors()` with functional interceptors, which is the forward-looking approach. The API still works today.

```typescript
// apps/shell/src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

### Remote: app.config.ts (For Standalone Development Only)

Each remote has its own `app.config.ts` used only when running standalone with `nx serve mfe_products`:

```typescript
// apps/mfe_products/src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
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
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimationsAsync(),
  ],
};
```

> **Note:** When the remote is loaded inside the shell, its `bootstrap.ts` is never executed. Module Federation loads only the exposed `entry.routes.ts`. The remote's bootstrap and `app.config.ts` are used only during standalone development.

### Remote: bootstrap.ts

```typescript
// apps/mfe_products/src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry } from './app/remote-entry/entry';

bootstrapApplication(RemoteEntry, appConfig)
  .catch((err) => console.error(err));
```

> **Note:** The remote's `bootstrap.ts` bootstraps the `RemoteEntry` component (not a separate `App` component). When the remote runs standalone, this entry component serves as the root. When loaded inside the shell via Module Federation, `bootstrap.ts` is never executed; the shell loads only `entry.routes.ts`.

### The `NullInjectorError: No provider for HttpClient` Problem

This is the **#1 runtime error** in Angular MFE setups. It happens when:

1. The shell's `app.config.ts` is missing `provideHttpClient()`.
2. A remote has a service that injects `HttpClient`, but the root injector has no provider for it.

The error message looks like: `NullInjectorError: R3InjectorError(Environment)[HttpClient -> HttpClient]: NullInjectorError: No provider for HttpClient!`

**Fix:** Always ensure `provideHttpClient()` is in the shell's `app.config.ts`. Verify it is there before debugging anything else. If you add a new global provider to any remote, you must also add it to the shell.

### Dual Routing: Shell Routes vs. Remote Routes (No Changes Needed Yet)

Each remote has **two routing contexts**:

| Context | File | Used When |
|---|---|---|
| Loaded inside shell | `entry.routes.ts` (exposed via Module Federation) | The shell lazy-loads `./Routes` |
| Running standalone | `app.routes.ts` (used by `bootstrapApplication`) | Developer runs `nx serve mfe_products` |

In practice, when you build real features (starting in Chapter 7), you will replace the placeholder `RemoteEntry` with actual feature routes. At that point, `entry.routes.ts` becomes the only routing file that matters for the federated content. The `app.routes.ts` simply wraps it for standalone development. You do not need to maintain two separate sets of routes.

**entry.routes.ts** (exposed to the shell). At this point the route uses the generated placeholder; we replace it with real components in Chapter 7:

```typescript
// apps/mfe_products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';
import { RemoteEntry } from './entry';

export const remoteRoutes: Route[] = [
  // Placeholder: replaced with ProductListComponent in Chapter 7
  { path: '', component: RemoteEntry },
];
```

At that point, you can delete `entry.ts` (the `RemoteEntry` file). It is only a placeholder that the generator creates.

**app.routes.ts** (for standalone mode, reuses the same routes):

```typescript
// apps/mfe_products/src/app/app.routes.ts
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
// apps/shell/src/app/app.ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
})
export class App {}
```

> **Note:** Angular 21's generator names the root component `App` (without the `Component` suffix). Other components in this guide use the traditional `*Component` convention. Both styles are valid in Angular.

```html
<!-- apps/shell/src/app/app.html -->
<nav>
  <a routerLink="/products">Products</a>
  <a routerLink="/orders">Orders</a>
  <a routerLink="/account">Account</a>
</nav>
<main>
  <!-- Remote content renders HERE -->
  <router-outlet />
</main>
```

> **Note:** The generator uses an external template file (`app.html`) by default. You can switch to an inline `template` if you prefer. Both approaches work the same way.

> **Note:** The generator creates the shell component with `imports: [NxWelcome, RouterModule]`. We replace `RouterModule` with the more specific `RouterOutlet` and `RouterLink` imports for better tree-shaking, and remove `NxWelcome` once we have our own layout.

> **Note:** The generated template uses `routerLink="mfe_products"` with the remote name as both the path and link text. Update these to match the user-friendly route paths you defined in `app.routes.ts`.

> **Warning:** If a remote loads but shows a blank page inside the shell, the most common cause is a missing `<router-outlet>`. Verify the shell's `App` template includes one.

> **Tip:** To remove the Nx welcome placeholder: delete the `NxWelcome` import and its reference from the shell's component, and remove the default route `{ path: '', component: NxWelcome }` from `app.routes.ts`. Do this once you have your own home page component.

If a remote has **child routes**, its entry component needs its own `<router-outlet>`:

```typescript
// apps/mfe_products/src/app/remote-entry/products-shell.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-mfe_products-entry',
  imports: [RouterOutlet],
  // This outlet renders the remote's child routes
  template: `<router-outlet />`,
})
export class ProductsShellComponent {}
```

This pattern is used when the remote has multiple routes (e.g., product list and product detail). We wire it up fully in Chapter 7.

> **What just happened?**
>
> - [x] Configured the shell's `app.config.ts` with global providers (`HttpClient`, animations, router)
> - [x] Understood that remotes inherit the shell's providers at runtime
> - [x] Configured each remote's `app.config.ts` for standalone development
> - [x] Understood dual routing: `entry.routes.ts` for federation, `app.routes.ts` for standalone
> - [x] Verified where `<router-outlet>` goes in the shell and in remote entry components

Now that providers and routing are set up correctly, we need to prevent microfrontends from importing each other's internals. That's Chapter 6.

---

## Chapter 6: Enforcing Module Boundaries

Without boundaries, microfrontends start importing each other's internal code. One remote imports a component from another remote's library, creating invisible coupling. Nx's tag-based boundary system prevents this.

### Tagging Projects

Add tags to each project's `project.json`. Tags have two dimensions: **scope** (which domain owns this code) and **type** (what kind of code it is).

```jsonc
// apps/shell/project.json          -> "tags": ["scope:shell", "type:app"]
// apps/mfe_products/project.json    -> "tags": ["scope:products", "type:app"]
// apps/mfe_orders/project.json      -> "tags": ["scope:orders", "type:app"]
// apps/mfe_account/project.json     -> "tags": ["scope:account", "type:app"]
// libs/products/feature             -> "tags": ["scope:products", "type:feature"]
// libs/products/data-access         -> "tags": ["scope:products", "type:data-access"]
// libs/shared/ui                    -> "tags": ["scope:shared", "type:ui"]
// libs/shared/data-access-auth      -> "tags": ["scope:shared", "type:data-access"]
// libs/shared/models                -> "tags": ["scope:shared", "type:util"]
// libs/shared/utils                 -> "tags": ["scope:shared", "type:util"]
```

### Configuring Constraints

Open `eslint.config.mjs` at the workspace root. Find the existing `@nx/enforce-module-boundaries` rule (it will have an empty `depConstraints` array). Replace the `depConstraints` value with the array shown below:

```javascript
// eslint.config.mjs (relevant excerpt)
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

> **Note:** The scope rules and type rules are evaluated independently. An import must satisfy **both** to be allowed. For example, if `mfe_products` (scope:products, type:app) tries to import from `libs/orders/feature` (scope:orders, type:feature), it fails the scope check (products cannot depend on orders) even though it passes the type check (app can depend on feature). Both constraints must pass.

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
npx nx lint mfe_products
```

If you accidentally import a products library from the orders remote, the linter produces a clear error:

```
A project tagged with "scope:orders" can only depend on libs tagged with
"scope:orders", "scope:shared"
```

> **What just happened?**
>
> - [x] Tagged every project with `scope:*` and `type:*`
> - [x] Configured ESLint boundary rules to prevent cross-scope and cross-layer imports
> - [x] Verified that violations produce clear, actionable error messages

> **Tip:** Enforce boundaries from day one. Adding them to an existing codebase with existing violations is painful. Setting them up now prevents coupling before it starts.

Now that the workspace is structured with shared libraries and enforced boundaries, we can build real features. That's Chapter 7.
