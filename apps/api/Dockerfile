# syntax=docker/dockerfile:1.9
# =====================================================================
# @metaflow/api — multi-stage production image
# Stages: deps → builder → runner (non-root, tini, healthcheck)
# =====================================================================

ARG NODE_VERSION=20.18.2
ARG PNPM_VERSION=9.15.3

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache tini
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/tsconfig/node_modules ./packages/tsconfig/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules ./packages/eslint-config/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @metaflow/database db:generate
RUN pnpm --filter @metaflow/shared-types build
RUN pnpm --filter @metaflow/api build

# Prune dev deps for the runtime image.
RUN pnpm --filter @metaflow/api deploy --prod --legacy /app/deploy

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache tini curl

ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

# Non-root user
RUN addgroup -S -g 1001 nestjs && adduser -S -u 1001 -G nestjs nestjs

COPY --from=builder --chown=nestjs:nestjs /app/deploy /app

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3001/health/live || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending migrations on every boot (idempotent) then start the API.
# The prisma CLI + migrations are bundled because @metaflow/database is a
# runtime workspace dep of @metaflow/api.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=node_modules/@metaflow/database/prisma/schema.prisma && node dist/main.js"]
