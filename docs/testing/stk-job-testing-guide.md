# STK Push Job Testing Guide (T042 & T043)

Short guide for running and verifying the STK Push periodic jobs locally and on staging.

## When are test endpoints available?

- **GET-by-ID**, **trigger endpoints**, and **debug listing** are available only when:
  - `NODE_ENV === 'development'` or `NODE_ENV === 'staging'`
- No `ENABLE_CRON_TEST_ENDPOINTS`; use `NODE_ENV` only.

## Getting the Supabase JWT

Internal endpoints require a Supabase Bearer token. Easiest way:

1. Log into the **agent-registration** app (e.g. http://localhost:3000).
2. Open **Get Supabase Token**: [http://localhost:3000/admin/get-token](http://localhost:3000/admin/get-token).
3. Copy the token and use it in the `Authorization: Bearer <token>` header for curl (or Postman).

Replace the port/host if your app runs elsewhere (e.g. staging).

## Local testing

### 1. Seed test data

**From repo root:**

```bash
pnpm --filter @microbima/api run seed:stk-job-test
```

**From `apps/api`:**

```bash
pnpm exec ts-node -r dotenv/config scripts/seed-stk-job-test-data.ts
```

**Output:** The script prints **Created T042 IDs** and **Created T043 IDs**. Copy these for verification.

- **T042 IDs**: PENDING requests with old `initiatedAt` (will be marked EXPIRED by the expiration job).
- **T043 IDs**: COMPLETED requests with no IPN within 24h (reported by the missing-IPN job).

### 2. Start the API

Ensure `NODE_ENV=development` (default for local). Start the API from the repo root or `apps/api` as usual (e.g. `pnpm run start:dev`).

### 3. Run jobs (choose one)

**Option A – Trigger jobs on demand (no waiting):**

```bash
# Mark old PENDING requests as EXPIRED (T042)
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/jobs/run-expiration \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"

# Run missing-IPN check (T043)
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/jobs/run-missing-ipn-check \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

**Option B – Rely on cron:**  
Wait ~2 minutes for the expiration job (T042) and up to 1 hour for the missing-IPN job (T043).

### 4. Verify

**Check a single request (GET-by-ID):**

```bash
curl http://localhost:3001/api/internal/mpesa/stk-push/requests/<ID> \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

Use a **T042 ID**: after the expiration job, `status` should be `EXPIRED`.  
Use a **T043 ID**: it should appear in the missing-IPN debug list and in logs.

**List IDs for debugging:**

```bash
# Recently expired (T042)
curl "http://localhost:3001/api/internal/mpesa/stk-push/jobs/debug?type=expired" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"

# Missing IPN (T043)
curl "http://localhost:3001/api/internal/mpesa/stk-push/jobs/debug?type=missing-ipn" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

You can also confirm status in the DB using the printed IDs.

## Staging testing

1. **Deploy** with `NODE_ENV=staging` so the same endpoints are available.
2. **Seed staging DB** (point `DATABASE_URL` at staging, then run from your machine):

   From repo root:
   ```bash
   DATABASE_URL="postgresql://..." pnpm --filter @microbima/api run seed:stk-job-test
   ```
   Or from `apps/api`: `DATABASE_URL="postgresql://..." pnpm exec ts-node -r dotenv/config scripts/seed-stk-job-test-data.ts`

   Save the printed **Created T042 IDs** and **Created T043 IDs**.
3. **Run and verify** either:
   - **On demand:** Call `POST .../jobs/run-expiration` and `POST .../jobs/run-missing-ipn-check` on the staging API, then use GET-by-ID and `GET jobs/debug?type=expired|missing-ipn`, or
   - **Via cron:** Wait ~2 min (T042) and up to 1 h (T043), then check staging logs and DB (or the same GET endpoints).

Use the staging API base URL and the same auth (e.g. Supabase JWT) for all requests.

## Quick reference

| What              | Command / endpoint |
|-------------------|--------------------|
| Seed script (root) | `pnpm --filter @microbima/api run seed:stk-job-test` |
| Seed script (api)  | From `apps/api`: `pnpm exec ts-node -r dotenv/config scripts/seed-stk-job-test-data.ts` |
| Supabase JWT      | Log in to agent-registration → [http://localhost:3000/admin/get-token](http://localhost:3000/admin/get-token) |
| Trigger T042      | `POST /api/internal/mpesa/stk-push/jobs/run-expiration` |
| Trigger T043       | `POST /api/internal/mpesa/stk-push/jobs/run-missing-ipn-check` |
| Get one request   | `GET /api/internal/mpesa/stk-push/requests/:id` |
| List expired      | `GET /api/internal/mpesa/stk-push/jobs/debug?type=expired` |
| List missing IPN  | `GET /api/internal/mpesa/stk-push/jobs/debug?type=missing-ipn` |

All internal endpoints require the same auth as other internal routes (e.g. Supabase Bearer token).
