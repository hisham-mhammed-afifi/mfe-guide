# Part 4: Deployment, Versions, and Testing

---

## Chapter 11: CI/CD and Deployment on AWS with Docker

### Deployment Architecture on AWS

Each MFE is a static Angular build served from its own S3 bucket behind CloudFront. The shell loads remotes at runtime via the manifest. Each app has its own CI pipeline, Docker build stage, and deploy step.

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

| Application | S3 Bucket | CloudFront Distribution | Domain |
|---|---|---|---|
| shell | `mfe-shell-{env}` | `EXXXSHELL` | `app.example.com` |
| mfe-products | `mfe-products-{env}` | `EXXXPRODUCTS` | `products.mfe.example.com` |
| mfe-orders | `mfe-orders-{env}` | `EXXXORDERS` | `orders.mfe.example.com` |
| mfe-account | `mfe-account-{env}` | `EXXXACCOUNT` | `account.mfe.example.com` |

### Dockerized Build

Each MFE uses a multi-stage Docker build: Node for building, nginx for serving. Even though the final deployment goes to S3, Docker provides a consistent, reproducible build environment across CI agents and local machines.

#### Shared Base Dockerfile (workspace root)

```dockerfile
# Dockerfile
# ============================================
# Stage 1: Install dependencies (cached layer)
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: Build a specific MFE
# ============================================
FROM deps AS builder
WORKDIR /app
COPY . .
ARG APP_NAME
ARG CONFIGURATION=production
RUN npx nx build ${APP_NAME} --configuration=${CONFIGURATION}

# ============================================
# Stage 3: Serve with nginx (for Docker-based deploy or local testing)
# ============================================
FROM nginx:1.27-alpine AS server
ARG APP_NAME
COPY --from=builder /app/dist/apps/${APP_NAME}/browser /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

> **Why multi-stage?**
> - `deps` stage is cached. As long as `package.json` doesn't change, `npm ci` is skipped on rebuilds.
> - `builder` receives the full workspace and builds only the requested app via `ARG APP_NAME`.
> - `server` produces a tiny nginx image (~25 MB) with only the static output.

#### nginx.conf for SPA Routing

```nginx
# docker/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively (content-hashed by Webpack)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Short cache for remoteEntry.js (changes on every deploy)
    location = /remoteEntry.js {
        expires 60s;
        add_header Cache-Control "public, max-age=60";
    }

    # CORS (used when served from Docker; CloudFront handles CORS in prod)
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

#### Building Each MFE

```bash
docker build --build-arg APP_NAME=shell -t mfe-shell:latest .
docker build --build-arg APP_NAME=mfe-products -t mfe-products:latest .
docker build --build-arg APP_NAME=mfe-orders -t mfe-orders:latest .
docker build --build-arg APP_NAME=mfe-account -t mfe-account:latest .
```

#### docker-compose.yml (Full System Local Test)

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

Navigate to `http://localhost:4200`. The shell loads remotes from `localhost:4201-4203` via the dev manifest. This is a production-like integration test using real nginx and real Module Federation.

### Injecting the Manifest per Environment

The shell is built once; the manifest is swapped at deploy time.

#### Approach A: Replace the File Before S3 Sync (For S3+CloudFront)

```bash
#!/bin/bash
# scripts/deploy-shell.sh
ENV=${1:-prod}

# Build (or use cached artifact)
npx nx build shell --configuration=production

# Overwrite manifest
cat > dist/apps/shell/browser/assets/module-federation.manifest.json << EOF
{
  "mfe-products": "https://products.mfe.example.com",
  "mfe-orders": "https://orders.mfe.example.com",
  "mfe-account": "https://account.mfe.example.com"
}
EOF

# Sync to S3
aws s3 sync dist/apps/shell/browser s3://mfe-shell-${ENV} --delete

# Invalidate CloudFront (manifest + index.html)
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST_SHELL} \
  --paths "/assets/module-federation.manifest.json" "/index.html"
```

#### Approach B: Docker Entrypoint (For ECS/EKS Container Deploy)

For teams deploying the shell as a Docker container on ECS Fargate or EKS:

```bash
#!/bin/sh
# docker/entrypoint.sh
cat > /usr/share/nginx/html/assets/module-federation.manifest.json << EOF
{
  "mfe-products": "${MFE_PRODUCTS_URL}",
  "mfe-orders": "${MFE_ORDERS_URL}",
  "mfe-account": "${MFE_ACCOUNT_URL}"
}
EOF

exec nginx -g "daemon off;"
```

Update the Dockerfile server stage:

```dockerfile
FROM nginx:1.27-alpine AS server
ARG APP_NAME
COPY --from=builder /app/dist/apps/${APP_NAME}/browser /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
```

Run with env vars:

```bash
docker run -p 4200:80 \
  -e MFE_PRODUCTS_URL=https://products.mfe.example.com \
  -e MFE_ORDERS_URL=https://orders.mfe.example.com \
  -e MFE_ACCOUNT_URL=https://account.mfe.example.com \
  mfe-shell:latest
```

In ECS, these env vars come from the task definition. In EKS, from a ConfigMap or Secret.

### CI Pipeline: GitHub Actions with Docker + AWS

