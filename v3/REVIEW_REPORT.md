# v2 Review Report

## Summary Verdict

The v2 guide has strong structural bones: clear e-commerce example, good DevOps handoff framing, all 7 beginner scenarios covered, and a mentor-like tone throughout. However, it contains **critical API inaccuracies** that would cause the reader's code to fail. The runtime helpers `loadRemoteModule` and `setRemoteDefinitions` from `@nx/angular/mf` were deprecated in Nx 19.5 and replaced in Nx 22 by `loadRemote` and `registerRemotes` from `@module-federation/enhanced/runtime`. The manifest file location, several GitHub Actions versions, the `@module-federation/enhanced` package version, and Angular 21's defaults for `standalone` and pipe imports are all incorrect. Additionally, many chapters lack transition sentences, several jargon terms are used before definition, and a few code blocks have missing imports or use `...` placeholders.

---

## Critical Issues

### C1. Runtime API imports are wrong (ALL route and bootstrap files)
**Location:** 02 (Ch3 main.ts, app.routes.ts), 03 (Ch7 entry.routes.ts), 05 (Ch14 routes)
**Problem:** `loadRemoteModule` from `@nx/angular/mf` and `setRemoteDefinitions` from `@nx/angular/mf` were deprecated in Nx 19.5 and replaced in Nx 22 by APIs from `@module-federation/enhanced/runtime`. The guide uses the removed APIs in every route and bootstrap file.
**Fix:** Replace all occurrences:
- `setRemoteDefinitions` from `@nx/angular/mf` → `registerRemotes` from `@module-federation/enhanced/runtime` (with format transformation)
- `loadRemoteModule('name', './Exposed')` from `@nx/angular/mf` → `loadRemote('name/Exposed')` from `@module-federation/enhanced/runtime`

### C2. `standalone: true` is no longer needed in Angular 21
**Location:** All component code blocks across 02, 03, 05
**Problem:** Since Angular 19, `standalone` defaults to `true`. Including `standalone: true` in every `@Component` decorator teaches an outdated pattern. Angular 21 readers will not see this in generated code.
**Fix:** Remove `standalone: true` from all `@Component` and `@Injectable` decorators. Add a one-time note in Ch3 that standalone is the default.

### C3. `CommonModule` import is outdated for pipes
**Location:** 03 (Ch7 ProductListComponent, ProductDetailComponent)
**Problem:** Since Angular 17, built-in pipes (`CurrencyPipe`, `DatePipe`, etc.) are standalone and can be imported individually. Importing `CommonModule` for a single pipe pulls in unnecessary code and teaches a legacy pattern.
**Fix:** Replace `imports: [CommonModule, RouterLink]` with `imports: [CurrencyPipe, RouterLink]` and import `CurrencyPipe` from `@angular/common`.

### C4. `@module-federation/enhanced` version is wrong
**Location:** 00 (Technology Versions table)
**Problem:** Listed as `0.8+` but the current version is `2.1.0` (a major version with breaking changes from 0.x).
**Fix:** Update to `2.x`.

---

## High Issues

### H1. Missing transition sentences in most chapters
**Location:** End of Ch3, Ch4, Ch5, Ch7, Ch8, Ch9, Ch11, Ch12, Ch14
**Problem:** Only Ch1→2, Ch2→3, Ch6→7, Ch10→11, and Ch13→14 have transition sentences. The remaining 9 chapter boundaries lack them, breaking the narrative flow.
**Fix:** Add a transition sentence at the end of every chapter.

### H2. Ch5 entry.routes.ts uses undefined component references
**Location:** 02 (Ch5 "Dual Routing" section, line ~458)
**Problem:** `entry.routes.ts` references `ProductListComponent` and `ProductDetailComponent` without import statements. These components don't exist yet at this point in the guide (they're created in Ch7).
**Fix:** Use the placeholder `RemoteEntryComponent` (which exists from Ch3) in the Ch5 entry.routes.ts example, or add a note that these components are created in Ch7 and use `loadComponent` with dynamic imports.

### H3. GitHub Actions versions are outdated
**Location:** 04 (Ch11 CI pipeline)
**Problem:** `actions/checkout@v4` → should be `@v6`, `actions/setup-node@v4` → should be `@v6`, `aws-actions/configure-aws-credentials@v4` → should be `@v5`. Only `nrwl/nx-set-shas@v4` is still current.
**Fix:** Update all action versions.

### H4. CDN used before definition
**Location:** 02 (Ch3 line 104: "URLs point to your CDN")
**Problem:** "CDN" first appears in Ch3 without definition. It is defined much later in Ch11.
**Fix:** Add a brief parenthetical definition on first use: "your CDN (Content Delivery Network, a globally distributed file server)".

