# Audit Report: MFE Guide Code-Along Validation

**Date:** 2026-03-12
**Nx Version:** 22.4.5
**Angular Version:** 21.1.6
**Node Version:** 24.12.0
**Platform:** Windows 11 (win32-x64)

---

## 1. Summary

The guide was validated by creating a fresh workspace, executing every command, and writing every code snippet from Chapters 1–15. The workspace setup, library generation, feature code, unit tests, and production builds all work. **18 issues** were found, ranging from incorrect output paths to code that fails to compile as written. Most are documentation mismatches between what the guide claims and what the generator actually produces.

**Severity legend:**
- **BREAKING** — Reader follows the guide exactly and hits a build error or runtime failure
- **INCORRECT** — Guide states something factually wrong; reader may be confused or misled
- **COSMETIC** — Minor mismatch that doesn't break anything but may confuse attentive readers

---

## 2. Version Validation

| Claim in Guide | Actual | Status |
|---|---|---|
| Angular 21.x | 21.1.6 | PASS |
| Nx 22.4.5 | 22.4.5 | PASS |
| Webpack 5.x | 5.105.4 | PASS |
| `@module-federation/enhanced` 2.x | **0.21.6** | FAIL |
| `@nx/module-federation` 22.4.5 | 22.4.5 | PASS |
| Vitest 4.x | 4.0.18 | PASS |
| TypeScript 5.9+ | 5.9.3 | PASS |

### Issue #1: `@module-federation/enhanced` version is wrong (INCORRECT)
**File:** `00-table-of-contents.md`, line 32
**Guide says:** `@module-federation/enhanced | 2.x`
**Actual:** `0.21.6`
**Fix:** Change version to `0.x` or `0.21.x`.

---

## 3. Command Validation

| Command | Chapter | Result |
|---|---|---|
| `npx create-nx-workspace@22.4.5 mfe-platform --preset=apps --nxCloud=skip` | 2 | PASS |
| `npm install @nx/angular@22.4.5` | 2 | PASS |
| `npx nx g @nx/angular:host apps/shell --remotes=... --dynamic` | 2 | PASS |
| `npx nx report` | 2 | PASS |
| `npx nx serve shell` | 2 | PASS |
| `npx nx g @nx/angular:library ...` (all 8) | 4 | PASS |
| `npx nx g @nx/js:library ...` (models, utils) | 4 | PASS |
| `npx nx build mfe_products --configuration=production` | 7/11 | PASS (after fix) |
| `npx nx build shell --configuration=production` | 11 | PASS |
| `npx nx test products-data-access` | 13 | PASS |

---

## 4. Code Validation — Issues Found

### Issue #2: `export` must be `export type` for interfaces in shared-models (BREAKING)
**File:** `03-features-workflow-communication-styles.md`, lines 44–47; also `02-configuration-libraries-providers-boundaries.md`, lines 328–330
**Guide shows:**
```typescript
// libs/shared/models/src/index.ts
export { Product } from './lib/product.interface';
export { User, LoginRequest } from './lib/user.interface';
```
**Actual result:** Build fails with `TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'`.
**Fix:** Must use `export type { Product }` and `export type { User, LoginRequest }` because `isolatedModules` is enabled by default in Angular 21's tsconfig.

---

### Issue #3: Generated route paths use remote names, not user-friendly paths (INCORRECT)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 117–137
**Guide shows:**
```typescript
{ path: 'products', loadChildren: () => loadRemote...('mfe_products/Routes')... },
{ path: 'orders', loadChildren: () => loadRemote...('mfe_orders/Routes')... },
{ path: 'account', loadChildren: () => loadRemote...('mfe_account/Routes')... },
```
**Actually generated:**
```typescript
{ path: 'mfe_products', loadChildren: () => loadRemote...('mfe_products/Routes')... },
{ path: 'mfe_orders', loadChildren: () => loadRemote...('mfe_orders/Routes')... },
{ path: 'mfe_account', loadChildren: () => loadRemote...('mfe_account/Routes')... },
```
**Impact:** The guide shows ideal paths (`products`, `orders`, `account`) but doesn't mention that the generator creates paths matching the remote names (`mfe_products`, etc.). The reader should be told to rename the paths manually. The tip on line 140 says "The route path does not need to match the remote name" but doesn't clarify that the generator defaults to using the remote name.
**Fix:** Add a note after the code block: "The generator defaults to using the remote name as the path (e.g., `mfe_products`). We rename them to user-friendly paths like `products`."

---

