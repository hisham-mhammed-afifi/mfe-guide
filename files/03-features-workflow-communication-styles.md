# Part 3: Features, Workflow, Communication, and Styles

---

## Chapter 7: Building Features in Remotes

Let's build out `mfe-products` with complete, compilable code. Every import is shown explicitly.

### Step 1: Define the Product Model

```typescript
// libs/shared/models/src/lib/product.interface.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}
```

```typescript
// libs/shared/models/src/index.ts
export { Product } from './lib/product.interface';
export { User, LoginRequest } from './lib/user.interface';
```

### Step 2: Create the Product Service

```typescript
// libs/products/data-access/src/lib/product.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '@mfe-platform/shared-models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products');
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`/api/products/${id}`);
  }
}
```

```typescript
// libs/products/data-access/src/index.ts
export { ProductService } from './lib/product.service';
```

### Step 3: Create the Product List Component

```typescript
// libs/products/feature/src/lib/product-list.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Products</h2>
    <div class="product-grid">
      @for (product of products(); track product.id) {
        <div class="product-card">
          <h3>{{ product.name }}</h3>
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
      gap: var(--spacing-md, 16px);
    }
    .product-card {
      border: 1px solid #ddd;
      border-radius: var(--border-radius, 8px);
      padding: var(--spacing-md, 16px);
    }
  `],
})
export class ProductListComponent {
  private readonly productService = inject(ProductService);

  readonly products = toSignal(
    this.productService.getAll(),
    { initialValue: [] }
  );
}
```

> **Import checklist:** `toSignal` is from `@angular/core/rxjs-interop` (not `@angular/core`). `RouterLink` must be in the `imports` array for standalone components. `CommonModule` provides `currency` pipe. These are the most common "compiles but fails at runtime" mistakes.

### Step 4: Create the Product Detail Component

```typescript
// libs/products/feature/src/lib/product-detail.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { ProductService } from '@mfe-platform/products-data-access';

