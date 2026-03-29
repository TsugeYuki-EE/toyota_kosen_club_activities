# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci \
  && npm cache clean --force

COPY apps/table-tennis/package.json apps/table-tennis/package-lock.json ./apps/table-tennis/
RUN npm --prefix apps/table-tennis ci \
  && npm cache clean --force

COPY apps/handball/package.json apps/handball/package-lock.json ./apps/handball/
RUN npm --prefix apps/handball ci \
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

FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /workspace /workspace

EXPOSE 3000

CMD ["node", "gateway/server.cjs"]