### Issue #4: Remote entry selector uses underscore, not hyphen (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 191, 578
**Guide shows:** `selector: 'app-mfe-products-entry'`
**Actually generated:** `selector: 'app-mfe_products-entry'`
**Impact:** Minor cosmetic mismatch. The generated selector preserves the underscore from the project name. The guide normalizes it to hyphens, which is the more conventional CSS selector style but doesn't match what the generator produces.
**Fix:** Either update the guide to show the actual generated selector, or note that the guide normalizes the selector for readability.

---

### Issue #5: Output path is `dist/apps/<name>/` not `dist/apps/<name>/browser/` (BREAKING)
**File:** `04-deployment-versions-testing.md`, lines 44, 47, 130, 260, 410, 470; also `05-advanced-and-best-practices.md` Appendix B line 260
**Guide says:** `dist/apps/<app-name>/browser/`
**Actual:** `dist/apps/<app-name>/` (no `browser/` subdirectory)
**Impact:** The Dockerfile `COPY --from=builder /app/dist/apps/${APP_NAME}/browser` would copy nothing. The deploy script `aws s3 sync dist/apps/shell/browser` would fail. The manifest injection `cat > dist/apps/shell/browser/module-federation.manifest.json` would fail.
**Fix:** Remove `/browser` from all output path references. The correct path is `dist/apps/<app-name>/`.

---

### Issue #6: Remote entry file is `remoteEntry.mjs` not `remoteEntry.js` (INCORRECT)
**File:** `04-deployment-versions-testing.md`, lines 51, 56, 161–163, 276, 457; `05-advanced-and-best-practices.md`, lines 206, 209
**Guide says:** `remoteEntry.js`
**Actual:** `remoteEntry.mjs` (ESM extension)
**Impact:** The nginx cache rule `location = /remoteEntry.js` would not match the actual file. CloudFront cache behavior for `/remoteEntry.js` would miss. The guide's warning about `remoteEntry.js` not being content-hashed applies to `remoteEntry.mjs` instead.
**Fix:** Change all references from `remoteEntry.js` to `remoteEntry.mjs`.

---

### Issue #7: `libs/` directory does not exist after workspace setup (COSMETIC)
**File:** `01-foundations-and-setup.md`, line 191
**Guide shows in the workspace structure:**
```
libs/                         # Shared libraries (empty for now)
```
**Actual:** The `libs/` directory is not created until the first library is generated (Chapter 4).
**Fix:** Remove `libs/` from the Step 4 structure diagram, or add a note: "The `libs/` directory will be created when you generate your first library in Chapter 4."

---

### Issue #8: Shell `app.ts` imports `RouterModule`, not `RouterOutlet`/`RouterLink` (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 539–549
**Guide shows:**
```typescript
imports: [RouterOutlet, RouterLink],
```
**Actually generated:**
```typescript
imports: [NxWelcome, RouterModule],
```
**Impact:** The guide's code is the *recommended* approach (individual imports for tree-shaking), but the *generated* code uses `RouterModule`. The guide does acknowledge this in a note (line 566), but the main code block shows something different from what the reader will see.
**Fix:** Either show the generated code first and then recommend changing it, or note that the reader should replace `RouterModule` with `[RouterOutlet, RouterLink]`.

---

### Issue #9: Shell `app.config.ts` missing `provideHttpClient` and `provideAnimationsAsync` (INCORRECT)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 404–423
**Guide says the shell's `app.config.ts` should include `provideHttpClient(withInterceptorsFromDi())` and `provideAnimationsAsync()`.
**Actually generated:**
```typescript
providers: [provideBrowserGlobalErrorListeners(), provideRouter(appRoutes)],
```
**Impact:** The guide is correct that these *should* be added, but implies they are generated. The guide says "Add these manually for MFE support" with a comment in the code, which is accurate. However, readers may not notice the comment and assume these are auto-generated.
**Fix:** No change needed — the guide's comment "Add these manually" is correct. Consider making this more prominent, e.g., a bolded note.

---

### Issue #10: Shell routes include `NxWelcome` default route (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 112–137
**Guide shows routes without the NxWelcome default route:**
```typescript
export const appRoutes: Route[] = [
  { path: 'products', loadChildren: () => ... },
  ...
];
```
**Actually generated:** The routes include `import { NxWelcome } from './nx-welcome';` and a default route `{ path: '', component: NxWelcome }`.
**Impact:** The guide omits the NxWelcome import and default route that the generator creates. Readers will see extra code they weren't told about. The guide does mention NxWelcome in the entry component context (line 197) but not in the shell routes.
**Fix:** Add a note: "The generated routes include a default NxWelcome component route. You can remove it once you add your own home page."

