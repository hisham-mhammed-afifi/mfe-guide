# Part 3: Features, Workflow, Communication, and Styles

---

## Chapter 7: Building Features in Remotes

Let's build out `mfe_products` with complete, compilable code. Every import is shown explicitly. No ellipsis, no "exercise for the reader."

### What Happens When a User Clicks "Products"

Here is the sequence of events when the user navigates to `/products` in the shell:

```
1. User clicks "Products" link in the shell
2. Angular router matches path "products" -> loadChildren
3. loadRemote('mfe_products/Routes') is called
4. Federation runtime looks up 'mfe_products' URL from registered remotes
5. Browser fetches http://products.cdn.com/mf-manifest.json
6. mf-manifest.json tells the runtime what the remote exposes and needs
7. Federation checks shared deps (@angular/core, rxjs, etc.) - already loaded
8. Browser fetches the remote's main chunk (product feature code)
9. Angular receives the route array and renders ProductListComponent
10. User sees the product list inside the shell's <router-outlet>
```

The entire process happens in milliseconds on a fast connection. Steps 5-8 happen only on the first navigation to that remote. Subsequent visits use the cached chunks.

### Step 1: Define the Product Model

Create the file `product.interface.ts` in `libs/shared/models/src/lib/`:

```typescript
// libs/shared/models/src/lib/product.interface.ts
export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  category: string;
  rating: number;
  stock: number;
}
```

> **Note:** This interface matches the shape returned by `https://dummyjson.com/products`. DummyJSON products have many more fields (images, brand, dimensions, reviews, etc.). We include only the fields our components use.

Update the public API to export it:

```typescript
// libs/shared/models/src/index.ts
export type { Product } from './lib/product.interface';
export type { User, LoginRequest } from './lib/user.interface';
```

### Step 2: Create the Product Service

Create the file `product.service.ts` in `libs/products/data-access/src/lib/`:

```typescript
// libs/products/data-access/src/lib/product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '@mfe-platform/shared-models';

// Response wrapper: DummyJSON wraps products in an object
interface ProductsResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

// providedIn: 'root' makes this a singleton shared across all MFEs
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://dummyjson.com/products';

  getAll(): Observable<Product[]> {
    return this.http
      .get<ProductsResponse>(this.apiUrl)
      .pipe(map((res) => res.products));
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }
}
```

```typescript
// libs/products/data-access/src/index.ts
export { ProductService } from './lib/product.service';
```

### Step 3: Create the Product List Component

Create the file `product-list.component.ts` in `libs/products/feature/src/lib/`:

> **MFE Gotcha: Do not use `toSignal()` in remote components.**
> Module Federation can load multiple Angular instances. `toSignal()` relies on an injection context
> that may belong to a different Angular instance than the one running your remote, causing `NG0203`.
> Use `signal()` with a manual subscription in `ngOnInit` / `ngOnDestroy` instead.
> This also applies to other DI-dependent reactive helpers like `toObservable()`.

