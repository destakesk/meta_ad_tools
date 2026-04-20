# metaflow

Meta Ads management platform — monorepo.

> **Status:** Module 01 — Project Bootstrap (infrastructure only, no business logic yet).

## Requirements

- Node.js **20.18.2** (see [`.nvmrc`](./.nvmrc))
- pnpm **9.15.3** (activated via Corepack)
- Docker 24+ (for Postgres, Redis, MinIO)

## Quickstart

```bash
# 1. Make sure you're on Node 20
nvm use           # or: corepack use node@20.18.2

# 2. Enable pnpm via corepack
corepack enable
corepack prepare pnpm@9.15.3 --activate

# 3. Install dependencies
pnpm install

# 4. Copy env template and generate secrets
cp .env.example .env
# then: openssl rand -base64 32  →  ENCRYPTION_KEY / JWT_SECRET

# 5. Bring up backing services
docker compose -f infra/docker-compose.yml up -d

# 6. Generate Prisma client + run migrations + seed permissions
pnpm db:generate
pnpm db:migrate
pnpm --filter @metaflow/database db:seed

# 7. Start dev servers
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/health

## Layout

```
apps/
  api/         NestJS 10 (port 3001)
  web/         Next.js 15 (port 3000)
packages/
  database/      Prisma 6 schema + client
  shared-types/  Zod schemas shared between apps
  eslint-config/ Shared flat ESLint config
  tsconfig/      Shared TS base configs
infra/
  docker-compose.yml
  nginx/
scripts/
```

## Security

See [`SECURITY.md`](./SECURITY.md) for the threat model and reporting process.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for commit conventions and branch strategy.
