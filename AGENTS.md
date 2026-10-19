# AGENTS.md

## Cursor Cloud specific instructions

This section captures non-obvious, durable setup/run knowledge for the MicroBima
monorepo. Standard commands live in the root `package.json`, `apps/*/package.json`,
and `README.md`; this section only records what is easy to get wrong.

### Services

| Service | Path | Port | Run (dev) |
|---|---|---|---|
| Backend API (NestJS) | `apps/api` | 3001 | `pnpm dev:api` (or `cd apps/api && PORT=3001 pnpm start:dev`) |
| Agent Registration (Next.js) | `apps/agent-registration` | 3000 | `pnpm dev:agent` (or `cd apps/agent-registration && pnpm dev`) |
| Postgres + Auth + Storage | local Supabase stack | 54321 (API), 54322 (DB), 54323 (Studio) | `supabase start` |

`pnpm dev` (root) builds the shared packages and starts BOTH apps. The shared
libs `packages/common-config` and `packages/portal-pin` are consumed via `dist/`,
so they must be built before/api start (the start scripts and turbo `^build` do
this automatically).

### Required infra: Docker + local Supabase

The API and both apps expect the local Supabase stack (default env points at
`127.0.0.1:54321/54322`). Supabase local requires Docker. On a fresh VM session:

1. Start the Docker daemon (needs the docker-in-docker workaround; daemon is not
   auto-started): `sudo dockerd &` then `sudo chmod 666 /var/run/docker.sock`.
   Docker is configured with the `fuse-overlayfs` storage driver and
   `containerd-snapshotter: false` in `/etc/docker/daemon.json` (required for
   Docker 29 in this VM). iptables is set to legacy mode.
2. Start Supabase: `supabase start` (run from repo root; uses `supabase/config.toml`).
3. If the DB is empty, bootstrap it: `./scripts/cloud-dev-db-bootstrap.sh`.

### Database gotchas (important)

- Migration history is NOT replayable on a fresh DB. `prisma migrate deploy/dev`
  fails because the `_init` migration (`20250903093411_init`) is ordered AFTER
  three Feb-2025 migrations that depend on tables it creates (e.g. `packages`).
  For a fresh local DB use `prisma db push` (schema.prisma is the source of truth),
  NOT the migration commands. `scripts/cloud-dev-db-bootstrap.sh` does this.
- After seeding you MUST sync Postgres sequences. The seed inserts rows with
  explicit integer ids, which does not advance the identity sequences, so the
  app's first inserts fail with "A record with this id already exists". Fix with
  `scripts/fix-db-sequences.sql` (invoked by the bootstrap script). Re-run it any
  time you re-seed with explicit ids.
- Prisma blocks destructive commands run by AI agents (e.g. `db push --force-reset`).
  To reset a local dev DB, drop/recreate the schema directly instead:
  `docker exec -e PGPASSWORD=postgres supabase_db_microbima psql -U postgres -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
  then re-run the bootstrap.

### Env files

Local dev env files are created (gitignored): `apps/api/.env` and
`apps/agent-registration/.env.local`. Note the frontend calls the API directly at
`NEXT_PUBLIC_INTERNAL_API_BASE_URL`; for local dev this must be
`http://localhost:3001/api` (the values in `env.example` are deployment-oriented
and point at port 3000 via a gateway — wrong for local). Regenerate from the
`env.example` files if missing.

### Local admin login

The seed creates a root Supabase user for admin login:
`tech@maishapoa.co.ke` / `DevPassword123!` (from `ROOT_USER_*` in `apps/api/.env`).
Admin UI: http://localhost:3000/admin — after login the app lands on the admin
dashboard.

### Health / docs

- API health is at `/health` (NOT `/api/health`). `start-api.sh` health-checks the
  wrong path (`/api/health`) and may print a warning even when the API is healthy.
- Swagger: `http://localhost:3001/api/internal/docs` and `.../api/v1/docs`.

### Lint / test / build

- Lint: `pnpm lint` (root, turbo). Passes with warnings only.
- Test: `pnpm test` (root, turbo; API uses Jest). Unit tests are mocked and do not
  need the DB.
- Build: `pnpm build` (root). Local Next build is fast; the standalone/Sentry
  production build only runs with `CI=true NEXT_OUTPUT_STANDALONE=true`.
