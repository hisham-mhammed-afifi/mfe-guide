# MFE Guide Audit Report

**Audit Date:** 2026-03-11
**Guide Version:** files/ (current production)
**Stack Tested:** Nx 22.x, Angular 21.x, `@module-federation/enhanced`, Webpack
**Audit Workspace:** `d:\mfe-platform\`

---

## Executive Summary

The guide's architectural concepts are sound but the **code samples and file references are significantly out of date** with Nx 22 / Angular 21 generator output. There are **6 Critical**, **14 Major**, and **9 Minor** issues. The most severe: the guide uses hyphenated remote names (`mfe-products`) throughout all 15 chapters, but Nx 22 rejects hyphens in remote names entirely. This means every code sample, every CLI command, and every file path referencing `mfe-products` is wrong.

---

## Critical Issues

Issues that prevent a reader from following the guide successfully.

### C1: Hyphenated Remote Names Are Invalid in Nx 22

**Chapters Affected:** 2–15 (entire guide)
**Guide Says:** Use `--remotes=mfe-products,mfe-orders,mfe-account`
**Actual Behavior:** Nx 22 rejects hyphens:
```
Invalid remote name provided: mfe-products.
The name can only contain letters, digits, underscores, and dollar signs.
```
**Impact:** Every code sample, file path, import statement, route path, manifest key, Docker service name, CI command, and deployment script in the guide uses hyphenated names. Reader is blocked at Chapter 2 Step 3.
**Fix:** Replace `mfe-products` → `mfeProducts` (or `mfe_products`) throughout all chapters. This is a pervasive change affecting every file in the guide.

### C2: TypeScript Project References Error Not Mentioned

**Chapter Affected:** 2
**Guide Says:** Run the host generator command directly.
**Actual Behavior:** The `@nx/angular:host` generator fails with:
```
The "@nx/angular:host" generator doesn't support the existing TypeScript setup.
```
Must set `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` as an environment variable.
**Impact:** Reader is blocked at workspace generation with no guidance.
**Fix:** Add an environment variable or `--no-interactive` note to Chapter 2 Step 3. Explain the TypeScript project references issue.

### C3: Manifest Location Is Wrong

**Chapters Affected:** 3, 11, 14, Appendix B
**Guide Says:** Manifest at `apps/shell/src/assets/module-federation.manifest.json`
**Actual Location:** `apps/shell/public/module-federation.manifest.json`
**Impact:** The guide's `main.ts` code fetches `'/assets/module-federation.manifest.json'`. The actual generated code fetches `'/module-federation.manifest.json'` (served from `public/` at the root). All deployment scripts, Docker entrypoint scripts, CI manifest injection steps, and the DevOps handoff checklist reference the wrong path.
**Fix:** Update all references from `src/assets/` to `public/` and from `/assets/module-federation.manifest.json` to `/module-federation.manifest.json`.

### C4: Manifest Values Point to `mf-manifest.json`, Not Base URLs

**Chapters Affected:** 3, 11, 14, Appendix B
**Guide Says:** Manifest values are base URLs (e.g., `"http://localhost:4201"`). `main.ts` appends `/remoteEntry.js`.
**Actual Generated Manifest:**
```json
{
  "mfeProducts": "http://localhost:4201/mf-manifest.json",
  "mfeOrders": "http://localhost:4202/mf-manifest.json",
  "mfeAccount": "http://localhost:4203/mf-manifest.json"
}
```
**Impact:** The guide's `main.ts` code manually constructs `${url}/remoteEntry.js`. The actual code uses the manifest values directly as entry points (they already include `/mf-manifest.json`). The guide's explanation of `remoteEntry.js` as the federation entry file may be outdated — Nx 22 uses `mf-manifest.json` instead. All production manifest examples, deployment scripts, and cache-busting rules reference `remoteEntry.js` which may not be the correct file to cache-bust.
**Fix:** Update manifest format documentation, `main.ts` code, deployment scripts, and caching rules to reflect `mf-manifest.json` as the federation entry point.

### C5: `main.ts` Code Is Significantly Different

**Chapter Affected:** 3
**Guide Shows (complex version):**
```typescript
fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((manifest: Record<string, string>) => {
    const remotes = Object.entries(manifest).map(([name, url]) => ({
      name,
      entry: `${url}/remoteEntry.js`,
    }));
    registerRemotes(remotes);
  })
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```
**Actual Generated Code:**
```typescript
fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
  )
  .then((remotes) => registerRemotes(remotes))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```
**Differences:** (1) Fetch path is `/module-federation.manifest.json` not `/assets/...`, (2) manifest values are used directly as `entry` (no `/remoteEntry.js` append), (3) the code structure is slightly different.
**Fix:** Replace the guide's `main.ts` code with the actual generated version.

### C6: Shell `module-federation.config.ts` Has Empty Remotes Array

**Chapter Affected:** 3
**Guide Says:** `remotes: ['mfe-products', 'mfe-orders', 'mfe-account']` and states "Keeping the remote names here is correct and necessary for the dev server to work properly."
**Actual Generated Code:** `remotes: []` (empty array)
**Impact:** The guide's explanation of the `remotes` array's dual purpose (dev server discovery + runtime) is directly contradicted by the generator output. Readers who try to match the guide's code to their generated code will be confused.
**Fix:** Update to show the empty array and explain how Nx discovers remotes in the current version.

---

## Major Issues

Incorrect details that don't block the reader but cause confusion or broken code if copied.

### M1: Entry Component Filename and Class Name

**Chapter Affected:** 3, 5, 7
**Guide Says:** File is `entry.component.ts`, class is `RemoteEntryComponent`
**Actual:** File is `entry.ts`, class is `RemoteEntry`
**Fix:** Update all references. Also update the import in `entry.routes.ts` from `import { RemoteEntryComponent } from './entry.component'` to `import { RemoteEntry } from './entry'`.

### M2: App Component Filename and Class Name

**Chapter Affected:** 5
**Guide Says:** `app.component.ts`, class `AppComponent`
**Actual:** `app.ts`, class `App`
**Fix:** Update `bootstrap.ts` code from `import { AppComponent } from './app/app.component'` to `import { App } from './app/app'`.

### M3: App Component Uses Separate Template File

**Chapter Affected:** 5
**Guide Says:** Inline template in `app.component.ts` with `template: \`...\``
**Actual:** Uses `templateUrl: './app.html'` with a separate `app.html` file.
**Fix:** Show the `app.html` approach or note that inline vs. external templates vary by generator version.

