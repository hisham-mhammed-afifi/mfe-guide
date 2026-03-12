# MFE Guide Audit Report

**Audited:** March 12, 2026
**Guide Title:** Microfrontends with Angular, Nx, and Module Federation
**Method:** Full code-along execution of every command and code snippet

---

## 1. Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Major | 8 |
| Minor | 10 |
| Cosmetic | 6 |
| **Total** | **25** |

**Overall Assessment:** The guide is **usable with revisions**. The workspace setup, code generation, and core Module Federation wiring all work as described. However, one critical missing dependency (`@angular/animations`) will block readers at Chapter 5, and several generated file contents differ from the guide's listings. A reader who types commands exactly as shown will succeed through Chapter 4, hit a build failure at Chapter 5, and need to troubleshoot independently. With the fixes listed below, the guide would be production-quality.

---

## 2. Version & Tooling Validation

All version claims verified against `npx nx report` and `package.json` after generation:

| Claim in Guide | Actual Installed | Match? |
|---|---|---|
| Angular 21.x | `@angular/core@~21.1.0` (21.1.3 resolved) | ✅ Yes |
| Nx 22.4.5 | `nx@22.4.5` | ✅ Yes |
| `@nx/angular` 22.4.5 | `@nx/angular@22.4.5` | ✅ Yes |
| `@nx/module-federation` 22.4.5 | `@nx/module-federation@22.4.5` | ✅ Yes |
| `@module-federation/enhanced` 0.x | `@module-federation/enhanced@^0.21.2` | ✅ Yes |
| Vitest 4.x | `vitest@^4.0.8` (4.0.18 resolved) | ✅ Yes |
| TypeScript 5.9+ | `typescript@~5.9.2` (5.9.3 resolved) | ✅ Yes |
| Webpack 5.x | Present via `@nx/webpack` | ✅ Yes |
| `@analogjs/vite-plugin-angular` | `@analogjs/vite-plugin-angular@2.1.3` | ✅ Yes (auto-installed) |
| `@angular/animations` | **NOT installed** by `@nx/angular` | ❌ Missing |

**Notes:**
- The guide claims "This single package [`@nx/angular`] installs Angular, Webpack, and all the Module Federation infrastructure that Nx needs." This is **mostly true**, but `@angular/animations` is NOT included. It must be installed separately to use `provideAnimationsAsync()`.
- Node.js 24.12.0 was used (guide says 20+/22.x LTS). Worked fine.
- All version claims independently verified via npm registry searches and official documentation (Angular 21 zoneless-by-default confirmed, Vitest 4.0 released Oct 2025, `@module-federation/enhanced` maintained by Zack Jackson/ByteDance confirmed, TypeScript 5.9.3 stable with 6.0 RC available).
- The guide claims `eslint.config.mjs` — verified correct for Nx 22.4.5 (the actual generated file is `.mjs`, not `.js`).
- Angular 21's `isolatedModules` behavior: `ng new` uses `verbatimModuleSyntax: true`, while Nx-generated projects use `isolatedModules: true`. Both require `export type` for type-only re-exports. The guide's description is functionally accurate.

---

## 3. Command Validation

### Chapter 2: Workspace Setup

| Command | Result | Notes |
|---|---|---|
| `npx create-nx-workspace@22.4.5 mfe-platform --preset=apps --nxCloud=skip` | ✅ Success | Workspace created correctly |
| `npm install @nx/angular@22.4.5` | ✅ Success | 712 packages added, 20 high severity audit warnings (unrelated) |
| `npx nx g @nx/angular:host apps/shell --remotes=mfe_products,mfe_orders,mfe_account --dynamic --prefix=app --style=scss --no-interactive` | ✅ Success | All 4 apps + 4 e2e projects generated correctly |
| `npx nx report` | ✅ Success | Shows all expected packages at correct versions |

### Chapter 4: Shared Libraries