```typescript
// libs/products/feature/src/lib/product-list.component.ts
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-list',
  // Import individual pipes and directives, not CommonModule
  imports: [CurrencyPipe, RouterLink],
  template: `
    <h2>Products</h2>
    <div class="product-grid">
      @for (product of products(); track product.id) {
        <div class="product-card">
          <img [src]="product.thumbnail" [alt]="product.title" />
          <h3>{{ product.title }}</h3>
          <p>{{ product.price | currency }}</p>
          <a [routerLink]="[product.id]">View Details</a>
        </div>
      } @empty {
        <p>Loading products...</p>
      }
    </div>
  `,
  styles: [`
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: var(--spacing-md, 16px);  /* Falls back to 16px if token missing */
    }
    .product-card {
      border: 1px solid #ddd;
      border-radius: var(--border-radius, 8px);
      padding: var(--spacing-md, 16px);
    }
    .product-card img {
      width: 100%;
      height: 180px;
      object-fit: contain;
    }
  `],
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);

  // signal() is a plain reactive primitive with no DI dependency.
  // We subscribe in ngOnInit, after the component is fully initialized in the correct DI tree.
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

> **Warning:** `RouterLink` must be in the `imports` array. `CurrencyPipe` must be imported individually from `@angular/common` (since Angular 17, built-in pipes are standalone and should be imported directly instead of via `CommonModule`). These are the most common "compiles but fails at runtime" mistakes.

### Step 4: Create the Product Detail Component

Create the file `product-detail.component.ts` in `libs/products/feature/src/lib/`:

```typescript
// libs/products/feature/src/lib/product-detail.component.ts
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap, of, Subscription } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-detail',
  imports: [CurrencyPipe],
  template: `
    @if (product(); as p) {
      <img [src]="p.thumbnail" [alt]="p.title" style="max-width:300px;" />
      <h2>{{ p.title }}</h2>
      <p>{{ p.description }}</p>
      <p class="price">{{ p.price | currency }}</p>
      <p>Category: {{ p.category }} | Rating: {{ p.rating }}/5 | Stock: {{ p.stock }}</p>
    } @else {
      <p>Loading...</p>
    }
  `,
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);

  // signal() + ngOnInit avoids NG0203 in Module Federation remotes.
  // See the MFE Gotcha note in Step 3 above.
  readonly product = signal<Product | null>(null);
  private subscription?: Subscription;

  ngOnInit(): void {
    this.subscription = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id');
        return id ? this.productService.getById(Number(id)) : of(null);
      })
    ).subscribe(p => this.product.set(p));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
```

### Step 5: Export from the Feature Library

```typescript
// libs/products/feature/src/index.ts
export { ProductListComponent } from './lib/product-list.component';
export { ProductDetailComponent } from './lib/product-detail.component';
```

### Step 6: Update Remote Entry Routes

Replace the placeholder `RemoteEntry` component with real routes that use the feature library. The `RemoteEntry` component in `entry.ts` is no longer referenced. You can safely delete that file.

```typescript
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
```

> **Note:** `entry.routes.ts` imports from `@mfe-platform/products-feature`. When Module Federation builds this remote, it follows the import and bundles the feature library code into the remote's federated chunk. However, since Nx configured the library as a shared singleton, it is loaded only once at runtime and reused if another MFE also imports it.

### Step 7: Run Standalone

```bash
npx nx serve mfe_products
```

Navigate to `http://localhost:4201`. You should see a grid of products loaded from the DummyJSON API, each showing a thumbnail, title, and price. Click any product to see its detail page. The products feature runs independently using its own `bootstrap.ts` and `app.config.ts` (with providers). This is useful for focused development without starting the full system.

### Step 8: Verify in the Shell

```bash
npx nx serve shell
```

Navigate to `http://localhost:4200/products`. The shell loads the products remote via Module Federation. You should see the same product grid, now rendered inside the shell's layout. This confirms that the remote loads correctly, the shared `HttpClient` provider works, and the DummyJSON API is accessible.

> **What just happened?**
>
> - [x] Defined the `Product` interface in the shared models library
> - [x] Created `ProductService` in the products data-access library
> - [x] Built `ProductListComponent` and `ProductDetailComponent` in the products feature library
> - [x] Updated `entry.routes.ts` to lazy-load from the feature library
> - [x] Verified standalone mode on port 4201 and integrated mode via the shell on port 4200

