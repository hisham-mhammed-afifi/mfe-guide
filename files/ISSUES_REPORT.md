# MFE Platform — Issues Report

**Date:** 2026-03-13
**Project:** `d:\mfe-platform` (Nx Angular Micro Frontend Platform)

---

## Issue 1 — NG0203: `toSignal()` Injection Context Error in `ProductListComponent`

### Error
```
ERROR RuntimeError: NG0203: toSignal() can only be used within an injection context
    at new ProductListComponent (product-list.component.ts:46:31)
    at NodeInjectorFactory.ProductListComponent_Factory [as factory] (product-list.component.ts:49:4)
```

### Trigger
Navigating to the `mfeProducts` route in the shell app.

### Root Cause
`toSignal()` was called as a class field initializer:
```typescript
readonly products = toSignal(this.productService.getAll(), { initialValue: [] });
```
Class field initializers are normally valid injection contexts in Angular. However, in a **Module Federation** environment, there can be **multiple Angular instances** (one in the shell, one in the MFE). The shell's Angular sets up the injection context, but the MFE's `toSignal()` (from the MFE's Angular bundle) checks its own Angular instance's context — which is never set. The same failure also occurred after moving `toSignal()` into the constructor, confirming the multiple-instances diagnosis.

### Fix
Replaced `toSignal()` with `signal()` + `ngOnInit`/`ngOnDestroy` subscription. `signal()` is a plain reactive primitive with no DI dependency; subscribing in `ngOnInit` happens after the component is fully initialized in the correct DI tree.

**File:** `libs/products/feature/src/lib/product-list.component.ts`

```typescript
// Before
export class ProductListComponent {
  private readonly productService = inject(ProductService);
  readonly products = toSignal(this.productService.getAll(), { initialValue: [] });
}

// After
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  readonly products = signal<Product[]>([]);
  private subscription?: Subscription;

  ngOnInit() {
    this.subscription = this.productService.getAll().subscribe(p => this.products.set(p));
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
```

---

## Issue 2 — NG0203: `toSignal()` Injection Context Error in `ProductDetailComponent`

### Error
```
ERROR RuntimeError: NG0203: toSignal() can only be used within an injection context
    at new ProductDetailComponent (product-detail.component.ts:27:30)
    at NodeInjectorFactory.ProductDetailComponent_Factory [as factory] (product-detail.component.ts:35:4)
```

### Trigger
Clicking "View Details" on any product in the `mfeProducts` route.

### Root Cause
Same root cause as Issue 1. `toSignal()` was called as a class field initializer on a route-param-driven observable:
```typescript
readonly product = toSignal(
  this.route.paramMap.pipe(switchMap(...)),
  { initialValue: null }
);
```

### Fix
Same approach as Issue 1 — replaced with `signal()` + `ngOnInit`/`ngOnDestroy`.

**File:** `libs/products/feature/src/lib/product-detail.component.ts`

```typescript
// Before
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  readonly product = toSignal(
    this.route.paramMap.pipe(switchMap((params) => {
      const id = params.get('id');
      return id ? this.productService.getById(Number(id)) : of(null);
    })),
    { initialValue: null }
  );
}

// After
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  readonly product = signal<Product | null>(null);
  private subscription?: Subscription;

  ngOnInit() {
    this.subscription = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id');
        return id ? this.productService.getById(Number(id)) : of(null);
      })
    ).subscribe(p => this.product.set(p));
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
```

---

## Issue 3 — `Cannot use 'import.meta' outside a module` in `styles.js`

### Error
```
Uncaught SyntaxError: Cannot use 'import.meta' outside a module (at styles.js:9230:29)
```

### Trigger
Loading the shell app in the browser (error present on initial page load).

### Root Cause
A chain of four interacting behaviours:

1. **`withModuleFederation` sets `experiments.outputModule: true` and `output.publicPath: 'auto'`**
   (`node_modules/@nx/module-federation/src/with-module-federation/angular/with-module-federation.js:23`)
   This combination tells webpack 5 to emit ESM-formatted output and to determine the public path at runtime.

2. **`publicPath: 'auto'` with `outputModule: true` generates `import.meta.url` in every chunk**
   Webpack uses `import.meta.url` to dynamically resolve the base URL for chunk loading — this code ends up inside `styles.js`.

3. **Angular hardcodes `isModule = false` for the styles entrypoint**
   In `@angular-devkit/build-angular/src/utils/package-chunk-sort.js`, `generateEntryPoints()` always emits `[bundleName, false]` for style entries — meaning the `IndexHtmlGenerator` must inject them as classic scripts.

4. **Classic `<script defer>` cannot contain `import.meta`**
   `import.meta` is a parse-time syntax construct only valid inside ES modules (`<script type="module">`). Even wrapping it in `typeof` does not prevent the SyntaxError in a classic script context.

### Why only the shell is affected
MFE remote apps expose `remoteEntry.mjs`. The `.mjs` extension forces `isModule = true` in `IndexHtmlGenerator`, so it is injected with `type="module"` — `import.meta.url` is valid there. The MFE apps' own `styles.js` is never injected into the shell's HTML when loaded as remotes.

### Why MFE remote webpack configs must keep `publicPath: 'auto'`
When the shell loads a remote's `remoteEntry.mjs`, webpack's runtime inside the MFE uses `import.meta.url` (valid, because it's a module) to set `__webpack_public_path__` to the MFE's origin (e.g. `http://localhost:4201/`). Hardcoding `'/'` would redirect all MFE chunk requests to the shell's origin, breaking lazy chunk loading.

### Fix
Override `output.publicPath` to `'/'` in the shell's webpack config after `withModuleFederation` runs. With a static path webpack does not need to generate `import.meta.url` in any chunk, so `styles.js` no longer contains `import.meta`.

**File:** `apps/shell/webpack.config.ts`

```typescript
// Before
export default withModuleFederation(config, { dts: false });

// After
export default withModuleFederation(config, { dts: false }).then((mfConfig) => {
  return (baseConfig: Configuration): Configuration => {
    const result = mfConfig(baseConfig);
    return {
      ...result,
      output: {
        ...result.output,
        publicPath: '/',
      },
    };
  };
});
```

> **Note:** After changing a webpack config, a full server restart (`nx serve shell`) is required — webpack config changes are not picked up by hot reload.

---

## Summary Table

| # | Error | Component / File | Root Cause | Fix |
|---|-------|-----------------|------------|-----|
| 1 | `NG0203: toSignal()` injection context | `ProductListComponent` | Multiple Angular instances in MFE break DI context for `toSignal()` | Replace `toSignal()` with `signal()` + `ngOnInit` subscription |
| 2 | `NG0203: toSignal()` injection context | `ProductDetailComponent` | Same as above | Same as above |
| 3 | `import.meta` SyntaxError in `styles.js` | `apps/shell/webpack.config.ts` | `withModuleFederation` sets `outputModule: true` + `publicPath: 'auto'`; Angular injects `styles.js` as a classic (non-module) script | Override `output.publicPath: '/'` in shell webpack config |
