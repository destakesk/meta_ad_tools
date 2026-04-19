#!/usr/bin/env bash
# Drops and recreates the dev database, then re-runs migrations + seed.
# Requires explicit confirmation — guard against accidental data loss.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '\033[1;31mThis will DROP the metaflow_dev database and re-run migrations.\033[0m\n'
read -r -p "Type 'reset' to continue: " confirm

if [ "$confirm" != "reset" ]; then
  echo "aborted"
  exit 1
fi

pnpm --filter @metaflow/database exec prisma migrate reset --force --skip-seed
pnpm db:generate
echo "database reset complete"
