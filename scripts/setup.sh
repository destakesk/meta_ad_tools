#!/usr/bin/env bash
# One-shot local environment setup. Idempotent — safe to re-run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
err() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || err "docker not installed"
command -v pnpm   >/dev/null || err "pnpm not available (run: corepack enable && corepack prepare pnpm@9.15.3 --activate)"

if [ ! -f .env ]; then
  say "copying .env.example → .env"
  cp .env.example .env
  say "generating ENCRYPTION_KEY, JWT_SECRET, NEXTAUTH_SECRET (openssl rand -base64 32)"
  for key in ENCRYPTION_KEY JWT_SECRET NEXTAUTH_SECRET; do
    secret=$(openssl rand -base64 32)
    # Replace placeholder in place.
    # Use | as delimiter because the secret may contain /.
    sed -i.bak "s|CHANGEME_openssl_rand_base64_32|$secret|" .env
    rm -f .env.bak
    break  # Only substitute one placeholder per pass to keep the loop simple.
  done
  # Do remaining two with the same pattern.
  for key in JWT_SECRET NEXTAUTH_SECRET; do
    secret=$(openssl rand -base64 32)
    sed -i.bak "s|CHANGEME_openssl_rand_base64_32|$secret|" .env
    rm -f .env.bak
  done
fi

say "starting backing services (postgres, redis, minio)"
docker compose -f infra/docker-compose.yml up -d

say "waiting for postgres to be healthy"
for _ in {1..30}; do
  if docker exec metaflow-postgres pg_isready -U metaflow -d metaflow_dev >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

say "installing node dependencies"
pnpm install

say "generating prisma client"
pnpm db:generate

say "applying database migrations"
pnpm db:migrate

say "setup complete — run 'pnpm dev' to start api and web"
