# Student Notes: Microfrontends with Angular, Nx, and Module Federation

*Read by: Junior Angular developer, 1 year experience, zero MFE/Nx/Docker knowledge*

---

## Chapter 1: The Big Picture

### Key Takeaways
- A microfrontend is just a smaller Angular app that owns one feature area. Multiple MFEs compose into one user-facing website.
- A monorepo keeps all these apps in one Git repo so they share dependencies and stay in sync.
- Module Federation is the Webpack feature that lets the browser load separately-built JS bundles at runtime and stitch them together.
- Dynamic Federation means the URLs for remotes come from a JSON file at runtime, not baked in at build time. This lets you build once and deploy to any environment by swapping the JSON.
- A "singleton" in this context means only one copy of a library (like Angular itself) exists in the browser, shared by all MFEs.

### My Notes
So basically instead of one massive Angular app, you split it into a "shell" (which is the outer frame, nav bar, layout) and multiple "remotes" (each one owns a feature like products or orders). The shell fetches the remote's JavaScript at runtime when the user navigates to that section. The user has no idea multiple apps are running.

The monorepo approach makes sense. If you had separate Git repos for each MFE, keeping Angular versions and shared code in sync would be a nightmare. Nx is the tool that manages the monorepo. It does caching (so you do not rebuild things that have not changed), code generation, and dependency tracking.

The aha moment was understanding that Module Federation is a *Webpack* thing, not an Angular thing. Angular 21 actually defaults to esbuild, but we explicitly use Webpack because that is where Module Federation lives. Nx handles this choice for you when you generate the apps.

Dynamic Federation was also a big click. The shell reads a JSON file to find remote URLs. In dev, those are localhost URLs. In production, they are CDN URLs. You swap the JSON, not rebuild the app. That is the "build once, deploy everywhere" pattern.

### What I Found Confusing
- The note says "Nx wraps this with its own helper called `withModuleFederation`" and mentions `@module-federation/enhanced` maintained by "Zack Jackson and the ByteDance team." I do not know who Zack Jackson is or why ByteDance is involved. This is not blocking, but it felt like insider knowledge dropped without context.
- The term "version negotiation at runtime" is mentioned but not explained yet. I get the general idea but I am not sure what happens if two remotes need different versions of the same library.

### Questions I Would Ask the Author
- If Angular 21 defaults to esbuild and Module Federation needs Webpack, does that mean I am stuck on an older/slower build system? What is the practical cost?
- The guide mentions Native Federation as an alternative for esbuild. Is it production-ready? Why not use that instead?
- When the shell fetches a remote's bundle, how big is that network request typically? Would a user on slow 3G notice a delay?

---

## Chapter 2: Workspace Setup

### Key Takeaways
- One `npx nx g @nx/angular:host` command creates the shell AND all three remotes, wires Module Federation, sets up routing, creates the manifest, and splits `main.ts`/`bootstrap.ts`.
- The `--dynamic` flag is what enables manifest-based URL resolution at runtime.
- Each app gets its own port (shell: 4200, products: 4201, orders: 4202, account: 4203).
- `standalone: true` is the default in Angular 21. You do not write it anymore.
- `nx serve shell` builds all remotes (or restores from cache) and serves the entire system.

### My Notes
This was surprisingly straightforward. Three commands and you have a full microfrontend setup:
1. Create an empty Nx workspace
2. Install `@nx/angular`
3. Generate the host with `--remotes` and `--dynamic`

The generator does a LOT behind the scenes. It creates the manifest JSON, the `main.ts`/`bootstrap.ts` split, route configuration, and unique ports for each remote. I am used to `ng new` creating a single app. This is like `ng new` on steroids.

The fact that `npm install @nx/angular` installs Angular, Webpack, AND Module Federation infrastructure is nice. I do not need to hunt for packages.

The workspace structure is clean. `apps/` for the four applications, `libs/` for shared code (empty for now), and config files at the root.

### What I Found Confusing
- The guide says to use `--preset=apps` instead of `angular-monorepo`. It briefly says "avoids generating any application upfront" but I am not clear on what the `angular-monorepo` preset would have done differently. Would it have created a single Angular app automatically?
- It mentions `--nxCloud=skip` with a note about remote caching. I do not understand what "remote caching" means in this context. Is it caching builds on a server so my teammates do not rebuild the same thing? That was not explained.

### Questions I Would Ask the Author
- If I already have an existing Angular CLI project, can I convert it to this Nx MFE setup? Or do I have to start from scratch?
- The generator assigns ports automatically (4200-4203). What if I already have something running on port 4201? Can I change it, and where?
- What happens if the smoke test (`nx serve shell`) fails? What are the most common reasons and how do I debug?

---

## Chapter 3: Understanding the Generated Configuration

### Key Takeaways
- `module-federation.config.ts` declares the app's name, its role (host vs. remote), and what it exposes or consumes.
- `webpack.config.ts` uses `withModuleFederation()` to auto-configure sharing. You never touch this file.
- `main.ts` fetches the manifest, calls `registerRemotes()`, then dynamically imports `bootstrap.ts`. The split is needed so Module Federation can negotiate shared deps before Angular starts.
- The manifest JSON maps remote names to base URLs. The code appends `/remoteEntry.js` to each URL.
- `loadRemote()` is how the shell's routes fetch remote code at runtime. It is basically lazy loading but across separately built apps.
- The `remotes` array in the shell's config is for the dev server (so Nx knows what to build). At runtime, the manifest takes over.

### My Notes
This chapter was dense but extremely valuable. I now understand what every generated file does.

The biggest aha: the `main.ts` / `bootstrap.ts` split. The reason is that Module Federation needs to negotiate which version of Angular, RxJS, etc. to use *before* Angular starts bootstrapping. If you put everything in one file, Angular would try to initialize before federation is ready, and you get mysterious errors. The dynamic `import('./bootstrap')` creates that async pause.

The `registerRemotes()` call in `main.ts` was interesting. The manifest is a simple `{name: url}` object, but `registerRemotes` wants an array of `{name, entry}` objects where `entry` includes `/remoteEntry.js`. So the code does a quick transformation with `Object.entries().map()`.

I was confused about the `remotes` array at first. Why list remote names in the config if dynamic mode uses the manifest? The answer: the `remotes` array is for `nx serve`, so Nx knows which projects to auto-build for the dev server. At runtime in the browser, it is the manifest that matters.

`remoteEntry.js` is the key file for each remote. It is what Module Federation generates, and it tells the runtime what the remote exposes and what shared dependencies it needs. The shell fetches this file to "discover" the remote.

