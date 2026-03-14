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

1. **File 02, Chapter 6, "Configuring Constraints" prose vs. code:** The intro sentence reads "the generator places the `@nx/enforce-module-boundaries` rule inside a config object that looks like this (the `depConstraints` array is **empty by default**):" — but the code block immediately below now correctly shows `[{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]` as the default. The prose parenthetical was not updated when the code was fixed. A reader sees "empty by default" and then a non-empty array. They cannot know which to trust. Fix: change the parenthetical to "(the `depConstraints` defaults to a wildcard catch-all that permits all imports)".

2. **File 04, Chapter 13, "Unit Testing" note (line 553):** The note correctly warns that `npx nx test mfeProducts` fails (no test files), then says "Run `npx nx test products-data-access` to test the product service, for example." In Nx 22.4.5 `products-data-access` uses the `vitest:test` target, so `npx nx test products-data-access` would also fail with "task not found." Should be `npx nx run products-data-access:vitest:test`.

3. **File 04, Chapter 13, chapter-opening note (line 535):** "Add the `--watch` flag for continuous testing during local development: `npx nx test mfeProducts --watch`." Two errors: (a) `mfeProducts` is a remote app with no test files — the command produces "No test files found"; (b) the target would be `vitest:test` not `test` even if the project had tests. This command will fail for every reader who tries it. Should reference a real testable project: `npx nx run products-data-access:vitest:test --watch`.

4. **File 04, Chapter 13, Contract Testing note (bottom of section):** States "They run as part of the shell's Vitest test suite (`npx nx test shell`)." The shell was generated with `@nx/angular:host`, which in Nx 22.4.5 produces a `vitest:test` target, not `test`. Should be `npx nx run shell:vitest:test`.

5. **File 05, Chapter 14, "Add a 4th Remote" — snake_case throughout a camelCase guide:** The generator command uses `apps/mfe_notifications`, the manifest entry uses `"mfe_notifications"`, and steps 3–4 reference `apps/mfe_notifications/project.json`. These are snake_case while every other remote in the guide is now camelCase (`mfeProducts`, `mfeOrders`, `mfeAccount`). The same kebab-case lint problem the rename was designed to fix (Pitfall 14 in Chapter 15) would occur with `mfe_notifications` — the generated selector `app-mfe_notifications-entry` would fail `@angular-eslint/component-selector`. Fix: rename the example to `mfeNotifications` throughout that section.

6. **File 05, Chapter 14, "Add a 4th Remote" manifest JSON — mixed naming styles in one object:** The manifest sample for the 4th remote shows:
   ```json
   {
     "mfeProducts": "http://localhost:4201/mf-manifest.json",
     "mfeOrders": "http://localhost:4202/mf-manifest.json",
     "mfeAccount": "http://localhost:4203/mf-manifest.json",
     "mfe_notifications": "http://localhost:4204/mf-manifest.json"
   }
   ```
   Three camelCase keys alongside one snake_case key in the same JSON object. This is technically valid JSON but will directly confuse readers who just read three chapters explaining that camelCase is required. Fix: rename `mfe_notifications` to `mfeNotifications` (tied to finding 5 above).

### Major (technically wrong or misleading, may not block the reader)

7. **File 03, Chapter 9, Pattern 1 code block — invalid TypeScript:** The code block shows:
   ```typescript
   import { AuthService } from '@mfe-platform/shared-data-access-auth';

   @Injectable({ providedIn: 'root' })
   export class AuthService { /* ... */ }
   ```
   This is not valid TypeScript: you cannot import a name and then declare a class with the same name in the same file (TypeScript emits "Duplicate identifier 'AuthService'"). Additionally, `@Injectable` is used without being imported from `@angular/core`. No decorator import is shown at all. A reader who copies this into a file gets immediate compile errors. The snippet is clearly meant to be conceptual, but it reads as a copy-pasteable example. Fix: either separate it into two labeled conceptual blocks (one showing the import in a consuming component, one showing the class definition) or add a clear "Conceptual — not a single file" label.

8. **File 05, Appendix A — `npx nx affected -t lint test build` missing `vitest:test`:** The CI pipeline in file 04 (Chapter 11) was correctly updated to `npx nx affected -t lint test vitest:test build`. Appendix A still shows the old command without `vitest:test`. A DevOps engineer copying from Appendix A would miss all Angular library tests.

9. **File 05, Appendix A — `apps/mfe_new` uses snake_case in generator example:** `npx nx g @nx/angular:remote apps/mfe_new --host=shell` uses the underscore naming that the guide explicitly moved away from. The generated selector `app-mfe_new-entry` would fail the `@angular-eslint/component-selector` rule. Should be `apps/mfeNew`.

