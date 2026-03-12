# Part 1: Foundations and Setup

---

## Chapter 1: The Big Picture

### What Is a Microfrontend?

A **microfrontend** is a frontend application that owns one slice of a larger product. Instead of building one giant Angular application that contains every feature (products, orders, account settings, admin dashboard), you build several smaller Angular applications. Each one is responsible for a single business domain.

Think of an e-commerce website. The product catalog, the order history page, and the account settings page are all distinct features. In a microfrontend architecture, each of these is its own Angular application, built and deployed independently. A **shell** application (sometimes called the "host") stitches them together into a seamless experience for the user.

The user sees one website. Under the hood, that website is composed of multiple independently built applications loaded at runtime.

### What Is a Monorepo?

A **monorepo** (short for "monolithic repository") is a single Git repository that contains multiple projects. Instead of having separate repositories for `shell`, `mfe_products`, `mfe_orders`, and `mfe_account`, all four live side by side in one repository.

Why? Because microfrontends that share libraries, models, and services need to stay in sync. A monorepo makes it easy to share code, run a single `npm install`, and ensure everyone uses the same Angular version. The alternative (separate repositories per MFE) creates significant coordination overhead for small-to-medium teams.

**Nx** is the monorepo tool we use. It provides intelligent build caching (skip work that has not changed), code generators (scaffold apps and libraries with one command), and dependency analysis (know which apps are affected by a code change).

### What Is Module Federation?

**Module Federation** is a Webpack feature that allows separately built JavaScript applications to share code at runtime. When the user navigates to `/products`, the shell does not contain the products code. Instead, it fetches the products application's JavaScript bundle from a URL, loads it into the browser, and renders it inside the shell's layout.

The key insight: each microfrontend is built independently and produces its own JavaScript bundle. Module Federation handles the loading, the code sharing, and the version negotiation at runtime.

> **Note:** Module Federation is a Webpack feature, not an Angular feature. Angular 21 defaults to esbuild for builds, but we use Webpack because Module Federation requires it. Nx handles this bundler choice automatically when you generate a host or remote. If you want to stay on esbuild, look into **Native Federation** (`@angular-architects/native-federation`) instead, which is a separate community package not covered in this guide.