### M4: Shell `app.config.ts` Missing Providers

**Chapter Affected:** 5
**Guide Shows:**
```typescript
providers: [
  provideRouter(appRoutes, withComponentInputBinding()),
  provideHttpClient(withInterceptorsFromDi()),
  provideAnimationsAsync(),
]
```
**Actual Generated Code:**
```typescript
providers: [provideBrowserGlobalErrorListeners(), provideRouter(appRoutes)]
```
**Impact:** The guide presents its version as "what the generator creates" but actually it's showing what you should *manually add*. The `provideBrowserGlobalErrorListeners()` provider (new in Angular 21) is present in generated code but never mentioned in the guide.
**Fix:** Show the actual generated code first, then explain what to add (HttpClient, animations) and why. Mention `provideBrowserGlobalErrorListeners()`.

### M5: Remote `bootstrap.ts` Imports `RemoteEntry`, Not `AppComponent`

**Chapter Affected:** 5
**Guide Says:** Remote bootstrap imports `AppComponent`
**Actual:** Remote `bootstrap.ts` imports `RemoteEntry` from `./app/remote-entry/entry`:
```typescript
import { RemoteEntry } from './app/remote-entry/entry';
bootstrapApplication(RemoteEntry, appConfig).catch((err) => console.error(err));
```
**Fix:** Update the remote bootstrap code sample.

### M6: `webpack.config.ts` Has `{ dts: false }` Second Argument

**Chapter Affected:** 3
**Guide Shows:** `export default withModuleFederation(config);`
**Actual:** `export default withModuleFederation(config, { dts: false });`
**Fix:** Update the code sample and explain the DTS plugin.

### M7: ESLint Config Extension

**Chapter Affected:** 6
**Guide Says:** `eslint.config.js`
**Actual:** `eslint.config.mjs` (ES module extension)
**Fix:** Update the filename reference.

### M8: Route Paths Use camelCase, Not Kebab-Case

**Chapters Affected:** 3, 5, 7, 8, 14
**Guide Shows:** `path: 'mfe-products'`, navigation to `/mfe-products`
**Actual:** `path: 'mfeProducts'`, navigation to `/mfeProducts`
**Impact:** Follows from C1 (no hyphens in remote names). All route paths, navigation links, and URL examples need updating.
**Fix:** Update all route paths and URL examples to use camelCase (or show how to customize paths).

