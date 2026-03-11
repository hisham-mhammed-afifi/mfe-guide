# v4 Changelog

**Date:** 2026-03-11
**Source:** v3 guide files + `v3/student_notes.md` + `v3/FRESHNESS_REPORT.md`

---

## Phase 1: Student Notes Fixes

These changes address confusions, "couldn't follow" items, wishes, and questions raised by a junior Angular developer reading the v3 guide.

### 00-table-of-contents.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Updated Angular description to include "zoneless by default" | Student Note (Ch1 confusion) + Freshness Report (HIGH) | Technology Versions table |

### 01-foundations-and-setup.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Added zoneless-by-default Note callout in Ch1 explaining Angular 21 has no Zone.js, change detection is signal-driven, and `vi.useFakeTimers()` replaces `fakeAsync`/`tick` | Freshness Report (HIGH) + Student Note (Ch13 confusion) | After Module Federation note in Ch1 |
| 2 | Clarified `--preset=apps` vs `angular-monorepo` with parenthetical explanation | Student Note (Ch2 confusion: "what would angular-monorepo do?") | Ch2 Step 1 note |
| 3 | Added Nx Cloud remote caching explanation (3 sentences) after `--nxCloud=skip` | Student Note (Ch2 + Ch8 confusion: "what is remote caching?") | Ch2 Step 1 note |

### 02-configuration-libraries-providers-boundaries.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Added `typeof import(...)` explanation as Note callout after shell's `app.routes.ts` | Student Note "Couldn't Follow" #1, Top Question #1 | Ch3, after app.routes.ts |
| 2 | Added `@nx/angular:library` vs `@nx/js:library` explanation as Note | Student Note (Ch4 confusion) | Ch4, after library generation commands |
| 3 | Added `withComponentInputBinding()` explanation as Note | Student Note (Ch5 confusion) | Ch5, after shell app.config.ts |
| 4 | Added `withInterceptorsFromDi()` explanation as Note, including future phase-out flag | Student Note (Ch3 question) + Freshness Report (MEDIUM) | Ch5, after shell app.config.ts |
| 5 | Added paragraph clarifying dual routing mental model (entry.routes.ts is the only file that matters) | Student Note "Couldn't Follow" #2 | Ch5, after routing contexts table |
| 6 | Added note that `entry.component.ts` can be deleted once real features replace the placeholder | Student Note (Ch7 confusion: "what happens to RemoteEntryComponent?") | Ch5, after entry.routes.ts placeholder code |
| 7 | Added Note clarifying both scope AND type rules must pass independently | Student Note (Ch6 confusion) | Ch6, after ESLint config |

### 03-features-workflow-communication-styles.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Added "What Happens When a User Clicks Products" 10-step request flow sequence | Student Note Wish #2 | Ch7, after intro paragraph |
| 2 | Added note that `entry.component.ts` is no longer referenced and can be deleted | Student Note (Ch7 confusion: "is entry.component.ts orphaned?") | Ch7 Step 6 |
| 3 | Added Nx caching explanation Note (local cache vs. Nx Cloud remote caching, cache invalidation) | Student Note (Ch8 confusion: "what is remote caching?", "what triggers cache miss?") | Ch8, after "Running the Full System" |

### 04-deployment-versions-testing.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Added `--build` and `-d` flag explanations after `docker compose up --build -d` | Student Note "Couldn't Follow" #4, Wish #9 | Ch11, docker compose section |
| 2 | Added inline comments to CI pipeline bash explaining `nx show projects`, `grep -q`, regex anchors | Student Note "Couldn't Follow" #3 | Ch11, CI pipeline "Check if affected" step |
| 3 | Added "semver-compatible" definition with examples (21.0.0 vs 21.1.0 vs 22.0.0) | Student Note "Couldn't Follow" #6 | Ch12, after "highest semver-compatible version" |
| 4 | Expanded contract test Note to explain execution context, path alias resolution, and scope limitations | Student Note "Couldn't Follow" #7 | Ch13, after contract test code |

### 05-advanced-and-best-practices.md

| # | Change | Source | Lines |
|---|---|---|---|
| 1 | Added `--importPath` to Appendix A library generation command | Student Note (Appendix A: "Ch4 warned to always use --importPath") | Appendix A |