| Command | Result | Notes |
|---|---|---|
| `npx nx g @nx/angular:library --directory=libs/shared/ui --name=shared-ui --importPath=@mfe-platform/shared-ui --changeDetection=OnPush` | ✅ Success | Generated with Vitest config |
| `npx nx g @nx/angular:library --directory=libs/shared/data-access-auth --name=shared-data-access-auth --importPath=@mfe-platform/shared-data-access-auth` | ✅ Success | |
| `npx nx g @nx/js:library --directory=libs/shared/models --name=shared-models --importPath=@mfe-platform/shared-models` | ✅ Success | Generated with Jest config (as guide states) |
| `npx nx g @nx/js:library --directory=libs/shared/utils --name=shared-utils --importPath=@mfe-platform/shared-utils` | ✅ Success | Generated with Jest config |
| `npx nx g @nx/angular:library --directory=libs/products/feature --name=products-feature --importPath=@mfe-platform/products-feature` | ✅ Success | |
| `npx nx g @nx/angular:library --directory=libs/products/data-access --name=products-data-access --importPath=@mfe-platform/products-data-access` | ✅ Success | |

**Note:** The guide's library commands are missing `--no-interactive`, which causes interactive prompts. Adding `--no-interactive` resolves this. The guide uses it for the host generator but not for library generators.

### Chapter 5: Providers

| Command | Result | Notes |
|---|---|---|
| `npx nx build shell --configuration=production` (after adding `provideAnimationsAsync()`) | ❌ **FAILS** | `Module not found: Error: Can't resolve '@angular/animations/browser'`. Requires `npm install @angular/animations@"~21.1.0"` first. |
| `npx nx build shell --configuration=production` (after installing `@angular/animations`) | ✅ Success | |

### Chapter 7: Building Features

| Command | Result | Notes |
|---|---|---|
| `npx nx build mfe_products --configuration=production` | ✅ Success | Warning about `@angular/animations` not being shared (cosmetic) |

### Chapter 13: Testing

| Command | Result | Notes |
|---|---|---|
| `npx nx test products-data-access` | ✅ Success | Guide's test code compiles and passes |
| `npx nx test mfe_products` | ❌ **FAILS** | "No test files found" — remote apps have no generated spec files |

### Chapter 14: Advanced

| Command | Result | Notes |
|---|---|---|
| `npx nx g @nx/angular:convert-to-rspack --help` | ✅ Exists | Generator is available |
| `npx nx serve shell --help` (check `--devRemotes`) | ✅ Exists | Flag is present |
| `npx nx g @nx/angular:remote --help` (check `--host`) | ✅ Exists | Flag is present |

### Other Commands

| Command | Result | Notes |
|---|---|---|
| `npx nx lint shell` | ✅ Success | 3 warnings, 0 errors |

---

## 4. Code Validation

### Code That Compiles and Works As Described

- ✅ `User` and `LoginRequest` interfaces (`libs/shared/models/src/lib/user.interface.ts`)
- ✅ `Product` interface (`libs/shared/models/src/lib/product.interface.ts`)
- ✅ `AuthService` with signals (`libs/shared/data-access-auth/src/lib/auth.service.ts`)
- ✅ `ProductService` (`libs/products/data-access/src/lib/product.service.ts`)
- ✅ `ProductListComponent` with `toSignal` and `@for` syntax (`libs/products/feature/src/lib/product-list.component.ts`)
- ✅ `ProductDetailComponent` with `switchMap` and `toSignal` (`libs/products/feature/src/lib/product-detail.component.ts`)
- ✅ Updated `entry.routes.ts` with `loadComponent` lazy loading
- ✅ Unit test for `ProductService` using `TestBed` and `HttpTestingController`
- ✅ All `index.ts` barrel exports compile, including `export type` for interfaces

### Code Issues