### M9: `loadRemote` String Uses camelCase Remote Names

**Chapter Affected:** 3
**Guide Shows:** `loadRemote<typeof import('mfe-products/Routes')>('mfe-products/Routes')`
**Actual:** `loadRemote<typeof import('mfeProducts/Routes')>('mfeProducts/Routes')`
**Fix:** Update all `loadRemote` call examples.

### M10: Shell Has No `webpack.prod.config.ts`

**Chapter Affected:** 3
**Guide Says:** "The generator also creates a `webpack.prod.config.ts` for production builds"
**Actual:** Only remotes get `webpack.prod.config.ts`. The shell does not have one.
**Fix:** Clarify that only remotes get a prod webpack config.

### M11: Docker/Deployment Scripts Use Wrong App Names

**Chapter Affected:** 11, Appendix B
**Guide Shows:** `APP_NAME: mfe-products`, `npx nx build mfe-products`, S3 bucket `mfe-mfe-products-prod`
**Actual:** App names are `mfeProducts`, `mfeOrders`, `mfeAccount`
**Fix:** Update all deployment commands, docker-compose service names, and CI matrix values.

### M12: Deployment Scripts Reference Wrong Manifest Path

**Chapter Affected:** 11
**Guide Shows:**
```bash
cat > dist/apps/shell/browser/assets/module-federation.manifest.json
```
**Actual Path:** Since the manifest is in `public/`, the build output path is:
```bash
dist/apps/shell/browser/module-federation.manifest.json
```
(No `assets/` subdirectory)
**Fix:** Update all deployment and CI scripts.

### M13: Contract Test Path Aliases Use Wrong Names

**Chapter Affected:** 13
**Guide Shows:**
```json
"@mfe-platform/mfe-products/entry": ["apps/mfe-products/src/app/remote-entry/entry.routes.ts"]
```
**Actual:** Should use `mfeProducts` and point to the correct directory:
```json
"@mfe-platform/mfeProducts/entry": ["apps/mfeProducts/src/app/remote-entry/entry.routes.ts"]
```
**Fix:** Update all path aliases in contract testing section.

### M14: `--devRemotes` Flag Uses Wrong Names

**Chapter Affected:** 8
**Guide Shows:** `npx nx serve shell --devRemotes=mfe-products`
**Actual:** `npx nx serve shell --devRemotes=mfeProducts`
**Fix:** Update all `--devRemotes` examples.

---

## Minor Issues

Cosmetic issues or minor inaccuracies that don't impact functionality.

### m1: `--no-interactive` Flag Not Mentioned

**Chapter Affected:** 2
The guide doesn't mention `--no-interactive`. Without it, generators may prompt for additional options.

### m2: Component Selector Prefix

**Chapter Affected:** 3
Guide shows `selector: 'products-entry'`. Actual: `selector: 'app-mfeProducts-entry'`.

### m3: Shell Uses `RouterModule` Instead of Individual Imports

**Chapter Affected:** 5
Guide shows `imports: [RouterOutlet, RouterLink]`. Actual: `imports: [NxWelcome, RouterModule]`.

### m4: NxWelcome Component Not Mentioned

Generated code includes `NxWelcome` component in both host and remote entry components. Not mentioned in guide. Should note its existence and that it will be removed.

### m5: `vite.config.mts` Generated But Not Mentioned

Vitest configuration file `vite.config.mts` is generated for each app. Not documented.

### m6: `--nxCloud=skip` Still Shows Cloud Setup Message

**Chapter Affected:** 2
Guide says `--nxCloud=skip` skips Nx Cloud setup. The actual output still shows "Nx Cloud has been set up successfully". Minor discrepancy in expected console output.

### m7: `standalone: true` Explanation Slightly Misleading

**Chapter Affected:** 2
Guide says "you will not see `standalone: true`" — correct, but the generated code also doesn't show `standalone: false` or any standalone flag at all. The guide's Note is accurate but could be clearer.

### m8: Workspace Preset Creates `packages/` Not `apps/`

**Chapter Affected:** 2
The `--preset=apps` creates a workspace with `packages/` directory, not `apps/`. The `apps/` directory is created by the host generator. Minor but could confuse readers checking structure before Step 3.

### m9: `remoteEntry.js` vs `mf-manifest.json` Caching Rules

**Chapter Affected:** 11
All caching rules, nginx config, and CloudFront behaviors reference `remoteEntry.js`. If `mf-manifest.json` is now the primary federation entry, the caching advice may need updating (or may need to cover both files).

