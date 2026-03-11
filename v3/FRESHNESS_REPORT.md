# Freshness Report

**Date:** 2026-03-11
**Guide Version:** v3
**Checked Against:** Angular 21.2.2, Nx 22.5.4, Vitest 4.0.18

---

## Summary Verdict

The guide is **mostly current** but has **3 Critical, 3 High, and 5 Medium** issues that need attention. The core architecture (Angular 21 + Nx 22 + Webpack Module Federation + Dynamic Federation) is still the correct and recommended approach. However, several version numbers are outdated (Vitest jumped to 4.x, TypeScript to 5.9, Node.js 20 is approaching EOL), one API (`withInterceptorsFromDi`) is flagged for future phase-out, the Docker base images need updating, and Angular 21's zoneless-by-default posture is not mentioned in the guide. No breaking changes to the fundamental Module Federation workflow were found.

---

## Version Table

| Technology | Guide Says | Current Stable | Status | Action Needed |
|---|---|---|---|---|
| Angular | 21.x | 21.2.2 | OK | None. "21.x" covers 21.2.2. |
| Nx | 22.x | 22.5.4 | OK | None. "22.x" covers 22.5.4. |
| `@module-federation/enhanced` | 2.x | 2.1.0 | OK | None. "2.x" covers 2.1.0. |
| `@nx/module-federation` | 22.x | 22.5.4 | OK | None. |
| Vitest | 3.x | 4.0.18 | **OUTDATED** | Update to "4.x" in `00-table-of-contents.md` line 34 and verify API compatibility. |
| TypeScript | 5.7+ | 5.9.3 | **OUTDATED** | Update to "5.9+" in `00-table-of-contents.md` line 35. Angular 21 requires >=5.9.0. |
| Node.js | 18+ (20.x LTS recommended) | 24.x LTS (20.x EOL April 2026) | **OUTDATED** | Update prerequisite to "Node.js 20+" with "22.x LTS recommended". Node 18 is already EOL. Node 20 EOL is April 2026. |
| Docker `node:20-alpine` | 20-alpine | 22-alpine or 24-alpine | **OUTDATED** | Update Dockerfile to `node:22-alpine`. Node 20 EOL is imminent (April 2026). |
| Docker `nginx:1.27-alpine` | 1.27-alpine | 1.28-alpine (stable) | **OUTDATED** | Update Dockerfile to `nginx:1.28-alpine`. |
| Webpack | 5.x | 5.x | OK | None. |
| Docker | 24+ | 24+ | OK | None. |
| Playwright | (not versioned in guide) | 1.58.2 | OK | No version claim to verify. |

---

## API and Import Path Changes

| Import Path / API | Guide Usage | Still Valid? | Notes |
|---|---|---|---|
| `loadRemote` from `@module-federation/enhanced/runtime` | Ch3, Ch5, Ch14 | YES | No changes. |
| `registerRemotes` from `@module-federation/enhanced/runtime` | Ch3 | YES | No changes. Now supports `force: true` option. |
| `ModuleFederationConfig` from `@nx/module-federation` | Ch3, Ch14 | YES | No changes. |
| `withModuleFederation` from `@nx/module-federation/angular` | Ch3 | YES | Still used for Webpack. Will eventually be replaced by `NxModuleFederationPlugin` for Rspack, but not yet for Angular. |
| `signal`, `computed`, `inject` from `@angular/core` | Ch4, Ch9 | YES | No changes. |
| `toSignal` from `@angular/core/rxjs-interop` | Ch7 | YES | No changes. |
| `provideHttpClient` from `@angular/common/http` | Ch5, Ch13 | YES | No changes. |
| `withInterceptorsFromDi` from `@angular/common/http` | Ch5 | **FLAGGED** | Still works, but Angular docs state: "Support for DI-provided interceptors may be phased out in a later release." Consider adding a note or switching to `withInterceptors()` with functional interceptors. |
| `provideHttpClientTesting`, `HttpTestingController` from `@angular/common/http/testing` | Ch13 | YES | No changes. |
| `provideRouter`, `withComponentInputBinding` from `@angular/router` | Ch5 | YES | No changes. |
| `provideAnimationsAsync` from `@angular/platform-browser/animations/async` | Ch5 | YES | No changes. |
| `TestBed` from `@angular/core/testing` | Ch13 | YES | No changes. |
| `@angular/build:unit-test` | Ch13 (note) | YES | Still the Vitest executor for Angular. |
| `ApplicationConfig` from `@angular/core` | Ch5 | YES | Note: the old import from `@angular/platform-browser` was removed. The guide correctly imports from `@angular/core`. |

