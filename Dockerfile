# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifest files first (enables Docker layer caching)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/extension/package.json ./apps/extension/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (ignore lifecycle scripts to avoid wxt prepare etc.)
RUN npm ci --ignore-scripts

# Copy source files needed for API build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build the API (tsup bundles @underline/shared and zod inline → dist/index.js)
RUN npm run build --workspace @underline/api


# ---- Stage 2: Production ----
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests for production dependency install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/extension/package.json ./apps/extension/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only (fastify and its deps)
# --ignore-scripts prevents wxt prepare and other dev lifecycle hooks
RUN npm ci --omit=dev --ignore-scripts

# Copy the built API output from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# DigitalOcean App Platform injects $PORT at runtime (default 8080).
# The app reads PORT → API_PORT (8787 fallback) via resolveListenPort().
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