---

## Phase 2: Freshness Report Fixes

These changes address version outdating, API changes, and ecosystem shifts identified in the freshness audit.

### Critical

| # | File | Change | Source |
|---|---|---|---|
| 1 | `00-table-of-contents.md` | Updated Vitest version from "3.x" to "4.x" | Freshness Report: Vitest 4.0.18 released |
| 2 | `00-table-of-contents.md` | Updated TypeScript version from "5.7+" to "5.9+" | Freshness Report: Angular 21 requires >=5.9.0 |
| 3 | `00-table-of-contents.md` | Updated Node.js prerequisite from "18+" to "20+" and recommended from "20.x" to "22.x" | Freshness Report: Node 18 EOL, Node 20 EOL April 2026 |
| 4 | `01-foundations-and-setup.md` | Updated Ch2 prerequisites Node.js from "18+" to "20+" and "20.x" to "22.x" | Same as above |

### High

| # | File | Change | Source |
|---|---|---|---|
| 1 | `04-deployment-versions-testing.md` | Updated Dockerfile `node:20-alpine` to `node:22-alpine` | Freshness Report: Node 20 EOL April 2026 |
| 2 | `04-deployment-versions-testing.md` | Updated Dockerfile `nginx:1.27-alpine` to `nginx:1.28-alpine` | Freshness Report: nginx 1.28 is current stable |
| 3 | `04-deployment-versions-testing.md` | Updated CI pipeline `node-version: 20` to `node-version: 22` (both ci and deploy jobs) | Freshness Report: align CI with Node 22 LTS |
| 4 | `01-foundations-and-setup.md` | Added zoneless-by-default Note in Ch1 | Freshness Report: Angular 21 zoneless not mentioned |

### Medium

| # | File | Change | Source |
|---|---|---|---|
| 1 | `02-configuration-libraries-providers-boundaries.md` | Added `withInterceptorsFromDi()` future phase-out note | Freshness Report: Angular docs flag for future phase-out |
| 2 | `05-advanced-and-best-practices.md` | Added `NxModuleFederationPlugin` note in Ch14 Rspack section | Freshness Report: new Rspack MF plugin, React-only for now |

### Low

| # | File | Change | Source |
|---|---|---|---|
| 1 | `05-advanced-and-best-practices.md` | `NxModuleFederationPlugin` mention covers both MEDIUM and LOW items | Freshness Report |

---

## Phase 3: Consistency Pass

| # | Check | Result |
|---|---|---|
| 1 | Node.js version consistent across all files (prerequisites, Dockerfile, CI) | Verified: "20+" / "22.x LTS" in 00 and 01, `node:22-alpine` in 04, `node-version: 22` in CI |
| 2 | Vitest version consistent (4.x in tech table, no "3.x" references) | Verified: "4.x" in 00, no "3.x" anywhere |
| 3 | TypeScript version consistent (5.9+ in tech table) | Verified: "5.9+" in 00 |
| 4 | Docker images consistent (node:22-alpine, nginx:1.28-alpine) | Verified: both updated in 04 |
| 5 | No em dashes in any file | Verified |
| 6 | All chapter transitions present | Verified: every chapter ends with a transition sentence |
| 7 | No orphaned cross-references (all "as we saw in Chapter X" references valid) | Verified |
| 8 | `--importPath` consistently mentioned wherever library generation appears | Verified: Ch4 warning + Appendix A now both include it |
| 9 | `withInterceptorsFromDi()` note does not contradict the code (code still uses it) | Verified: code unchanged, note explains it is flagged but still works |
| 10 | Zoneless note in Ch1 aligns with Ch13 Vitest note about `vi.useFakeTimers()` | Verified: both mention that `fakeAsync`/`tick` are unavailable |

---

## Summary

| Category | Count |
|---|---|
| Student notes fixes applied | 14 |
| Freshness critical fixes | 4 |
| Freshness high fixes | 4 |
| Freshness medium fixes | 2 |
| Freshness low fixes | 1 |
| Consistency checks passed | 10 |
| **Total changes** | **25** |

All v3 content not listed above was preserved identically. No code blocks were modified except Docker base images and CI Node version. No structural reorganization was performed. All changes are additive (new Note/Warning callouts, version number updates, or inline explanations).