```yaml
# .github/workflows/ci-deploy.yml
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
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4
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

      - name: Configure AWS credentials (OIDC)
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

> **Key aspects:**
> - **Matrix strategy:** Each MFE is a parallel job. Only affected apps build and deploy.
> - **OIDC auth:** Uses role assumption instead of static AWS keys.
> - **Manifest injection:** Shell gets its production manifest after build, before S3 sync.
> - **CloudFront IDs** stored as secrets: `CF_DIST_shell`, `CF_DIST_mfe-products`, etc.

### CloudFront CORS (Response Headers Policy)

Each remote's distribution needs a response headers policy:

```json
{
  "CORSConfig": {
    "AccessControlAllowOrigins": { "Items": ["https://app.example.com"] },
    "AccessControlAllowMethods": { "Items": ["GET", "OPTIONS"] },
    "AccessControlAllowHeaders": { "Items": ["*"] },
    "AccessControlMaxAgeSec": 86400,
    "OriginOverride": true
  }
}
```

> S3 does not need separate CORS if CloudFront is the only origin.

### CloudFront Cache Behaviors

| Path Pattern | TTL | Notes |
|---|---|---|
| `/remoteEntry.js` | 60 seconds | Changes on every deploy |
| `/*.js` (hashed chunks) | 1 year | Content-hashed, immutable |
| `/index.html` | 0 (revalidate) | Points to latest chunks |
| `/assets/*` | 1 year | Immutable |

### ECR + ECS Alternative

For teams running MFEs as containers on ECS Fargate:

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag mfe-shell:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/mfe-shell:latest
docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/mfe-shell:latest

aws ecs update-service \
  --cluster mfe-cluster \
  --service shell-service \
  --force-new-deployment
```

ECS task definition passes manifest URLs as environment variables (consumed by the entrypoint script):

```json
{
  "containerDefinitions": [{
    "name": "shell",
    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/mfe-shell:latest",
    "portMappings": [{ "containerPort": 80 }],
    "environment": [
      { "name": "MFE_PRODUCTS_URL", "value": "https://products.mfe.example.com" },
      { "name": "MFE_ORDERS_URL", "value": "https://orders.mfe.example.com" },
      { "name": "MFE_ACCOUNT_URL", "value": "https://account.mfe.example.com" }
    ]
  }]
}
```

> **S3+CloudFront vs. ECS:** For pure static MFEs, S3+CloudFront is simpler, cheaper, and faster (no servers to manage, global edge caching). ECS makes sense if you need SSR, dynamic manifest injection at container startup, or your org standardizes on container deployments.

---

## Chapter 12: Version Management and Shared Dependencies

### The Version Problem

Independently deployed remotes may be built with different versions of shared dependencies. Module Federation handles this through version negotiation at runtime: when multiple versions of a shared singleton are available, it picks the highest semver-compatible version.

### Nx's Default Strategy

`withModuleFederation` configures shared deps with:

- **`singleton: true`** for Angular core packages (one instance of Angular).
- **`strictVersion: true`** for critical packages. This produces a **console warning** (not a crash) like `Unsatisfied version X of shared singleton module Y`. The app continues loading, but behavior may be unpredictable.
- **`requiredVersion: 'auto'`** reads the version from `package.json`.

> **`strictVersion` does NOT throw a JavaScript error.** It only logs a warning. Version mismatches can sneak into production unnoticed. Always check for these warnings in integration tests.

### Keeping Versions Aligned

```bash
nx migrate latest
npm install
nx migrate --run-migrations
```

After migration, rebuild and redeploy all affected apps.

### Detecting Drift

- Run integration tests (Docker Compose) that load all remotes in the shell.
- Check the browser Network tab for duplicate `@angular/core` chunks.
- Check the console for `Unsatisfied version` warnings.

---

## Chapter 13: Testing Strategy

### Unit Testing

```bash
nx test mfe-products
nx test shared-data-access-auth
nx test shared-ui
```

### Affected Testing in CI

```bash
nx affected -t test
```

### Integration Testing with Docker Compose

Spin up the full system in production-like containers, then run E2E tests:

```bash
docker compose up --build -d
npx playwright test --config=apps/shell-e2e/playwright.config.ts
docker compose down
```

What to verify:
1. Each remote route loads and renders.
2. Cross-MFE flows (login in account, verify state in products).
3. No MF warnings in browser console.
4. `@angular/core` appears only once in Network tab.

### Contract Testing

```typescript
// apps/shell/src/app/mfe-contracts.spec.ts
// Requires tsconfig path aliases (see below)

describe('MFE Contract Tests', () => {
  it('mfe-products exposes remoteRoutes', async () => {
    const mod = await import('@mfe-platform/mfe-products/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
    expect(mod.remoteRoutes.length).toBeGreaterThan(0);
    expect(mod.remoteRoutes.find((r: any) => r.path === '')).toBeDefined();
  });

  it('mfe-orders exposes remoteRoutes', async () => {
    const mod = await import('@mfe-platform/mfe-orders/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });

  it('mfe-account exposes remoteRoutes', async () => {
    const mod = await import('@mfe-platform/mfe-account/entry');
    expect(mod.remoteRoutes).toBeDefined();
    expect(Array.isArray(mod.remoteRoutes)).toBe(true);
  });
});
```

> Add to `tsconfig.base.json`:
> ```json
> "@mfe-platform/mfe-products/entry": ["apps/mfe-products/src/app/remote-entry/entry.routes.ts"],
> "@mfe-platform/mfe-orders/entry": ["apps/mfe-orders/src/app/remote-entry/entry.routes.ts"],
> "@mfe-platform/mfe-account/entry": ["apps/mfe-account/src/app/remote-entry/entry.routes.ts"]
> ```
