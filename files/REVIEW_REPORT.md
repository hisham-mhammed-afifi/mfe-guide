# Documentation Review Report

**Date:** 2026-03-13
**Reviewed files:**
- `files/00-table-of-contents.md`
- `files/01-foundations-and-setup.md`
- `files/02-configuration-libraries-providers-boundaries.md`
- `files/03-features-workflow-communication-styles.md`
- `files/04-deployment-versions-testing.md`
- `files/05-advanced-and-best-practices.md`

---

## Role 1: Technical Accuracy

### Critical (would cause errors if reader follows the guide)

1. **GitHub Actions versions do not exist (`04`, CI/CD pipeline)**
   `actions/checkout@v6` and `actions/setup-node@v6` are used in the sample GitHub Actions workflow. As of early 2026, the latest published versions for both are `v4`. Referencing a non-existent tag causes the CI run to fail immediately with a "version not found" error. Fix: change both to `@v4`.

2. **Contradiction: how `nx serve shell` discovers remotes (`02` Chapter 3 vs. `03` Chapter 8)**
   Chapter 3 states explicitly: "The `remotes` array is empty by default. Nx discovers which remotes belong to this host by reading the `--host` relationships set during generation." The final "What just happened?" bullet in Chapter 3 then says: "Learned that the `remotes` array in config is for dev server, while the manifest is for runtime" — which partially contradicts the body. Chapter 8 escalates the contradiction: "Nx reads the `remotes` array in the shell's `module-federation.config.ts` to discover which remote projects exist." These three statements cannot all be true. With dynamic federation and the `apps` preset, the `remotes` array in `module-federation.config.ts` is indeed empty; Nx uses the project graph (derived from the `--host` flag set during generation and stored in `project.json` implicit dependencies) to determine which remotes to start alongside the shell. Fix: remove the incorrect Chapter 8 claim; keep Chapter 3's project-graph explanation and delete the "for dev server" summary bullet, which is not accurate for dynamic federation.

