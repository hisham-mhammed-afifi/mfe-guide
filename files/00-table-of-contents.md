# Microfrontends with Angular, Nx, and Module Federation

**A Complete Practical Guide**

Nx 22 | Angular 21 | Webpack Module Federation | Dynamic Federation

*March 2026*

---

## Who This Guide Is For

You are a **beginner-to-intermediate Angular developer**. You have built at least one Angular application with standalone components and routing, but you have never worked with microfrontends, Nx monorepos, or Module Federation. You may not know what Webpack is. This guide assumes zero prior knowledge of anything beyond core Angular.

You are a **frontend developer, not a DevOps engineer**. A separate DevOps team handles Dockerfiles, CI pipelines, AWS infrastructure, and deployment scripts. This guide gives you enough understanding of those topics to collaborate with DevOps effectively, hand off the right artifacts, and participate in architecture discussions, without expecting you to write or maintain infrastructure code yourself.

## Prerequisites

- **Node.js 20+** installed (22.x LTS recommended)
- **npm**, yarn, or pnpm
- **Angular CLI basics**: you know what `ng serve` and `ng generate component` do
- **Standalone components**: you have used `@Component({ ... })` and `provideRouter()`
- **Basic terminal comfort**: you can run commands and read their output
- **Docker** (24+, optional): needed only for local integration testing in Chapters 11 and 13. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) before reaching those chapters.

## Technology Versions

| Technology | Version | Purpose |
|---|---|---|
| Angular | 21.x | UI framework (standalone components, signals, zoneless by default, new control flow) |
| Nx | 22.4.5 | Monorepo build system (caching, generators, boundaries) |
| Webpack | 5.x | Bundler (required for Module Federation) |
| `@module-federation/enhanced` | 0.8.x | Module Federation runtime (maintained by Zack Jackson and ByteDance) |
| `@nx/module-federation` | 22.4.5 | Nx's abstraction over Module Federation |
| Vitest | 4.x | Unit test runner (Angular 21 default, replaces Karma/Jasmine) |
| TypeScript | 5.9+ | Type system |
| Docker | 24+ | Reproducible builds and local integration testing |

## How to Use This Guide

This guide is a **narrative path**. Each chapter builds on the previous one. Skipping ahead will leave you missing context that later chapters assume.

Chapter 1 is concepts only, with no code. Chapter 2 introduces your first commands and walks you through workspace setup. Code complexity increases steadily from there. Docker and AWS appear only after everything works locally, and they are framed as "understand and hand off to DevOps" rather than "write it yourself." The one exception is `docker compose up` for local integration testing, which you run yourself.

The running example throughout the entire guide is an **e-commerce platform** with four applications:

- **`shell`** (host): layout, navigation, authentication
- **`mfe_products`** (remote): product listing, product detail
- **`mfe_orders`** (remote): order history, order tracking
- **`mfe_account`** (remote): user profile, settings

By the end, you will have a fully working microfrontend system running locally, with reference artifacts ready to hand off to your DevOps team for production deployment.

---

## Table of Contents

### Part 1: Foundations and Setup

- **Chapter 1: The Big Picture**
  What is a microfrontend? What is a monorepo? What is Module Federation? Why combine all three? This chapter answers these questions with zero code, using the e-commerce platform as a running analogy.

- **Chapter 2: Workspace Setup**
  Create the Nx workspace, generate the shell and all three remotes in a single command, and verify everything works with a smoke test.

### Part 2: Configuration, Libraries, Providers, and Boundaries

- **Chapter 3: Understanding the Generated Configuration**
  Walk through every file the generator created. Every line explained, nothing hand-waved.

- **Chapter 4: Shared Libraries**
  Generate reusable libraries for UI components, services, and models. Build a complete AuthService that works across all microfrontends.

- **Chapter 5: Angular Providers and Routing in MFE**
  The provider problem, `app.config.ts` for shell and remotes, dual routing, `<router-outlet>` placement, and the dreaded `NullInjectorError`.

- **Chapter 6: Enforcing Module Boundaries**
  Tags, constraints, the `type:app` rule. Prevent microfrontends from importing each other's internals.

### Part 3: Features, Workflow, Communication, and Styles

- **Chapter 7: Building Features in Remotes**
  Build the products feature end-to-end with complete, compilable code. Every import shown, every file complete.

- **Chapter 8: Serving and Development Workflow**
  Dev remotes vs. static remotes, the `--devRemotes` flag, caching, and resource warnings.

- **Chapter 9: Shared State and Cross-MFE Communication**
  Shared services, signals (with the singleton warning), and custom events.

- **Chapter 10: CSS and Style Isolation**
  ViewEncapsulation, CSS custom properties, theming strategy, and rules to prevent style leaking.

### Part 4: Deployment, Versions, and Testing

- **Chapter 11: What Your DevOps Team Needs From You**
  Responsibility boundaries, Docker multi-stage builds, nginx config, docker-compose for local testing, manifest injection, CI/CD pipeline reference, AWS architecture overview, CORS, and CloudFront cache behaviors. Includes a "Checklist: What to Tell Your DevOps Team."

- **Chapter 12: Version Management and Shared Dependencies**
  How Module Federation negotiates versions at runtime, `strictVersion` behavior (warning, not crash), and keeping versions aligned with `nx migrate`.

- **Chapter 13: Testing Strategy**
  Unit tests with Vitest (Angular 21's default test runner), integration tests with Docker Compose, and contract tests with working code.

### Part 5: Advanced Patterns and Best Practices

- **Chapter 14: Advanced Patterns**
  Exposing individual components, error handling for remote failures, adding new remotes to an existing setup, the Rspack alternative, and `nx graph`.

- **Chapter 15: Best Practices and Pitfalls**
  10 best practices (including "know what to hand off to DevOps"), 15 pitfalls with fixes (including NG0203 toSignal() in MFE remotes and the styles.js import.meta error), and performance tips.

- **Appendix A: Quick Reference Card**
  The 10 most common Nx and Module Federation commands.

- **Appendix B: DevOps Handoff Checklist**
  A one-page summary you can copy into a Slack message or Jira ticket for your DevOps team.
