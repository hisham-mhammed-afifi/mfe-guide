# Part 4: Deployment, Versions, and Testing

---

## Chapter 11: What Your DevOps Team Needs From You

This chapter is framed differently from the rest of the guide. As a frontend developer, you are not expected to write or maintain Dockerfiles, CI pipelines, or AWS infrastructure. A separate DevOps team handles that. However, you need to understand these artifacts well enough to:

- Explain what each MFE produces (a static build folder).
- Provide DevOps with the correct build commands and output paths.
- Explain the manifest file and why it must be swapped per environment.
- Understand CORS and cache-busting requirements.
- Run `docker compose up` locally for integration testing.

### Responsibility Boundary

```
+------------------------------------------+-------------------------------------------+
|         Frontend Team Owns               |          DevOps Team Owns                 |
+------------------------------------------+-------------------------------------------+
| Source code (apps/ and libs/)            | Dockerfiles and Docker Compose            |
| module-federation.config.ts              | CI/CD pipeline (GitHub Actions, etc.)     |
| module-federation.manifest.json format   | AWS infrastructure (S3, CloudFront, ECS)  |
| Build commands: npx nx build <app>       | nginx configuration                       |
| Output paths: dist/apps/<name>            | CORS headers on CDN                       |
| Cache-busting rules for federation files | SSL certificates and DNS                  |
| Environment-specific manifest URLs       | Container orchestration (ECS, EKS)        |
+------------------------------------------+-------------------------------------------+
```

The sections below provide **ready-to-hand-off artifacts** with explanations. You should understand what each file does, but you are not expected to author or maintain them.

### What Each MFE Produces

Every MFE (including the shell) produces a static build folder when you run:

```bash
npx nx build shell --configuration=production
npx nx build mfe_products --configuration=production
npx nx build mfe_orders --configuration=production
npx nx build mfe_account --configuration=production
```

The output for each app lands in `dist/apps/<name>/` and contains:

```
dist/apps/mfe_products/
  index.html              # The SPA entry point
  main.[hash].js          # Application code (content-hashed filename)
  polyfills.[hash].js     # Browser polyfills (content-hashed)
  remoteEntry.mjs          # Module Federation entry (NOT hashed)
  styles.[hash].css       # Compiled stylesheets
  assets/                 # Static assets
```

> **Warning:** `remoteEntry.mjs` is the file that Module Federation uses to discover what a remote exposes. Unlike other JS files, it is **not content-hashed**. Its filename stays the same across builds, but its contents change. This has critical implications for caching (covered below).

> **Note:** The exact output path may vary depending on your build executor. Verify by running `npx nx build mfe_products --configuration=production` and checking the output.

### The Manifest File

As we saw in Chapter 3, the manifest (`module-federation.manifest.json`) maps remote names to their `mf-manifest.json` URLs. Here is what the production version looks like. Share this explanation with your DevOps team:

```json
{
  "mfe_products": "https://products.mfe.example.com/mf-manifest.json",
  "mfe_orders": "https://orders.mfe.example.com/mf-manifest.json",
  "mfe_account": "https://account.mfe.example.com/mf-manifest.json"
}
```

- Each **key** is the remote's name (must match the `name` in the remote's `module-federation.config.ts`).
- Each **value** is the full URL to the remote's `mf-manifest.json` file. This file describes what the remote exposes and what shared dependencies it needs.
- This file must be **different per environment** (dev, staging, production). The shell is built once; only this file changes.

### CORS: Why It Matters for Microfrontends

**CORS** (Cross-Origin Resource Sharing) is a browser security mechanism that blocks JavaScript from loading resources from a different domain unless the server explicitly allows it.

In a microfrontend setup, the shell at `https://app.example.com` needs to fetch `mf-manifest.json` from `https://products.mfe.example.com`. Without CORS headers, the browser blocks this request.

**What to tell your DevOps team:** "Each remote's CDN (or server) must include these response headers for requests from the shell's origin":

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, OPTIONS
```

### Docker Multi-Stage Build (Reference Artifact)

Share this Dockerfile with your DevOps team. It builds any MFE in the workspace using a build argument.

```
  +---------------+     +---------------+     +----------------+
  |  Stage 1:     |     |  Stage 2:     |     |  Stage 3:      |
  |  deps         | --> |  builder      | --> |  server         |
  |  npm ci       |     |  nx build     |     |  nginx (~25MB) |
  |  (cached)     |     |  (one app)    |     |  (static only) |
  +---------------+     +---------------+     +----------------+