### What I Found Confusing
- The `loadRemote<typeof import('mfe-products/Routes')>('mfe-products/Routes')` syntax is doing a lot. The generic type parameter `typeof import(...)` seems to be a type assertion for TypeScript, but I have never seen `typeof import(...)` used like that. Is `'mfe-products/Routes'` a real import path or a virtual one that only Module Federation understands?
- The file says `export default config` but then a note says it might be `module.exports = config`. I do not know when one would be used vs. the other. What determines this?
- The tip about production error handling in `main.ts` shows setting `document.body.innerHTML` directly. Is that really the recommended approach for a production Angular app? It bypasses Angular entirely.

### Questions I Would Ask the Author
- In `app.routes.ts`, the `loadRemote` call uses `.then((m) => m!.remoteRoutes)`. What does the `!` (non-null assertion) do here, and what happens if `m` actually is null? Would the app crash?
- If I rename a path in `app.routes.ts` from `'mfe-products'` to `'products'`, do I need to change anything else? The tip says the `loadRemote` string must still use the remote's registered name, but I want to make sure I understand the difference between the URL path and the remote name.
- What is `withInterceptorsFromDi()` doing inside `provideHttpClient()`? The guide uses it but never explains it.

---

## Chapter 4: Shared Libraries

### Key Takeaways
- Libraries are organized by scope (which domain owns them) and type (feature, data-access, ui, util, models).
- Always use `--directory`, `--name`, and `--importPath` together when generating libraries in Nx 22.
- Nx auto-detects workspace libraries and shares them as singletons through Module Federation. No manual config needed.
- `@Injectable({ providedIn: 'root' })` services in shared libraries get exactly one instance across all MFEs because Angular's root injector is shared.
- The `AuthService` pattern uses Angular signals internally. When one MFE logs the user in, all other MFEs see the updated auth state instantly.

### My Notes
The library organization pattern makes a lot of sense. You have `shared/` for cross-cutting concerns (auth, UI components, models, utils), and then domain-specific libraries like `products/feature` and `products/data-access`. Each MFE only imports what it needs.

There are 10 library generation commands shown. That is a lot of boilerplate to run, but each one is a one-liner. The `--importPath` flag was new to me. It sets the TypeScript alias that you use in imports (like `@mfe-platform/shared-ui`). The warning says that without it, Nx might derive an unexpected path. Good to know.

The AuthService code was clear. It uses a writable `signal<User | null>(null)` internally, exposes a readonly view via `.asReadonly()`, and a `computed()` for `isAuthenticated`. The `login()` method does an HTTP POST and uses `tap()` to update the signal. Since the service is `providedIn: 'root'` and the library is a shared singleton, every MFE that injects this service gets the same instance. That is the key insight: DI singleton + Module Federation singleton = true cross-MFE shared state.

The "How Nx Auto-Shares Libraries" section was the missing puzzle piece. The `withModuleFederation` helper scans the project graph, finds all dependencies (npm and workspace), and configures them all as shared singletons. You literally just import a library and it works. No manual Webpack config.

### What I Found Confusing
- There are two different generator commands: `@nx/angular:library` (for Angular-specific libs with components/services) and `@nx/js:library` (for plain TypeScript). The guide uses `@nx/js:library` for models and utils. I assume this is because they do not need Angular, but the guide does not explicitly explain the difference.
- The `tap()` operator in the AuthService: `tap((user) => this.currentUser.set(user))`. I know `tap` from RxJS but I have not used it to update a signal before. This pattern of bridging Observables and signals seems important but it is done in one line without much ceremony.
- The library generation commands show `--changeDetection=OnPush` only for `shared-ui`. Why only that library? Is OnPush not recommended for the others?

### Questions I Would Ask the Author
- If I add a new shared library later, do I need to rebuild everything? Or does Nx pick it up incrementally?
- The guide says "No manual Module Federation configuration was needed." But what if I need to NOT share a library as a singleton? How do I override the auto-sharing behavior?
- The `index.ts` files (like `libs/shared/models/src/index.ts`) are exporting from the library. Is this file automatically created by the generator, or do I need to create/update it manually?

---

## Chapter 5: Angular Providers and Routing in MFE

### Key Takeaways
- The shell's `app.config.ts` is the single source of truth for global providers. Remotes inherit everything from the shell's root injector.
- Remotes need their own `app.config.ts` with the same providers, but ONLY for standalone development. When loaded in the shell, the remote's bootstrap is never executed.
- `NullInjectorError: No provider for HttpClient` is the #1 runtime error. Fix: make sure `provideHttpClient()` is in the shell's config.
- Remotes have two routing files: `entry.routes.ts` (exposed via Module Federation for the shell) and `app.routes.ts` (for standalone dev mode).
- The shell needs a `<router-outlet>` where remote content renders. If a remote has child routes, it needs its own `<router-outlet>` too.

### My Notes
This chapter solved several "why" questions I had.

The provider problem is actually elegant once you understand it. The shell bootstraps Angular, creating the root injector with all the global providers. When a remote is loaded inside the shell, it does not re-bootstrap. Module Federation just loads `entry.routes.ts`, and the components rendered from those routes inherit from the shell's injector. So `HttpClient`, `Router`, animations, etc. are all provided by the shell.

But here is the catch: when you run a remote standalone for development (`nx serve mfe-products`), it DOES bootstrap Angular itself. So it needs its own `app.config.ts` with the same providers. Otherwise you get the dreaded `NullInjectorError` in standalone mode.

Dual routing was confusing at first but makes sense now. `entry.routes.ts` is the public API that the shell imports. `app.routes.ts` wraps those same routes for standalone use. The remote reuses its own `entry.routes.ts` inside `app.routes.ts` by wrapping them in a `{ path: '', children: remoteRoutes }`.

The `<router-outlet>` chain was a good callout. The shell has one, and the remote's entry component might need one too if it has child routes. Otherwise you get a blank page inside the shell with no error message.

### What I Found Confusing
- The chapter shows `ProductsShellComponent` (a wrapper component with just a `<router-outlet />`), but Chapter 3 showed `RemoteEntryComponent` as the entry component. How do these relate? When do I use `ProductsShellComponent` vs. `RemoteEntryComponent`? The chapter says "we wire it up fully in Chapter 7" but at this point I am holding two mental models.
- `withComponentInputBinding()` is passed to `provideRouter()` in the shell's config. The guide never explains what this does. I am guessing it lets route params be bound directly to component inputs, but I am not sure.
- The concept of "injector" is defined as "Angular's dependency injection container that holds service instances," which is helpful. But the sentence structure made me re-read it twice because the definition is inlined in the middle of a complex sentence about bootstrap flow.

