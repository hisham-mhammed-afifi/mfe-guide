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
| Output paths: dist/apps/<name>/browser   | CORS headers on CDN                       |
| Cache-busting rules for remoteEntry.js   | SSL certificates and DNS                  |
| Environment-specific manifest URLs       | Container orchestration (ECS, EKS)        |
+------------------------------------------+-------------------------------------------+
```

The sections below provide **ready-to-hand-off artifacts** with explanations. You should understand what each file does, but you are not expected to author or maintain them.

### What Each MFE Produces

Every MFE (including the shell) produces a static build folder when you run:

```bash
npx nx build shell --configuration=production
npx nx build mfe-products --configuration=production
npx nx build mfe-orders --configuration=production
npx nx build mfe-account --configuration=production
```

The output for each app lands in `dist/apps/<name>/browser/` and contains:

```
dist/apps/mfe-products/browser/
  index.html              # SPA entry point
  main.[hash].js          # Application code (content-hashed)
  polyfills.[hash].js     # Browser polyfills (content-hashed)
  remoteEntry.js          # Module Federation entry (NOT hashed, changes every build)
  styles.[hash].css       # Compiled stylesheets
  assets/                 # Static assets
```

> **Warning:** `remoteEntry.js` is the file that Module Federation uses to discover what a remote exposes. Unlike other JS files, it is **not content-hashed**. Its filename stays the same across builds, but its contents change. This has critical implications for caching (covered below).

### The Manifest File

The manifest file (`module-federation.manifest.json`) tells the shell where each remote lives. Share this explanation with your DevOps team:

```json
{
  "mfe-products": "https://products.mfe.example.com",
  "mfe-orders": "https://orders.mfe.example.com",
  "mfe-account": "https://account.mfe.example.com"
}
```

- Each **key** is the remote's name (must match the `name` in the remote's `module-federation.config.ts`).
- Each **value** is the base URL where the remote is hosted. The shell appends `/remoteEntry.js` to fetch the federation entry point.
- This file must be **different per environment** (dev, staging, production). The shell is built once; only this file changes.

### CORS: Why It Matters for Microfrontends

**CORS** (Cross-Origin Resource Sharing) is a browser security mechanism that blocks JavaScript from loading resources from a different domain unless the server explicitly allows it.

In a microfrontend setup, the shell at `https://app.example.com` needs to fetch `remoteEntry.js` from `https://products.mfe.example.com`. Without CORS headers, the browser blocks this request.

**What to tell your DevOps team:** "Each remote's CDN (or server) must include these response headers for requests from the shell's origin":

```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, OPTIONS
```

### Docker Multi-Stage Build (Reference Artifact)

Share this Dockerfile with your DevOps team. It builds any MFE in the workspace using a build argument.

```dockerfile
# Dockerfile (workspace root)
# ============================================
# Stage 1: Install dependencies (cached layer)
# ============================================
FROM node:20-alpine AS deps
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
# APP_NAME is passed at build time (e.g., shell, mfe-products)
ARG APP_NAME
ARG CONFIGURATION=production
RUN npx nx build ${APP_NAME} --configuration=${CONFIGURATION}

# ============================================
# Stage 3: Serve with nginx (tiny ~25 MB image)
# ============================================
FROM nginx:1.27-alpine AS server
ARG APP_NAME
# Copy only the built static files into the nginx html directory
COPY --from=builder /app/dist/apps/${APP_NAME}/browser /usr/share/nginx/html
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

    # SPA fallback: any route that does not match a file serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed static assets aggressively (content-hashed by Webpack)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Short cache for remoteEntry.js (changes on every deploy, not hashed)
    location = /remoteEntry.js {
        expires 60s;
        add_header Cache-Control "public, max-age=60";
    }

    # CORS headers (for Docker-based serving; CloudFront handles CORS in prod)
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

**Key sections explained:**
- **SPA fallback:** Angular uses client-side routing. If the user refreshes on `/products/123`, nginx must serve `index.html` (not a 404), so Angular's router can handle the route.
- **Hashed assets (1 year cache):** Files like `main.abc123.js` have a content hash in their name. If the file content changes, the hash changes, so a new filename is requested. It is safe to cache these forever.
- **`remoteEntry.js` (60 second cache):** This file has no content hash. Its contents change on every deploy, but its filename stays the same. A short cache ensures browsers pick up new versions quickly after a deploy.

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

  mfe-products:
    build:
      context: .
      args:
        APP_NAME: mfe-products
    ports:
      - "4201:80"

  mfe-orders:
    build:
      context: .
      args:
        APP_NAME: mfe-orders
    ports:
      - "4202:80"

  mfe-account:
    build:
      context: .
      args:
        APP_NAME: mfe-account
    ports:
      - "4203:80"
```