```

```dockerfile
# Dockerfile (workspace root)
# ============================================
# Stage 1: Install dependencies (cached layer)
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app
# Copy only package files first so npm ci is cached when source changes
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: Build a specific MFE
# ============================================
FROM deps AS builder
WORKDIR /app
COPY . .
# APP_NAME is passed at build time (e.g., shell, mfe_products)
ARG APP_NAME
ARG CONFIGURATION=production
RUN npx nx build ${APP_NAME} --configuration=${CONFIGURATION}

# ============================================
# Stage 3: Serve with nginx (tiny ~25 MB image)
# ============================================
FROM nginx:1.28-alpine AS server
ARG APP_NAME
# Copy only the built static files into the nginx html directory
COPY --from=builder /app/dist/apps/${APP_NAME} /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**How it works in plain English:**
- **Stage 1 (deps):** Installs npm packages. This layer is cached. As long as `package.json` does not change, `npm ci` is skipped on rebuilds.
- **Stage 2 (builder):** Copies the full workspace and builds only the requested app via the `APP_NAME` argument.
- **Stage 3 (server):** Copies the static build output into a tiny nginx image. The final image contains only HTML, JS, CSS, and nginx. No Node.js, no source code.

### nginx.conf (Reference Artifact)

Share this nginx configuration with your DevOps team:

```nginx
# docker/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback: any route that doesn't match a file serves index.html
    # (SPA = Single Page Application: one HTML page, JS handles navigation)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Short cache for remoteEntry.mjs (changes on every deploy, not hashed)
    # Exact-match location takes priority over the regex rule below
    location = /remoteEntry.mjs {
        expires 60s;
        add_header Cache-Control "public, max-age=60";
    }

    # Short cache for mf-manifest.json (changes on every deploy, not hashed)
    location = /mf-manifest.json {
        expires 60s;
        add_header Cache-Control "public, max-age=60";
    }

    # Cache hashed static assets aggressively (content-hashed by Webpack)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # CORS headers (for Docker-based serving; CloudFront handles CORS in prod)
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

> **Note:** The `location = /remoteEntry.mjs` and `location = /mf-manifest.json` (exact match) blocks take priority over the `location ~*` (regex match) in nginx. This means `remoteEntry.mjs` and `mf-manifest.json` get a 60-second cache while all other `.js` files get a 1-year cache.

### docker-compose.yml (You Run This Yourself)

This is the one Docker artifact you run locally for integration testing. It starts all four MFEs in production-like containers:

```yaml
# docker-compose.yml
services:
  shell:
    build:
      context: .
      args:
        APP_NAME: shell
    ports:
      - "4200:80"

  # Docker service names use hyphens; APP_NAME must match the Nx project name (snake_case)
  mfe-products:
    build:
      context: .
      args:
        APP_NAME: mfe_products
    ports:
      - "4201:80"

  mfe-orders:
    build:
      context: .
      args:
        APP_NAME: mfe_orders
    ports:
      - "4202:80"

  mfe-account:
    build:
      context: .
      args:
        APP_NAME: mfe_account
    ports:
      - "4203:80"
```

```bash
docker compose up --build -d
```

The `--build` flag forces Docker to rebuild the images (instead of using a previous build). The `-d` flag means "detached," which runs the containers in the background so you get your terminal back. Without `-d`, the terminal would show live container logs and you would need a second terminal to run tests.

Navigate to `http://localhost:4200`. The shell loads remotes from `localhost:4201-4203` via the dev manifest. This is a production-like integration test using real nginx and real Module Federation.

After adding Docker files, your workspace root looks like this:

```
mfe-platform/
  apps/
  libs/
  docker/
    nginx.conf              # nginx config (shared with DevOps)
    entrypoint.sh           # ECS manifest injection (shared with DevOps)
  Dockerfile                # Multi-stage build (shared with DevOps)
  docker-compose.yml        # Local integration testing (you run this)
  nx.json
  package.json
```