---

## Verified Correct Items

These guide claims match the actual generated output:

| Item | Chapter | Status |
|---|---|---|
| `ModuleFederationConfig` type from `@nx/module-federation` | 3 | ✅ Correct |
| `withModuleFederation` from `@nx/module-federation/angular` | 3 | ✅ Correct |
| `loadRemote` from `@module-federation/enhanced/runtime` | 3 | ✅ Correct |
| `registerRemotes` from `@module-federation/enhanced/runtime` | 3 | ✅ Correct |
| `main.ts` / `bootstrap.ts` split pattern | 3 | ✅ Correct |
| Port assignments: shell=4200, remote1=4201, remote2=4202, remote3=4203 | 2 | ✅ Correct |
| Vitest as default test runner (`@nx/vitest:test` executor) | 13 | ✅ Correct |
| `exposes: { './Routes': '...' }` pattern | 3 | ✅ Correct |
| `remoteRoutes` export name in `entry.routes.ts` | 3 | ✅ Correct |
| Separate `entry.routes.ts` in `remote-entry/` directory | 3 | ✅ Correct |
| `--dynamic` flag creates manifest-based federation | 2 | ✅ Correct |
| `--style=scss` generates SCSS files | 2 | ✅ Correct |
| `--prefix=app` sets the component selector prefix | 2 | ✅ Correct |
| Shell uses `@nx/angular:module-federation-dev-server` executor | n/a | ✅ Correct |
| Remote serve executor is `@nx/angular:dev-server` | n/a | ✅ Correct |
| `webpack.config.ts` exists for both host and remotes | 3 | ✅ Correct |
| Remote `module-federation.config.ts` has `exposes` block | 3 | ✅ Correct |
| `bootstrap.ts` calls `bootstrapApplication()` | 3 | ✅ Correct |
| SCSS as default style format when specified | 2 | ✅ Correct |
| Each app has its own `tsconfig.app.json`, `tsconfig.json`, `tsconfig.spec.json` | n/a | ✅ Correct |
| Remote has `webpack.prod.config.ts` for production overrides | 3 | ✅ Correct |
| Architectural concepts (singleton sharing, DI, provider hierarchy) | 4-5 | ✅ Correct |
| Module boundary concepts (scope + type tags) | 6 | ✅ Correct |

---

## Recommendations

### Priority 1: Fix Remote Naming (Blocks Everything)

1. Change all remote names from `mfe-products` to `mfeProducts` (or `mfe_products`) throughout all chapters.
2. This is a find-and-replace across all 7 files affecting: CLI commands, file paths, import statements, route paths, manifest keys, Docker service names, CI configs, deployment scripts, and narrative text.
3. Consider adding a note explaining that Nx 22 doesn't allow hyphens in remote names and suggesting a naming convention.

### Priority 2: Fix File Names and Code Samples

1. Update `entry.component.ts` → `entry.ts`, `RemoteEntryComponent` → `RemoteEntry`
2. Update `app.component.ts` → `app.ts`, `AppComponent` → `App`
3. Update manifest location from `src/assets/` to `public/`
4. Update `main.ts` code to match actual generated output
5. Update `webpack.config.ts` to include `{ dts: false }`
6. Add `provideBrowserGlobalErrorListeners()` to app.config.ts examples

### Priority 3: Fix Deployment Artifacts

1. Update all deployment scripts for correct manifest path (`/module-federation.manifest.json` not `/assets/...`)
2. Update caching rules to cover `mf-manifest.json` in addition to or instead of `remoteEntry.js`
3. Update docker-compose service names and CI matrix values

### Priority 4: Add Missing Information

1. Add a prerequisite note about `NX_IGNORE_UNSUPPORTED_TS_SETUP=true`
2. Mention `--no-interactive` flag for non-interactive generator execution
3. Document the `provideBrowserGlobalErrorListeners()` provider
4. Mention `vite.config.mts` in the generated file list
5. Note that ESLint config uses `.mjs` extension

---

## Summary Statistics

| Severity | Count |
|---|---|
| Critical | 6 |
| Major | 14 |
| Minor | 9 |
| Verified Correct | 23 |
| **Total Issues** | **29** |

The guide's **conceptual content is excellent** — the explanations of Module Federation, Dynamic Federation, provider hierarchy, module boundaries, and deployment patterns are accurate and well-written. The **code samples and file references need a comprehensive update** to match Nx 22 / Angular 21 generator output.