---

### Issue #11: Shell app template uses `routerLink="mfe_products"` not `routerLink="/products"` (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 551–561
**Guide shows:**
```html
<a routerLink="/products">Products</a>
```
**Actually generated:**
```html
<a routerLink="mfe_products">MfeProducts</a>
```
**Impact:** Matches Issue #3 — the generated template uses the remote names as link text and paths, not the user-friendly names shown in the guide.
**Fix:** Same as Issue #3 — note that the reader should rename these.

---

### Issue #12: Vitest runs in single-run mode by default, not watch mode (INCORRECT)
**File:** `04-deployment-versions-testing.md`, line 524
**Guide says:** "The `nx test` command runs Vitest in watch mode by default during local development and in single-run mode in CI (when the `CI` environment variable is set)."
**Actual:** The generated `vite.config.mts` sets `watch: false`, meaning tests run in single-run mode by default regardless of environment.
**Fix:** Change to: "The `nx test` command runs Vitest in single-run mode by default. Add `--watch` for continuous testing during development."

---

### Issue #13: Vitest uses `@analogjs/vite-plugin-angular`, not `@angular/build:unit-test` (INCORRECT)
**File:** `04-deployment-versions-testing.md`, line 524
**Guide says:** "Nx 22.3+ supports Vitest for Angular projects via the `vitest-angular` option (using Angular's native `@angular/build:unit-test` builder)."
**Actual:** The generated Vitest config uses `@analogjs/vite-plugin-angular`, not Angular's native `@angular/build:unit-test` builder.
**Fix:** Change to: "Nx 22.3+ supports Vitest for Angular projects via the `@analogjs/vite-plugin-angular` Vite plugin."

---

### Issue #14: `@nx/js:library` generates Jest, not Vitest (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, lines 234–243
**Impact:** The `@nx/js:library` generator creates a Jest config (`jest.config.cts`) and installs Jest dependencies, while `@nx/angular:library` creates Vitest config. The guide doesn't mention this difference. For `shared-models` and `shared-utils`, tests will run with Jest, not Vitest.
**Fix:** Add a note: "`@nx/js:library` uses Jest by default (not Vitest). You can convert to Vitest later or keep Jest for pure TypeScript libraries."

---

### Issue #15: `shell-e2e` and remote `-e2e` projects not mentioned in structure (COSMETIC)
**File:** `01-foundations-and-setup.md`, lines 183–195
**Guide shows:** `shell-e2e/` in the workspace structure.
**Actually generated:** `shell-e2e/`, `mfe_products-e2e/`, `mfe_orders-e2e/`, `mfe_account-e2e/` — the guide only mentions `shell-e2e/` but each remote also gets an `-e2e` project.
**Fix:** Either add the remote e2e projects to the structure diagram or add a note: "Each remote also gets an `-e2e` project for end-to-end testing."

---

### Issue #16: `withComponentInputBinding()` not generated by default (COSMETIC)
**File:** `02-configuration-libraries-providers-boundaries.md`, line 418
**Guide shows:** `provideRouter(appRoutes, withComponentInputBinding())`
**Actually generated:** `provideRouter(appRoutes)` (no `withComponentInputBinding`)
**Impact:** The guide's code adds `withComponentInputBinding()` as a manual addition. The guide should be clearer that this is a manual enhancement, not generated code.
**Fix:** The code comment "Add these manually" applies here too. No separate fix needed.

---

### Issue #17: `app.html` link text uses CamelCase remote names (COSMETIC)
**File:** Not directly referenced in the guide's code but related to the shell template.
**Generated:** `<a routerLink="mfe_products">MfeProducts</a>` — the link text is "MfeProducts" (CamelCase), not "Products".
**Impact:** Purely cosmetic; the reader will see "MfeProducts" in the nav, not "Products" as implied by the guide.

---

### Issue #18: Guide says "Chapters 1 and 2 are concepts only, with no code" (INCORRECT)
**File:** `00-table-of-contents.md`, line 42
**Guide says:** "Chapters 1 and 2 are concepts only, with no code. Chapter 3 introduces your first commands."
**Actual:** Chapter 2 contains all the workspace setup commands (`create-nx-workspace`, `npm install`, `nx g @nx/angular:host`, `nx serve`). Chapter 3 is about understanding the generated configuration (no new commands to run). The description should say "Chapter 1 is concepts only. Chapter 2 introduces your first commands."
**Fix:** Change to: "Chapter 1 is concepts only, with no code. Chapter 2 introduces your first commands."

