# Claude Code Prompt: Rewrite the Microfrontend Guide

## Your Role

You are a senior technical author and frontend architect with 10+ years of Angular, Nx, and Module Federation experience. You are rewriting an existing 6-file technical guide into a polished, beginner-friendly technical book.

## Source Files

Read ALL files in this order before writing anything:

```
v2/00-table-of-contents.md
v2/01-foundations-and-setup.md
v2/02-configuration-libraries-providers-boundaries.md
v2/03-features-workflow-communication-styles.md
v2/04-deployment-versions-testing.md
v2/05-advanced-and-best-practices.md
```

## Output

Rewrite ALL content into new files inside `v2/`, keeping the same 6-file structure and filenames. Every file must be rewritten from scratch, not patched.

## Target Audience

**Beginner-to-intermediate Angular developers** who have built at least one Angular app but have never worked with microfrontends, Nx monorepos, or Module Federation. They may not know what Webpack is. Assume zero prior knowledge of anything beyond core Angular.

**Docker/DevOps scope:** The reader is a frontend developer, not a DevOps engineer. A separate DevOps team handles Dockerfiles, CI pipelines, AWS infrastructure, and deployment scripts. However, the reader needs enough understanding of these topics to:

- Explain to DevOps what each MFE produces (a static build folder with `index.html`, JS chunks, and a `remoteEntry.js`).
- Explain the `module-federation.manifest.json` file: what it is, why it must be swapped per environment, and what the keys/values mean.
- Understand what CORS is and why each remote's CDN must allow the shell's origin.
- Read a Dockerfile or CI pipeline without writing one from scratch.
- Know the difference between S3+CloudFront (static hosting) and ECS (container hosting) at a conceptual level, so they can participate in architecture discussions.
- Provide DevOps with the correct `nx build` commands, output paths (`dist/apps/<name>/browser`), and cache-busting requirements for `remoteEntry.js`.

The guide includes reference Dockerfiles, nginx configs, CI pipelines, and AWS configs as **ready-to-hand-off artifacts**. These are presented as "here is what your DevOps team needs" rather than "here is what you must write." The frontend developer should understand what each file does, but is not expected to author or maintain them.

## The 4 C's: Your Quality Standard

Apply these to every sentence, code block, and section:

### 1. Clarity
- Every new concept must be introduced BEFORE it is used. Never reference a term, file, or command that hasn't been explained yet.
- When a concept has a "why," explain the WHY before the HOW. Example: before showing `main.ts`/`bootstrap.ts` split, explain why Module Federation needs async bootstrapping.
- Use the "one new idea per paragraph" rule. If a paragraph introduces two concepts, split it.
- Jargon check: the first time you use any of these terms, define them in plain English with a one-sentence explanation: monorepo, host, remote, federation, singleton, shared dependency, manifest, exposes, lazy loading, dev server, HMR, cache invalidation, CDN, CORS, OIDC, ECR, ECS, Fargate, CloudFront, S3 bucket, task definition, ConfigMap.
- Add a "What just happened?" summary block after every multi-step procedure (workspace creation, generating host+remotes, docker compose up, CI pipeline). Format as a blockquote with a checklist of outcomes the reader should verify.

### 2. Conciseness
- Cut every sentence that restates what the code already shows. Code is self-documenting for syntax; prose explains intent, traps, and decisions.
- Remove duplicate explanations. If a concept is explained in Chapter 3, do not re-explain it in Chapter 7. Instead, write "As we saw in Chapter 3, ..." with a brief reminder.
- Merge sections that are under 3 sentences into their parent section.
- Target: no chapter should exceed 1000 lines of markdown. If it does, split it or cut.

### 3. Correctness
- Search the web for the latest Nx 22 and Angular 21 documentation before writing each chapter. Verify:
  - The exact generator command syntax (`nx g @nx/angular:host`, `nx g @nx/angular:remote`, etc.)
  - The exact import paths (`@nx/angular/mf`, `@nx/module-federation`, `@nx/module-federation/angular`)
  - The exact file names Nx generates (`module-federation.config.ts`, `module-federation.manifest.json`, `bootstrap.ts`, `entry.routes.ts`)
  - Whether `--dynamic` flag exists on `@nx/angular:host` in Nx 22
  - Whether `@module-federation/enhanced` is still the underlying package
  - The executor names in project.json (`@nx/angular:webpack-browser`, `@nx/angular:module-federation-dev-server`)
  - Whether `nrwl/nx-set-shas@v4` is still the correct GitHub Action