> **What just happened?**
>
> - [x] Built all four MFEs inside Docker containers
> - [x] Each container runs nginx serving the static build output
> - [x] The shell loads remotes over HTTP, just like production
> - [x] You can verify cross-MFE routing, shared services, and style isolation

### Manifest Injection: Two Approaches

The shell is built once. The manifest is swapped at deploy time. There are two approaches.

**Approach A: File replacement before S3 sync (for S3 + CloudFront).** Your DevOps team replaces the manifest file after building, before uploading to S3:

```bash
#!/bin/bash
# scripts/deploy-shell.sh (share with DevOps)
ENV=${1:-prod}

# Build (or use cached artifact)
npx nx build shell --configuration=production

# Overwrite manifest with environment-specific URLs
cat > dist/apps/shell/module-federation.manifest.json << EOF
{
  "mfe_products": "https://products.mfe.example.com/mf-manifest.json",
  "mfe_orders": "https://orders.mfe.example.com/mf-manifest.json",
  "mfe_account": "https://account.mfe.example.com/mf-manifest.json"
}
EOF

# Sync to S3 and invalidate CloudFront cache
aws s3 sync dist/apps/shell s3://mfe-shell-${ENV} --delete
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST_SHELL} \
  --paths "/module-federation.manifest.json" "/index.html"
```

**Approach B: Docker entrypoint (for ECS/EKS container deploy).** The container generates the manifest from environment variables at startup:

```bash
#!/bin/sh
# docker/entrypoint.sh (share with DevOps)
# Generate manifest from environment variables injected by ECS/EKS
cat > /usr/share/nginx/html/module-federation.manifest.json << EOF
{
  "mfe_products": "${MFE_PRODUCTS_URL}/mf-manifest.json",
  "mfe_orders": "${MFE_ORDERS_URL}/mf-manifest.json",
  "mfe_account": "${MFE_ACCOUNT_URL}/mf-manifest.json"
}
EOF

exec nginx -g "daemon off;"
```

In ECS, these environment variables come from the **task definition** (a JSON configuration that tells ECS how to run a container). In EKS (Kubernetes), they come from a **ConfigMap** (a Kubernetes resource that stores configuration as key-value pairs).

### CI/CD Pipeline (Reference for DevOps)

Your DevOps team can adapt this GitHub Actions pipeline:

```
  +------------+     +-------------+     +-----------+     +----------+
  | checkout   | --> | npm ci      | --> | nx        | --> | deploy   |
  | full       |     | + set SHAs  |     | affected  |     | to S3 +  |
  | history    |     |             |     | lint/test |     | CF inv.  |
  +------------+     +-------------+     +-----------+     +----------+
```

```yaml
# .github/workflows/ci-deploy.yml (share with DevOps)
name: CI & Deploy
on:
  push:
    branches: [main]
  pull_request:

env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
  AWS_REGION: us-east-1

permissions:
  id-token: write
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0   # Full history needed for nx affected
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      # Sets base/head SHAs for affected detection
      - uses: nrwl/nx-set-shas@v4
      - run: npx nx affected -t lint test build

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [shell, mfe_products, mfe_orders, mfe_account]
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4

      # Only deploy if this app was affected by the change
      - name: Check if affected
        id: check
        run: |
          # nx show projects --affected --type=app: lists apps changed by this PR/push
          # grep -q "^...$": silently checks if the current matrix app is in that list
          # -q means "quiet" (no output, just exit code), ^ and $ are regex anchors for exact match
          if npx nx show projects --affected --type=app | grep -q "^${{ matrix.app }}$"; then
            echo "affected=true" >> $GITHUB_OUTPUT
          else
            echo "affected=false" >> $GITHUB_OUTPUT
          fi

      - name: Build
        if: steps.check.outputs.affected == 'true'
        run: npx nx build ${{ matrix.app }} --configuration=production

      # Inject production manifest into shell build
      - name: Inject manifest (shell only)
        if: steps.check.outputs.affected == 'true' && matrix.app == 'shell'
        run: |
          cat > dist/apps/shell/module-federation.manifest.json << 'EOF'
          {
            "mfe_products": "https://products.mfe.example.com/mf-manifest.json",
            "mfe_orders": "https://orders.mfe.example.com/mf-manifest.json",
            "mfe_account": "https://account.mfe.example.com/mf-manifest.json"
          }
          EOF

      # OIDC = OpenID Connect: secure auth without static passwords
      - name: Configure AWS credentials (OIDC)
        if: steps.check.outputs.affected == 'true'
        uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy-role
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to S3 + invalidate CloudFront
        if: steps.check.outputs.affected == 'true'
        run: |
          BUCKET="mfe-${{ matrix.app }}-prod"
          DIST_ID="${{ secrets[format('CF_DIST_{0}', matrix.app)] }}"
          aws s3 sync dist/apps/${{ matrix.app }} s3://${BUCKET} --delete
          aws cloudfront create-invalidation --distribution-id ${DIST_ID} --paths "/*"
```