### Questions I Would Ask the Author
- If I add a new provider to the shell (like `provideStore()` for NgRx), do I need to redeploy all remotes? Or do they pick it up because they inherit from the shell's injector?
- What happens if a remote accidentally provides `provideHttpClient()` in its own `entry.routes.ts` (not `app.config.ts`)? Does Angular create a second HTTP client? Or does it silently use the shell's?
- The `NullInjectorError` section says "verify it is there before debugging anything else." Are there other common `NullInjectorError` variants in MFE setups beyond `HttpClient`?

---

## Chapter 6: Enforcing Module Boundaries

### Key Takeaways
- Every project gets two tags: `scope:*` (which domain) and `type:*` (what kind of code).
- Boundary rules in ESLint prevent cross-scope imports (e.g., orders importing products internals) and enforce layered architecture (apps depend on features, features on data-access, etc.).
- The `type:app` rule is critical because without it, apps could import from other apps.
- Violations produce clear error messages at lint time.
- Setting up boundaries early prevents coupling before it starts.

### My Notes
This is like access control for imports. You tag every project and then write rules about who can import from whom.

The scope rules are straightforward: products code can only depend on products and shared code. Orders code can only depend on orders and shared. The shell can only depend on shell and shared. No cross-domain access.

The type rules create a layered architecture. The flow is: `app -> feature -> data-access/ui -> util`. Nothing goes upward. A data-access library cannot import from a feature library. This prevents circular dependencies and keeps the architecture clean.

The ASCII diagram of the dependency flow was helpful. I can see at a glance that `feature` can reach down to `data-access`, `ui`, and `util`, but none of those can reach back up.

### What I Found Confusing
- The `eslint.config.js` snippet uses both `sourceTag` and `onlyDependOnLibsWithTags`. I am used to ESLint rules being simpler (like "no unused vars"). This custom rule from Nx is new to me. I understand what it does from context, but I would not have been able to write these rules from scratch.
- The config shows scope AND type rules as separate entries in the same `depConstraints` array. Are they evaluated independently? If something satisfies the scope rule but violates the type rule, does it fail? I assume yes, but the guide does not explicitly say "both must pass."
- The `type:util` rule says `onlyDependOnLibsWithTags: ['type:util']`. So utils can only depend on other utils? That makes sense but the guide does not call it out.

### Questions I Would Ask the Author
- If I lint and find existing violations, does Nx provide a tool to auto-fix them? Or do I have to refactor manually?
- The boundary constraints are enforced at lint time, not build time. Can a developer bypass this by not running lint? Is there a way to enforce it in CI too?
- If I need a products component in the orders MFE (like showing a product name in an order), what is the correct approach? Extract it to `shared`?

---

## Chapter 7: Building Features in Remotes

### Key Takeaways
- The guide builds a complete product feature with full code: model, service, list component, detail component, library exports, and route wiring.
- `toSignal()` from `@angular/core/rxjs-interop` converts an Observable into a signal for template use.
- Import pipes individually (`CurrencyPipe` from `@angular/common`), not `CommonModule`.
- `entry.routes.ts` uses `loadComponent` with dynamic imports from the feature library.
- Remotes can run standalone on their own port for focused development.

### My Notes
This chapter was the most practical so far. It walks through building the products feature end-to-end with every file, every import, and every export shown.

The layered architecture from Chapter 6 comes to life here:
- `shared/models` has the `Product` interface (type: util)
- `products/data-access` has the `ProductService` (type: data-access)
- `products/feature` has `ProductListComponent` and `ProductDetailComponent` (type: feature)
- `mfe-products` app wires them together in `entry.routes.ts` (type: app)

The `toSignal()` pattern was new to me. You pass it an Observable and it returns a signal. The component template reads `products()` as a signal, which is cleaner than doing `| async` in the template. The `{ initialValue: [] }` prevents null values before the HTTP response arrives.

The product detail component does something clever: it reads the route param via `this.route.paramMap.pipe(switchMap(...))` and feeds that into `toSignal`. So the whole pipeline is: route changes -> new ID -> fetch product -> signal updates -> template re-renders. All reactive, no imperative code.

The `entry.routes.ts` update in Step 6 was the key connection. It uses `loadComponent: () => import('@mfe-platform/products-feature').then(m => m.ProductListComponent)`. This lazy-loads the component from the feature library. When Module Federation builds this, the library code is bundled into the remote but shared as a singleton at runtime.

### What I Found Confusing
- Step 6 says to "replace" the placeholder `RemoteEntryComponent` with real routes. But the code shows a completely different file structure. The new `entry.routes.ts` no longer imports `RemoteEntryComponent`. What happens to `entry.component.ts`? Is it just left orphaned in the codebase? Should I delete it?
- The warning about `toSignal` being from `@angular/core/rxjs-interop` and NOT `@angular/core` is helpful. But I am wondering: if I accidentally import from the wrong path, do I get a compile error or a runtime error?
- The `of(null)` fallback in the product detail component: `return id ? this.productService.getById(id) : of(null)`. When would `id` be null if the route is `:id`? Is this defensive coding for an edge case or would this actually happen?

### Questions I Would Ask the Author
- In Step 6, the entry routes use `loadComponent` (lazy single component), not `loadChildren` (lazy route array). Chapter 3 showed `loadChildren` in the shell's routes. When do I use one vs. the other?
- The `ProductListComponent` links to `[routerLink]="[product.id]"`. This is a relative link. How does Angular resolve this? Does it append to the current URL? If I am at `/products`, does clicking a product take me to `/products/123`?
- What about form handling? If I have a "create product" form in the products MFE, would the approach be the same? Create a component in the feature library, add a route in `entry.routes.ts`?

---

## Chapter 8: Serving and Development Workflow

### Key Takeaways
- Dev remotes use `webpack-dev-server` with HMR (instant updates). Static remotes are pre-built and served from cache.
- Use `--devRemotes=mfe-products` to only run HMR for the remote you are editing. Everything else is static.
- Each dev remote consumes 1-2 GB of RAM. Do not run too many at once.
- If remotes do not load, check three things: `remotes` array in config, manifest URLs, and Network tab for failed `remoteEntry.js` requests.

