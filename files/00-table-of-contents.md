# Microfrontends with Angular in an Nx Monorepo Using Webpack Module Federation with Dynamic Federation

**Nx 22 | Angular 21 | @module-federation/enhanced | Dynamic Federation**

*A Complete Practical Guide | March 2026*

---

## About This Guide

This guide teaches you how to build a production-grade microfrontend architecture combining three tools:

- **Angular 21** as the UI framework (standalone components, signals, new control flow)
- **Nx 22** as the monorepo build system (caching, affected builds, generators, boundaries)
- **Webpack Module Federation** as the runtime integration layer (dynamic remotes, shared singletons)

> **Nx wraps raw Webpack Module Federation** with its own abstraction (`withModuleFederation` from `@nx/module-federation/angular`). You never write raw `ModuleFederationPlugin` config. Under the hood, Nx uses the **`@module-federation/enhanced`** package, which is maintained by Zack Jackson (the creator of Module Federation) and the ByteDance team. If you see tutorials using `@angular-architects/module-federation`, that is a separate community package with a different API. This guide uses the **Nx-native** approach (`@nx/angular/mf` for runtime helpers, `@nx/module-federation` for build config).

> **Why Webpack and not esbuild?** Angular 21 defaults to esbuild/Vite for builds. However, Module Federation is a Webpack feature. Choosing Webpack as the bundler is required for this approach. If you want to stay on esbuild, look into **Native Federation** (`@angular-architects/native-federation`) instead, which is covered in a separate guide. Nx 22 also supports **Angular Rspack**, a Rust-based Webpack-compatible bundler that supports Module Federation with significantly faster build times. It is a viable alternative worth evaluating.

---

## Table of Contents

### Part 1: Foundations and Setup
- **Chapter 1: The Big Picture** -- Architecture overview, Static vs. Dynamic Federation, the MF enhanced runtime
- **Chapter 2: Workspace Setup** -- Creating the Nx workspace and generating Host + Remotes in one step

### Part 2: Configuration, Libraries, and Providers
- **Chapter 3: Understanding the Generated Configuration** -- Every generated file explained line by line
- **Chapter 4: Shared Libraries** -- Generating, sharing, the AuthService pattern, adding libs later
- **Chapter 5: Angular Providers and Routing in MFE** -- provideHttpClient, provideRouter, app.config.ts, dual routing, router-outlet
- **Chapter 6: Enforcing Module Boundaries** -- Tags, constraints, the type:app rule

### Part 3: Features, Workflow, Communication, and Styles
- **Chapter 7: Building Features in Remotes** -- Complete, compilable code examples with every import
- **Chapter 8: Serving and Development Workflow** -- Dev remotes, static remotes, caching, resource warnings
- **Chapter 9: Shared State and Cross-MFE Communication** -- Services, signals (with singleton warning), events
- **Chapter 10: CSS and Style Isolation** -- ViewEncapsulation, CSS custom properties, theming strategy

### Part 4: Deployment, Versions, and Testing
- **Chapter 11: CI/CD and Deployment on AWS with Docker** -- Dockerized builds, S3+CloudFront, ECS/ECR, manifest injection, GitHub Actions pipeline
- **Chapter 12: Version Management and Shared Dependencies** -- Negotiation, strictVersion behavior, alignment
- **Chapter 13: Testing Strategy** -- Unit, integration, contract testing with working code

### Part 5: Advanced Patterns and Best Practices
- **Chapter 14: Advanced Patterns** -- Exposing components, error handling, adding remotes, Rspack
- **Chapter 15: Best Practices and Pitfalls** -- 10 best practices, 13 pitfalls with fixes, performance tips