---

## Generator Command Changes

| Command | Guide Usage | Still Valid? | Changes |
|---|---|---|---|
| `nx g @nx/angular:host --dynamic` | Ch2 | YES | No changes to flags or behavior. |
| `nx g @nx/angular:remote --host=shell` | Ch14 | YES | No changes. |
| `nx g @nx/angular:library --directory --name --importPath` | Ch4 | YES | No changes. |
| `nx g @nx/js:library --directory --name --importPath` | Ch4 | YES | No changes. |
| `nx g @nx/angular:convert-to-rspack` | Ch14 | YES | Still exists. Angular Rspack is still experimental. |

---

## Deprecations and Breaking Changes

### Angular 21 Changes Affecting the Guide

| Change | Impact on Guide | Action |
|---|---|---|
| **Angular 21 is zoneless by default** | The guide does not mention zoneless Angular. New apps generated with Angular 21 do not include Zone.js. This affects testing (`fakeAsync`/`tick` from Zone.js are unavailable) and change detection behavior. The guide's Ch13 Vitest note correctly avoids `fakeAsync`/`tick`, but the guide never explains that the apps are zoneless. | **HIGH**: Add a brief note in Ch1 or Ch2 that Angular 21 apps are zoneless by default, and what that means practically (no Zone.js, change detection driven by signals). |
| **`*ngIf`, `*ngFor`, `*ngSwitch` deprecated** | The guide correctly uses `@if`, `@for` control flow. No action needed. | None. |
| **`withInterceptorsFromDi()` future phase-out** | Used in Ch5 `app.config.ts` for both shell and remotes. Not yet deprecated, but flagged. | **MEDIUM**: Add a note that `withInterceptors()` with functional interceptors is the forward-looking approach. |

### Nx 22 Changes Affecting the Guide

| Change | Impact on Guide | Action |
|---|---|---|
| **`NxModuleFederationPlugin` introduced** | New Rspack-based MF plugin. Not yet available for Angular (React only). Does not affect the guide's Webpack-based approach. | **LOW**: Mention in Ch14 (Rspack section) that Nx is working toward Rspack-based MF plugins but they are not yet available for Angular. |
| **`@nx/vite:test` deprecated in favor of `@nx/vitest:test`** | The guide does not reference this executor directly (it references `@angular/build:unit-test` and `nx test`). No direct impact. | None. |

### Vitest Changes

| Change | Impact on Guide | Action |
|---|---|---|
| **Vitest 4.x released** | The guide says "Vitest 3.x" in the technology table. The `describe`/`it`/`expect` globals and `vi` import patterns should be verified against 4.x. | **CRITICAL**: Update version. Verify that Vitest 4.x has no breaking changes to the globals/API used in the guide. |

---

## Docker/CI Updates

| Item | Guide Says | Current | Status | Action |
|---|---|---|---|---|
| `node:20-alpine` | 20-alpine | 22-alpine (LTS) | **OUTDATED** | Update to `node:22-alpine`. Node 20 EOL is April 2026. |
| `nginx:1.27-alpine` | 1.27-alpine | 1.28-alpine (stable) | **OUTDATED** | Update to `nginx:1.28-alpine`. |
| `actions/checkout` | @v6 | @v6 | OK | None. |
| `actions/setup-node` | @v6 | @v6 | OK | None. |
| `aws-actions/configure-aws-credentials` | @v5 | @v5 (latest: v5.1.1) | OK | None. |
| `nrwl/nx-set-shas` | @v4 | @v4 (latest: v4.3.0) | OK | None. |
| Node version in CI (`node-version: 20`) | 20 | 22 (LTS) | **OUTDATED** | Update to `node-version: 22` in CI pipeline. |
| Node.js prerequisite ("18+, 20.x LTS recommended") | 18+, 20.x | 20+, 22.x LTS | **OUTDATED** | Update in Ch2 prerequisites and `00-table-of-contents.md`. |