### My Notes
Short chapter, but the key practical insight is: do not make every remote a dev remote. Use `--devRemotes` only for what you are actively working on. Everything else runs from cache as static builds.

The RAM warning is good to know. Each dev remote is its own `webpack-dev-server` instance eating 1-2 GB. With 4 remotes all as dev, that is 8 GB just for the dev servers. My laptop has 16 GB, so I would be in trouble fast.

HMR (Hot Module Replacement) is explained in passing: "changes appear instantly without a full page reload." I know what this is from regular Angular dev, so the MFE version makes sense.

The troubleshooting checklist is practical. Three steps, in order.

### What I Found Confusing
- The chapter mentions "Nx Cloud remote caching" where "even a fresh machine gets cached artifacts." This was mentioned in Chapter 2 as well but never really explained. How does it work? Does it upload build artifacts to a cloud server? Is it free?
- The section about static remotes being "restored from Nx's local cache" raises a question I do not have the answer to: what triggers a cache miss? If I change a file in `shared/ui`, would that invalidate the cache for ALL remotes that depend on it?

### Questions I Would Ask the Author
- If I am running `nx serve shell --devRemotes=mfe-products` and a colleague pushes changes to `mfe-orders`, do I need to restart the shell to pick up their changes? Or does the static remote just serve whatever was last built?
- Is there a way to see which remotes are currently being served as static vs. dev in the terminal output?
- If I do not have Nx Cloud and my local cache is cold (first time or after clearing), how long does it take to build all remotes from scratch?

---

## Chapter 9: Shared State and Cross-MFE Communication

### Key Takeaways
- Pattern 1 (recommended): Shared Angular services with `providedIn: 'root'`. Since Angular runs as a singleton, these services are instantiated once and shared across all MFEs.
- Pattern 2 (caution): Module-level signals. They work ONLY because Module Federation shares the library as a singleton. If someone breaks the singleton config, state silently stops syncing.
- Pattern 3 (fallback): Custom browser events via `window.dispatchEvent`. No type safety, no Angular change detection.
- The golden rule: minimize cross-MFE communication. If two MFEs talk a lot, the domain boundary might be wrong.

### My Notes
The three patterns are clearly ranked: use shared services first, module-level signals with caution, custom events as a last resort.

The warning about module-level signals was eye-opening. If Module Federation's sharing config breaks and a library gets loaded twice, each MFE gets its own copy of the signals. State stops syncing between MFEs with NO error message. That sounds terrifying to debug. The recommendation to use `providedIn: 'root'` services instead makes sense because Angular's DI system is independent of Module Federation's sharing.

Custom events via `window.dispatchEvent` are simple but feel fragile. No TypeScript type checking on the payload, and the receiving MFE does not automatically trigger Angular change detection. You would need to manually call something to update the view.

The best practice about minimizing communication resonated. If products and orders are constantly talking to each other, maybe they should not be separate MFEs.

### What I Found Confusing
- The custom events example casts the listener as `EventListener`. I am not sure why that is needed. Is it a TypeScript thing where `CustomEvent` does not match the expected `Event` type?
- Pattern 2 shows `signal()` and `computed()` imported from `@angular/core`. In Chapter 4, the AuthService also used `signal()` but inside a class. What is the actual difference between putting signals in a class vs. at module level, besides the singleton concern?

### Questions I Would Ask the Author
- For the custom events pattern, how do I get Angular change detection to notice the event? Do I need to inject `NgZone` and run inside the zone?
- If the AuthService is shared and I call `authService.logout()` from the account MFE, does the products MFE's template that reads `authService.isAuthenticated()` update immediately? Or is there a tick delay?
- Can I use RxJS `BehaviorSubject` instead of signals for shared state? What are the trade-offs?

---

## Chapter 10: CSS and Style Isolation

### Key Takeaways
- Angular's default `ViewEncapsulation.Emulated` scopes component styles. This is your primary defense against style leaking.
- Never use `ViewEncapsulation.None` or `::ng-deep` in remote components.
- The shell defines design tokens as CSS custom properties (`:root { --color-primary: ... }`). Remotes consume them via `var(--color-primary)`.
- CSS custom properties work at runtime across separately built apps, unlike Sass variables which are compile-time only.
- Global CSS only goes in the shell. Remotes use only component-scoped styles.

### My Notes
Style leaking is a "top-3 complaint" in microfrontend architectures. That sounds like a real pain. The fix is simple in principle: use Angular's default encapsulation and never go global in remotes.

The CSS custom properties approach for theming is elegant. The shell defines `--color-primary`, `--spacing-md`, etc. in `:root`. Remotes use `var(--color-primary)` in their component styles. Change the variable in the shell, and every MFE updates instantly because CSS custom properties are resolved at runtime by the browser. This is why you cannot use Sass variables for the same purpose: Sass variables are resolved at compile time, and each MFE is compiled separately.

The style rules are clear and actionable: (1) no global CSS in remotes, (2) no `ViewEncapsulation.None` in remotes, (3) CSS custom properties for theming, (4) include Tailwind/Bootstrap in the shell only.

### What I Found Confusing
- The table mentions "shared component styles" in `libs/shared/ui`. How do these work in practice? If I have a shared `ButtonComponent` with styles, and two MFEs use it, are the styles duplicated or shared? Since Angular encapsulates per component instance, I assume each MFE gets its own scoped copy, but I am not sure.
- Tailwind is mentioned ("include it in the shell only, configure it to scan all apps/libs"). This seems like it could be its own section. How does Tailwind's purging work across separately built MFEs? Would unused Tailwind classes be stripped per-MFE or for the whole monorepo?

### Questions I Would Ask the Author
- If a remote developer accidentally uses `ViewEncapsulation.None`, is there a lint rule that catches this? Or do I just have to manually check during code review?
- The shell defines CSS custom properties, but what about dark mode? Would I toggle between two sets of custom properties, and all MFEs automatically switch?
- If I am using a third-party Angular component library (like Angular Material), should I include its theme in the shell only?

---

## Chapter 11: What Your DevOps Team Needs From You

### Key Takeaways
- Each MFE produces a static folder of HTML/JS/CSS. The shell is special because it also has the manifest file.
- `remoteEntry.js` is NOT content-hashed. It changes every deploy but keeps the same filename. This requires special cache handling (60-second TTL).
- The manifest must be swapped per environment after building, before deploying. Two approaches: file replacement (for S3) or Docker entrypoint (for ECS).
- CORS headers are required because the shell at one domain fetches `remoteEntry.js` from another domain.
- S3 + CloudFront is the recommended deployment for static Angular MFEs.