3. **`ProductsShellComponent` promised in Chapter 5, absent in Chapter 7 (`02`, `03`)**
   Chapter 5 introduces `ProductsShellComponent` (a shell component with `<router-outlet />` for remote child routes) and explicitly says: "This pattern is used when the remote has multiple routes (e.g., product list and product detail). We wire it up fully in Chapter 7." Chapter 7 Step 6 then provides `entry.routes.ts` with both `''` and `':id'` routes loaded directly using `loadComponent` — no parent `ProductsShellComponent` in sight. The routes work without it (they render as siblings in the shell's outlet), but the promised wiring never happens. This is a broken cross-reference and leaves the reader with an unused component file and no explanation of when `ProductsShellComponent` is actually needed. Fix: either remove `ProductsShellComponent` from Chapter 5 and rewrite the note to explain when a nested outlet is needed, or update Chapter 7 to include it as a named parent route wrapping the two child routes, which is the more common real-world pattern.

4. **NG0203 root cause misstated in Chapter 15 Pitfall 14 (`05`)**
   The pitfall explanation reads: "Module Federation can load multiple Angular instances — one in the shell and one in the remote. `toSignal()` checks the injection context of its own Angular instance, which is never activated for the remote's components." With Nx's default configuration, Angular core packages are configured as `singleton: true`, so there is only one Angular instance. The real cause of NG0203 in MFE remotes is that `toSignal()` (and other `rxjs-interop` helpers) must be called inside an active injection context (i.e., inside the constructor or a class field initializer that runs during injection), and the remote's lazy-loaded component may be instantiated in a context where the effect-tracking infrastructure is not correctly set up — particularly when the component is created outside the root injector's initialization flow. Attributing the error to "multiple Angular instances" will mislead readers who check the Network tab, see only one `@angular/core` chunk (correct), and conclude the explanation is wrong, abandoning the fix. The prescribed fix (`signal()` + `ngOnInit`) is correct; only the explanation of why it happens is wrong. The same misstatement appears in the Chapter 7 MFE Gotcha callout. Fix: replace the multiple-instance explanation with: "`toSignal()` registers a cleanup effect that requires an active injection context at the time of call. In a Module Federation remote, the injection context may not be correctly active when the component class is being evaluated, so the call fails. Moving the subscription into `ngOnInit` — which runs after the component is fully attached to the injector — avoids the problem."

5. **TypeScript virtual module types for `typeof import('mfe_products/Routes')` not explained (`02` Chapter 3)**
   The `app.routes.ts` in Chapter 3 uses `loadRemote<typeof import('mfe_products/Routes')>('mfe_products/Routes')`. TypeScript cannot resolve the virtual module path `'mfe_products/Routes'` without either: (a) the Module Federation TypeScript plugin generating `.d.ts` files during a prior build, or (b) a manual type declaration file. Without a prior build, a reader who copy-pastes this route file will get `TS2307: Cannot find module 'mfe_products/Routes' or its corresponding type declarations`. The guide says this is a "type-only import" and "TypeScript resolves it using declaration files (`.d.ts`) generated by Module Federation," but never tells the reader where those files are generated, when they are generated, or what to do before the first build when they do not exist yet (e.g., use `// @ts-ignore`, run a build first, or add a `globals.d.ts`). Fix: add a note explaining that the `.d.ts` files are generated by `withModuleFederation` during the first build. Until then, TypeScript will complain. The simplest workaround during development is to type the generic explicitly as `{ remoteRoutes: Route[] }` instead of `typeof import(...)`.

---

### Major (technically wrong or misleading but may not block the reader)

1. **`@nx/js:library` uses Jest by default — may not hold in Nx 22 (`02` Chapter 4)**
   The guide states: "Running `@nx/js:library` for the first time will also install Jest-related dependencies and create `jest.preset.js` and `jest.config.ts` at the workspace root." In Nx 22, `@nx/js:library` may generate Vitest configuration depending on workspace defaults and the `preset` used. Explicitly adding `--unitTestRunner=jest` or `--unitTestRunner=vitest` to the command is the reliable approach. The note should either verify the behavior and add the explicit flag, or acknowledge that the test runner may vary.

2. **`@module-federation/enhanced` listed at version `0.x` in the technology table (`00`)**
   The version table shows `@module-federation/enhanced | 0.x`. This package is actively developed by Zack Jackson and ByteDance. By March 2026, the package is well past `0.x` (it reached `0.6.x` in 2024 and was tracking toward `1.x` rapidly). Listing `0.x` implies to readers that the package is pre-release or unstable, which may deter production use. Fix: update to the actual version shipped with Nx 22.4.5.

3. **`withInterceptorsFromDi()` marked as "flagged for potential future phase-out" without basis (`02` Chapter 5)**
   The note reads: "Angular's documentation flags `withInterceptorsFromDi()` for potential future phase-out in favor of `withInterceptors()` with functional interceptors." No Angular release notes or official documentation flags this API for deprecation. The note creates unnecessary doubt about a stable API and may cause readers to avoid it or spend time researching a non-issue. Fix: change the note to: "`withInterceptors()` with functional interceptors is the forward-looking pattern Angular recommends for new code, but `withInterceptorsFromDi()` is not deprecated and continues to work."

4. **`RemoteUnavailableComponent` improved retry example injects `router` without declaring it (`05` Chapter 14)**
   The "more robust production pattern" tip block shows:
   ```typescript
   retry(): void {
     const url = this.router.url;
     this.router.navigateByUrl(...)
   ```
   But `this.router` does not exist in the class as shown — no `private readonly router = inject(Router)` field and no `Router` import. Readers who copy this pattern get `Property 'router' does not exist on type 'RemoteUnavailableComponent'`. Fix: add the field declaration and `import { Router } from '@angular/router'` to the tip block.

5. **Pitfall 10 solution recommends Rspack to solve a Webpack-required problem (`05` Chapter 15)**
   Pitfall 10 is "Webpack required but esbuild is default" with solution: "use `@nx/angular:convert-to-rspack` or reconfigure." Rspack is not Webpack; it is a different (Rust-based) bundler. Converting to Rspack does not solve the stated problem of needing Webpack for Module Federation — Rspack has its own Module Federation support via `@module-federation/enhanced`. The solution line should be: "The `@nx/angular:host` generator automatically configures Webpack. This pitfall only applies if you created the app using `ng new` or a non-MFE generator. In that case, regenerate using `@nx/angular:host` or manually configure Webpack as the executor in `project.json`."

6. **`@nx/module-federation` is never installed explicitly, yet Nx 22 ships it separately (`02` Chapter 2, Chapter 3)**
   Chapter 2 says "You do not need to install `@module-federation/enhanced` or any Webpack packages separately." Chapter 3 imports `withModuleFederation` from `@nx/module-federation/angular`. In Nx 22, `@nx/module-federation` is a separate package (a peer dependency of `@nx/angular`) and may or may not be automatically installed depending on npm's hoisting behavior. The guide should state explicitly that `npm install @nx/angular@22.4.5` will also install `@nx/module-federation` and `@module-federation/enhanced` as dependencies, or add an explicit `npm install @nx/module-federation@22.4.5` step.

---

### Minor (imprecise but not harmful)

1. **`import { tap } from 'rxjs/operators'` is legacy style (`02` Chapter 4)**
   The `AuthService` uses `import { tap } from 'rxjs/operators'`. Since RxJS 7, operators are importable directly from `'rxjs'`. The `/operators` sub-path still works (it re-exports from the root) but the canonical modern style is `import { tap } from 'rxjs'`. Same applies to `map` in `product.service.ts`. Not harmful, but inconsistent with the "modern Angular" framing.

2. **Custom event listener has no `removeEventListener` — memory leak (`03` Chapter 9)**
   The Pattern 3 example adds a `window.addEventListener('cart:add', ...)` handler with no corresponding cleanup. Readers who follow this in an Angular component will introduce a memory leak. The example should show the handler stored in a variable and removed in `ngOnDestroy`.

3. **`vitest.workspace.ts` extension may be `.mts` in Nx 22 (`01` Chapter 2 workspace layout)**
   The workspace structure diagram shows `vitest.workspace.ts`. Nx 22 generates this file as `vitest.workspace.mts` (ESM TypeScript). This is a minor discrepancy but would confuse readers who cannot find the listed file.

4. **`standalone: true` note says "since Angular 19" but Chapter 3 note says "since Angular 19" and guide header says Angular 21 (`01`, `02`)**
   Chapter 3's `entry.ts` comment says: "No `standalone: true` needed: it is the default since Angular 19." The TOC technology table says the guide targets Angular 21. The statement is accurate (Angular 19 made standalone the default), but the two different version references in close proximity create minor confusion for readers trying to map features to versions.

5. **`nx.json` never shown despite Chapter 3 claiming to walk through "every file the generator created" (`02` Chapter 3)**
   The opening sentence of Chapter 3 is "The generator created dozens of files across four applications. Let's examine the important ones." This is a reasonable scope limitation. However, `nx.json` is a significant workspace-level file that controls caching, task pipelines, and defaults, and it is mentioned by name in the workspace layout diagram in Chapter 2. Its absence in Chapter 3 is not a critical gap but worth a forward reference.

---

## Role 2: Developer Experience

### Blockers (reader would get stuck)

1. **No troubleshooting guidance for a failing smoke test (`01` Chapter 2, Step 6)**
   The guide says "Navigate to `http://localhost:4200`. You should see the Nx welcome page with links for each remote." Then immediately: "If it works, the foundation is solid." There is no "if it doesn't work" guidance. For a reader on Windows (the target platform, since the guide uses `\` continuation characters and has Windows notes), port conflicts, firewall rules, or PATH issues with Node.js are common. The first time `nx serve shell` fails with no guidance is a complete blocker for a beginner. Fix: add a short "If you see an error" section with the three most common failure modes: (a) port already in use → kill the process on 4200-4203, (b) Webpack build error → check Node.js version with `node -v`, (c) blank page on a remote link → CORS or manifest URL mismatch.

2. **`project.json` tag editing shown as pseudocode, not actual JSON (`02` Chapter 6)**
   The instruction reads:
   ```
   // apps/shell/project.json  -> "tags": ["scope:shell", "type:app"]
   ```
   This is a comment, not code. A beginner opening `apps/shell/project.json` for the first time will not know where in the file to add the tags key, what the surrounding JSON structure looks like, or whether `"tags"` already exists. Fix: show at minimum one complete `project.json` snippet with the `"tags"` key in context of the surrounding object structure (e.g., alongside `"name"` and `"targets"`).

3. **Chapter 5 introduces `ProductsShellComponent` but Chapter 7 never uses it — reader is left with dead code (`02`, `03`)**
   (Also flagged under Technical Accuracy.) After Chapter 5, the reader creates `products-shell.component.ts`. After Chapter 7, `entry.routes.ts` does not reference it, and the guide says "You can safely delete that file" about `entry.ts` but says nothing about `ProductsShellComponent`. A reader who followed Chapter 5 literally now has an unused component file, no explanation of whether to delete it, and routing that works differently from what was described. This is a blocker because the reader does not know if their setup is correct.

4. **The `eslint.config.mjs` edit in Chapter 6 gives no anchor for where to find the existing rule (`02` Chapter 6)**
   The guide says: "Open `eslint.config.mjs` at the workspace root. Find the existing `@nx/enforce-module-boundaries` rule (it will have an empty `depConstraints` array)." The generated `eslint.config.mjs` in Nx 22 is a flat-config array with multiple config objects spread across 50-100 lines. A beginner has never seen this file. There is no description of which object in the array contains the rule, no line number, no surrounding context. Fix: show a trimmed version of the relevant section of the generated file with the `@nx/enforce-module-boundaries` rule visible, then show what to replace.

5. **No explanation of how TypeScript resolves virtual module paths before the first build (`02` Chapter 3)**
   (Also flagged under Technical Accuracy.) A reader who copies the `app.routes.ts` and tries to run TypeScript checking or IDE navigation before ever running `nx build` will see red squiggles on `typeof import('mfe_products/Routes')`. There is no instruction to run the build first, no mention of a `globals.d.ts` workaround, and no preparation for this. Fix: add a note immediately after the route file code block explaining the pre-build TypeScript error and the simplest workaround.

---

### Friction (reader would be confused but could figure it out)

1. **The `app.config.ts` for remotes: create or edit? (`02` Chapter 5)**
   Chapter 5 shows the complete contents of `apps/mfe_products/src/app/app.config.ts` as a code block, prefaced with "Each remote has its own `app.config.ts`." It never states whether this file was generated by the Nx generator (it was) or whether the reader needs to create it. The phrase "Mirror the shell's providers for standalone development" implies editing an existing file, but a reader who searches for "replace its contents" (used in the shell section) or "create" (used in Chapter 4) will find no clear instruction. Fix: begin with "Open the generated `apps/mfe_products/src/app/app.config.ts` and replace its contents with:"

2. **Library barrel file: created or pre-existing? (`02` Chapter 4)**
   The guide shows `libs/shared/models/src/index.ts` as a code block for the public API. Nx generators create this file automatically but with a default export (usually `export * from './lib/...'` or empty). The guide says nothing about whether the reader is creating this file from scratch or editing the generated one. The same issue applies to `libs/shared/data-access-auth/src/index.ts`. Fix: precede each barrel file block with "Open the generated `src/index.ts` and replace its contents with:" or "Add the following export to `src/index.ts`:"

3. **What does the generated `app.config.ts` in the shell look like before editing? (`02` Chapter 5)**
   The section says "Open `apps/shell/src/app/app.config.ts` and replace its contents." A reader who wants to understand what they're replacing (and verify their file is in the expected state) has no reference. The guide never shows the pre-edit generated file. Fix: add a small "Before" block showing the two lines the generator produces, then the "After" block, so the reader can confirm they have the right file.

4. **Mixed test runners (Jest and Vitest) in the same workspace are introduced but never reconciled (`02` Chapter 4, `04` Chapter 13)**
   Chapter 4 notes that `@nx/js:library` generates Jest configuration while `@nx/angular:library` generates Vitest. Chapter 13's testing coverage only addresses Vitest. The reader is left wondering: how do I run Jest tests for `shared-models` and `shared-utils`? Does `npx nx affected -t test` handle both runners? What does the output look like when mixing runners? Fix: add a paragraph in Chapter 13 or Chapter 4 explaining that `npx nx affected -t test` runs each project with its own configured runner, and that Jest test results look different from Vitest results. Optionally show how to configure `@nx/js:library` to use Vitest with `--unitTestRunner=vitest`.

5. **The `vitest.workspace.ts` file is listed in the workspace layout but never explained (`01` Chapter 2, `04` Chapter 13)**
   The workspace structure in Chapter 2 lists `vitest.workspace.ts` as "Vitest workspace configuration (auto-generated)." Chapter 13 discusses `vite.config.mts` per project but never returns to `vitest.workspace.ts`. A reader curious about Vitest's workspace mode, or one who encounters a test infrastructure error, has no guidance. Fix: add a brief explanation in Chapter 13 noting that `vitest.workspace.ts` aggregates all per-project `vite.config.mts` files and is managed by Nx — readers should not edit it manually.

6. **No output shown for `npx nx graph` in Chapter 4 (`02` Chapter 4)**
   The guide says "verify they appear in the project graph" and "Confirm you see all 10 libraries." But no screenshot or description of what the graph looks like is given. For a reader who has never opened a browser-based Nx graph, knowing that it opens a browser tab and what UI to look for would help. Fix: add one sentence: "A new browser tab opens showing a node-and-edge diagram. Each library appears as a named node. If a node is missing, check the generator command for typos."

7. **Chapter 11's `entrypoint.sh` is listed in the workspace layout but the `docker-compose.yml` does not use it (`04` Chapter 11)**
   The workspace layout after Docker setup shows `docker/entrypoint.sh`. The docker-compose file shown does not use an `entrypoint` key. A reader who sets up Docker locally will copy the compose file and wonder why the entrypoint is never invoked. Fix: add a note in the workspace layout or the entrypoint section: "The `docker-compose.yml` in this guide does not use `entrypoint.sh`. The shell's dev manifest is already in the build output. The entrypoint script is only for production container deployments (ECS/EKS) where environment variables inject the manifest at startup."

---

### Suggestions (nice-to-have improvements)

1. **Chapter 2 Step 1: what does an empty `apps` preset workspace contain?**
   After `create-nx-workspace` completes, show the generated root files (`nx.json`, `tsconfig.base.json`, `package.json`, `.gitignore`). A reader unfamiliar with Nx may wonder if something went wrong when they see almost nothing in the folder.

2. **Chapter 4: show the generated library structure before writing code**
   After the 10 `nx g` commands, show what a generated library directory looks like (`src/lib/`, `src/index.ts`, `project.json`, `tsconfig.lib.json`) so the reader knows where to place the files they are about to create.

3. **Chapter 7 Step 7: note that clicking a product link in standalone mode navigates to `/:id`**
   The reader navigates to `http://localhost:4201` and sees the product list. Clicking a product navigates to `http://localhost:4201/1`. Confirming this works (and what "detail page" looks like) makes the step feel complete.

4. **Chapter 9 Pattern 3: show `removeEventListener` in a `ngOnDestroy` block**
   The custom events example is clearly intended as illustrative, but showing the cleanup prevents the pattern from being copy-pasted into production code with a memory leak.

5. **Chapter 13 contract tests: clarify the tsconfig edit is additive**
   "add to `paths`" assumes `paths` already exists in `tsconfig.base.json`. The generator-created file does have `paths`, but confirming this and showing the surrounding context removes ambiguity.

---

## Role 3: Consistency & Completeness

### Contradictions

1. **How Nx discovers remotes: project graph vs. remotes array (files `02`, `03`)**
   Chapter 3 (shell `module-federation.config.ts` section): "The `remotes` array is empty by default. Nx discovers which remotes belong to this host by reading the `--host` relationships set during generation."
   Chapter 3 ("What just happened?" bullet): "Learned that the `remotes` array in config is for dev server, while the manifest is for runtime."
   Chapter 8 (first paragraph): "Nx reads the `remotes` array in the shell's `module-federation.config.ts` to discover which remote projects exist."
   Three different explanations, two of which contradict the first. Resolution: the body of Chapter 3 is the most accurate. The summary bullet and the Chapter 8 statement are wrong for a dynamic federation setup and should be corrected.

2. **Module-level signals: singleton guarantee vs. fragility warning (file `03` Chapter 9)**
   The Pattern 2 warning says: "Module-level signals are shared across microfrontends **only because** Module Federation resolves this library as a singleton. If someone changes the sharing config (removes `singleton: true` for this library), each MFE gets its own copy." But Chapter 4 says Nx configures all workspace libraries as shared singletons automatically and states "You never manually configure shared dependencies." These two claims together imply the Module Federation config cannot easily be changed to remove singleton behavior — yet the warning implies it can. Resolution: clarify that `singleton: true` is set by `withModuleFederation` automatically, and the risk arises only if someone manually overrides the sharing config. The warning remains valid but should specify the override scenario.

3. **Shell has no `webpack.prod.config.ts` — implied vs. stated (files `02`, `04`)**
   Chapter 3: "Each remote also gets a `webpack.prod.config.ts` for production build overrides. **The shell does not have one**; it uses the same `webpack.config.ts` for both development and production."
   Chapter 11: `npx nx build shell --configuration=production` is given as the production build command without any note about the webpack config. The Nx `@nx/angular:host` generator in some versions does generate `webpack.prod.config.ts` for the shell too. Resolution: verify whether the generator in Nx 22.4.5 creates `webpack.prod.config.ts` for the shell. If it does, the Chapter 3 claim is wrong and should be corrected.

4. **`remoteEntry.mjs` caching: 60s vs. short TTL (files `04`, `05`)**
   Chapter 11 nginx.conf: `expires 60s;` and `Cache-Control "public, max-age=60"` for `remoteEntry.mjs`.
   Chapter 11 CloudFront table: TTL for `/remoteEntry.mjs` is "60 seconds." ✓
   Chapter 11 Checklist: "`remoteEntry.mjs` and `mf-manifest.json`: short TTL (60 seconds)." ✓
   Chapter 15 Pitfall 9: "create a cache behavior for `/remoteEntry.mjs` and `/mf-manifest.json` with 60s TTL." ✓
   This is consistent. No contradiction. _(Note: flagged during review, confirmed consistent.)_

---

### Gaps (promised but missing)

1. **`ProductsShellComponent` wiring promised in Chapter 5, never delivered in Chapter 7 (files `02`, `03`)**
   Chapter 5 explicitly says: "This pattern is used when the remote has multiple routes (e.g., product list and product detail). We wire it up fully in Chapter 7." Chapter 7's final `entry.routes.ts` does not use `ProductsShellComponent` and does not mention it. The component is introduced, explained, and then abandoned without acknowledgment. Resolution: either deliver on the promise in Chapter 7 (show `ProductsShellComponent` as a parent route component), or remove the component from Chapter 5 and replace the cross-reference note with an explanation of when a nested outlet is actually needed (when the remote's routes need their own sub-navigation or layout, separate from the shell's outlet).

2. **`nx.json` content never shown despite the chapter claiming to cover "every file" (file `02` Chapter 3)**
   Chapter 3 opens: "The generator created dozens of files across four applications. Let's examine the important ones." `nx.json` is listed in the workspace layout in Chapter 2 and controls caching, task runner configuration, and plugin options. It is never opened, shown, or explained in Chapter 3 or anywhere else in the guide. Resolution: either drop the "every file" framing in Chapter 3's opener, or add a short `nx.json` section covering the `targetDefaults` (caching) and `plugins` entries that `@nx/angular` installs.

3. **Jest-based test execution never explained for `@nx/js` libraries (files `02` Chapter 4, `04` Chapter 13)**
   Chapter 4 notes that `shared-models` and `shared-utils` use Jest. Chapter 13 covers only Vitest unit testing and never addresses how to run, structure, or view output from Jest tests. `npx nx test shared-models` is never shown. Resolution: add a sentence in Chapter 13 showing `npx nx test shared-models` and noting that Jest output format differs from Vitest's tree output shown in the chapter.

4. **`vitest.workspace.ts` listed in workspace layout but never explained (files `01` Chapter 2, `04` Chapter 13)**
   The workspace structure diagram in Chapter 2 includes `vitest.workspace.ts` with the annotation "Vitest workspace configuration (auto-generated)." No chapter explains what this file does, how it relates to per-project `vite.config.mts` files, or when a reader would need to touch it. Resolution: add one paragraph in Chapter 13's unit testing section explaining that `vitest.workspace.ts` is the workspace-level aggregator for all Vitest-configured projects and is managed by Nx.

5. **Appendix B describes the shell's `MFE_PRODUCTS_URL` env variable pattern but `docker-compose.yml` does not use it (files `04`, `05`)**
   Appendix B states: "The shell container uses an entrypoint script that reads `MFE_PRODUCTS_URL`, `MFE_ORDERS_URL`, and `MFE_ACCOUNT_URL` to generate the mf-manifest.json format manifest at startup." The `docker-compose.yml` shown in Chapter 11 does not pass these environment variables and does not specify the `entrypoint.sh`. The appendix describes a production container scenario (Approach B from Chapter 11) that is never demonstrated locally. Resolution: add a note in Appendix B clarifying that the local `docker-compose.yml` uses the dev manifest already present in the build output (Approach A), and that the env variable approach applies only to production ECS/EKS deployments.

---

### Inconsistencies (naming, formatting, structure)

1. **`module-federation.manifest.json` referred to as both the shell's manifest and the remote's federation file (multiple files)**
   Two different files share similar names and are discussed in close proximity throughout the guide:
   - The shell's **`module-federation.manifest.json`** (in `apps/shell/public/`) maps remote names to URLs.
   - The remote's **`mf-manifest.json`** (generated by the build in `dist/apps/<remote>/`) describes what the remote exposes.
   In several passages, these are referred to interchangeably or their distinction is blurred. For example, Chapter 3 says "Each value is the full URL to the remote's `mf-manifest.json` file" immediately after discussing the shell's `module-federation.manifest.json`. Appendix B says "to generate the mf-manifest.json format manifest at startup" when referring to the shell's manifest. Resolution: create a consistent naming convention at the start of Chapter 3 and stick to it throughout. Suggested: always call the shell's file "the shell manifest" and the remote's file "the remote federation manifest" or "mf-manifest.json."

2. **`@mfe-platform/shared-data-access-auth` library name used inconsistently**
   In Chapter 4, the library is generated with `--importPath=@mfe-platform/shared-data-access-auth`. Chapter 14's "How Do I Share an Auth Service" section says: "Import it in any MFE via `@mfe-platform/shared-data-access-auth`." ✓ Consistent.
   However, the `AuthService` import path shown in Chapter 4's data-access-auth barrel file (`libs/shared/data-access-auth/src/index.ts`) exports `AuthService` with no import path shown. Readers must infer the correct import path. The Chapter 7 and Chapter 9 code examples that inject `AuthService` never show the import statement. Resolution: add `import { AuthService } from '@mfe-platform/shared-data-access-auth'` to at least one of the usage examples in Chapters 5 or 9.

3. **`app.routes.ts` in the shell shown in three incompatible states across chapters (`02`, `03`, `05`)**
   - Chapter 3: basic version with three `loadRemote` calls using typed generics.
   - Chapter 14: rewritten with `loadRemoteRoutes()` helper and `RemoteUnavailableComponent` fallback.
   - Appendix A table: `loadRemoteRoutes` is not mentioned; the command table implies the Chapter 3 version is canonical.
   These are not labeled as "enhanced version" or "replace Chapter 3's version with this." A reader building the project cumulatively has no clear indication that Chapter 14's version is a full replacement for Chapter 3's. Resolution: open the Chapter 14 block with: "Replace `apps/shell/src/app/app.routes.ts` entirely with the following error-resilient version:"

4. **Chapter 2 Step 3's flag table describes `apps/shell` as "Directory where the host app is created," but the note says the `apps/` directory is created by the generator (`01`)**
   The workspace structure note says: "The `apps/` directory is created by the host generator in Step 3, not by the workspace preset." Then the flag table lists `apps/shell` as the directory. This is self-consistent but the order of presentation (note at Step 1, usage at Step 3) requires the reader to connect two passages that are a page apart. Resolution: move the "apps/ directory is created by the generator" note to be adjacent to the flag table in Step 3.

5. **Chapter 5 `bootstrap.ts` for the shell imports `App` but no earlier chapter introduces this component (`02` Chapter 5)**
   ```typescript
   import { App } from './app/app';
   bootstrapApplication(App, appConfig)
   ```
   `App` is the root component generated by Nx for the shell. It is shown later in Chapter 5 in the "Router Outlets" section. But `bootstrap.ts` is shown first, with `App` imported and unexplained. A reader reading top-to-bottom will see `App` with no context for several paragraphs. Resolution: reorder the Chapter 5 sections so the shell's `App` component code appears before `bootstrap.ts`, or add a forward reference to the Router Outlets section.

6. **`nx-welcome.ts` filename vs. module reference inconsistency (`02` Chapter 3)**
   The `entry.ts` template shows `<app-nx-welcome></app-nx-welcome>` and `imports: [NxWelcome]`. The guide refers to the file as `nx-welcome.ts` but does not mention the selector `app-nx-welcome` comes from that file. Chapter 5 (Tip) says "delete the `NxWelcome` import and its reference from the shell's component" — referring to the shell's `App` component. But the shell's `App` component is only shown in Chapter 5's Router Outlets section and is not shown importing `NxWelcome`. This creates ambiguity about whether the shell's `App` also has `NxWelcome` (it does, per the generated code) or only the remote's `RemoteEntry`. Resolution: add a note in Chapter 3 clarifying that both the shell's `App` component and each remote's `RemoteEntry` are generated with `NxWelcome`, and both need to be cleaned up.

---

## Summary

The guide is well-structured, covers a genuinely complex topic with appropriate depth for its stated audience, and delivers on most of its promises. The e-commerce running example is coherent throughout. The Pitfalls and Best Practices chapters (15) are genuinely useful and harder to find this clearly stated elsewhere.

**The five most important things to fix:**

1. **GitHub Actions versions** (`actions/checkout@v6`, `actions/setup-node@v6`): a copy-paste blocker in the CI pipeline. Change both to `@v4`.

2. **The `ProductsShellComponent` broken promise**: Chapter 5 introduces the component, says "we wire it up in Chapter 7," and Chapter 7 never uses it. The reader is left with dead code and no explanation. Either deliver the pattern in Chapter 7 or remove the component and the cross-reference entirely.

3. **Chapter 8 contradicts Chapter 3 on remote discovery**: "Nx reads the `remotes` array" is flatly wrong for dynamic federation. Remove the incorrect sentence from Chapter 8 and align the Chapter 3 summary bullet with the accurate body explanation.

4. **`project.json` tag editing in Chapter 6 is pseudocode, not JSON**: the comment-style representation leaves beginners unable to apply the tags. Show at least one complete snippet with the `"tags"` key in proper JSON context.

5. **NG0203 root cause explanation in Chapter 15**: attributing the error to "multiple Angular instances" misleads readers who verify (correctly) that only one Angular instance is loaded. Restate the cause as an injection context timing issue so readers can apply the diagnosis correctly.