- Every code sample must be **complete and compilable**. No missing imports, no `...` ellipsis in code that a reader would need to type, no undefined variables.
- Verify that every `nx g` command uses the correct flags for Nx 22 (e.g., `--directory` behavior, `--standalone` default).

### 4. Completeness
- The reader must be able to follow along from `npx create-nx-workspace` through local development, testing, and `docker compose up` (for local integration testing) without leaving the guide. The AWS deployment section is a **reference for handoff to DevOps**, not a step-by-step the reader executes themselves.
- No "exercise for the reader" gaps. If the guide says "create a component," show the full file.
- Every configuration file mentioned must be shown in full (not "update your config to include..."). Show the entire file or the exact diff.
- Docker/CI/AWS artifacts (Dockerfile, nginx.conf, docker-compose.yml, GitHub Actions YAML, CloudFront configs) are presented as **complete, ready-to-hand-off files** with prose that explains what each section does in plain English, so the frontend developer can discuss them intelligently with DevOps. Frame these sections with language like: "Share this Dockerfile with your DevOps team," "Your DevOps team will need to configure CloudFront with these settings," "Here is a reference CI pipeline your DevOps team can adapt."
- The guide must cover these scenarios that beginners WILL hit:
  - `NullInjectorError: No provider for HttpClient` (why and how to fix)
  - Remote works standalone but shows blank when loaded in shell (missing `<router-outlet>`)
  - `nx serve shell` does not load remotes (remotes array empty in dynamic mode)
  - CORS error when loading remoteEntry.js in production (explain what to ask DevOps to fix)
  - Styles from one MFE bleeding into another
  - "How do I add a 4th remote to an existing setup?"
  - "How do I share an auth service across MFEs?"

## Structural Rules

1. **Narrative path:** Each chapter ends with a transition sentence that tells the reader what's next and why. Example: "Now that all four apps are wired, we need to add shared libraries so they can reuse code without duplication. That's Chapter 4."

2. **Progressive complexity:** Chapters 1-2 use zero code. Chapter 3 introduces the first commands. Code complexity increases linearly. Docker and AWS appear only after everything works locally, and are framed as "understand and hand off to DevOps" rather than "write it yourself." The one exception is `docker compose up` for local integration testing, which the frontend developer runs themselves.

3. **Consistent example domain:** The running example throughout the entire guide is an **e-commerce platform** with:
   - `shell` (host): layout, navigation, auth
   - `mfe-products` (remote): product listing, product detail
   - `mfe-orders` (remote): order history, order tracking
   - `mfe-account` (remote): user profile, settings

4. **File tree after every structural change.** After workspace creation, after generating remotes, after adding libraries, after adding Docker files, show the updated file tree so the reader can verify they match.

5. **Code comments in every code block.** Every code block of 5+ lines must have at least one inline comment explaining a non-obvious line.

6. **Warning/Note/Tip callouts.** Use these consistently:
   - `> **Warning:**` for things that will break or cause hard-to-debug errors
   - `> **Note:**` for important context that isn't an error
   - `> **Tip:**` for optional improvements or shortcuts

7. **No em dashes.** Use commas, periods, or parentheses instead.

8. **Diagrams as ASCII art.** Include ASCII diagrams for:
   - The MFE architecture (shell loading remotes at runtime)
   - The library dependency flow (app > feature > data-access > util)
   - The AWS deployment architecture (Route 53 > CloudFront > S3)
   - The Docker multi-stage build flow (deps > builder > server)
   - The CI/CD pipeline flow (checkout > lint/test > build > deploy)
   - The responsibility boundary (what frontend owns vs. what DevOps owns)

## Per-File Instructions

### 00-table-of-contents.md
- Title, subtitle, audience statement, prerequisites, technology versions, TOC with chapter summaries.
- Add a "How to Use This Guide" section explaining the narrative path and that each chapter builds on the previous.