### My Notes
This chapter is clearly "understand and hand off" rather than "write this yourself." The guide repeatedly says to share artifacts with DevOps and provides copy-paste-ready scripts and configs.

The Docker multi-stage build was educational even though I have never written a Dockerfile. The ASCII diagram helped: deps stage (install packages, cached), builder stage (build one app), server stage (tiny nginx image with just the static files). The final image has no Node.js, no source code, just HTML/JS/CSS and nginx. That is surprisingly clean.

The nginx config had an important subtlety: `location = /remoteEntry.js` (exact match) has a 60-second cache, while `location ~* \.(js|css|...)` (regex match) has a 1-year cache. The exact match takes priority in nginx. Without this, `remoteEntry.js` would get a 1-year cache and users would load stale remotes after deploys.

The CI/CD pipeline is a GitHub Actions workflow. The matrix strategy was clever: each MFE runs as a separate parallel job, and only affected apps build and deploy. The "affected" detection uses `nrwl/nx-set-shas` to compare Git SHAs.

Manifest injection has two approaches. For S3: overwrite the JSON file before upload. For ECS: use an entrypoint script that reads environment variables and generates the JSON at container startup. Both achieve the same goal: build once, deploy everywhere.

### What I Found Confusing
- The CI pipeline uses `if: github.ref == 'refs/heads/main'` for the deploy job. I understand this means "only deploy on pushes to main." But the `ci` job runs on both `push` and `pull_request`. Does this mean PRs only lint/test but do not deploy? The guide does not explicitly say this.
- The pipeline step `npx nx show projects --affected --type=app | grep -q "^${{ matrix.app }}$"` is dense bash. I can roughly parse it (list affected apps, check if the current matrix app is in the list), but the `grep -q` flag and the regex anchors `^...$` are not explained.
- The AWS architecture section mentions Route 53, S3, CloudFront, ECS, Fargate, and ECR. That is six AWS services in two paragraphs. Each gets a one-sentence definition, which is helpful, but I still feel lost about how they connect. The ASCII diagram helps for S3+CloudFront but there is no equivalent diagram for the ECS approach.
- Docker Compose uses `--build -d` flags. The `-d` flag is never explained. I assume it means "detached" (run in background) from the one time I heard about it, but the guide should say so.
- The entrypoint script uses `${MFE_PRODUCTS_URL}` syntax. I understand this is a shell variable substitution, but the guide says these come from a "task definition" (ECS) or "ConfigMap" (EKS). I have no idea what those are beyond the parenthetical definitions.

### Questions I Would Ask the Author
- If I change the manifest JSON in production (swapping a remote URL), do users who already have the page open pick up the change? Or do they need to refresh?
- The Docker build uses `npm ci --ignore-scripts`. What are "scripts" and why are they being ignored?
- In the CI pipeline, if the shell is affected but no remotes are, does only the shell deploy? What happens if users are currently on a remote page?
- The CloudFront invalidation step does `--paths "/*"`. Does this invalidate everything? Would that not be expensive or slow?

---

## Chapter 12: Version Management and Shared Dependencies

### Key Takeaways
- Module Federation does version negotiation at runtime. If multiple versions of a shared package exist, it picks the highest semver-compatible one.
- `strictVersion: true` produces a console WARNING, not a crash. The app keeps running but may behave unpredictably.
- Since all apps share one `package.json` in the monorepo, versions stay aligned naturally.
- Run `npx nx migrate latest` regularly to keep everything in sync. After migration, rebuild and redeploy all affected apps.

### My Notes
This was a short but important chapter. The version problem is: what if the shell was built with Angular 21.1.0 but a remote was built a week earlier with 21.0.0? Module Federation handles this by picking the highest compatible version at runtime.

The scary part: `strictVersion: true` does NOT crash the app. It only logs a console warning. So version drift can sneak into production. The detection strategy is: check the browser console for "Unsatisfied version" warnings, and look for duplicate `@angular/core` chunks in the Network tab.

The fix is simple because of the monorepo: everyone shares one `package.json`, so `npm install` gives everyone the same versions. Run `nx migrate latest` to update. But you MUST rebuild and redeploy all affected apps afterward. Otherwise the deployed versions diverge.

### What I Found Confusing
- "Semver-compatible" is mentioned but never defined. I know semver basics (major.minor.patch), but what counts as "compatible"? If the shell has 21.1.0 and a remote has 21.0.0, are those compatible? What about 22.0.0 vs. 21.1.0?
- The chapter says "version drift between deployed builds." This implies a scenario where the shell is deployed with one version and a remote is deployed later with a different version. But if they share `package.json`, how does this happen? Is it because they were built at different times from different commits?

### Questions I Would Ask the Author
- Can Module Federation's version negotiation cause it to pick an OLDER version? For example, if the shell has 21.0.0 but a remote has 21.1.0, would the shell's code run with 21.1.0?
- What happens if a major version mismatch occurs (e.g., Angular 21 vs. Angular 22)? Does the warning still appear, or does it crash?
- Is there a way to make `strictVersion` throw a real error instead of just a warning?

---

## Chapter 13: Testing Strategy

### Key Takeaways
- Angular 21 uses Vitest as the default test runner, replacing Karma/Jasmine. Nx 22.3+ supports this via `vitest-angular`.
- Test files use `.spec.ts` extension. `nx test <project>` runs Vitest in watch mode locally and single-run in CI.
- `describe`, `it`, `expect`, `beforeEach`, `afterEach` are globals (no imports needed). For mocking utilities, import `vi` from `'vitest'`.
- `TestBed`, `HttpTestingController`, and Angular testing utilities work the same way with Vitest.
- Contract tests verify that each remote exports the expected shape (`remoteRoutes` as a non-empty Route array).
- Integration tests use Docker Compose + Playwright to test the full composed system.

### My Notes
Three types of tests, each at a different level:

1. **Unit tests (Vitest):** Test individual services and components in isolation. The `ProductService` test uses `TestBed.configureTestingModule` with `provideHttpClient()` and `provideHttpClientTesting()`, then uses `HttpTestingController` to mock HTTP responses. This is the same pattern I have used before (in Jest), but with Vitest now.

2. **Contract tests:** This is a new concept to me. The idea is that each remote exports `remoteRoutes` from `entry.routes.ts`, and the shell depends on that name and shape. A contract test imports the remote's entry file directly (bypassing Module Federation) and verifies the export exists, is an array, is non-empty, and has a default route (path: ''). If someone renames the export, the test catches it before deployment.