### H5. "OIDC" and "SPA" used without definition
**Location:** 04 (Ch11: "OIDC auth" in CI pipeline, "SPA fallback" in nginx.conf)
**Problem:** Both terms are used without definition. The target audience may not know them.
**Fix:** Define on first use. SPA = "Single Page Application (an app where the browser loads one HTML page and JavaScript handles all navigation)". OIDC = "OpenID Connect (a protocol for secure authentication without static passwords)".

### H6. `...` placeholder in code the reader needs
**Location:** 05 (Ch14 error handling routes: `// ... other routes with the same .catch() pattern`)
**Problem:** The prompt explicitly forbids `...` in code the reader would need to type. This forces the reader to guess how to apply the pattern to other routes.
**Fix:** Show all routes with the `.catch()` pattern, or restructure as a helper function applied to all routes.

---

## Medium Issues

### M1. Manifest explanation partially duplicated
**Location:** 02 (Ch3) and 04 (Ch11)
**Problem:** The manifest file format and purpose are explained in both chapters with overlapping content.
**Fix:** Ch11 should reference Ch3: "As we saw in Chapter 3, the manifest maps remote names to URLs. Here is how it changes per environment."

### M2. "Caching" section in Ch8 is only 2 sentences
**Location:** 03 (Ch8)
**Problem:** Below the 3-sentence minimum for standalone sections.
**Fix:** Merge into "Running the Full System" or expand with practical details.

### M3. Missing file tree after Docker files are added
**Location:** 04 (Ch11)
**Problem:** After introducing Dockerfile, nginx.conf, docker-compose.yml, and entrypoint.sh, no file tree shows where they go.
**Fix:** Add a file tree showing `docker/nginx.conf`, `docker/entrypoint.sh`, `Dockerfile`, `docker-compose.yml`.

### M4. Missing "What just happened?" blocks
**Location:** 02 (end of Ch3), 02 (end of Ch6)
**Problem:** Ch3 (config walkthrough) and Ch6 (boundaries) are multi-step procedures without summary blocks.
**Fix:** Add "What just happened?" checklists.

### M5. Missing ASCII diagrams
**Location:** 04 (Ch11)
**Problem:** No Docker multi-stage build flow diagram. No CI/CD pipeline flow diagram. The prompt requires both.
**Fix:** Add ASCII diagrams for Docker build stages and CI/CD flow.

### M6. product.service.ts lacks inline comments
**Location:** 03 (Ch7 Step 2)
**Problem:** 10-line code block with no inline comments. The prompt requires at least one comment per 5+ line block.
**Fix:** Add a comment explaining the `inject(HttpClient)` pattern or the API endpoint.

### M7. Library generation commands may produce unexpected import paths
**Location:** 02 (Ch4)
**Problem:** In Nx 22 "as-provided" mode, `nx g @nx/angular:library shared-models --directory=libs/shared/models` may produce import path `@mfe-platform/shared-models` or `@mfe-platform/models` depending on how the generator interprets the positional argument vs. the `--directory` flag. The guide never mentions `--importPath` or `--name` to ensure correct alias.
**Fix:** Add `--importPath=@mfe-platform/shared-models` to library generation commands to be explicit, or explain the naming behavior.

### M8. nginx.conf `remoteEntry.js` location assumes root path
**Location:** 04 (Ch11)
**Problem:** `location = /remoteEntry.js` only matches requests to the root path. If the remote is served from a subpath, this won't match. Also, the regex `\.(js|...)$` would match `remoteEntry.js` if the exact match somehow fails.
**Fix:** Add a note that the exact match takes priority in nginx. The config is correct but benefits from a brief explanation of nginx location matching priority.

---

## Low Issues

### L1. Ch10 transition sentence could be stronger
**Location:** 03 (end of Ch10)
**Problem:** Transition is "The next step is understanding what your DevOps team needs to deploy it. That's Chapter 11." Works but could bridge the conceptual shift better.

### L2. Contract tests use `any` type
**Location:** 04 (Ch13)
**Problem:** `mod.remoteRoutes.find((r: any) => r.path === '')` uses `any`. Could use `Route` from `@angular/router`.
**Fix:** Import `Route` and type the parameter.

### L3. Appendix A duplicates commands shown in chapters
**Location:** 05 (Appendix A)
**Problem:** All 10 commands appeared earlier. This is intentional as a reference card but could note "all commands explained in the chapters above."

### L4. No mention of `webpack.prod.config.ts`
**Location:** 02 (Ch3)
**Problem:** The generator creates `webpack.prod.config.ts` but the guide never mentions it.
**Fix:** Add a brief note that it exists and typically doesn't need changes.