```bash
docker compose up --build
```

Navigate to `http://localhost:4200`. The shell loads remotes from `localhost:4201-4203` via the dev manifest. This is a production-like integration test using real nginx and real Module Federation, without deploying to AWS.

> **What just happened?**
>
> - [x] Built all four MFEs inside Docker containers
> - [x] Each container runs nginx serving the static build output
> - [x] The shell loads remotes over HTTP, just like production
> - [x] You can verify cross-MFE routing, shared services, and style isolation

### Manifest Injection: Two Approaches

The shell is built once. The manifest is swapped at deploy time. There are two approaches depending on your deployment model.

**Approach A: File replacement before S3 sync (for S3 + CloudFront).** Your DevOps team replaces the manifest file after building, before uploading to S3:

```bash
#!/bin/bash
# scripts/deploy-shell.sh (share with DevOps)
ENV=${1:-prod}

# Build (or use cached artifact)
npx nx build shell --configuration=production

# Overwrite manifest with environment-specific URLs
cat > dist/apps/shell/browser/assets/module-federation.manifest.json << EOF
{
  "mfe-products": "https://products.mfe.example.com",
  "mfe-orders": "https://orders.mfe.example.com",
  "mfe-account": "https://account.mfe.example.com"
}
EOF

# Sync to S3 and invalidate CloudFront cache
aws s3 sync dist/apps/shell/browser s3://mfe-shell-${ENV} --delete
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST_SHELL} \
  --paths "/assets/module-federation.manifest.json" "/index.html"
```

**Approach B: Docker entrypoint (for ECS/EKS container deploy).** The container generates the manifest from environment variables at startup:

```bash
#!/bin/sh
# docker/entrypoint.sh (share with DevOps)
# Generate manifest from environment variables injected by ECS/EKS
cat > /usr/share/nginx/html/assets/module-federation.manifest.json << EOF
{
  "mfe-products": "${MFE_PRODUCTS_URL}",
  "mfe-orders": "${MFE_ORDERS_URL}",
  "mfe-account": "${MFE_ACCOUNT_URL}"
}
EOF

exec nginx -g "daemon off;"
```

In ECS, these environment variables come from the **task definition** (a JSON configuration that tells ECS how to run a container). In EKS (Kubernetes), they come from a **ConfigMap** (a Kubernetes resource that stores configuration as key-value pairs).

### CI/CD Pipeline (Reference for DevOps)

Your DevOps team can adapt this GitHub Actions pipeline. It uses Nx's affected command to only build and deploy apps that changed:

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # Full history needed for nx affected
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4  # Sets base/head SHAs for affected detection
      - run: npx nx affected -t lint test build

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [shell, mfe-products, mfe-orders, mfe-account]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4

      # Only deploy if this app was affected by the change
      - name: Check if affected
        id: check
        run: |
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
          cat > dist/apps/shell/browser/assets/module-federation.manifest.json << 'EOF'
          {
            "mfe-products": "https://products.mfe.example.com",
            "mfe-orders": "https://orders.mfe.example.com",
            "mfe-account": "https://account.mfe.example.com"
          }
          EOF

      # Authenticate with AWS using OIDC (no static keys)
      - name: Configure AWS credentials
        if: steps.check.outputs.affected == 'true'
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy-role
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to S3 + invalidate CloudFront
        if: steps.check.outputs.affected == 'true'
        run: |
          BUCKET="mfe-${{ matrix.app }}-prod"
          DIST_ID="${{ secrets[format('CF_DIST_{0}', matrix.app)] }}"
          aws s3 sync dist/apps/${{ matrix.app }}/browser s3://${BUCKET} --delete
          aws cloudfront create-invalidation --distribution-id ${DIST_ID} --paths "/*"