---

## 5. File Structure Validation

| Claimed Structure | Actual | Status |
|---|---|---|
| `apps/shell/` | Exists | PASS |
| `apps/shell-e2e/` | Exists | PASS |
| `apps/mfe_products/` | Exists | PASS |
| `apps/mfe_orders/` | Exists | PASS |
| `apps/mfe_account/` | Exists | PASS |
| `libs/` (after Ch 2) | Does NOT exist until Ch 4 | FAIL (Issue #7) |
| `vite.config.mts` per app | Exists | PASS |
| `module-federation.config.ts` per app | Exists | PASS |
| `webpack.config.ts` per app | Exists | PASS |
| `webpack.prod.config.ts` (remotes only) | Exists for remotes, not shell | PASS |
| `module-federation.manifest.json` | Exists in `apps/shell/public/` | PASS |
| Port assignments (4200-4203) | Correct | PASS |

---

## 6. Conceptual Accuracy

| Claim | Status | Notes |
|---|---|---|
| Dynamic federation uses manifest at runtime | PASS | Verified — manifest fetched in `main.ts` |
| `registerRemotes` + `loadRemote` are the runtime APIs | PASS | Confirmed in generated code |
| `withModuleFederation` auto-configures sharing | PASS | Verified — no manual sharing config needed |
| `main.ts`/`bootstrap.ts` split creates async boundary | PASS | Confirmed in generated code |
| Remotes' `bootstrap.ts` bootstraps `RemoteEntry`, not `App` | PASS | Confirmed |
| `singleton: true` for Angular packages | PASS | Nx handles automatically |
| Nx discovers remotes from project graph | PASS | `nx serve shell` found and served all 3 remotes |
| Angular 21 zoneless by default | PASS | No Zone.js in dependencies |
| `standalone: true` not needed (default since Angular 19) | PASS | No `standalone: true` in generated code |

---

## 7. Completeness Assessment

The guide covers the complete workflow from workspace creation through deployment. The code-along validated that:

1. **Workspace setup works end-to-end** with pinned Nx 22.4.5
2. **All library generators work** as documented
3. **Feature code compiles and builds** (after the `export type` fix)
4. **Unit tests pass** using Vitest with TestBed and HttpTestingController
5. **Production builds succeed** for both shell and remotes
6. **`nx serve shell`** correctly discovers and serves all remotes

### Items NOT validated (require external infrastructure):
- Docker builds (no Docker available in this environment)
- CI/CD pipeline (GitHub Actions)
- AWS deployment (S3, CloudFront)
- Playwright E2E tests
- Module boundary enforcement via ESLint (requires manual tag setup)
- Rspack conversion

---

## 8. Prioritized Recommendations

### Must Fix (BREAKING)
1. **Issue #2:** Change `export { ... }` to `export type { ... }` in `libs/shared/models/src/index.ts` code blocks (files 02 and 03)
2. **Issue #5:** Change all `dist/apps/<name>/browser/` references to `dist/apps/<name>/` (file 04, and Appendix B in file 05)
3. **Issue #6:** Change `remoteEntry.js` to `remoteEntry.mjs` in nginx config, cache rules, and all references (files 04 and 05)

### Should Fix (INCORRECT)
4. **Issue #1:** Change `@module-federation/enhanced` version from `2.x` to `0.x` (file 00)
5. **Issue #3:** Add a note that the generator uses remote names as route paths, and the reader should rename them (file 02)
6. **Issue #12:** Fix Vitest watch mode claim (file 04)
7. **Issue #13:** Fix Vitest builder claim — uses `@analogjs/vite-plugin-angular`, not `@angular/build:unit-test` (file 04)
8. **Issue #18:** Fix "Chapters 1 and 2 are concepts only" to "Chapter 1 is concepts only" (file 00)

### Nice to Fix (COSMETIC)
9. **Issue #4:** Note the actual selector generated (`app-mfe_products-entry`) vs the guide's idealized version
10. **Issue #7:** Note that `libs/` doesn't exist until Chapter 4
11. **Issue #8:** Clarify that `RouterModule` is generated but individual imports are recommended
12. **Issue #10:** Mention the NxWelcome default route in shell routes
13. **Issue #14:** Note that `@nx/js:library` uses Jest, not Vitest
14. **Issue #15:** Mention remote `-e2e` projects in the workspace structure