@Component({
  selector: 'products-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (product(); as p) {
      <h2>{{ p.name }}</h2>
      <p>{{ p.description }}</p>
      <p class="price">{{ p.price | currency }}</p>
    } @else {
      <p>Loading...</p>
    }
  `,
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);

  readonly product = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id');
        return id ? this.productService.getById(id) : of(null);
      })
    ),
    { initialValue: null }
  );
}
```

### Step 5: Export from the Feature Library

```typescript
// libs/products/feature/src/index.ts
export { ProductListComponent } from './lib/product-list.component';
export { ProductDetailComponent } from './lib/product-detail.component';
```

### Step 6: Update Remote Entry Routes

Replace the placeholder with real routes that lazy-load from the feature library:

```typescript
// apps/mfe-products/src/app/remote-entry/entry.routes.ts
import { Route } from '@angular/router';

export const remoteRoutes: Route[] = [
  {
    path: '',
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

> **How bundling works here:** `entry.routes.ts` imports from `@mfe-platform/products-feature`. When Module Federation builds this remote, it follows the import and bundles the feature library code into the remote's federated chunk. However, since Nx configured the library as a shared singleton, it is loaded only once at runtime and reused if another MFE also imports it. This is transparent to you.

### Step 7: Run Standalone

```bash
nx serve mfe-products
```

Navigate to `http://localhost:4201`. The products feature runs independently using its own `bootstrap.ts` and `app.config.ts` (with providers). This is useful for focused development.

---

## Chapter 8: Serving and Development Workflow

### Dev Remotes vs. Static Remotes

| Type | How It Works | When to Use |
|---|---|---|
| Dev Remote | Served with `webpack-dev-server` (HMR + live reload) | The feature you are actively coding |
| Static Remote | Built once (or restored from Nx cache) and served via `http-server` | All other remotes |

### Running the Full System

```bash
nx serve shell
```

Nx reads the `remotes` array in the shell's `module-federation.config.ts` to discover which remote projects exist. It builds them (or restores from cache) and serves them statically alongside the shell via a single file server. The dynamic manifest handles runtime resolution.

### Developing a Specific Remote

```bash
nx serve shell --devRemotes=mfe-products
```

Changes to `mfe-products` trigger HMR. `mfe-orders` and `mfe-account` are served statically.

### Working on Multiple Remotes

```bash
nx serve shell --devRemotes=mfe-products,mfe-orders
```

> **Resource warning:** Each dev remote runs its own `webpack-dev-server`, consuming 1-2 GB of RAM. Running 4+ dev remotes simultaneously can consume 8+ GB. Only use `--devRemotes` for the remotes you are actively editing.

### Caching

When you run `nx serve shell`, unchanged remotes are restored from Nx's local cache instantly. With Nx Cloud remote caching, even a fresh machine gets cached artifacts, making the full system start in seconds.

---

## Chapter 9: Shared State and Cross-MFE Communication

### Pattern 1: Shared Angular Services (Recommended)

Since Angular runs as a singleton, `providedIn: 'root'` services in shared libraries are instantiated once and shared across all MFEs:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService { ... }

// Shell:        inject(AuthService)  -> Instance A
// mfe-products: inject(AuthService)  -> Same Instance A
// mfe-orders:   inject(AuthService)  -> Same Instance A
```

This is the safest and most debuggable approach for cross-MFE state.

### Pattern 2: Signals for Global State

```typescript
// libs/shared/data-access-auth/src/lib/auth.state.ts
import { signal, computed } from '@angular/core';
import { User } from '@mfe-platform/shared-models';

export const currentUser = signal<User | null>(null);
export const isAuthenticated = computed(() => currentUser() !== null);
```

> **CRITICAL WARNING:** Module-level signals (declared outside a class) are shared across MFEs **only because** Module Federation resolves this library as a singleton. If someone changes the MF shared config (removes `singleton: true` for this library), each MFE gets its **own copy** of these signals. State silently stops syncing with **no error message**. This is one of the hardest bugs to debug.
>
> **Recommendation:** Prefer `@Injectable({ providedIn: 'root' })` services with signals inside them (like the AuthService pattern). Angular's DI-based singletons are tied to the shared root injector and are more robust than module-level singletons.

### Pattern 3: Custom Events (Framework-Agnostic Fallback)

```typescript
// Dispatch from mfe-products
window.dispatchEvent(new CustomEvent('cart:add', {
  detail: { productId: '123', qty: 1 },
}));

// Listen in mfe-orders
window.addEventListener('cart:add', ((e: CustomEvent) => {
  cartService.addItem(e.detail);
}) as EventListener);
```

### Communication Best Practices

- **Minimize cross-MFE communication.** Each MFE should be self-contained for its domain.
- **Use shared services for global concerns:** auth, user context, theming, error handling.
- **Use custom events only for loose notifications**, not request-response patterns.
- **Document contracts:** Put event names, payload types, and service interfaces in `@mfe-platform/shared-models`.

---

## Chapter 10: CSS and Style Isolation

Style leaking between MFEs is a top-3 complaint in microfrontend architectures.

### Angular's ViewEncapsulation (Primary Defense)

Angular's default `ViewEncapsulation.Emulated` scopes component styles with attribute selectors. **Leave this as the default for all MFE components.** Never use `ViewEncapsulation.None` in remote components.

### Global Styles Strategy

| Style Type | Where to Define | Approach |
|---|---|---|
| CSS reset / normalize | Shell `styles.scss` | Loaded once, applies globally |
| Design tokens (CSS variables) | Shell `:root { ... }` | Remotes consume via `var()` |
| Shared component styles | `libs/shared/ui` | Encapsulated per component |
| Feature-specific styles | Inside remote components | Encapsulated by Angular |

### Design Tokens via CSS Custom Properties

Define in the shell's `styles.scss`:

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

Remotes consume without importing anything:

```scss
.card {
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
}
```

Changing `--color-primary` in the shell instantly rebrands every MFE.

### Rules

1. **Never add global CSS in a remote.** Only component-scoped styles.
2. **Never use `ViewEncapsulation.None`** in remote components.
3. **Use CSS custom properties** for design tokens (runtime, works across builds), not Sass variables (compile-time).
4. **If using Tailwind or Bootstrap**, include it in the shell only. Configure it to scan all apps/libs for class usage.
