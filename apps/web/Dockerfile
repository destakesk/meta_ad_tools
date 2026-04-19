# syntax=docker/dockerfile:1.9
# =====================================================================
# @metaflow/web — multi-stage production image (Next.js standalone)
# =====================================================================

ARG NODE_VERSION=20.18.2
ARG PNPM_VERSION=9.15.3

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache tini libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/tsconfig/node_modules ./packages/tsconfig/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules ./packages/eslint-config/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm --filter @metaflow/shared-types build
RUN pnpm --filter @metaflow/web build

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache tini curl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Non-root user
RUN addgroup -S -g 1001 nextjs && adduser -S -u 1001 -G nextjs nextjs

# Next standalone output includes its own minimal node_modules.
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