**Key aspects your DevOps team should know:**
- **Matrix strategy:** Each MFE is a parallel job. Only affected apps build and deploy.
- **Manifest injection:** The shell gets its production manifest after the build, before S3 sync.
- **`nrwl/nx-set-shas@v4`:** This GitHub Action sets the base and head Git SHAs that Nx uses to determine which projects were affected.
- **CloudFront distribution IDs** should be stored as secrets: `CF_DIST_shell`, `CF_DIST_mfe_products`, `CF_DIST_mfe_orders`, `CF_DIST_mfe_account`.

### AWS Architecture Overview

There are two common deployment models. Your DevOps team chooses which one fits your organization.

```
                         +-----------------------+
                         |   Route 53 (DNS)      |
                         |   app.example.com     |
                         +----------+------------+
                                    |
                         +----------v------------+
                         |  CloudFront (Shell)   |
                         |  S3: shell-bucket     |
                         +----------+------------+
                                    |
        manifest.json resolves remotes at runtime
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
+---------v----------+  +-----------v--------+  +-------------v------+
| CloudFront (Prods) |  | CloudFront (Orders)|  | CloudFront (Acct)  |
| S3: products-bucket|  | S3: orders-bucket  |  | S3: account-bucket |
+--------------------+  +--------------------+  +--------------------+
```