---

## Ecosystem Shifts

| Question | Finding |
|---|---|
| Has Nx introduced a better way to do MFE? | Yes, `NxModuleFederationPlugin` with Rspack. But it is React-only for now. Angular MF still uses Webpack + `withModuleFederation`. No action needed for the guide's approach. |
| Has Angular introduced native federation support? | No. Angular has no first-party Module Federation. Third-party `@angular-architects/native-federation` exists but is not integrated with Nx generators. |
| Has Native Federation replaced Webpack MF? | Growing in popularity but has NOT displaced Webpack MF in the Nx ecosystem. The guide's approach is still the Nx-recommended path. |
| Has Rspack replaced Webpack for Angular MF in Nx? | For React, yes. For Angular, no. `@nx/angular-rspack` exists but is experimental. The guide correctly mentions Rspack as an alternative (Ch14) without recommending it as the default. |
| New Nx Cloud features? | No significant changes that affect the guide's content. |
| Has `@nx/angular:host`/`remote` been replaced? | No. Both generators still exist and work as documented. |

---

## Action Items

#### Critical (guide will break or is factually wrong)

- [ ] **Update Vitest version from "3.x" to "4.x"** in `00-table-of-contents.md` line 34. Verify that Vitest 4.x globals (`describe`, `it`, `expect`) and `vi` import still work identically. If there are breaking changes, update the Ch13 test code accordingly.
- [ ] **Update Node.js prerequisite from "18+" to "20+"** and recommended from "20.x LTS" to "22.x LTS" in `00-table-of-contents.md` line 19, `01-foundations-and-setup.md` line 107. Node 18 is already past EOL. Node 20 reaches EOL in April 2026.
- [ ] **Update TypeScript version from "5.7+" to "5.9+"** in `00-table-of-contents.md` line 35. Angular 21 requires TypeScript >=5.9.0.

#### High (guide is misleading or outdated)

- [ ] **Update Docker base images**: Change `node:20-alpine` to `node:22-alpine` in `04-deployment-versions-testing.md` line 107. Change `nginx:1.27-alpine` to `nginx:1.28-alpine` in line 127. Node 20 EOL is April 2026.
- [ ] **Update CI pipeline Node version**: Change `node-version: 20` to `node-version: 22` in `04-deployment-versions-testing.md` lines 334 and 354.
- [ ] **Add zoneless-by-default note**: Angular 21 apps are zoneless by default (no Zone.js). The guide should mention this briefly in Ch1 or Ch2, noting that change detection is signal-driven and `fakeAsync`/`tick` are unavailable. This connects to the Ch13 Vitest note about using `vi.useFakeTimers()` instead.

#### Medium (guide works but could be improved)

- [ ] **Add note about `withInterceptorsFromDi()` future**: In `02-configuration-libraries-providers-boundaries.md` (Ch5 `app.config.ts`), add a brief note that `withInterceptorsFromDi()` is flagged for future phase-out and `withInterceptors()` with functional interceptors is the forward-looking pattern. Do not change the code yet since the API still works.
- [ ] **Update Rspack section in Ch14**: Mention that Nx is developing `NxModuleFederationPlugin` for Rspack but it is not yet available for Angular. The current note about Rspack as an alternative is accurate but could mention this ongoing development.
- [ ] **Verify Vitest 4.x API compatibility**: Specifically test that `describe`/`it`/`expect` globals, `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()`, and `vi.advanceTimersByTime()` are unchanged in Vitest 4.x. If any changed, update Ch13 code.
- [ ] **Consider adding `provideExperimentalZonelessChangeDetection()` context**: While Angular 21 is zoneless by default for new apps, the Nx generators may or may not add this provider. The guide's `app.config.ts` examples should be verified against what the current Nx 22.5 generators actually produce.
- [ ] **Update `ApplicationConfig` import verification**: The guide imports `ApplicationConfig` from `@angular/core` (line 408 in file 02). This is correct. The old import from `@angular/platform-browser` was removed. No change needed, but flagged for awareness.

