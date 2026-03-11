# Part 1: Foundations and Setup

---

## Chapter 1: The Big Picture

This guide teaches you how to build a production-grade microfrontend architecture combining three powerful tools: Angular as the UI framework, Nx as the monorepo build system, and Webpack Module Federation as the runtime integration mechanism.

Each tool solves a specific problem. Angular gives you a component-based, strongly-typed framework for building features. Nx provides intelligent task orchestration, caching, code generation, and dependency management across many projects in one repository. Module Federation allows separately built Angular applications to share code at runtime, loading remote features on demand without bundling them together.

When combined, you get a system where multiple teams can own independent features (each an Angular application), develop them in a single Nx workspace with shared libraries, and deploy them independently while composing them into a unified user experience at runtime.

### Architecture Overview

| Layer | Technology | Role |
|---|---|---|
| Monorepo | Nx 22 | Workspace management, caching, affected builds, module boundaries, generators |
| Shell (Host) | Angular 21 + Webpack | Container app: layout, navigation, auth, loads remotes via federation |
| Remotes (MFEs) | Angular 21 + Webpack | Feature apps: each exposes routes/components consumed by the shell |
| Shared Libraries | Nx libs (`@org/...`) | UI components, services, models, utils shared as singletons at runtime |
| Federation Runtime | `@module-federation/enhanced` via Nx | Loads remotes, negotiates shared deps, resolves versions |

> **The technology stack under the hood:** Nx uses the `@module-federation/enhanced/webpack` package (maintained by Zack Jackson, the creator of Module Federation, and the ByteDance team). Nx wraps this with its own helper (`withModuleFederation` from `@nx/module-federation/angular`), which reads your Nx project graph and auto-generates the correct Module Federation config. You never configure `ModuleFederationPlugin` directly. When debugging, error messages may reference `@module-federation/enhanced`, so it helps to know this layer exists.

### Static vs. Dynamic Federation

| Mode | How Remotes Are Found | Rebuild on URL Change? | Use Case |
|---|---|---|---|
| Static | Remote names listed in `module-federation.config.ts`; Nx resolves their serve URLs | Yes | Local development, learning |
| Dynamic | Remote URLs loaded from a JSON manifest at runtime | No (change manifest only) | Production, multi-environment |

**This guide uses Dynamic Federation throughout.** It is the recommended approach for any real-world project because it enables the "build once, deploy everywhere" pattern.

---

## Chapter 2: Workspace Setup

### Prerequisites

- Node.js 20.19+ (required by Nx 22)
- npm, yarn, or pnpm
- Basic knowledge of Angular standalone components and routing

### Step 1: Create an Empty Nx Workspace

We start with the `apps` preset (an empty workspace) rather than `angular-monorepo`. This avoids generating any app upfront and gives us full control over how the host is scaffolded with Module Federation.

```bash
npx create-nx-workspace@latest mfe-platform \
  --preset=apps \
  --nxCloud=skip

cd mfe-platform
```

### Step 2: Install the Angular Plugin

```bash
npm install @nx/angular
```

This installs Angular, Webpack, and all the Module Federation infrastructure that Nx needs.

### Step 3: Generate the Host and All Remotes in One Command

This is the key step. Nx's `@nx/angular:host` generator creates the shell application, generates all specified remotes, wires Module Federation, configures routing, splits `main.ts`/`bootstrap.ts`, and creates the dynamic manifest. All in one command:

```bash
nx g @nx/angular:host apps/shell \
  --remotes=mfe-products,mfe-orders,mfe-account \
  --dynamic \
  --prefix=app \
  --style=scss
```

> **What `--dynamic` does:**
> 1. Creates `module-federation.manifest.json` in the shell's `src/assets/` with URLs for each remote.
> 2. Generates `main.ts` that fetches the manifest, calls `setRemoteDefinitions()`, then imports `bootstrap.ts`.
> 3. Generates `bootstrap.ts` with the actual `bootstrapApplication()` call.
> 4. Configures routes in `app.routes.ts` using `loadRemoteModule()` from `@nx/angular/mf`.
> 5. Keeps the `remotes` array in `module-federation.config.ts` populated with remote names (Nx uses this for `nx serve` to auto-build static remotes).

> **What the generator does for each remote:**
> 1. Creates a separate Angular application with its own `module-federation.config.ts`, `webpack.config.ts`, `main.ts`, `bootstrap.ts`.
> 2. Configures an `exposes` block pointing to `entry.routes.ts`.
> 3. Generates a `RemoteEntryComponent` and `entry.routes.ts` as the federated entry point.
> 4. Assigns unique ports (shell: 4200, mfe-products: 4201, mfe-orders: 4202, mfe-account: 4203).
> 5. Adds a lazy route to the shell's `app.routes.ts` for each remote.

### Step 4: Verify the Workspace Structure

```
mfe-platform/
  apps/
    shell/                    # Host app (port 4200)
    shell-e2e/                # E2E tests
    mfe-products/             # Remote (port 4201)
    mfe-orders/               # Remote (port 4202)
    mfe-account/              # Remote (port 4203)
  libs/                       # Shared libraries (next chapter)
  nx.json
  tsconfig.base.json
  package.json
```

### Step 5: Verify Nx and Angular Versions

```bash
npx nx report
```

Confirm you see `@nx/angular`, `@nx/module-federation`, and Angular 21.x. If the Angular version is wrong, run `nx migrate latest`.

### Step 6: Quick Smoke Test

```bash
nx serve shell
```

Navigate to `http://localhost:4200`. You should see the shell with navigation links. Clicking a link loads the remote's `RemoteEntryComponent` via Module Federation. Nx auto-builds all remotes as static builds (or restores from cache) and serves them alongside the shell.

> **If it works, the foundation is solid.** You now have a fully wired dynamic MFE architecture with zero manual Webpack configuration. Everything that follows builds on this foundation.
