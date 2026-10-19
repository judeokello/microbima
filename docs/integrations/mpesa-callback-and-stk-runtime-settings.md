# M-Pesa callback / STK runtime settings — when to include each

These six environment variables exist so Safaricom can call our API back, so we can reject fake callers in production, and so we can turn STK on/off and expire stuck prompts. They are **not** credentials.

Credentials (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_BUSINESS_SHORT_CODE`, `MPESA_PASSKEY`, `MPESA_ENVIRONMENT`) are a separate required set. Include those whenever the API talks to Daraja at all.

Typical local values (from `apps/api/.env`):

```bash
MPESA_STK_PUSH_CALLBACK_URL=https://<ngrok-host>/api/public/mpayesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://<ngrok-host>/api/public/mpayesa/confirmation
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128
MPESA_STK_PUSH_ENABLED=true
MPESA_STK_PUSH_TIMEOUT_MINUTES=5
MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES=1
```

## The two payment channels (this is the decision key)

| Channel | What the customer does | Safaricom calls | Which of these six matter |
|---|---|---|---|
| **STK Push** | Agent/app sends a prompt to the phone; customer enters PIN | `MPESA_STK_PUSH_CALLBACK_URL` | Callback URL, `ENABLED`, timeout, expiration interval. IP ranges in production. |
| **Paybill / C2B IPN** | Customer pays the till/paybill themselves (Lipa na M-Pesa) | `MPESA_IPN_CONFIRMATION_URL` | Confirmation URL (must also be registered with Safaricom). IP ranges in production. `ENABLED` does **not** apply. |

STK is used from:

- Agent registration **payment** step (first premium)
- Customer **Request payment** / on-demand STK on a prepaid policy
- Internal `POST /internal/mpesa/stk-push/initiate`

Paybill/IPN is used whenever someone pays the shortcode with a bill reference (policy number, etc.), including when STK is disabled and the UI tells them to pay via Paybill.

The API **will not start** unless both callback URLs are set and are `https://...`. Even if you only care about one channel, **include both URLs** in every real API env.

## Hard URL rules (wrong path = silent failure)

Safaricom rejects any callback URL containing the substring `mpesa`. Live routes therefore use **`mpayesa`**.

Always use:

```text
https://<public-host>/api/public/mpayesa/stk-push/callback
https://<public-host>/api/public/mpayesa/confirmation
```

Never use `/api/public/mpesa/...`.

`<public-host>` is:

- **Local:** current ngrok (or similar) hostname that tunnels to the API process (default port **3001**). Update and **restart the API** whenever the tunnel host changes.
- **Staging/prod:** the public internal-api host (e.g. Fly). Not localhost, not the Next.js app.

These two routes are **unauthenticated** (no API key). Safaricom cannot send keys. Security is IP allowlisting in production only.

## How IP restrictions work

This is **not** a global Express/Nest middleware that filters every request. Enforcement is a NestJS **guard** (`IpWhitelistGuard`) attached only to the three public M-Pesa handlers with `@UseGuards(IpWhitelistGuard)`:

| Route | Handler |
|---|---|
| `POST /api/public/mpayesa/stk-push/callback` | STK result from Daraja |
| `POST /api/public/mpayesa/confirmation` | C2B / paybill IPN |
| `POST /api/public/mpayesa/validation` | C2B validation (always accept) |

`MPESA_ALLOWED_IP_RANGES` is read only inside that guard. Other API routes (initiate STK, internal config, agent-registration, etc.) never consult it.

### What *is* middleware (and what it is not)

On the way in, two middlewares touch these paths but **do not** enforce IPs:

1. **`MpesaCallbackLoggerMiddleware`** — logs the raw body for debugging, then `next()`.
2. **`ApiKeyAuthMiddleware`** — **skips** API-key checks for the three `mpayesa` paths (Safaricom cannot send our key). Every other route still requires a key.

So the stack for a callback is:

```text
MpesaCallbackLoggerMiddleware  (log only)
  → CorrelationIdMiddleware
    → ApiKeyAuthMiddleware     (skip auth for mpayesa)
      → IpWhitelistGuard       (THIS is the IP check; production only)
        → controller / service (create payment, update STK status, …)
```

The guard is registered as a provider and applied **per-handler**, not as `APP_GUARD`. Adding a new public M-Pesa URL without `@UseGuards(IpWhitelistGuard)` and without an API-key skip would either be open to the world or blocked by API-key auth.

### When the guard allows vs rejects

`environment === 'production'` comes from `NODE_ENV`. Staging and local are **not** production.

| Condition | Result |
|---|---|
| `NODE_ENV` is not `production` (local, test, staging) | **Allow all IPs.** `MPESA_ALLOWED_IP_RANGES` is ignored. This is why ngrok works. |
| Production, and client IP is localhost / RFC1918 (`127.0.0.1`, `::1`, `10.*`, `192.168.*`, `172.16–31.*`) | **Allow** (safety hatch; should not be how Safaricom arrives). |
| Production, and `MPESA_ALLOWED_IP_RANGES` is empty/unset | **Reject.** Empty whitelist is treated as a misconfiguration, not “allow all”. |
| Production, IP in a configured CIDR | **Allow.** |
| Production, IP not in any CIDR | **Reject.** |

On reject the guard returns `false`. Nest never runs the controller: no payment row, no STK status update. It logs `SECURITY_VIOLATION`, emits a `security_violations` metric, and sends a Sentry error. Nest then answers with **HTTP 403**. Comments in the guard mention returning Daraja `{ ResultCode: 0 }` so Safaricom would not retry; that body is **not** what a failed guard currently returns (only the controller does that, and it never runs). Treat a rejected callback as dropped.

### How the client IP is chosen

In order:

1. First address in `X-Forwarded-For` (left-most hop)
2. Else `X-Real-IP`
3. Else `request.ip` / socket remote address

Behind Fly or another proxy, the address the guard sees is whatever those headers (or the proxy) provide. If the proxy overwrites `X-Forwarded-For` with an internal hop, production checks can fail even with correct Safaricom CIDRs.

### How CIDRs are matched

`MPESA_ALLOWED_IP_RANGES` is split on commas, trimmed, empty tokens dropped.

- **IPv4:** real CIDR match (`196.201.214.0/24` includes `196.201.214.10`; `/32` is a single host). A value with no `/` is an exact IP match.
- **IPv6:** **exact address match only** (the prefix is not applied). `::1/128` only matches if the seen IP is exactly `::1`.

Use IPv4 Safaricom ranges in production unless you have confirmed v6 callbacks and exact addresses.

### What another agent should do

- **Do not** implement a second IP filter in the Next apps or in initiate-STK clients. Only the API public callbacks need this.
- **Do not** expect `127.0.0.1/32,::1/128` to “lock down” local/staging; those environments skip the check.
- **Do** set real Safaricom IPv4 CIDRs on any API where `NODE_ENV=production`, or callbacks are rejected.
- **Do** put `@UseGuards(IpWhitelistGuard)` on any new public Safaricom URL, and add that path to the API-key skip list. Also add it to the callback logger if you want raw-body logs.

See `apps/api/src/guards/ip-whitelist.guard.ts`.

## Variable-by-variable: when it is used and when to include it

### 1. `MPESA_STK_PUSH_CALLBACK_URL` — include whenever STK might run

**When it is used:** At the moment an STK prompt is initiated. The API copies this string into Daraja’s `CallBackURL` on that request. Minutes later Safaricom POSTs success/cancel/timeout to it. That POST is what marks the payment complete in our DB and unblocks the agent UI.

**When to include:** Always in API env (boot-required). Functionally needed as soon as anyone will click Pay / Request payment / initiate STK.

**How to set:** Public HTTPS URL of **this same API**, path exactly `/api/public/mpayesa/stk-push/callback`. Local = ngrok. Deployed = that environment’s API origin.

**If wrong/missing:** API won’t boot if missing/HTTP. If path/host is wrong, STK still appears on the phone, PIN works, but our UI stays “processing” until timeout; payment may still land later via IPN if they paid.

**Do not:** Point this at the frontend, at another env’s API, or at a dead ngrok URL.

### 2. `MPESA_IPN_CONFIRMATION_URL` — include whenever paybill money should create payments

**When it is used:** Not on STK initiate. Safaricom POSTs here **after a C2B/paybill payment**. Our API then creates the payment record (and unmatched-SMS if the bill ref doesn’t match).

**When to include:** Always in API env (boot-required). Functionally needed for: paybill fallback when STK is off, customers who pay till directly, and sandbox C2B tests.

**How to set:** Same public host, path `/api/public/mpayesa/confirmation`.

**Extra step STK does not need:** This URL must also be **registered with Safaricom** as C2B `ConfirmationURL` (Daraja RegisterURL / portal). Changing `.env` does not tell Safaricom. If you change the ngrok host, re-register.

**If wrong:** API still boots (URL is valid https), but paybill payments never appear in MicroBima.

Related optional (not in the six, include for sandbox 174379):

```bash
MPESA_C2B_VALIDATION_URL=https://<host>/api/public/mpayesa/validation
```

Safaricom calls this *before* completing paybill; we always accept.

### 3. `MPESA_ALLOWED_IP_RANGES` — include for production; optional locally

**When it is used:** Only when a request hits the public `mpayesa` callback/confirmation/validation routes, **and only if the app environment is `production`**. Non-production: **all IPs allowed**; this var is ignored. That is why ngrok works locally.

**When to include:**

| You are… | Include? | Value |
|---|---|---|
| Local / sandbox API | Optional | `127.0.0.1/32,::1/128` is fine as a placeholder |
| Production API | **Required** | Safaricom CIDRs, comma-separated, e.g. `196.201.214.0/24,196.201.215.0/24` (confirm with Safaricom; empty list **rejects all** callbacks) |

**If you omit in production:** the guard rejects the request (HTTP 403). The handler never runs, so payments look lost.

Do not put ngrok/client IPs here expecting local enforcement — local/staging do not enforce. How the guard works is in [How IP restrictions work](#how-ip-restrictions-work).

### 4. `MPESA_STK_PUSH_ENABLED` — include as the STK on/off switch

**When it is used:**

1. Before sending any STK to Daraja (`POST /internal/mpesa/stk-push/initiate` and customer on-demand STK). If not enabled → **503** `"M-Pesa STK push is currently disabled."`
2. `GET /internal/config` → `{ mpesaStkPushEnabled: true|false }`. Agent-registration reads this and either shows STK or Paybill instructions.

Parsed as: only the string `true` (any case) is on. Unset / `false` / anything else = **off**. Default off.

**When to include:**

| Goal | Set |
|---|---|
| Local/staging STK testing | `true` |
| Production STK live | `true` (usually a Fly secret) |
| Kill STK without a deploy (paybill only) | `false` or omit |

**Does not affect:** inbound STK callbacks, IPN, expiration job. Turning it off only stops **new** prompts.

Frontend: if this is false, do not call initiate; show paybill. If true, STK UI is available.

### 5. `MPESA_STK_PUSH_TIMEOUT_MINUTES` — include only if you need a non-default pending window

**When it is used:** A background job looks at STK rows still `PENDING`. If they are older than this many minutes (UTC) **and** status-query retries are done, they become `EXPIRED`. The agent UI then treats the prompt as failed/timed out.

Default **5**. Daraja’s phone prompt is ~30 seconds; this is **our** “we gave up waiting for callback/query” window.

**When to include:**

- Omit → 5 minutes (normal).
- Set `5` explicitly if you want the env file to document intent.
- Increase only if callbacks are slow (flaky ngrok) and you are still querying Daraja.
- Decrease if you want the UI to fail faster. Do not go so low that a late callback races an expiry.

Not used for paybill/IPN.

### 6. `MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES` — include only to change how often we scan

**When it is used:** Cron `*/N * * * *` on API boot. Default **2**. Local `.env` often uses **1** (scan every minute). This is poll frequency, not the timeout itself.

**When to include:**

- Omit → every 2 minutes.
- `1` for tighter local observation of expiry.
- Keep ≥1. Smaller N = more DB scans, not faster Safaricom.

Not used for paybill/IPN. Changing it requires API restart.

## What to put in the env by task

### A. API must boot (minimum for these six)

Both HTTPS URLs. Everything else has defaults (`ENABLED` off, timeout 5, interval 2, IPs unused outside production).

### B. Local STK end-to-end (phone PIN → payment in app)

Include all of:

```bash
MPESA_STK_PUSH_CALLBACK_URL=https://<current-ngrok>/api/public/mpayesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://<current-ngrok>/api/public/mpayesa/confirmation
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128
MPESA_STK_PUSH_ENABLED=true
MPESA_STK_PUSH_TIMEOUT_MINUTES=5
MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES=1
```

Also: Daraja sandbox creds, ngrok → port 3001, restart API after ngrok host change. IPN URL can stay unused if you never paybill, but it must still be a valid https URL.

### C. Local/sandbox paybill only (no STK)

Same two URLs (confirmation must match what you RegisterURL’d). `MPESA_STK_PUSH_ENABLED=false` or omit. Timeout/interval unused for this path. Re-register confirmation URL when ngrok changes.

### D. Staging/production STK + paybill

Public API host (not ngrok). `ENABLED=true` if STK should show. `MPESA_ALLOWED_IP_RANGES` = real Safaricom CIDRs. Timeout 5 / interval 2 unless ops say otherwise. Register IPN confirmation (and validation if required) in the portal for that shortcode.

### E. Disable STK in a live env without touching callbacks

Set `MPESA_STK_PUSH_ENABLED=false` only. Keep URLs and IP ranges so in-flight callbacks and paybill still work.

### F. You are writing client UI, not deploying the API

Do not copy these into the Next app. Read `GET /internal/config` → `mpesaStkPushEnabled`. If true, call STK initiate; if false, show Paybill. Callbacks are server-to-server.

### G. You are calling initiate from another service

You do not pass these URLs in the request. The API injects `CallBackURL` from its own env. Your service only needs `MPESA_STK_PUSH_ENABLED` to be true on **that** API, or you will get 503.

## Decision cheat sheet

| Question | Answer |
|---|---|
| Starting the API? | Both URLs, HTTPS, `/mpayesa/` paths. |
| Want STK on the phone? | `MPESA_STK_PUSH_ENABLED=true` + working STK callback URL. |
| Want paybill recorded? | Working IPN URL **and** that URL registered with Safaricom. |
| Local ngrok? | IP ranges ignored; keep URLs in sync with the tunnel. |
| Production? | Real Safaricom CIDRs required or callbacks are dropped. |
| Only changing how long a stuck prompt sits? | `TIMEOUT_MINUTES` (and maybe interval). |
| Kill STK, keep paybill? | `ENABLED=false`; leave URLs. |
| Putting these on the frontend? | No. |

Restart the API after any change. Ngrok host change ⇒ update both URLs, restart, and re-register IPN if you use paybill.

## Related docs

- [M-Pesa configuration](./mpesa-configuration.md)
- [STK push testing guide](../testing/mpesa-stk-push-testing-guide.md)
- [Ngrok setup](../testing/ngrok-setup-guide.md)
- `apps/api/env.example`