#### Low (nice-to-have updates)

- [ ] **Mention `NxModuleFederationPlugin`**: In Ch14's Rspack section, briefly note that Nx's new `NxModuleFederationPlugin` replaces `withModuleFederation` for Rspack projects, currently React-only, with Angular support planned.
- [ ] **Consider mentioning Native Federation growth**: `@angular-architects/native-federation` 1.0 is now stable and gaining popularity for non-Nx projects. The Ch1 note already mentions it as an alternative. No change strictly needed.
- [ ] **Update `--nxCloud=skip` note**: Nx Cloud setup may have changed slightly in 22.5. Verify the flag name is still `--nxCloud=skip` vs. `--nxCloud=false` or similar.

---

## No-Change Confirmation

The following items were checked and confirmed still correct:

- `@module-federation/enhanced` package name and version range (2.x)
- `@nx/module-federation` package still exists at 22.x
- `ModuleFederationConfig` type export from `@nx/module-federation`
- `withModuleFederation` export from `@nx/module-federation/angular`
- `loadRemote` and `registerRemotes` from `@module-federation/enhanced/runtime`
- `@nx/angular:host` generator with `--dynamic`, `--remotes`, `--prefix`, `--style` flags
- `@nx/angular:remote` generator with `--host` flag
- `@nx/angular:library` generator with `--directory`, `--name`, `--importPath` flags
- `@nx/js:library` generator with `--directory`, `--name`, `--importPath` flags
- `@nx/angular:convert-to-rspack` generator
- `@nx/angular:webpack-browser` build executor for MF projects
- `@nx/angular:module-federation-dev-server` serve executor
- `@angular/build:unit-test` Vitest executor
- Generated file names: `module-federation.config.ts`, `webpack.config.ts`, `bootstrap.ts`, `entry.routes.ts`, `entry.component.ts`, `app.config.ts`
- `module-federation.manifest.json` manifest file name and format
- `main.ts` / `bootstrap.ts` async split pattern
- `signal()`, `computed()`, `inject()` from `@angular/core`
- `toSignal()` from `@angular/core/rxjs-interop`
- `provideHttpClient()` from `@angular/common/http`
- `provideHttpClientTesting()`, `HttpTestingController` from `@angular/common/http/testing`
- `provideRouter()`, `withComponentInputBinding()` from `@angular/router`
- `provideAnimationsAsync()` from `@angular/platform-browser/animations/async`
- `TestBed` from `@angular/core/testing`
- `standalone: true` is still the default (can be omitted)
- `ViewEncapsulation.Emulated` is still the default
- `@if`, `@for` control flow syntax (guide uses these correctly)
- `actions/checkout@v6`, `actions/setup-node@v6` GitHub Actions versions
- `aws-actions/configure-aws-credentials@v5` GitHub Action version
- `nrwl/nx-set-shas@v4` GitHub Action version
- Dynamic Federation as the recommended approach for production
- Nx project graph auto-sharing of libraries as singletons
- `nx serve shell --devRemotes=...` workflow
- `nx affected -t lint test build` command
- `nx graph` command
- `nx migrate latest` workflow
- CORS requirements for cross-origin remote loading
- `remoteEntry.js` caching strategy (60s TTL, not content-hashed)
- Docker multi-stage build pattern (deps -> builder -> server)
- nginx SPA fallback configuration (`try_files $uri $uri/ /index.html`)
- S3 + CloudFront as recommended deployment for static Angular MFEs
- ECS + Fargate as alternative for container-based deployment
- `provideRouter()` route configuration pattern
- `@Injectable({ providedIn: 'root' })` singleton pattern across MFEs
- CSS custom properties for cross-MFE theming
- Module boundary tags (`scope:*`, `type:*`) and `@nx/enforce-module-boundaries` rule