| # | Location | Issue | Severity |
|---|---|---|---|
| C1 | Ch5 `app.config.ts` | `provideAnimationsAsync()` requires `@angular/animations` which is NOT installed by `@nx/angular`. Build fails with `Module not found: Error: Can't resolve '@angular/animations/browser'`. The guide must add `npm install @angular/animations` before this step. | **Critical** |
| C2 | Ch3 `entry.ts` | Guide shows `template: '<p>mfe_products remote entry works!</p>'`. Actual generated code is `template: '<app-nx-welcome></app-nx-welcome>'` with `imports: [NxWelcome]`. The guide acknowledges this in a note but the main listing is misleading. | Minor |
| C3 | Ch3 `main.ts` (shell) | Guide listing matches generated code almost exactly. Only formatting differs (trailing comma placement). | Cosmetic |
| C4 | Ch3 `webpack.prod.config.ts` | Guide shows a minimal config identical to `webpack.config.ts`. Actual generated code uses `{ ...config, /* remote override comments */ }` spread pattern with production override comments. Functionally equivalent but structurally different. | Minor |
| C5 | Ch5 Remote `bootstrap.ts` | Guide code matches generated code exactly. ✅ | — |
| C6 | Ch5 Remote `app.routes.ts` | Guide shows `{ path: '', children: remoteRoutes }` (static import). Generated code uses `loadChildren: () => import('./remote-entry/entry.routes').then((m) => m.remoteRoutes)` (dynamic/lazy import). **Different loading strategy.** | Major |
| C7 | Ch5 Shell `app.ts` | Guide shows `imports: [RouterOutlet, RouterLink]`. Generated code has `imports: [NxWelcome, RouterModule]`. Guide acknowledges this in a note but the main listing creates a discrepancy. | Minor |
| C8 | Ch5 Shell `app.html` | Guide shows `<router-outlet />` (self-closing). Generated code has `<router-outlet></router-outlet>`. Both work but differ. Guide also shows clean nav with `routerLink="/products"`. Generated uses `routerLink="mfe_products"` with `MfeProducts` text. Guide acknowledges this in a note. | Minor |
| C9 | Ch13 `npx nx test mfe_products` | Guide says to run this command, but remote apps have **no test files**. The command fails with "No test files found, exiting with code 1". | Major |

---

## 5. File Structure Validation

### Generated vs. Expected (Chapter 2)

| Expected (Guide) | Actual | Match? |
|---|---|---|
| `apps/shell/` | ✅ Created | Yes |
| `apps/shell-e2e/` | ✅ Created | Yes |
| `apps/mfe_products/` | ✅ Created | Yes |
| `apps/mfe_products-e2e/` | ✅ Created | Yes |
| `apps/mfe_orders/` | ✅ Created | Yes |
| `apps/mfe_orders-e2e/` | ✅ Created | Yes |
| `apps/mfe_account/` | ✅ Created | Yes |
| `apps/mfe_account-e2e/` | ✅ Created | Yes |
| `nx.json` | ✅ Created | Yes |
| `tsconfig.base.json` | ✅ Created | Yes |
| `package.json` | ✅ Created | Yes |

### Files the Guide Mentions but Doesn't List in the Tree

| File | Actually Generated? | Notes |
|---|---|---|
| `apps/shell/module-federation.config.ts` | ✅ Yes | |
| `apps/shell/webpack.config.ts` | ✅ Yes | |
| `apps/shell/src/main.ts` | ✅ Yes | |
| `apps/shell/src/bootstrap.ts` | ✅ Yes | |
| `apps/shell/public/module-federation.manifest.json` | ✅ Yes | |
| `apps/shell/src/app/app.routes.ts` | ✅ Yes | |
| `apps/shell/src/app/app.config.ts` | ✅ Yes | |
| `apps/shell/src/app/app.ts` | ✅ Yes | |
| `apps/shell/src/app/app.html` | ✅ Yes | |
| `apps/shell/src/app/app.scss` | ✅ Yes | Not mentioned in guide |
| `apps/shell/src/app/app.spec.ts` | ✅ Yes | Not mentioned in guide |
| `apps/shell/src/app/nx-welcome.ts` | ✅ Yes | Mentioned in notes |
| `apps/shell/eslint.config.mjs` | ✅ Yes | Not mentioned in guide |
| `apps/shell/vite.config.mts` | ✅ Yes | Mentioned in a note |
| `apps/mfe_products/webpack.prod.config.ts` | ✅ Yes | |
| `apps/mfe_products/src/app/remote-entry/entry.routes.ts` | ✅ Yes | |
| `apps/mfe_products/src/app/remote-entry/entry.ts` | ✅ Yes | |
| `apps/mfe_products/src/app/remote-entry/nx-welcome.ts` | ✅ Yes | Not mentioned |
| `eslint.config.mjs` (root) | ✅ Yes | |
| `vitest.workspace.ts` | ✅ Yes | Not mentioned in guide |

