# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Docker build 中は仮の設定で Next.js をビルドします。
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV ADMIN_VIEW_KEY=toyota-table-tennis-admin
ENV NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000

# Optimize build for constrained environments
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=3072

# Clean any previous build artifacts and caches
RUN rm -rf .next node_modules/.cache

RUN npx prisma generate
RUN npm run build -- --webpack

FROM base AS runner
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm ci --omit=dev \
	&& npm cache clean --force

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD set -eu; if [ -z "${DATABASE_URL:-}" ]; then for key in POSTGRES_PRISMA_URL POSTGRES_URL NEON_DATABASE_URL RENDER_POSTGRESQL_URL RENDER_DATABASE_URL RENDER_INTERNAL_DATABASE_URL POSTGRES_INTERNAL_URL; do eval value="\${$key:-}"; if [ -n "$value" ]; then export DATABASE_URL="$value"; break; fi; done; fi; if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGHOST:-}" ] && [ -n "${PGUSER:-}" ] && [ -n "${PGPASSWORD:-}" ] && [ -n "${PGDATABASE:-}" ]; then export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}?schema=public"; fi; if [ -z "${DATABASE_URL:-}" ]; then echo 'DATABASE_URL is required (or POSTGRES_PRISMA_URL / POSTGRES_URL / NEON_DATABASE_URL / RENDER_POSTGRESQL_URL / RENDER_DATABASE_URL / RENDER_INTERNAL_DATABASE_URL / POSTGRES_INTERNAL_URL, or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)'; exit 1; fi; if [ -z "${NEXT_PUBLIC_APP_BASE_URL:-}" ]; then if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then export NEXT_PUBLIC_APP_BASE_URL=$RENDER_EXTERNAL_URL; else export NEXT_PUBLIC_APP_BASE_URL=https://toyota-table-tennis-notes.onrender.com; fi; fi; export PORT=${PORT:-3000}; export HOSTNAME=0.0.0.0; echo "PORT=$PORT"; echo "DATABASE_URL=present"; echo "NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL"; exec node server.js