### Minor (imprecise but not harmful)

10. **File 04, Chapter 13 — "Inspecting a Project's Targets" section placement:** This section appears after "Integration Testing with Docker Compose" and before "Contract Testing." It describes `npx nx show project` as a pre-test diagnostic tool, but by the time a reader reaches it they have already been instructed to run tests and hit failures. It would serve readers better if placed at the start of the chapter, before "Unit Testing."

11. **File 01, Chapter 2, Step 6 — smoke test still references waiting for an unspecified welcome page:** "You should see the Nx welcome page with links for each remote. Clicking a link (e.g., the mfeProducts link) loads that remote's placeholder component via Module Federation." The mfeProducts app's `RemoteEntry` still uses `<app-nx-welcome>` which renders a full Angular welcome page. The selector used here (`mfeProducts link`) is a text label, which is accurate enough, but "the mfeProducts link" could confuse readers because the generated template may say `routerLink="mfeProducts"` as link text. The note about the generated template's path is in Chapter 5 but not here. Minor DX gap.

---

## Role 2: Developer Experience

### Blockers (reader would get stuck)

1. **File 04, Chapter 13, intro note — broken watch command:** A reader who wants to run tests in watch mode follows the note and runs `npx nx test mfeProducts --watch`. They get "task not found" because (a) the target is `vitest:test` and (b) `mfeProducts` has no tests. No fallback or explanation is given for why it fails. Readers new to Nx will assume they set something up wrong in previous chapters.

2. **File 04, Chapter 13, Unit Testing note — broken test command:** "Run `npx nx test products-data-access` to test the product service" is the first concrete test command a reader runs. It fails with "task not found." This is the primary test example in the chapter. A reader who has carefully followed every prior step will conclude they have a broken setup when the problem is just the wrong command syntax.

3. **File 04, Chapter 13, Contract Testing note — `npx nx test shell` fails:** When the reader runs the contract tests they are told to use `npx nx test shell`. This fails because the shell uses `vitest:test`. The reader just wrote a complete test file and cannot run it.

4. **File 05, Chapter 14, "Add a 4th Remote" — guidance contradicts the established convention:** A reader who carefully learned "we use camelCase to avoid selector lint failures" (Chapter 2 note and Chapter 6 note) then sees the 4th remote example using `apps/mfe_notifications`. They don't know if the convention was relaxed, if it only applies to the three main remotes, or if the example is a mistake. The ESLint selector rule will fail on the generated component if they follow the example as written.

### Friction (reader would be confused but could figure it out)

5. **File 02, Chapter 6 — prose says "empty by default," code says it's not:** A careful reader will notice the contradiction between the parenthetical and the code block. They may trust the code (which is correct), but the prose will cause doubt and slow them down. This is the most confusing single paragraph in the guide because the "before" state — which readers need to understand in order to know what they are replacing — is ambiguously described.

6. **File 03, Chapter 9, Pattern 1 — structurally invalid code block:** A reader trying to understand how the shared service pattern works will see the import and declaration of `AuthService` in the same snippet. They know this is wrong TypeScript but cannot tell what the intended structure is. The comments below the (fake) class declaration seem to be the real point, but they are buried under confusing boilerplate. The reader must mentally reconstruct the intent.

7. **File 04, Chapter 13 — section "Inspecting a Project's Targets" placed after integration tests:** A reader who just ran `npx nx run products-data-access:vitest:test` would benefit from knowing about `npx nx show project` BEFORE running tests, so they can verify targets exist. Placed after Docker Compose integration testing, it is encountered too late to help with the unit-test confusion that precedes it.

### Suggestions (nice-to-have improvements)

8. **File 05, Chapter 14, "Add a 4th Remote" — add a note reinforcing the camelCase naming convention:** After renaming `mfe_notifications` to `mfeNotifications`, add a brief callout reminding readers that all new remotes should use camelCase to avoid the selector lint failure described in Chapter 2 and Chapter 6.

9. **File 04, Chapter 13, intro — replace the broken `--watch` example with a working one:** Replace the stale `npx nx test mfeProducts --watch` with `npx nx run products-data-access:vitest:test --watch` so the very first thing readers see in the testing chapter is a command that works.

---

## Role 3: Consistency & Completeness

### Contradictions

1. **File 02, Chapter 6 — "empty by default" prose vs. wildcard-default code:** Within the same paragraph and code block, the guide states that `depConstraints` is "empty by default" and then shows `[{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]` as the default. These directly contradict each other. The code is correct; the prose is stale.