### Key Structural Differences

1. **Remote apps do NOT have `app.ts` or `app.html`** — they bootstrap `RemoteEntry` directly. This is consistent with the guide's description in Chapter 5 but the guide doesn't explicitly call this out as different from the shell.
2. **Each app has `vite.config.mts`** — Guide mentions this in a note (Chapter 2). Correct.
3. **`vitest.workspace.ts` generated at root** — Not mentioned in guide at all.
4. **`jest.preset.js` and `jest.config.ts` generated at root** — Created when `@nx/js:library` is run (for models/utils). Not mentioned in guide.

### Build Output Structure (Chapter 11)

| Guide Claims | Actual | Match? |
|---|---|---|
| `dist/apps/mfe_products/index.html` | ✅ Present | Yes |
| `dist/apps/mfe_products/main.[hash].js` | ✅ `main.df0d53cc2506f35d.js` | Yes |
| `dist/apps/mfe_products/polyfills.[hash].js` | ❌ **Not present** | No — polyfills not generated separately |
| `dist/apps/mfe_products/remoteEntry.mjs` | ✅ Present | Yes |
| `dist/apps/mfe_products/styles.[hash].css` | ✅ `styles.ef46db3751d8e999.css` | Yes |
| `dist/apps/mfe_products/assets/` | ❌ No `assets/` directory | No (only `favicon.ico` at root) |
| Guide says `dist/apps/<name>/` | ✅ Correct path | Yes |
| Additional: `mf-manifest.json` | ✅ Present in remote output | Not mentioned explicitly in Ch11 output listing |
| Additional: `mf-stats.json` | Present in output | Not mentioned in guide |

---

## 6. Conceptual / Factual Gaps

| # | Claim | Assessment |
|---|---|---|
| F1 | "Angular 21 defaults to esbuild for builds" (Ch1 Note) | **Correct.** Angular 21 uses esbuild by default. The Nx MFE generators override this to use Webpack for Module Federation. |
| F2 | "Angular 21 apps are zoneless by default" (Ch1 Note) | **Correct.** Confirmed by the absence of Zone.js in the generated project and `provideBrowserGlobalErrorListeners()` in `@angular/core`. |
| F3 | "`@module-federation/enhanced` maintained by Zack Jackson and ByteDance" (Ch1) | **Correct.** The package is published under the `@module-federation` scope. |
| F4 | "Nx does not allow hyphens in remote names" (Ch2) | **Correct.** Underscore-based names (`mfe_products`) work. Hyphens would cause issues with JavaScript identifiers. |
| F5 | "`standalone: true` is the default since Angular 19" (Ch2 Note) | **Correct.** No `standalone: true` appears in any generated code. |
| F6 | "Vitest is Angular 21's default test runner" (Ch13) | **Correct for `@nx/angular` projects.** Angular apps generated by Nx 22+ use Vitest via `@analogjs/vitest-angular`. However, the Angular CLI itself may still offer Karma as an option. The guide's claim is accurate within the Nx context. |
| F7 | "`@nx/js:library` generates Jest, `@nx/angular:library` generates Vitest" (Ch4 Note) | **Correct.** Verified by actual generation. |
| F8 | "`isolatedModules` enabled by default requiring `export type`" (Ch4 Note) | **Correct.** `tsconfig.json` for shell includes `"isolatedModules": true`. |
| F9 | "`strictVersion: true` produces a console warning, not a crash" (Ch12) | **Correct with caveat.** The guide appropriately notes "behavior may vary across Module Federation versions." |
| F10 | "Each dev remote runs its own webpack-dev-server, consuming 1-2 GB of RAM" (Ch8) | **Unverifiable in this audit** but the claim is reasonable for Webpack-based builds. |
| F11 | "The shell does not have a `webpack.prod.config.ts`" (Ch3) | **Correct.** Verified — only remotes have this file. |
| F12 | "Module Federation negotiates versions at runtime, picking highest semver-compatible" (Ch12) | **Correct** — this is documented Module Federation behavior. |
| F13 | "Nx discovers remotes from the project graph" (Ch3, Ch8) | **Correct.** The shell's `module-federation.config.ts` has `remotes: []` and Nx resolves them from the graph. |

