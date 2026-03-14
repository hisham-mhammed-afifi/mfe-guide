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
# Use nginx:alpine for the latest stable nginx on Alpine Linux
FROM nginx:alpine AS server
ARG APP_NAME
# Copy only the built static files into the nginx html directory
COPY --from=builder /app/dist/apps/${APP_NAME} /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