**S3 + CloudFront (static hosting):** Each MFE's build output is uploaded to an **S3 bucket** (Amazon's object storage, like a file server in the cloud). **CloudFront** (Amazon's CDN) sits in front of S3 and caches files at edge locations worldwide for fast delivery. This is simpler, cheaper, and faster for static sites.

**ECS + Fargate (container hosting):** Each MFE runs as a Docker container on **ECS** (Elastic Container Service, Amazon's container orchestration platform). **Fargate** is the serverless compute engine for ECS. **ECR** (Elastic Container Registry) stores your Docker images. This approach makes sense if you need server-side rendering or dynamic manifest injection at container startup.

For most Angular MFE setups, **S3 + CloudFront is the recommended approach** because the output is static HTML/JS/CSS.

### CloudFront Cache Behaviors

Share this table with your DevOps team so they configure caching correctly:

| Path Pattern | TTL | Why |
|---|---|---|
| `/remoteEntry.mjs` | 60 seconds | Changes on every deploy, not content-hashed |
| `/mf-manifest.json` | 60 seconds | Federation manifest, changes on every deploy, not content-hashed |
| `/*.js` (hashed chunks) | 1 year | Content-hashed filenames, immutable |
| `/index.html` | 0 (always revalidate) | Points to latest hashed chunks |
| `/assets/*` | 1 year | Immutable static assets |

> **Warning:** If your DevOps team does not set a short TTL for `remoteEntry.mjs` and `mf-manifest.json`, users may load a stale version after a deploy. The shell would try to load code that no longer exists, causing runtime errors.

### Checklist: What to Tell Your DevOps Team

Copy this into a Slack message or Jira ticket:

- **Build commands:** `npx nx build <app-name> --configuration=production` for each of: `shell`, `mfe_products`, `mfe_orders`, `mfe_account`
- **Output directory:** `dist/apps/<app-name>/` (contains `index.html`, JS chunks, CSS, assets)
- **Manifest file:** `dist/apps/shell/module-federation.manifest.json` must be replaced with environment-specific URLs after building, before deploying
- **Manifest format:** JSON object where keys are remote names and values are full URLs to `mf-manifest.json`
- **CORS requirement:** Each remote's CDN must set `Access-Control-Allow-Origin` to the shell's domain
- **Cache-busting:** `remoteEntry.mjs` and `mf-manifest.json` must have a short TTL (60s). All other `.js` and `.css` files are content-hashed and can be cached for 1 year. `index.html` should always revalidate
- **SPA routing:** nginx (or CloudFront) must return `index.html` for all routes that do not match a file
- **CloudFront invalidation:** After each deploy, invalidate at minimum `/index.html` and `/module-federation.manifest.json`

With deployment artifacts ready for your DevOps team, let's look at how to keep shared dependency versions aligned. That's Chapter 12.

---

## Chapter 12: Version Management and Shared Dependencies

### The Version Problem

Independently deployed remotes may be built at different times with different versions of shared dependencies. For example, the shell might use `@angular/core@21.1.0` while a remote was built with `@angular/core@21.0.0`.

Module Federation handles this through **version negotiation** at runtime: when multiple versions of a shared singleton are available, it picks the highest semver-compatible version. **Semver-compatible** means versions that share the same major number. For example, `21.0.0` and `21.1.0` are compatible (same major version 21). But `21.1.0` and `22.0.0` are NOT compatible (different major versions). Module Federation loads the highest version within the compatible range. If both `21.0.0` and `21.1.0` are available, it picks `21.1.0`.

### Nx's Default Strategy

The `withModuleFederation` helper configures shared deps with:

- **`singleton: true`** for Angular core packages (only one instance of Angular can run).
- **`strictVersion: true`** for critical packages. This produces a **console warning** (not a crash) like `Unsatisfied version X of shared singleton module Y`.
- **`requiredVersion: 'auto'`** reads the version from `package.json`.

> **Warning:** `strictVersion` does NOT throw a JavaScript error. It only logs a warning. The app continues running, but behavior may be unpredictable. Version mismatches can sneak into production unnoticed. Always check for these warnings in integration tests.

### Keeping Versions Aligned

Since all apps share one `package.json` in the monorepo, versions stay aligned naturally. Run migrations regularly:

```bash
npx nx migrate latest
npm install
npx nx migrate --run-migrations
```

After migration, rebuild and redeploy all affected apps to ensure no version drift between deployed builds.

### Detecting Drift

- Run integration tests with Docker Compose (as described in Chapter 11) that load all remotes in the shell.
- Open the browser DevTools Network tab and filter for `@angular/core`. If you see more than one chunk, sharing is broken.
- Check the browser console for `Unsatisfied version` warnings.

Now let's look at how to test the composed system effectively. That's Chapter 13.

---

## Chapter 13: Testing Strategy

> **Note:** Angular 21 made Vitest the default test runner, replacing Karma/Jasmine. Nx 22.3+ supports Vitest for Angular projects via the `@analogjs/vite-plugin-angular` Vite plugin, which enables Angular's TestBed to work within a Vitest environment. All test files use the standard `.spec.ts` extension. The `nx test` command runs Vitest in single-run mode by default (the generated `vite.config.mts` sets `watch: false`). Add the `--watch` flag for continuous testing during local development: `npx nx test mfe_products --watch`. Angular's `TestBed`, `HttpTestingController`, and other testing utilities work the same way with Vitest as they did with previous test runners.

### Unit Testing

Each library and app has its own unit tests. Run them individually or for the whole workspace:

```bash
# Test a specific library
npx nx test products-data-access

# Test a specific app
npx nx test mfe_products

# Test only projects affected by your changes
npx nx affected -t test
```

Vitest output uses a tree format with checkmarks:

```
 ✓ products-data-access src/lib/product.service.spec.ts (2 tests) 145ms
   ✓ ProductService (2)
     ✓ should fetch all products 85ms
     ✓ should fetch a product by ID 42ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  10:42:15
   Duration  1.28s
```

Here is a sample unit test for `ProductService` using `TestBed` and `HttpTestingController`:

```typescript
// libs/products/data-access/src/lib/product.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify(); // Ensure no outstanding requests
  });

  it('should fetch all products', () => {
    const mockProducts = [
      { id: '1', name: 'Widget', description: 'A widget', price: 9.99, imageUrl: '' },
    ];

    service.getAll().subscribe((products) => {
      expect(products).toEqual(mockProducts);
    });

    const req = httpTesting.expectOne('/api/products');
    expect(req.request.method).toBe('GET');
    req.flush(mockProducts);
  });

  it('should fetch a product by ID', () => {
    const mockProduct = {
      id: '1', name: 'Widget', description: 'A widget', price: 9.99, imageUrl: '',
    };

    service.getById('1').subscribe((product) => {
      expect(product).toEqual(mockProduct);
    });

    const req = httpTesting.expectOne('/api/products/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockProduct);
  });
});
```

> **Note:** `describe`, `it`, `expect`, `beforeEach`, and `afterEach` are available as globals (no imports needed). Angular's Vitest setup enables `globals: true` by default. If you need mocking utilities like fake timers, import `vi` explicitly: `import { vi } from 'vitest';`. Then use `vi.fn()` instead of `jest.fn()`, `vi.spyOn()` instead of `jest.spyOn()`, and `vi.useFakeTimers()` / `vi.advanceTimersByTime()` instead of `fakeAsync` / `tick`.

### Integration Testing with Docker Compose

Spin up the full system in production-like containers, then run end-to-end tests:

```bash
# Build and start all containers
docker compose up --build -d

# Run Playwright tests against the containerized system
npx playwright test --config=apps/shell-e2e/playwright.config.ts

# Tear down
docker compose down
```

**What to verify in integration tests:**

1. Each remote route loads and renders content (not a blank page).
2. Cross-MFE flows work (log in via the account MFE, verify auth state in the products MFE).
3. No Module Federation warnings in the browser console.
4. `@angular/core` appears only once in the Network tab (no duplicate loading).

### Contract Testing

Contract tests verify that each remote exposes the module shape the shell expects. If someone renames `remoteRoutes` to `routes` in a remote's `entry.routes.ts`, these tests catch it before deployment.

First, add path aliases so the test can import remote entry files directly:

```json
// tsconfig.base.json (add to "paths")
{
  "compilerOptions": {
    "paths": {
      "@mfe-platform/mfe_products/entry": [
        "apps/mfe_products/src/app/remote-entry/entry.routes.ts"
      ],
      "@mfe-platform/mfe_orders/entry": [
        "apps/mfe_orders/src/app/remote-entry/entry.routes.ts"
      ],
      "@mfe-platform/mfe_account/entry": [
        "apps/mfe_account/src/app/remote-entry/entry.routes.ts"
      ]
    }
  }
}
```

Then write the contract tests:

```typescript
// apps/shell/src/app/mfe-contracts.spec.ts
import { Route } from '@angular/router';

describe('MFE Contract Tests', () => {
  it('mfe_products exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_products/entry');
    // Verify the export exists and is an array with at least one route
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
    expect(mod.remoteRoutes.length).toBeGreaterThan(0);
    // Verify there is a default route (path: '')
    expect(mod.remoteRoutes.find((r: Route) => r.path === '')).toBeDefined();
  });

  it('mfe_orders exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_orders/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });

  it('mfe_account exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe_account/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });
});
```

> **Note:** These tests import the remote's entry file directly using a tsconfig path alias (bypassing Module Federation). They run as part of the shell's Vitest test suite (`npx nx test shell`). Vitest resolves the `@mfe-platform/mfe_products/entry` import by following the path alias in `tsconfig.base.json`, just like a regular TypeScript import. The `await import(...)` is a standard dynamic import that Vitest handles natively. These tests verify the export name and shape (that `remoteRoutes` exists and is a non-empty array), catching breaking changes like renamed exports before they cause runtime errors in the shell. They do NOT verify the Module Federation wiring (the `exposes` block in `module-federation.config.ts`). For that, use the Docker Compose integration tests above.

Now that the application is tested and deployment artifacts are ready for your DevOps team, let's look at advanced patterns and best practices. That's Chapter 14.

---