3. **Integration tests (Docker Compose + Playwright):** Build everything in Docker containers, start them up, and run Playwright end-to-end tests against the composed system. This catches problems that unit tests cannot: cross-MFE routing, shared services, Module Federation warnings, duplicate loading.

The sample Vitest output with the tree format and checkmarks was nice to see. I know what to expect now.

The note about Vitest globals was important: `describe`, `it`, `expect` do not need imports (globals are enabled by default), but if I need `vi.fn()` or `vi.useFakeTimers()`, I do need to `import { vi } from 'vitest'`.

### What I Found Confusing
- The contract test imports from `@mfe-platform/mfe-products/entry` which is a path alias added to `tsconfig.base.json`. But this bypasses Module Federation entirely. If the test passes but Module Federation is misconfigured (wrong name in `exposes`), would the test still catch it? I think not. The test only verifies the file shape, not the federation wiring.
- The contract test is placed in `apps/shell/src/app/mfe-contracts.spec.ts`. Does this mean it runs as part of the shell's test suite? How does Vitest resolve the `@mfe-platform/mfe-products/entry` import? Does it follow the tsconfig path alias?
- The integration test section says to run `docker compose up --build -d` and then `npx playwright test`. But the Playwright tests run OUTSIDE Docker, hitting `localhost:4200` which is the Docker container. Is that correct? It was not 100% clear where Playwright is running.
- The Vitest note mentions `vi.useFakeTimers()` / `vi.advanceTimersByTime()` as replacements for `fakeAsync` / `tick`. I have used `fakeAsync` before. Is the Vitest version a 1:1 replacement? The guide says to use `vi.fn()` "instead of `jest.fn()`" but I was using Jest before, so this transition note is helpful.

### Questions I Would Ask the Author
- For the contract test, what if a remote's `entry.routes.ts` has a `loadComponent` with a dynamic import? Would the contract test try to resolve that import? Would it fail because the component has Angular dependencies that are not set up in the test?
- Is there a way to run contract tests in CI without running the full integration test suite?
- How do I set up Playwright for this project? The guide references `apps/shell-e2e/playwright.config.ts` but never shows how to create it.
- The Vitest note mentions `@angular/build:unit-test`. Is this the executor configured in `project.json`? What does the test configuration look like?

---

## Chapter 14: Advanced Patterns

### Key Takeaways
- You can expose individual components (not just route trees) from a remote.
- Error handling for remote loading: wrap `loadRemote()` in a `.catch()` that returns a fallback route with a "Feature Unavailable" component.
- Adding a new remote: use `@nx/angular:remote` with `--host=shell`, then update the manifest, add tags, and update boundary rules.
- Rspack is a Rust-based Webpack alternative with 2-3x faster builds and the same Module Federation API.
- `nx graph` visualizes the project dependency graph in the browser.

### My Notes
The error handling pattern was the most practical takeaway. The `loadRemoteRoutes` helper function wraps every remote load in a `.catch()`. If a remote is down, instead of crashing the whole shell, it renders a "Feature Temporarily Unavailable" component with a Retry button. The helper is applied to all three remote routes, keeping the code DRY.

Exposing individual components was interesting. Instead of only exposing `./Routes`, you can expose `./ProductCard` and use `loadComponent` in the shell to embed it anywhere. This is useful for cross-cutting UI like "featured product" widgets on the home page.

The "add a 4th remote" checklist was practical: (1) generate with `--host=shell`, (2) add URL to manifest, (3) verify route was added, (4) tag the project, (5) update boundary rules, (6) build and test. Five steps after the generator runs.

Rspack sounds appealing (2-3x faster builds) but the guide wisely says "worth evaluating" rather than "you should switch." The trade-off is a smaller plugin ecosystem.

### What I Found Confusing
- The error handling section shows `loadRemoteRoutes` returning `() => Promise<Route[]>`, which is assigned to `loadChildren`. But earlier in Chapter 3, `loadChildren` was assigned `() => loadRemote(...).then(m => m!.remoteRoutes)`. The helper wraps this in a function that returns a function. The double-arrow pattern (`return () =>`) was a bit hard to parse at first.
- The `ProductCardComponent` exposure: the `exposes` path is `'libs/products/feature/src/lib/product-card.component.ts'`. But this component was never created in Chapter 7. It is a hypothetical example. This is fine, but it caught me off guard because every other code sample so far was "real" and buildable.
- The "How Do I Share an Auth Service" section is marked as a summary of Chapter 4. Why repeat it here? It feels redundant.

### Questions I Would Ask the Author
- If a remote is down and the fallback renders, what happens when the user clicks "Retry" and the remote is still down? Does it just reload the page forever?
- The error handling catches the error and returns a fallback. But what about the user's navigation? If they are at `/products` and the remote fails, are they stuck at `/products` with the fallback? Can they navigate to other remotes?
- Can I prefetch remotes (mentioned in Chapter 15 performance tips) and also use the error handling pattern? Would the prefetch catch fail silently?

---

## Chapter 15: Best Practices and Pitfalls

### Key Takeaways
- Top practices: dynamic federation for everything, one team per remote, keep the shell thin, enforce boundaries from day one, inject manifest at deploy time.
- 13 common pitfalls with causes and solutions in a reference table.
- Performance tips: prefetch critical remotes, use `@defer` blocks, code-split within remotes, monitor bundle sizes.

### My Notes
The 10 best practices are a good summary of everything the guide taught. Many of them were already covered in detail (dynamic federation, boundaries, shell providers), so this reads as a checklist.

The pitfalls table is a goldmine. I can see myself bookmarking this and checking it every time something goes wrong. The top ones I would likely hit:
- #1: `NullInjectorError` (missing `provideHttpClient` in shell) - covered in Chapter 5
- #5: Remote blank in shell (missing `<router-outlet>`) - covered in Chapter 5
- #7: `nx serve shell` not loading remotes (empty `remotes` array) - covered in Chapter 8
- #8: CORS errors (DevOps forgot the headers) - covered in Chapter 11

Performance tips about prefetching and `@defer` blocks are interesting but not fully explained. The guide mentions them as one-liners. I would need to look up how `@defer` works with remote loading.