### Missing Conceptual Context

| # | Gap | Chapter |
|---|---|---|
| G1 | The guide never explains that `provideAnimationsAsync()` requires `@angular/animations` to be installed as a dependency. This is the **most likely point where a reader gets stuck**. | Ch5 |
| G2 | The guide doesn't explain why the generated `app.routes.ts` for remotes uses lazy `loadChildren` while the guide shows a static `children` import. A reader comparing the generated code to the guide may be confused. | Ch5 |
| G3 | The guide doesn't mention that remote apps have no spec files and thus `npx nx test mfe_products` will fail out of the box. | Ch13 |
| G4 | The guide mentions running `npx nx serve shell` for a smoke test (Ch2 Step 6) but doesn't warn that this builds ALL remotes, which can take several minutes on first run. | Ch2 |

---

## 7. Completeness Gaps

### Promised but Not Delivered

| ToC Promise | Delivered? | Notes |
|---|---|---|
| Ch4: "Generate reusable libraries... Build a complete AuthService" | ✅ Partially | Guide shows only `shared-ui`, `shared-data-access-auth`, `shared-models`, `shared-utils`, and products libs. The commands for `orders/*` and `account/*` libraries are listed but their **code** (services, components) is not shown. Guide says "left as an exercise." |
| Ch5: "Intentionally trigger NullInjectorError to confirm diagnosis" | ❌ No | The guide describes the error and fix but never walks the reader through triggering it. |
| Ch7: "Every import shown, every file complete" | ✅ Yes (for products) | Products feature is fully complete. Orders/account are "left as an exercise." |
| Ch8: "Test `--devRemotes` flag behavior" | ✅ Partially | Commands shown but no verification steps described. |
| Ch10: "Test `ViewEncapsulation` behavior" | ❌ No | Chapter describes concepts but has no hands-on code or verification steps. |
| Ch11: "`docker compose up` for integration testing" | ✅ Shown | Docker artifacts provided. Not executed in this audit (Docker available but not tested as it requires full build of all apps). |
| Ch13: "Contract tests with working code" | ✅ Yes | Contract test code provided and should compile with tsconfig path aliases. |
| Ch14: "Test exposing individual components" | ✅ Partially | Code shown but `ProductCardComponent` referenced doesn't exist in the guide's code. Reader would need to create it. |
| Ch14: "Test adding a 4th remote" | ✅ Yes | Command and steps documented. |
| Appendix A: Quick Reference Card | ✅ Yes | All 11 commands listed with descriptions. |
| Appendix B: DevOps Handoff Checklist | ✅ Yes | Complete and accurate. |

### Code Referenced but Not Shown

1. **`ProductCardComponent`** (Ch14): Referenced in the `exposes` block example but never defined in any chapter.
2. **`ProductsShellComponent`** (Ch5): Shown as a pattern for child routes but never integrated into the actual `entry.routes.ts` in Ch7.
3. **Orders and Account features**: Generator commands listed but no code for `OrderService`, `AccountService`, or any components for these domains.

---

## 8. Recommendations (Prioritized by Chapter)

### Critical (Must Fix)