> **Tip:** This guide uses [DummyJSON](https://dummyjson.com) as a free public API so you can see real data immediately. DummyJSON also provides endpoints for users, carts, and authentication that you can use when building out the `mfe_orders` and `mfe_account` remotes. See `https://dummyjson.com/docs` for the full API reference.

> **Note:** The `mfe_orders` and `mfe_account` remotes still use their generated placeholder components. Building them out follows the same pattern you just completed: define models in `shared-models`, create services in the `data-access` library, build components in the `feature` library, and update `entry.routes.ts`. This is left as an exercise since the pattern is identical.

With features built, let's look at how to work efficiently during development. That's Chapter 8.

---

## Chapter 8: Serving and Development Workflow

### Dev Remotes vs. Static Remotes

When you run `nx serve shell`, Nx needs to serve all the remotes alongside the shell. It offers two modes:

| Type | How It Works | When to Use |
|---|---|---|
| **Dev Remote** | Served with `webpack-dev-server`, with **HMR** (Hot Module Replacement: changes appear instantly without a full page reload) and live reload | The feature you are actively coding |
| **Static Remote** | Built once (or restored from Nx cache) and served via a simple file server | All other remotes you are not editing |

### Running the Full System

```bash
npx nx serve shell
```

Nx reads the `remotes` array in the shell's `module-federation.config.ts` to discover which remote projects exist. It builds each remote (or restores from cache) and serves them all statically alongside the shell. Unchanged remotes are restored from Nx's local cache instantly. With Nx Cloud remote caching enabled, even a fresh machine gets cached artifacts, making the full system start in seconds instead of minutes.

> **Note:** **Nx's local cache** stores build results on your machine. If a project has not changed since the last build, `nx serve` or `nx build` restores the output from cache instead of rebuilding. **Nx Cloud remote caching** (optional, enabled by connecting to Nx Cloud) uploads these cached results to a shared server. When a teammate or CI machine needs the same build, it downloads the cached result instead of rebuilding from scratch. This is how "even a fresh machine gets cached artifacts." A cache miss occurs when the project's source files, dependencies, or configuration have changed since the last cached build. Changing a file in `shared/ui` invalidates the cache for ALL projects that depend on it.

### Developing a Specific Remote

```bash
npx nx serve shell --devRemotes=mfe_products
```

Changes to `mfe_products` source files trigger HMR instantly. `mfe_orders` and `mfe_account` are served as static builds.

### Working on Multiple Remotes

```bash
npx nx serve shell --devRemotes=mfe_products,mfe_orders
```

> **Warning:** Each dev remote runs its own `webpack-dev-server`, consuming 1-2 GB of RAM. Running 4+ dev remotes simultaneously can consume 8+ GB. Only use `--devRemotes` for the remotes you are actively editing.

### Troubleshooting: `nx serve shell` Does Not Load Remotes

If clicking a remote link shows a blank page or a loading error:

1. Nx discovers remotes from the project graph. Verify that all remote projects were generated with `--host=shell` or were listed in the original `--remotes` flag.
2. Check that `module-federation.manifest.json` has the correct localhost URLs.
3. Open the browser DevTools Network tab and look for failed requests to `mf-manifest.json` or `remoteEntry.mjs`.

> **What just happened?**
>
> - [x] Understood dev remotes (HMR, live reload) vs. static remotes (cached, fast startup)
> - [x] Used `--devRemotes` to focus development on a single remote
> - [x] Learned troubleshooting steps when `nx serve shell` does not load remotes

Now that the development workflow is clear, let's look at how microfrontends communicate with each other. That's Chapter 9.

---

## Chapter 9: Shared State and Cross-MFE Communication

### Pattern 1: Shared Angular Services (Recommended)

Since Angular runs as a singleton, `@Injectable({ providedIn: 'root' })` services in shared libraries are instantiated once and shared across all microfrontends:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService { /* ... */ }

// Shell:        inject(AuthService)  -> Instance A
// mfe_products: inject(AuthService)  -> Same Instance A
// mfe_orders:   inject(AuthService)  -> Same Instance A
```

This is the safest and most debuggable approach for cross-MFE state. As we saw in Chapter 4, the `AuthService` uses signals internally, and every MFE reads the same signal values because they share the same service instance.

### Pattern 2: Module-Level Signals (Use with Caution)

You can declare signals outside a class, at the module level:

```typescript
// libs/shared/data-access-auth/src/lib/auth.state.ts
import { signal, computed } from '@angular/core';
import { User } from '@mfe-platform/shared-models';

// These signals live at the module level, outside any class
export const currentUser = signal<User | null>(null);
export const isAuthenticated = computed(() => currentUser() !== null);
```

> **Warning:** Module-level signals are shared across microfrontends **only because** Module Federation resolves this library as a singleton. If someone changes the sharing config (removes `singleton: true` for this library), each MFE gets its **own copy** of these signals. State silently stops syncing with **no error message**. This is one of the hardest bugs to debug.
>
> **Recommendation:** Prefer `@Injectable({ providedIn: 'root' })` services with signals inside them (like the `AuthService` in Chapter 4). Angular's DI-based singletons are tied to the shared root injector and are more robust than module-level singletons that depend on Module Federation config.

### Pattern 3: Custom Events (Framework-Agnostic Fallback)

For loose notifications between microfrontends that do not need request-response patterns:

```typescript
// Dispatch from mfe_products (e.g., when user adds item to cart)
window.dispatchEvent(new CustomEvent('cart:add', {
  detail: { productId: '123', qty: 1 },
}));

// Listen in mfe_orders (e.g., to update cart badge count)
window.addEventListener('cart:add', ((e: CustomEvent) => {
  console.log('Item added:', e.detail);
}) as EventListener);
```

Custom events use the browser's native event system. They work across any framework, which makes them useful if you ever have a non-Angular microfrontend. The trade-off is no type safety and no Angular change detection integration.

### Communication Best Practices

- **Minimize cross-MFE communication.** Each MFE should be self-contained for its domain. If two MFEs constantly exchange data, the domain boundary may be wrong.
- **Use shared services for global concerns:** auth, user context, theming, error handling.
- **Use custom events only for loose notifications**, not request-response patterns.
- **Document contracts:** Put event names, payload types, and service interfaces in `@mfe-platform/shared-models` so all teams can see them.

> **Note:** If your application requires complex state management (NgRx, SignalStore), place the store in a shared library tagged with `scope:shared`. The same singleton sharing mechanism that works for `AuthService` applies to state management libraries. Each MFE can dispatch actions and select state from the shared store, as long as the library is shared as a singleton through Module Federation.

With communication patterns established, let's tackle the last piece of the local development story: preventing styles from leaking between MFEs. That's Chapter 10.

---

## Chapter 10: CSS and Style Isolation

Style leaking between microfrontends is a top-3 complaint in microfrontend architectures. One remote's `.card` class overrides another remote's `.card` class, causing visual bugs that are hard to trace.

### Angular's ViewEncapsulation (Primary Defense)

Angular's default `ViewEncapsulation.Emulated` scopes component styles by adding unique attribute selectors. A `.card` style in `ProductListComponent` only applies to elements inside that component's template, not to `.card` elements in other components.

**Leave this as the default for all MFE components.** Never use `ViewEncapsulation.None` in remote components.

### Global Styles Strategy

| Style Type | Where to Define | Approach |
|---|---|---|
| CSS reset / normalize | Shell `styles.scss` | Loaded once, applies globally |
| Design tokens (CSS variables) | Shell `:root { ... }` | Remotes consume via `var()` |
| Shared component styles | `libs/shared/ui` components | Encapsulated per component |
| Feature-specific styles | Inside remote components | Encapsulated by Angular |

### Design Tokens via CSS Custom Properties

A **CSS custom property** (also called a CSS variable) is a value defined with `--name` syntax and consumed with `var(--name)`. Unlike Sass variables, CSS custom properties work at runtime across separately built applications.

Define tokens in the shell's `styles.scss`:

```scss
// apps/shell/src/styles.scss
:root {
  --color-primary: #4A1942;
  --color-secondary: #6B2D5B;
  --color-bg: #FFFFFF;
  --color-text: #333333;
  --font-family: 'Inter', sans-serif;
  --border-radius: 8px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}
```

Remotes consume tokens without importing anything:

```scss
// Any component in any remote
.card {
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
}
```

Changing `--color-primary` in the shell instantly rebrands every MFE, because CSS custom properties are resolved at runtime by the browser.

### Style Rules for Microfrontends

1. **Never add global CSS in a remote.** Only use component-scoped styles.
2. **Never use `ViewEncapsulation.None`** in remote components.
3. **Use CSS custom properties** for design tokens (runtime, works across builds), not Sass variables (compile-time, only available within the app that defines them).
4. **If using Tailwind or Bootstrap**, include it in the shell only. Configure it to scan all apps/libs directories for class usage.

> **Tip:** If you see styles from one MFE bleeding into another, check for `ViewEncapsulation.None` or `::ng-deep` in the offending component. Both disable Angular's style scoping.

Now that we have working features, a development workflow, cross-MFE communication, and style isolation, the application works locally. The next step is understanding what your DevOps team needs to deploy it. That's Chapter 11.

---