### 01-foundations-and-setup.md
- Ch1: What is a microfrontend? What is a monorepo? What is Module Federation? Why combine them? (Zero code. Concepts only. Use the e-commerce analogy throughout.)
- Ch2: Workspace creation. The single `@nx/angular:host --dynamic --remotes=...` command. Verify with smoke test.
- End with file tree + "What just happened?" summary.

### 02-configuration-libraries-providers-boundaries.md
- Ch3: Walk through every generated file. Explain each line. No hand-waving.
- Ch4: Generate shared libraries. Show full AuthService. Explain how Nx auto-shares.
- Ch5: The provider problem. `app.config.ts` for shell and remotes. Dual routing. `<router-outlet>` placement. The `NullInjectorError` section.
- Ch6: Tags, constraints, the `type:app` rule. Show the lint error message.

### 03-features-workflow-communication-styles.md
- Ch7: Build the products feature end-to-end. Every import explicit. Every file shown in full.
- Ch8: Dev remotes vs static. `--devRemotes` flag. Caching. Resource warnings.
- Ch9: Shared services, signals (with the singleton warning), custom events.
- Ch10: ViewEncapsulation, CSS custom properties, theming. Rules list.

### 04-deployment-versions-testing.md
- Ch11: **"What Your DevOps Team Needs From You"** framing. Start with a section explaining what the frontend team is responsible for (build output, manifest, cache-busting requirements) vs. what DevOps owns (Docker, CI, AWS infra). Then provide the reference artifacts:
  - Docker multi-stage build (explain each stage in plain English: "Stage 1 installs npm packages, Stage 2 runs the Nx build, Stage 3 copies the output into a tiny nginx image")
  - nginx.conf (explain the SPA fallback and the `remoteEntry.js` short cache rule)
  - docker-compose.yml for **local integration testing** (this IS something the frontend dev runs themselves)
  - Manifest injection: explain both approaches (file swap for S3, entrypoint for ECS) conceptually, then show the scripts as handoff artifacts
  - GitHub Actions CI/CD pipeline as a reference for DevOps to adapt
  - AWS architecture overview (S3+CloudFront vs. ECS) at a conceptual level with ASCII diagram, not a step-by-step AWS console walkthrough
  - CORS: explain what it is, why it matters for MFEs, and what to ask DevOps to configure
  - CloudFront cache behaviors: explain what `remoteEntry.js` is vs. hashed chunks, and why they need different TTLs
  - Add a **"Checklist: What to Tell Your DevOps Team"** section at the end with a bullet list of everything they need to know (build commands, output paths, manifest location, CORS origins, cache rules, environment-specific URLs)
- Ch12: Version negotiation, strictVersion behavior (warning not crash), nx migrate.
- Ch13: Unit tests, integration tests with Docker Compose (frontend dev runs this), contract tests with working code and tsconfig setup.

### 05-advanced-and-best-practices.md
- Ch14: Exposing individual components, error handling for remote failures, adding new remotes, Rspack alternative, nx graph.
- Ch15: Best practices (10, including "know what to hand off to DevOps"), pitfalls table (13 with Docker/AWS entries, framing DevOps-side pitfalls as "ask your DevOps team to check..."), performance tips.
- Appendix A: Quick reference card with the 10 most common Nx/MFE commands.
- Appendix B: **DevOps Handoff Checklist** (a one-page summary the frontend dev can copy-paste into a Slack message or Jira ticket for the DevOps team, listing: build commands per app, output directory structure, manifest file location and format, CORS requirements, cache-busting rules for remoteEntry.js, environment-specific manifest URLs, Docker build args).

## Final Quality Check

Before writing each file, ask yourself:
1. Could a beginner follow this without Googling anything?
2. Does every code block compile as written?
3. Is every "why" answered before the "how"?
4. Are there any undefined terms?
5. Does the chapter end with a clear transition to the next?
6. For Docker/CI/AWS content: is this framed as "understand and hand off" rather than "write it yourself"? Would a frontend dev reading this feel confident discussing deployment with their DevOps team without feeling like they need to become a DevOps engineer?

Search the web to verify every command, import path, and generator flag before including it.