> **Note:** Angular 21 apps are zoneless by default. This means Zone.js is not included, and change detection is driven by signals. In practice, apps work the same for most use cases, but testing utilities like `fakeAsync`/`tick` from Zone.js are unavailable (Vitest's `vi.useFakeTimers()` is used instead).

### Why Combine All Three?

Each tool solves a different problem:

| Tool | What It Solves |
|---|---|
| **Angular** | Building component-based, strongly typed UI features |
| **Nx** | Managing multiple projects in one repository with caching, generators, and boundaries |
| **Module Federation** | Loading separately built applications into one shell at runtime |

When combined, you get a system where multiple teams can own independent features (each a separate Angular application), develop them in a single Nx workspace with shared libraries, and deploy them independently while composing them into a unified user experience at runtime.

### Architecture Overview

Here is what the system looks like:

```
+--------------------------------------------------------+
|                    Browser                             |
|                                                        |
|  +---------------------------------------------------+ |
|  |                SHELL (Host)                       | |
|  |  Layout, Navigation, Auth, Global Providers       | |
|  |                                                   | |
|  |  +------------+  +------------+  +-------------+  | |
|  |  |            |  |            |  |             |  | |
|  |  |  Products  |  |   Orders   |  |   Account   |  | |
|  |  |  (Remote)  |  |  (Remote)  |  |  (Remote)   |  | |
|  |  |            |  |            |  |             |  | |
|  |  +------------+  +------------+  +-------------+  | |
|  +---------------------------------------------------+ |
+--------------------------------------------------------+
                         |
         Shared Libraries (loaded once as singletons)
         @angular/core, AuthService, shared UI, models
```

A **singleton** means exactly one instance exists in the browser, shared by all microfrontends. Module Federation ensures that libraries like `@angular/core` are loaded once and reused, not duplicated per remote.

The shell is the container. It provides the page layout, navigation bar, and global services (like authentication). When the user clicks "Products," the shell fetches the products remote's code over the network, loads it, and renders it in a designated area of the page.

### Static vs. Dynamic Federation

There are two ways Module Federation can discover where remotes live:

| Mode | How Remotes Are Found | Rebuild on URL Change? | Use Case |
|---|---|---|---|
| **Static** | Remote URLs are hardcoded at build time | Yes | Learning, simple setups |
| **Dynamic** | Remote URLs are loaded from a JSON file (called a **manifest**) at runtime | No (change the JSON file only) | Production, multi-environment |

**This guide uses Dynamic Federation throughout.** It is the recommended approach for any real project because it enables the "build once, deploy everywhere" pattern. You build the shell once, and swap the manifest to point remotes at different URLs per environment (dev, staging, production).

### The Technology Stack Under the Hood

You will interact with Nx commands and Angular code. Under the hood, several layers work together:

| Layer | Technology | Role |
|---|---|---|
| Monorepo | Nx 22.x | Workspace management, caching, affected builds, module boundaries, generators |
| Shell (Host) | Angular 21 + Webpack | Container app: layout, navigation, auth, loads remotes via federation |
| Remotes (MFEs) | Angular 21 + Webpack | Feature apps: each exposes routes/components consumed by the shell |
| Shared Libraries | Nx libs (`@mfe-platform/...`) | UI components, services, models, utilities shared as singletons at runtime |
| Federation Runtime | `@module-federation/enhanced` via Nx | Loads remotes, negotiates shared deps, resolves versions |

> **Note:** Nx uses the `@module-federation/enhanced` package (maintained by Zack Jackson, the creator of Module Federation, and the ByteDance team). Nx wraps this with its own helper called `withModuleFederation`, which reads your Nx project graph and auto-generates the correct Module Federation config. You never configure the underlying `ModuleFederationPlugin` directly. At runtime, you use `loadRemote` and `registerRemotes` from `@module-federation/enhanced/runtime` to load remotes dynamically. When debugging, error messages may reference `@module-federation/enhanced`, so it helps to know this layer exists.

Now that you understand what each piece does and why they work together, let's create the workspace and generate all four applications.

---

## Chapter 2: Workspace Setup

### Prerequisites

Before you begin, verify you have:

- **Node.js 20+** (22.x LTS recommended): run `node -v` to check
- **npm** (or yarn/pnpm): run `npm -v` to check
- A terminal (VS Code integrated terminal works fine)

### Step 1: Create an Empty Nx Workspace

We start with the `apps` preset, which creates an empty workspace with no applications. This gives us full control over how the shell is scaffolded with Module Federation.

```bash
npx create-nx-workspace@22.4.5 mfe-platform \
  --preset=apps \
  --nxCloud=skip

cd mfe-platform
```

> **Note:** The `--nxCloud=skip` flag skips Nx Cloud setup. You can enable it later for remote caching. Nx Cloud stores build artifacts on a shared server. When a teammate (or CI) has already built a project, your machine downloads the cached result instead of rebuilding. This is optional and can be enabled later. The `apps` preset (as opposed to `angular-monorepo`) avoids generating any application upfront. (The `angular-monorepo` preset would generate a single Angular application automatically, which we do not want because we will generate the host with Module Federation wiring instead.)

> **Note:** The `apps/` directory is created by the host generator in Step 3, not by the workspace preset.

> **Note:** Commands in this guide use `\` for line continuation, which works in bash, zsh, and Git Bash. On Windows CMD, use `^` instead. On PowerShell, use `` ` ``. Alternatively, paste each command on a single line without the continuation characters.

### Step 2: Install the Angular Plugin

```bash
npm install @nx/angular@22.4.5
npm install @angular/animations@"~21.1.0"
```

The `@nx/angular` package installs Angular, Webpack, and all the Module Federation infrastructure that Nx needs. You do not need to install `@module-federation/enhanced` or any Webpack packages separately. The second command installs `@angular/animations`, which is required by `provideAnimationsAsync()` (used in Chapter 5) but is not included automatically by `@nx/angular`.

### Step 3: Generate the Shell and All Remotes

This is the key step. Nx's `@nx/angular:host` generator creates the shell application, generates all specified remotes, wires Module Federation config, configures routing, splits `main.ts`/`bootstrap.ts`, and creates the dynamic manifest. All in one command:

```bash
npx nx g @nx/angular:host apps/shell \
  --remotes=mfe_products,mfe_orders,mfe_account \
  --dynamic \
  --prefix=app \
  --style=scss \
  --no-interactive
```

> **Note:** Nx does not allow hyphens in remote names. Remote names can only contain letters, digits, underscores, and dollar signs. This guide uses snake_case (`mfe_products`) throughout.

Here is what each flag does:

| Flag | Purpose |
|---|---|
| `apps/shell` | Directory where the host app is created |
| `--remotes=...` | Generates these remote apps and wires them to the shell |
| `--dynamic` | Enables dynamic federation (manifest-based URL resolution) |
| `--prefix=app` | HTML selector prefix for components (e.g., `<app-root>`) |
| `--style=scss` | Use SCSS for stylesheets |
| `--no-interactive` | Skip interactive prompts and use defaults |

> **What `--dynamic` does behind the scenes:**
> 1. Creates `module-federation.manifest.json` in the shell's `public/` directory with localhost URLs for each remote.
> 2. Generates `main.ts` that fetches the manifest, calls `registerRemotes()`, then imports `bootstrap.ts`.
> 3. Generates `bootstrap.ts` with the actual `bootstrapApplication()` call.
> 4. Configures routes in `app.routes.ts` using `loadRemote()` from `@module-federation/enhanced/runtime`.
> 5. Nx discovers which remotes belong to this host from the project graph during `nx serve`.

> **What the generator does for each remote:**
> 1. Creates a separate Angular application with its own `module-federation.config.ts`, `webpack.config.ts`, `main.ts`, and `bootstrap.ts`.
> 2. Configures an `exposes` block pointing to `entry.routes.ts` (the federated entry point).
> 3. Generates a placeholder `RemoteEntry` component and `entry.routes.ts`.
> 4. Assigns unique ports: shell on 4200, mfe_products on 4201, mfe_orders on 4202, mfe_account on 4203.
> 5. Adds a lazy route to the shell's `app.routes.ts` for each remote.

> **Note:** In Angular 21, `standalone: true` is the default for components and directives. You will not see `standalone: true` in any generated code or in this guide. If you see it in older tutorials, it is no longer necessary.

### Step 4: Verify the Workspace Structure

Your workspace should now look like this:

```
mfe-platform/
  apps/
    shell/                      # Host application (port 4200)
    shell-e2e/                  # End-to-end tests for the shell
    mfe_products/                # Remote: product catalog (port 4201)
    mfe_products-e2e/            # E2E tests for products remote
    mfe_orders/                  # Remote: order management (port 4202)
    mfe_orders-e2e/              # E2E tests for orders remote
    mfe_account/                 # Remote: user account (port 4203)
    mfe_account-e2e/             # E2E tests for account remote
  nx.json                       # Nx workspace configuration
  tsconfig.base.json            # Shared TypeScript config
  vitest.workspace.ts           # Vitest workspace configuration (auto-generated)
  package.json                  # Single dependency tree for all apps
```

> **Note:** The `libs/` directory does not exist yet. It will be created automatically when you generate your first shared library in Chapter 4.

> **Note:** Each app also contains a `vite.config.mts` file for Vitest configuration. This is generated automatically and typically needs no changes.

### Step 5: Verify Nx and Angular Versions

```bash
npx nx report
```

Confirm you see `@nx/angular`, `@nx/module-federation`, and Angular 21.x in the output. If the Angular version is wrong, run `npx nx migrate latest` to align.

### Step 6: Smoke Test

```bash
npx nx serve shell
```

Navigate to `http://localhost:4200`. You should see the Nx welcome page with links for each remote. Clicking a link (e.g., the mfe_products link) loads that remote's placeholder component via Module Federation. We will replace this welcome page with a proper layout later. Nx automatically builds all remotes (or restores them from cache) and serves them alongside the shell.

> **Note:** The first time you run `npx nx serve shell`, Nx must build all three remotes from scratch before the shell can start. This can take several minutes depending on your machine. Subsequent runs are much faster because Nx caches the build output and skips unchanged projects.

> **What just happened?**
>
> - [x] Created an Nx monorepo with the `apps` preset
> - [x] Installed the `@nx/angular` plugin (which brings Webpack and Module Federation)
> - [x] Generated 1 host + 3 remotes with full Module Federation wiring in a single command
> - [x] Each app has its own `module-federation.config.ts`, `webpack.config.ts`, `main.ts`, and `bootstrap.ts`
> - [x] The shell has a `module-federation.manifest.json` with localhost URLs for all remotes
> - [x] The shell's `app.routes.ts` has lazy routes that load each remote via `loadRemote()`
> - [x] Running `nx serve shell` builds all remotes and serves the full system on `localhost:4200`

If it works, the foundation is solid. You now have a fully wired dynamic microfrontend architecture with zero manual Webpack configuration.

Everything that follows builds on this foundation. In the next chapter, we walk through every generated file line by line so you understand exactly what Nx created and why.