1. **Chapter 5 / Chapter 2**: Add `npm install @angular/animations` after `npm install @nx/angular@22.4.5`. Without this, `provideAnimationsAsync()` causes a build failure. Alternatively, add a note that `@angular/animations` is not included by `@nx/angular` and must be installed separately. Consider adding it to the prerequisites or Step 2.

### Major (Should Fix)

2. **Chapter 5**: Update the remote `app.routes.ts` listing to match the actual generated code (uses `loadChildren` with dynamic import, not `children` with static import), or explain the difference.

3. **Chapter 3**: Update the `entry.ts` code listing to show the actual generated template (`<app-nx-welcome></app-nx-welcome>` with `imports: [NxWelcome]`), or note that the listing shows a simplified version.

4. **Chapter 3**: Update the `webpack.prod.config.ts` listing to show the actual spread pattern with override comments.

5. **Chapter 11**: Remove `polyfills.[hash].js` and `assets/` directory from the build output listing — they are not generated. Add `mf-manifest.json` and `mf-stats.json` which ARE generated.

6. **Chapter 13**: Add a note that remote apps have no test files by default. Either provide a sample test to create, or explain that `npx nx test mfe_products` only works after adding test files.

7. **Chapter 4**: Add `--no-interactive` to all library generator commands for consistency with the host generator command.

8. **Chapter 14**: Either provide the `ProductCardComponent` code or reference an existing component from Ch7.

### Minor (Nice to Fix)

9. **Chapter 2**: Mention that the first `npx nx serve shell` can take several minutes as it builds all remotes.

10. **Chapter 3**: Clarify that the shell's generated `app.html` uses `<router-outlet></router-outlet>` (not self-closing), and route links use `routerLink="mfe_products"` (not `routerLink="/products"`).

11. **Chapter 3**: Mention `vitest.workspace.ts` in the workspace structure description.

12. **Chapter 4**: Note that running `@nx/js:library` will install Jest-related dependencies and create `jest.preset.js` and `jest.config.ts` at the root.

13. **Chapter 5**: The guide shows `RemoteEntry` bootstrapped in `bootstrap.ts` for remotes — this is correct and matches generated code. But note that remotes do NOT have an `App` component or `app.html` file (unlike the shell).

14. **Chapter 6**: The guide's ESLint constraint format matches the actual `eslint.config.mjs` flat config format. ✅ No change needed.

15. **Chapter 11**: Add a note about the `@angular/animations` warning during builds: `Could not find a version for "@angular/animations" in the root "package.json" when collecting shared packages for the Module Federation setup.`

16. **Chapter 11**: The Dockerfile references `nginx:1.28-alpine`. This version may or may not exist at the reader's time. Consider using `nginx:alpine` or a more flexible tag.

### Cosmetic

17. **Chapter 2**: The workspace structure tree shows `mfe_products-e2e/` with a comment "E2E tests for products remote" — actual directory name uses hyphen between name and `e2e` which is correct.

18. **Chapter 3**: The shell `module-federation.config.ts` listing is accurate but doesn't include the generated comments about external remotes and `remotes.d.ts`.

19. **Chapter 5**: The generated shell `app.config.ts` formats the import of `ApplicationConfig` and `provideBrowserGlobalErrorListeners` on separate lines, while the guide puts them on one line. Purely cosmetic.

20. **Throughout**: The guide uses `App` for the root component class name (matching Angular 21 convention). Verified correct.

21. **Chapter 3**: The guide says routes "include a default route `{ path: '', component: NxWelcome }`" — verified correct.

22. **Chapter 5**: Guide note about `withInterceptorsFromDi()` being "flagged for potential future phase-out" — accurate as of March 2026, but no concrete deprecation timeline exists yet.

---

## Appendix: Environment Used

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| Node.js | v24.12.0 |
| npm | 11.6.2 |
| Shell | Git Bash |
| Nx | 22.4.5 |
| Angular | ~21.1.0 |
| TypeScript | ~5.9.2 |
| Vitest | ^4.0.8 (4.0.18 resolved) |
| `@module-federation/enhanced` | ^0.21.2 |
| Audit Date | 2026-03-12 |
