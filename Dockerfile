# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
ENV NPM_CONFIG_FETCH_TIMEOUT=300000

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
  && npm cache clean --force

COPY apps/table-tennis/package.json apps/table-tennis/package-lock.json ./apps/table-tennis/
RUN npm --prefix apps/table-tennis ci --no-audit --no-fund \
  && npm cache clean --force

COPY apps/handball/package.json apps/handball/package-lock.json ./apps/handball/
RUN npm --prefix apps/handball ci --no-audit --no-fund \
  && npm cache clean --force

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

RUN npm --prefix apps/table-tennis run db:generate
RUN npm --prefix apps/handball run db:generate
RUN npm --prefix apps/table-tennis run build
RUN npm --prefix apps/handball run build

FROM base AS runtime-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY apps/table-tennis/package.json apps/table-tennis/package-lock.json ./apps/table-tennis/
RUN npm --prefix apps/table-tennis ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY apps/handball/package.json apps/handball/package-lock.json ./apps/handball/
RUN npm --prefix apps/handball ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

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
COPY --from=builder /workspace/apps/handball/.next/static ./apps/handball/.next/static

COPY --from=builder /workspace/apps/table-tennis/package.json ./apps/table-tennis/package.json
COPY --from=builder /workspace/apps/table-tennis/prisma.config.ts ./apps/table-tennis/prisma.config.ts
COPY --from=builder /workspace/apps/table-tennis/prisma ./apps/table-tennis/prisma
COPY --from=builder /workspace/apps/table-tennis/public ./apps/table-tennis/public
COPY --from=builder /workspace/apps/table-tennis/.next/standalone ./apps/table-tennis/.next/standalone
COPY --from=builder /workspace/apps/table-tennis/.next/static ./apps/table-tennis/.next/static

EXPOSE 3000

CMD ["node", "gateway/server.cjs"]
