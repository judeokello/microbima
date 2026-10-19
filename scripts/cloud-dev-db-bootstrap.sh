#!/bin/bash
# Bootstrap the local development database for MicroBima (Cursor Cloud environment).
#
# Assumptions:
#   - The local Supabase stack is already running (`supabase start`), exposing
#     Postgres on 127.0.0.1:54322 and the DB container named `supabase_db_microbima`.
#   - apps/api/.env exists (contains DATABASE_URL / SUPABASE_* etc.).
#
# What it does (all idempotent):
#   1. Pushes the Prisma schema onto the DB. NOTE: the migration history is NOT
#      replayable from scratch (the `_init` migration is ordered AFTER migrations
#      that depend on its tables), so `db push` is the supported way to create a
#      fresh local schema here.
#   2. Runs the seed (creates the root user + idempotent SQL seeds).
#   3. Syncs all sequences to MAX(id) so app-side inserts don't collide with
#      explicitly-seeded ids.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_microbima}"

echo "==> [1/3] Pushing Prisma schema (prisma db push)"
cd "$ROOT_DIR/apps/api"
npx prisma db push --skip-generate

echo "==> [2/3] Seeding database (pnpm db:seed)"
pnpm db:seed

echo "==> [3/3] Syncing Postgres sequences to MAX(id)"
docker exec -e PGPASSWORD=postgres -i "$DB_CONTAINER" \
  psql -U postgres -d postgres < "$ROOT_DIR/scripts/fix-db-sequences.sql"

echo "==> Database bootstrap complete."