---

## Pass-by-Pass Findings

### Pass 1: Narrative Thread
- 6 of 15 chapter transitions have sentences. 9 are missing.
- E-commerce example stays consistent throughout. No name changes or surprise apps.
- `mfe-notifications` appears only in Ch14 as an "adding a new remote" example, which is appropriate.

### Pass 2: Concept Introduction Order
- "CDN" used in Ch3 before definition in Ch11.
- "OIDC" used in Ch11 CI pipeline without definition anywhere.
- "SPA" used in Ch11 nginx section without definition.
- "lazy loading" used in Ch3 without explicit definition (contextually clear but not formally defined).
- All other key terms (singleton, remoteEntry.js, manifest, exposes, HMR, CORS) are defined before or at first use.

### Pass 3: Code Completeness and Correctness
- CRITICAL: All `loadRemoteModule`/`setRemoteDefinitions` imports are from removed `@nx/angular/mf` package.
- CRITICAL: `standalone: true` should be omitted (default since Angular 19).
- CRITICAL: `CommonModule` should be replaced with individual pipe imports.
- HIGH: Ch5 entry.routes.ts references components that don't exist yet.
- `withModuleFederation` from `@nx/module-federation/angular`: CORRECT.
- `ModuleFederationConfig` from `@nx/module-federation`: CORRECT.
- `toSignal` correctly imported from `@angular/core/rxjs-interop`.
- `inject()` correctly imported from `@angular/core`.

### Pass 4: File and Path Consistency
- Manifest path is consistently `apps/shell/src/assets/module-federation.manifest.json`. Note: Nx 22 may use `public/` for new projects, but `src/assets/` still works for webpack-based builds. Keeping `src/assets/` is acceptable.
- Output path `dist/apps/<name>/browser/` is used consistently. For webpack-based MF builds, the output may actually be `dist/apps/<name>/` without `browser/`. Flagged as M-level since readers will see their actual output.
- Library import paths (`@mfe-platform/shared-models`, `@mfe-platform/products-feature`, etc.) are consistent throughout.
- All file paths use forward slashes consistently.

### Pass 5: The 7 Beginner Scenarios
All 7 covered: NullInjectorError ✓, blank remote ✓, remotes not loading ✓, CORS ✓, style leaking ✓, adding remote ✓, sharing auth ✓.

### Pass 6: DevOps Handoff Framing
Excellent throughout. "Reference artifact" language, "share with DevOps" framing, docker compose clearly marked as reader-run, Appendix B checklist present.

### Pass 7: Duplicate Content
- Manifest explanation in Ch3 and Ch11 overlaps. Ch11 should back-reference.
- AuthService correctly uses back-reference in Ch9 and Ch14.
- No verbatim code block duplication.
- Ch8 "Caching" section is under 3 sentences.

### Pass 8: Callout Consistency
Good overall. Warnings for errors, Tips for improvements, Notes for context. Missing: no Warning for Ch5 undefined component references, no definition callout for SPA/OIDC.

### Pass 9: File Trees and "What Just Happened?"
- File trees after: workspace creation ✓, library generation ✓. Missing after: Docker file addition.
- "What just happened?" after: Ch2 ✓, Ch4 ✓, Ch7 ✓, Ch11 docker ✓. Missing after: Ch3, Ch6.

### Pass 10: Diagrams
Present: MFE architecture ✓, library dependency flow ✓, AWS architecture ✓, responsibility boundary ✓.
Missing: Docker multi-stage build flow, CI/CD pipeline flow.

### Pass 11: Style and Tone
- No em dashes found. ✓
- One `...` placeholder in Ch14. ✗
- Most 5+ line code blocks have comments. product.service.ts is missing one. ✗
- Ch11 (04-deployment) is approximately 567 lines, exceeding the 1000-line limit. ✗
- Tone is consistently mentor-like. No condescending language. ✓

### Pass 12: Version Accuracy
- Nx 22: Correct ✓
- Angular 21: Correct (current 21.2.2) ✓
- `nrwl/nx-set-shas@v4`: Correct ✓
- `actions/checkout@v4`: Outdated, should be @v6 ✗
- `actions/setup-node@v4`: Outdated, should be @v6 ✗
- `aws-actions/configure-aws-credentials@v4`: Outdated, should be @v5 ✗
- `@module-federation/enhanced 0.8+`: Wrong, current is 2.x ✗
- `@nx/angular/mf` APIs: Removed/deprecated in Nx 22 ✗
- `@nx/module-federation/angular` for `withModuleFederation`: Correct ✓