### What I Found Confusing
- Pitfall #10 says "Webpack required but esbuild is default" for Angular 21. The solution says "The `@nx/angular:host` generator uses Webpack automatically." But what if I did not use the Nx generator? What if I created a regular Angular app and want to add Module Federation later? The guide does not cover this scenario.
- The performance tip about `--statsJson` and `webpack-bundle-analyzer` assumes I know how to use the bundle analyzer. A link or brief explanation would help.
- Pitfall #4 about module-level signals not syncing was covered in Chapter 9, but the table entry is very terse. Someone jumping to this table without reading Chapter 9 might not understand "Library loaded as separate copy per MFE."

### Questions I Would Ask the Author
- How do I prefetch a remote? Is it just calling `loadRemote('mfe-products/Routes')` in the shell's `AppComponent` on init?
- The `@defer` block tip says it can be "combined with remote loading." How exactly? Is there a code example somewhere?
- For monitoring bundles, what is a "too big" threshold for a remote's bundle? 500 KB? 1 MB?

---

## Appendix A: Quick Reference Card

### My Notes
This is a handy cheat sheet. 11 commands covering serve, build, test, generate, graph, and migrate. I would print this and pin it next to my monitor.

The only new one I had not seen before in the guide is `npx nx g @nx/angular:library --directory=libs/shared/my-lib --name=my-lib` which does not include `--importPath`. Chapter 4 warned to always use `--importPath`. Is this an oversight or is it OK to omit here?

---

## Appendix B: DevOps Handoff Checklist

### My Notes
Copy-paste into Slack or Jira. This is the entire Chapter 11 compressed into bullet points. Build commands, output paths, manifest format, CORS, cache-busting, SPA routing, Docker commands, and environment variables. Very practical.

---

## Concept Map