2. **File 04, Chapter 13 — `vitest:test` convention applied inconsistently across three places in the same chapter:** The chapter intro note (line 535) uses `npx nx test mfeProducts`, the Unit Testing code block correctly uses `npx nx run products-data-access:vitest:test`, the Unit Testing note (line 553) uses `npx nx test products-data-access`, and the Contract Testing note uses `npx nx test shell`. The same chapter both teaches and violates the `vitest:test` naming rule in the span of a few hundred lines.

3. **File 04, Chapter 11 vs. File 05, Appendix A — `affected` command versions:** Chapter 11's CI pipeline was updated to `npx nx affected -t lint test vitest:test build`. Appendix A still shows `npx nx affected -t lint test build`. A DevOps engineer using Appendix A as a quick reference would get a different (wrong) command than the one in the full pipeline definition.

4. **File 05, Chapter 14, "Add a 4th Remote" manifest — camelCase main remotes mixed with snake_case new remote:** The manifest JSON shows `mfeProducts`, `mfeOrders`, `mfeAccount` (camelCase) alongside `mfe_notifications` (snake_case). The same JSON object has inconsistent key naming styles.

5. **File 05, Chapter 14, "Add a 4th Remote" generator command vs. guide naming convention:** `apps/mfe_notifications` uses an underscore, while the guide's Chapter 2 note explicitly states this guide uses camelCase for remote names.

### Gaps (promised but missing)

6. **Naming convention for new remotes:** The guide explains in Chapter 2 why camelCase is used for remote names, and Chapter 6 notes the selector lint implication. But Chapter 14's "Add a 4th Remote" section never applies this convention to its own example. A reader adding real remotes to their project has no authoritative example of how to name them. The example should reinforce the camelCase rule, not undermine it.

7. **`npx nx run shell:vitest:test` never explicitly introduced:** The guide correctly explains that `vitest:test` is the target name for Angular libraries, but only says "Angular libraries." The shell (`apps/shell`) was also generated with `@nx/angular:host`, which also produces `vitest:test`. The guide's instruction to run contract tests with `npx nx test shell` silently fails. The scope of "Angular projects that use `vitest:test`" needs to be stated clearly: it applies to all projects generated with Angular generators (`@nx/angular:host`, `@nx/angular:remote`, `@nx/angular:library`), not just libraries.

### Inconsistencies (naming, formatting, structure)

8. **File 05, Appendix A — generator example uses snake_case:** `npx nx g @nx/angular:remote apps/mfe_new --host=shell` uses `mfe_new` (snake_case with underscore). Every other app in the guide is camelCase. This is the quick-reference card readers will copy most often; it should model the correct convention.

9. **File 04 Chapter 11 CI pipeline vs. Appendix A — different `affected` commands:** As noted in finding 3. The CI pipeline is the correct authoritative source; Appendix A should mirror it.

10. **File 04, Chapter 13 section order:** The chapter flows: Unit Testing → Integration Testing → Inspecting Project Targets → Contract Testing. "Inspecting Project Targets" (a diagnostic tool) is sandwiched between two testing sections. It logically belongs before Unit Testing as a setup/verification step, not after Integration Testing where it appears.

---

## Summary

The guide is in good overall shape. The global rename (snake_case → camelCase for remote app names) is complete and correct across all primary content. The major rounds of review-report and codealong fixes are all applied. However, five categories of issues remain that need targeted fixes before the guide should be considered final:

1. **Incomplete `vitest:test` migration in Chapter 13 (Critical/Blocker):** Three commands in Chapter 13 still use `npx nx test` where `npx nx run ...:vitest:test` is required — the chapter intro's `--watch` example, the unit-testing note's closing example, and the contract-testing note. All three will produce "task not found" errors for readers.

2. **Prose/code contradiction in Chapter 6 (Critical/Blocker):** The `depConstraints` section says "empty by default" in prose but shows the correct wildcard-default in the code block. One sentence needs updating to eliminate the contradiction.

3. **`mfe_notifications` in Chapter 14 breaks the naming convention (Critical):** The 4th-remote example uses snake_case throughout, directly contradicting the camelCase convention the guide established. It also embeds the kebab-case selector lint failure the rename was specifically designed to fix. Rename `mfe_notifications` to `mfeNotifications` throughout that section.

4. **Appendix A stale commands (Major):** `npx nx affected -t lint test build` missing `vitest:test`, and `apps/mfe_new` using snake_case in the generator example. Both are in the most-referenced section of the guide.

5. **Chapter 9, Pattern 1 invalid code block (Major):** The AuthService singleton pattern shows importing and re-declaring the same class in one block — invalid TypeScript — plus an undeclared `@Injectable` decorator. Restructure the snippet to be either clearly conceptual or syntactically valid.
