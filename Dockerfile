# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
ENV NPM_CONFIG_FETCH_TIMEOUT=300000
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY apps/table-tennis/package.json apps/table-tennis/package-lock.json ./apps/table-tennis/
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/table-tennis ci --no-audit --no-fund

COPY apps/handball/package.json apps/handball/package-lock.json ./apps/handball/
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/handball ci --no-audit --no-fund

FROM base AS builder
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/table-tennis/node_modules ./apps/table-tennis/node_modules
COPY --from=deps /workspace/apps/handball/node_modules ./apps/handball/node_modules
COPY . .

ARG BUILD_NODE_OPTIONS=--max-old-space-size=1024
ENV NODE_OPTIONS=${BUILD_NODE_OPTIONS}

ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV ADMIN_VIEW_KEY=placeholder

RUN --mount=type=cache,target=/root/.npm sh -c 'set -e; \
  n=0; \
  until [ "$n" -ge 5 ]; do \
    npm --prefix apps/table-tennis run db:generate && break; \
    n=$((n + 1)); \
    echo "table-tennis prisma generate failed (attempt ${n}/5). retrying..."; \
    sleep $((n * 5)); \
  done; \
  [ "$n" -lt 5 ]'
RUN --mount=type=cache,target=/root/.npm sh -c 'set -e; \
  n=0; \
  until [ "$n" -ge 5 ]; do \
    npm --prefix apps/handball run db:generate && break; \
    n=$((n + 1)); \
    echo "handball prisma generate failed (attempt ${n}/5). retrying..."; \
    sleep $((n * 5)); \
  done; \
  [ "$n" -lt 5 ]'
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/workspace/apps/table-tennis/.next/cache \
  npm --prefix apps/table-tennis run build
RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/workspace/apps/handball/.next/cache \
  npm --prefix apps/handball run build

FROM deps AS runtime-deps
RUN --mount=type=cache,target=/root/.npm npm prune --omit=dev --omit=optional --no-audit --no-fund
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/table-tennis prune --omit=dev --omit=optional --no-audit --no-fund
RUN --mount=type=cache,target=/root/.npm npm --prefix apps/handball prune --omit=dev --omit=optional --no-audit --no-fund

FROM base AS runner
ENV NODE_ENV=production

COPY --from=runtime-deps /workspace/node_modules ./node_modules
COPY --from=runtime-deps /workspace/apps/table-tennis/node_modules ./apps/table-tennis/node_modules
COPY --from=runtime-deps /workspace/apps/handball/node_modules ./apps/handball/node_modules

COPY --from=builder /workspace/gateway ./gateway

COPY --from=builder /workspace/apps/handball/package.json ./apps/handball/package.json
COPY --from=builder /workspace/apps/handball/prisma.config.ts ./apps/handball/prisma.config.ts
COPY --from=builder /workspace/apps/handball/prisma ./apps/handball/prisma
COPY --from=builder /workspace/apps/handball/public ./apps/handball/public
COPY --from=builder /workspace/apps/handball/.next/standalone ./apps/handball/.next/standalone
COPY --from=builder /workspace/apps/handball/.next/static ./apps/handball/.next/standalone/.next/static
COPY --from=builder /workspace/apps/handball/public ./apps/handball/.next/standalone/public

COPY --from=builder /workspace/apps/table-tennis/package.json ./apps/table-tennis/package.json
COPY --from=builder /workspace/apps/table-tennis/prisma.config.ts ./apps/table-tennis/prisma.config.ts
COPY --from=builder /workspace/apps/table-tennis/prisma ./apps/table-tennis/prisma
COPY --from=builder /workspace/apps/table-tennis/public ./apps/table-tennis/public
COPY --from=builder /workspace/apps/table-tennis/.next/standalone ./apps/table-tennis/.next/standalone
COPY --from=builder /workspace/apps/table-tennis/.next/static ./apps/table-tennis/.next/standalone/.next/static
COPY --from=builder /workspace/apps/table-tennis/public ./apps/table-tennis/.next/standalone/public

EXPOSE 3000

CMD ["node", "gateway/server.cjs"]