- Microfrontend Architecture
  - Shell (Host) loads Remotes at runtime
    - Module Federation handles the loading
      - Webpack `ModuleFederationPlugin` (configured by Nx's `withModuleFederation` helper)
      - `@module-federation/enhanced` is the underlying runtime package
      - `registerRemotes()` registers URLs at startup
      - `loadRemote()` fetches a remote's `remoteEntry.js` on navigation
    - Dynamic Federation reads URLs from a manifest
      - `module-federation.manifest.json` maps remote names to base URLs
      - Swapped per environment (dev, staging, production)
      - Enables "build once, deploy everywhere"
    - The `main.ts` / `bootstrap.ts` split creates an async boundary
      - Federation negotiates shared deps before Angular bootstraps
  - Each Remote is a standalone Angular app
    - Has its own `module-federation.config.ts` with `name` and `exposes`
    - `entry.routes.ts` is the exposed entry point
    - Can run standalone on its own port for focused development
    - Has its own `app.config.ts` with providers (for standalone only)
  - Shared Libraries prevent code duplication
    - Organized by scope (products, orders, account, shared) and type (feature, data-access, ui, util)
    - Nx auto-detects and shares as singletons via `withModuleFederation`
    - Path aliases in `tsconfig.base.json` (e.g., `@mfe-platform/shared-ui`)
    - `@Injectable({ providedIn: 'root' })` services get one instance across all MFEs
  - Providers
    - Shell's `app.config.ts` is the source of truth
    - Remotes inherit from the shell's root injector
    - `NullInjectorError` if shell is missing a provider
  - Module Boundaries
    - Tags: `scope:*` and `type:*` on every project
    - ESLint rule `@nx/enforce-module-boundaries` enforces constraints
    - Dependency flow: app -> feature -> data-access/ui -> util
  - CSS and Styles
    - Angular `ViewEncapsulation.Emulated` scopes styles per component
    - Shell defines CSS custom properties (design tokens)
    - Remotes consume via `var(--token-name)`
    - Never use `ViewEncapsulation.None` in remotes
  - Communication between MFEs
    - Shared services (recommended)
    - Module-level signals (fragile, depends on singleton config)
    - Custom browser events (no type safety, last resort)
  - Deployment
    - Each MFE produces a static folder: `dist/apps/<name>/browser/`
    - `remoteEntry.js` is NOT content-hashed (60s cache TTL)
    - Manifest injection: replace JSON after build, before deploy
    - CORS headers required on each remote's CDN
    - Two models: S3 + CloudFront (recommended) or ECS + Fargate
  - Testing
    - Unit: Vitest + TestBed (same Angular testing utilities)
    - Contract: verify remote export shape matches shell expectations
    - Integration: Docker Compose + Playwright for full-system tests
  - Development Workflow
    - `nx serve shell` serves everything
    - `--devRemotes` for HMR on the remote you are editing
    - Static remotes served from Nx cache
    - `nx affected -t test build` only rebuilds what changed

---

## Things I Could Not Follow

1. **Chapter 3, `loadRemote` generic type**: The expression `loadRemote<typeof import('mfe-products/Routes')>('mfe-products/Routes')` uses `typeof import(...)` as a generic type parameter. I have never seen this syntax before. Is `'mfe-products/Routes'` a real path that TypeScript can resolve, or is it a virtual alias? How does TypeScript know the shape of the module? This was used repeatedly but never explained.

2. **Chapter 5, dual routing mental model**: The chapter introduces both `RemoteEntryComponent` (from Chapter 3) and `ProductsShellComponent` (a new wrapper with `<router-outlet>`), plus two routing files (`entry.routes.ts` and `app.routes.ts`). By the end of the chapter, I was holding four files in my head and was not sure which pattern I would actually use in practice. Chapter 7 resolves this by replacing `RemoteEntryComponent` with real routes, but the intermediate confusion was real.

3. **Chapter 11, CI pipeline bash**: The step `if npx nx show projects --affected --type=app | grep -q "^${{ matrix.app }}$"; then echo "affected=true" >> $GITHUB_OUTPUT` is three chained concepts (Nx CLI, pipe to grep, GitHub Actions output variables) that I could not fully parse. I can guess what it does, but I would not be able to modify or debug it.

4. **Chapter 11, Docker flags**: `docker compose up --build -d` uses the `-d` flag which is never explained. I believe it means "detached" (run in background) but the guide should say so since the target audience has never used Docker.

5. **Chapter 11, ECS/EKS concepts**: The entrypoint script section mentions "task definition" and "ConfigMap" with parenthetical definitions, but those definitions are not enough for me to understand the deployment model. The S3+CloudFront path is much clearer because it has an ASCII diagram. The ECS path is described in one paragraph with no diagram.

6. **Chapter 12, semver compatibility**: The chapter says Module Federation picks "the highest semver-compatible version" but does not define what "compatible" means. I know semver basics but not enough to know if 21.0.0 and 21.1.0 are compatible (I think yes?) or if 21.x and 22.x are (I think no?).

7. **Chapter 13, contract test execution context**: The contract test file is in `apps/shell/src/app/`. Does it run with the shell's Vitest config? How does Vitest resolve the `@mfe-platform/mfe-products/entry` import? The test uses `await import(...)` which is a dynamic import. I am not sure if Vitest handles this the same as a static import, especially since the tsconfig path alias points to a file inside a different app.

---

## What I Wish Was Included

1. **A "what happens when things go wrong" section.** The guide shows the happy path. I want to see actual error messages and screenshots. What does a CORS error look like in the browser console? What does a missing `<router-outlet>` look like? What does the `NullInjectorError` message look like in full?

2. **A diagram of the request flow.** When a user clicks "Products" in the shell, what HTTP requests happen? I want to see: shell serves index.html -> browser requests remoteEntry.js from products URL -> federation runtime discovers exposed modules -> browser fetches product chunk -> Angular renders component. A sequence diagram or numbered list would make this much clearer.

3. **Explanation of `typeof import(...)` syntax.** This TypeScript feature is used in every `loadRemote` call but never explained. A one-paragraph sidebar would help.

4. **More on Vitest configuration.** Chapter 13 shows a test file and test output, but not what the test configuration looks like. Where is Vitest configured? Is there a `vitest.config.ts`? How does `project.json` wire up the test target?

5. **A troubleshooting decision tree.** Something like: "Remote not loading? -> Check manifest URLs -> Check CORS headers -> Check remoteEntry.js in Network tab -> Check remotes array in config -> Check router-outlet." The pitfalls table is helpful but a visual decision tree would be faster to use.

6. **The complete standalone mode story.** The guide mentions running remotes standalone but does not show what `localhost:4201` looks like in the browser. Does it show the products feature with no navigation? Does it have its own layout? A screenshot or description would help.

7. **How to handle environment-specific API URLs.** The manifest handles remote URLs, but what about the backend API? The `ProductService` calls `/api/products`. In production, is that a relative URL? Does it go to a different domain? How do I configure API URLs per environment?

8. **What happens during `nx build` in detail.** The guide mentions build output but does not walk through what happens when you run `npx nx build mfe-products --configuration=production`. Does it compile TypeScript, bundle with Webpack, generate the remoteEntry.js, output to dist/? A brief overview would connect the build process to the deployment chapter.

9. **Explanation of `-d` flag in `docker compose up --build -d`.** This is the first Docker command in the guide and the flag is unexplained.

10. **A "day in the life" scenario.** Walk through a typical development day: pull latest, run the shell, make a change to the products MFE, see it live-reload, run tests, push, see CI run. This would tie all the chapters together into a practical workflow.

---

## Confidence Check

| Skill | Confidence (1-5) | Notes |
|---|---|---|
| I can explain what a microfrontend is to a colleague | 5 | Chapter 1 was very clear. I could draw the architecture diagram from memory. |
| I can create an Nx workspace with a host and remotes | 4 | Three commands, well documented. I would need to reference the flags. |
| I can add a new shared library and use it across MFEs | 4 | The generation commands are clear. I would need the `--importPath` warning open. |
| I can explain why providedIn: 'root' services are shared | 5 | The shared root injector concept clicked in Chapters 4 and 5. |
| I can diagnose a NullInjectorError in an MFE setup | 4 | I know to check the shell's app.config.ts first. |
| I can add a new remote to an existing setup | 3 | Chapter 14 has a checklist. I would need it open (5 steps after the generator). |
| I can run the full system locally with nx serve | 5 | This was shown multiple times and is one command. |
| I can run the full system in Docker for integration testing | 2 | I have never used Docker. I could copy-paste the commands but could not debug if they fail. |
| I can explain to DevOps what the manifest file is and why it matters | 4 | I could explain the "build once, deploy everywhere" pattern clearly. |
| I can explain CORS to DevOps and tell them what to configure | 3 | I understand the concept but the specific headers and configuration would require referencing the guide. |
| I can write a contract test for a remote | 3 | The pattern is clear. I would need to set up the tsconfig path aliases and understand Vitest config. |
| I can enforce module boundaries with tags | 3 | I understand scope and type tags. I would need the ESLint config snippet open. |
| I can debug styles leaking between MFEs | 4 | Check for ViewEncapsulation.None and ::ng-deep. Clear rules. |
| I understand the difference between dev remotes and static remotes | 5 | Dev = HMR + 1-2 GB RAM. Static = cached build. Use --devRemotes only for what you are editing. |
| I could onboard another developer using this guide | 3 | I could walk them through Chapters 1-10. Chapters 11-13 (Docker, CI/CD) I would need help with myself. |

---

## Top 10 Questions for Follow-Up

1. **What does `typeof import('mfe-products/Routes')` actually do in TypeScript?** This syntax appears in every `loadRemote` call but is never explained. Is it a real import that TypeScript resolves at compile time, or is it a type-only declaration?

2. **How do I handle environment-specific API URLs across MFEs?** The manifest handles remote URLs, but `ProductService` calls `/api/products`. In production, how does this resolve? Do I need an API gateway? An Angular environment file?

3. **What does the Docker error output look like when things fail?** I have zero Docker experience. If `docker compose up --build` fails, what do I look for? What are the most common failure modes?

4. **How does Vitest configuration work for Angular projects in Nx 22?** Where is the test runner configured? Is there a `vitest.config.ts`? What does the `project.json` test target look like? Chapter 13 shows test code and output but not configuration.

5. **Can I convert an existing single-project Angular CLI app to this Nx MFE architecture?** Or do I need to start from scratch with `create-nx-workspace`?

6. **What exactly happens during `nx build mfe-products --configuration=production`?** I want to understand the build pipeline: TypeScript compilation -> Webpack bundling -> Module Federation plugin generates `remoteEntry.js` -> output to `dist/`.

7. **How do I set up Playwright for the integration tests?** The guide references `apps/shell-e2e/playwright.config.ts` but never shows how to create or configure it.

8. **If a remote crashes at runtime (not just fails to load, but throws an error after loading), does it crash the entire shell?** The error handling in Chapter 14 covers load failures. What about post-load errors?

9. **How does Nx caching work in detail?** What triggers a cache hit vs. a miss? If I change a shared library, does it invalidate all remotes that depend on it?

10. **What is the practical performance cost of using Webpack instead of esbuild?** The guide says Module Federation requires Webpack and mentions Rspack as a faster alternative. How much slower is Webpack for a typical MFE build?