```

**Key aspects your DevOps team should know:**
- **Matrix strategy:** Each MFE is a parallel job. Only affected apps build and deploy.
- **OIDC auth:** Uses role assumption instead of static AWS access keys.
- **Manifest injection:** The shell gets its production manifest after the build, before S3 sync.
- **`nrwl/nx-set-shas@v4`:** This GitHub Action sets the base and head Git SHAs that Nx uses to determine which projects were affected.
- **CloudFront distribution IDs** should be stored as secrets: `CF_DIST_shell`, `CF_DIST_mfe-products`, etc.

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

**S3 + CloudFront (static hosting):** Each MFE's build output is uploaded to an **S3 bucket** (Amazon's object storage, like a file server in the cloud). **CloudFront** (Amazon's CDN, short for Content Delivery Network) sits in front of S3 and caches files at edge locations worldwide for fast delivery. This is simpler, cheaper, and faster for static sites. No servers to manage.

**ECS + Fargate (container hosting):** Each MFE runs as a Docker container on **ECS** (Elastic Container Service, Amazon's container orchestration platform). **Fargate** is the serverless compute engine for ECS (you do not manage servers). **ECR** (Elastic Container Registry) stores your Docker images. This approach makes sense if you need server-side rendering, dynamic manifest injection at container startup, or your organization standardizes on containers.

For most Angular MFE setups, **S3 + CloudFront is the recommended approach** because the output is static HTML/JS/CSS.

### CloudFront Cache Behaviors

Share this table with your DevOps team so they configure caching correctly:

| Path Pattern | TTL | Why |
|---|---|---|
| `/remoteEntry.js` | 60 seconds | Changes on every deploy, not content-hashed |
| `/*.js` (hashed chunks) | 1 year | Content-hashed filenames, immutable |
| `/index.html` | 0 (always revalidate) | Points to latest hashed chunks |
| `/assets/*` | 1 year | Immutable static assets |

> **Warning:** If your DevOps team does not set a short TTL for `remoteEntry.js`, users may load a stale version after a deploy. The shell would try to load code that no longer exists, causing runtime errors.

### Checklist: What to Tell Your DevOps Team

Copy this into a Slack message or Jira ticket:

- **Build commands:** `npx nx build <app-name> --configuration=production` for each of: `shell`, `mfe-products`, `mfe-orders`, `mfe-account`
- **Output directory:** `dist/apps/<app-name>/browser/` (contains `index.html`, JS chunks, CSS, assets)
- **Manifest file:** `dist/apps/shell/browser/assets/module-federation.manifest.json` must be replaced with environment-specific URLs after building, before deploying
- **Manifest format:** JSON object where keys are remote names and values are base URLs (no trailing slash)
- **CORS requirement:** Each remote's CDN must set `Access-Control-Allow-Origin` to the shell's domain (e.g., `https://app.example.com`)
- **Cache-busting:** `remoteEntry.js` must have a short TTL (60s). All other `.js` and `.css` files are content-hashed and can be cached for 1 year. `index.html` should always revalidate
- **SPA routing:** nginx (or CloudFront) must return `index.html` for all routes that do not match a file (SPA fallback)
- **CloudFront invalidation:** After each deploy, invalidate `/index.html` and `/assets/module-federation.manifest.json` at minimum

---

## Chapter 12: Version Management and Shared Dependencies

### The Version Problem

Independently deployed remotes may be built at different times with different versions of shared dependencies. For example, the shell might use `@angular/core@21.1.0` while a remote was built with `@angular/core@21.0.0`.

Module Federation handles this through **version negotiation** at runtime: when multiple versions of a shared singleton are available, it picks the highest semver-compatible version.

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

---

## Chapter 13: Testing Strategy

### Unit Testing

Each library and app has its own unit tests. Run them individually or for the whole workspace:

```bash
# Test a specific library
npx nx test products-data-access

# Test a specific app
npx nx test mfe-products

# Test only projects affected by your changes
npx nx affected -t test
```

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
      "@mfe-platform/mfe-products/entry": [
        "apps/mfe-products/src/app/remote-entry/entry.routes.ts"
      ],
      "@mfe-platform/mfe-orders/entry": [
        "apps/mfe-orders/src/app/remote-entry/entry.routes.ts"
      ],
      "@mfe-platform/mfe-account/entry": [
        "apps/mfe-account/src/app/remote-entry/entry.routes.ts"
      ]
    }
  }
}
```

Then write the contract tests:

```typescript
// apps/shell/src/app/mfe-contracts.spec.ts
describe('MFE Contract Tests', () => {
  it('mfe-products exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe-products/entry');
    // Verify the export exists and is an array with at least one route
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
    expect(mod.remoteRoutes.length).toBeGreaterThan(0);
    // Verify there is a default route (path: '')
    expect(mod.remoteRoutes.find((r: any) => r.path === '')).toBeDefined();
  });

  it('mfe-orders exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe-orders/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });

  it('mfe-account exposes remoteRoutes as a non-empty array', async () => {
    const mod = await import('@mfe-platform/mfe-account/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });
});
```

> **Note:** These tests import the remote's entry file directly (bypassing Module Federation). They verify the export name and shape, catching breaking changes like renamed exports before they cause runtime errors in the shell.

Now that the application is tested and deployment artifacts are ready for your DevOps team, let's look at advanced patterns and best practices. That's Chapter 14.
