# Intake: Admin Messaging Campaigns (Compose, Templates, Audit)

**Status:** Formal Spec Kit feature exists — see [`specs/004-admin-messaging-campaigns/`](../../specs/004-admin-messaging-campaigns/) (`spec.md`, `plan.md`, `tasks.md`, `quickstart.md`)  
**Date:** 2026-08-08  
**Product surface:** Admin app (`apps/agent-registration`) + Messaging module (`apps/api`)  
**Related prior art:** `specs/001-customer-messaging/`, existing `MessagingDelivery` outbox, admin Messages list/detail, Customer Detail Messages tab  
**This file:** Decision / intake log. **Source of truth for implementation:** `specs/004-admin-messaging-campaigns/spec.md`

---

## 1. Problem

Registration admins need to compose and send SMS and email **campaigns** to defined audiences (schemes, scheme contacts, pasted lists), with placeholder personalization, preview, safety delays/cancel, campaign tracking, and full audit. Separately, admins need to **edit and save** existing system message templates (non-campaign). Customer-linked sends must appear on the existing Customer Detail Messages tab. Customer Care needs read-only campaign history; only Registration Admins may compose/send and edit templates.

---

## 2. Goals

- Clear UI separation: **Campaign compose/history** vs **Template edit/save**.
- Campaigns **only** via ad hoc shells:
  - SMS: `admin_template_sms`
  - Email: `admin_template_email`
- Admin campaign templates are **not saveable**; body/subject live on the campaign + audit only.
- Audience modes (combinable): scheme customers, multi-scheme union, scheme contacts, pasted phone list (SMS) / pasted email list (Email).
- Placeholder insertion (pill UI with remove) + live preview with color-linked resolved pills.
- Campaign entity + audit log + per-delivery history (`MessagingDelivery`).
- Safety: recipient-count confirmation threshold, configurable send delay + countdown UI, cancel before and after dispatch starts (pending only), idempotency.
- Missing placeholders: block whole campaign; downloadable error CSV; Sentry with recreate context.
- Soft skips (e.g. no email): campaign may proceed; soft-skipped report + CSV; no Sentry.
- Preserve non-prod recipient redirect for customer-linked messages.
- Dependants: **out of scope**.

---

## 3. Non-goals (MVP)

- Hand-picking individual members within a scheme (whole-scheme selection only).
- Messaging dependants / beneficiaries as an audience type.
- Sending campaigns using existing event template keys (`payment_received`, lifecycle keys, etc.).
- Persisting campaign body back onto `admin_template_sms` / `admin_template_email`.
- Email attachments on campaigns.
- Non-English campaign compose (English only for now; customer language preference later).
- Changing automated event trigger wiring (except via Template editor save on non-admin templates).

---

## 4. Roles & access

| Capability | `registration_admin` | `customer_care` |
|---|---|---|
| Compose / send campaigns | Yes | No |
| Cancel campaigns (any admin’s campaign) | Yes | No |
| Edit/save non-admin templates | Yes | No |
| View campaigns, detail, audit, CSVs | Yes | Yes |
| View per-customer deliveries (existing Messages tab) | Yes (admin UI) | Per existing messaging read/resend API rules |

---

## 5. UI / UX separation

| Area | Purpose | Who |
|---|---|---|
| **Campaigns → Compose** | Channel tabs SMS \| Email; only `admin_template_sms` / `admin_template_email`; audience; preview; send / delay / cancel | Admin |
| **Campaigns → History** | Campaign list + detail, audit, error/skip CSVs | Admin + Customer Care |
| **Templates** | Edit/save existing **non-admin** template keys; **no** campaign send; admin template keys **do not appear** here | Admin |

### 5.1 Campaign compose (SMS tab)

- Ad hoc body only (`admin_template_sms`); not saveable as a template.
- Placeholder picker (pin) inserts removable pills (`{first_name}`, etc.).
- Preview:
  - Deterministic sample: first recipient in the resolved audience set that fits the channel (SMS: has phone).
  - Fully rendered message with color-matched pills (compose placeholder color ↔ resolved value color).
- Recipient stats: total count after expansion/dedupe rules; per selected scheme, a pill with scheme name + recipient/phone count.
- Character / SMS segment counter: **display only** (no max, no warning threshold).
- Send: typed confirmation if count ≥ configurable threshold → campaign created → delay countdown → dispatch or cancel.

### 5.2 Campaign compose (Email tab)

- Same patterns as SMS for audience (channel-appropriate), placeholders, preview, confirmation, delay.
- Rich text editor for HTML body (templates/editor for system emails should support HTML).
- Subject line: required, editable, placeholders allowed; **not** pre-filled for admin email campaigns.
- **No phone-list audience** on Email; **no email-list** on SMS.
- Attachments: out of scope.

### 5.3 Template editor

- Dropdown of system template keys **excluding** `admin_template_sms` / `admin_template_email`.
- Load content → edit → save updates the live `MessagingTemplate` used by automated flows.
- **Send campaign** is never available here.

---

## 6. Audience model (MVP)

### 6.1 Modes (combinable in one campaign)

| Mode | SMS | Email |
|---|---|---|
| Scheme customers (one or multi-scheme) | Yes — customer phones | Yes — `customer.email` |
| Scheme contacts | Yes — both phones if present | Yes — `SchemeContact.email` |
| Pasted phone list | Yes | **Blocked / not available** |
| Pasted email list | **Blocked / not available** | Yes |

- **Multi-scheme:** **union** of enrolled customers across selected schemes, then smart dedupe (§7).
- Scheme customers: select whole scheme(s); no member hand-pick.
- Scheme contacts: skip if no phone (SMS) or no email (Email); SMS sends to **both** `phoneNumber` and `phoneNumber2` when present.
- Scheme contact may also be a customer: resolve by normalized phone/email → set `customerId` when known.
- Test users: **include** (internal QA).

### 6.2 Filters

| Filter | When required | UX |
|---|---|---|
| Customer status | Only when scheme-customers (customer-policy) audience is included | Multi-select, ≥1 |
| Policy status | Same | Multi-select, ≥1 |
| Package | Same | Multi-select, ≥1 |
| (None of the above) | Audience is only scheme contacts and/or pasted lists | Filters hidden / not required |

### 6.3 Pasted lists → identity resolution

**SMS phones**

- Normalize MSISDN → match customer phone → set `customerId` when found.
- No match → still send; `customerId = null`.

**Email addresses**

- Normalize email → match `customer.email` → set `customerId` when found.
- No match → still send; `customerId = null`.

### 6.4 Channel purity

- SMS tab: phone recipients only.
- Email tab: email recipients only.
- No mixing channel addresses across tabs.

---

## 7. Expansion, dedupe, skip, block

### 7.1 Policy expansion

When customer-policy audience is included:

- Expand to **one candidate per matching `(customer, policy)`** under selected customer statuses, policy statuses, and packages.
- Then apply content-hash dedupe (§7.2).

### 7.2 Dedupe (no extra cross-mode rule)

- **SMS:** key = `(normalizedPhone, hash(renderedBody))`.
- **Email:** key = `(normalizedEmail, hash(renderedSubject + renderedHtmlBody))`.
- One address + identical resolved content → **one** send; link `customerId` when known.
- If scheme-specific (or policy-specific) placeholders make renders differ, same person may receive multiple messages.
- Sameness is based on **resolved content from DB-backed placeholder values**, not wall-clock send time.
- Combinable modes: **only** this dedupe; no extra “don’t overlap scheme customer vs contact” rule.

### 7.3 Block vs soft-skip

| Situation | Behavior |
|---|---|
| Missing / unresolvable required placeholder for any candidate | **Block** entire campaign (no enqueue); error CSV; Sentry with recreate context |
| No phone (SMS) / no email (Email) for a candidate | **Soft-skip**; campaign continues if ≥1 valid recipient remains |
| Zero recipients left after skips | **Block** send; clear message + skipped CSV |
| Pasted identity with no customer/policy when body needs those fields | **Block** (unresolvable placeholders) |

### 7.4 Reports / CSV

Downloadable CSV available at **preflight/preview** and on **campaign detail** after send attempt:

**Blocking errors:** customer name, phone (and/or email), customer ID, specific error to resolve.

**Soft skips:** same shape (soft-skipped report); not sent to Sentry.

---

## 8. Placeholders

- Syntax: `{snake_case}` (existing `PlaceholderRendererService`).
- Catalog (v1): always-available customer fields (`first_name`, `last_name`, `email`, support numbers, etc.) + optional policy fields when policy context exists (`policy_number`, `product_name`, …).
- Composer: insert via picker; show as pills with remove (X).
- Preview: resolved values as color-matched pills.
- Language: **English only** for campaigns in MVP.

---

## 9. Templates & delivery keys

| Key | Role |
|---|---|
| `admin_template_sms` | Routing/shell for campaign SMS; UI body is ad hoc (not saved to template); campaign stores snapshot |
| `admin_template_email` | Routing/shell for campaign email; HTML body + subject ad hoc; campaign stores snapshot |
| Other template keys | Templates UI only; edit/save live content; **cannot** create campaigns |

Campaign deliveries always use `admin_template_sms` or `admin_template_email` as `templateKey`, with rendered content and pre-render body stored for history/audit. Customer-linked rows appear on Customer Detail Messages tab.

DB still needs `MessagingRoute` / template rows for the two admin keys so the existing outbox worker can send; content for campaigns comes from the campaign snapshot, not from editing those shells in the Templates UI.

---

## 10. Campaign entity & audit (conceptual)

Illustrative fields (schema finalization in Spec Kit):

- `id`, `name` (required; **globally unique forever**, case-insensitive, including cancelled)
- `channel` (`SMS` | `EMAIL`)
- `templateKey` (`admin_template_sms` | `admin_template_email`)
- Pre-render body with placeholders; email subject with placeholders; email HTML body
- Audience segmentation snapshot (modes, schemes, packages, statuses, list digests, counts)
- `createdBy`, `composedAt`, `sendRequestedAt`, `dispatchStartsAt`, `cancelledAt`, `cancelledBy`
- Status lifecycle e.g. `DRAFT` → `DELAYED` → `DISPATCHING` → `COMPLETED` | `CANCELLED` | `FAILED_PREFLIGHT`
- Totals: targeted count; delivered count (calculated from deliveries)

**Audit:** who composed, who sent, content snapshot, template key, audience, timing, cancel events, pre-render body with placeholders.

**Deliveries:** `MessagingDelivery` rows linked to `campaignId`; optional `customerId` / `policyId`; appear on customer Messages tab when `customerId` present.

---

## 11. Safety & send pipeline

1. Validate filters (when customer-policy audience included): ≥1 customer status, ≥1 policy status, ≥1 package.
2. Expand → render → dedupe → classify block errors vs soft skips.
3. If any blocking error → do not create dispatchable campaign send; show errors + CSV (+ Sentry).
4. If zero sendable recipients → block with message + skipped CSV.
5. Preview recipient count + sample render (+ skip/error CSVs as applicable).
6. If sendable count ≥ `campaign_confirm_threshold` (default **20**, system setting): typed confirmation.
7. On confirm: create campaign + audit; enter **delay** window:
   - SMS delay default **2 minutes** (setting)
   - Email delay default **3 minutes** (setting)
   - UI countdown; any `registration_admin` may **cancel**
8. After delay: dispatcher enqueues deliveries (respect dedupe + non-prod redirect).
9. **Cancel after dispatch started:** mark remaining `PENDING` as `CANCELLED`; leave `PROCESSING` / `SENT` alone (already handed to provider).
10. **Idempotency:** reject accidental double-send for same `campaignId`, or same name + body + audience within **10 minutes** (configurable).
11. Non-prod: keep existing customer-linked recipient redirect for broadcast/campaign sends.

### Africa's Talking

Prefer bulk/multi-recipient API usage where appropriate (docs may be attached later). Current code uses the bulk endpoint with one `to` per call; batching is an implementation decision in Spec Kit/plan.

---

## 12. Settings to add

Must sync with `MessagingSettingsSnapshot` per project rules (`messaging.types.ts`, `system-settings.service.ts`, migration/seed, bump `system_settings_meta.updatedAt`):

| Key (conceptual) | Default | Purpose |
|---|---|---|
| Campaign confirm threshold | `20` | Typed confirmation when recipient count ≥ N |
| SMS campaign send delay | `120` seconds (2 min) | Delay before dispatch |
| Email campaign send delay | `180` seconds (3 min) | Delay before dispatch |
| Campaign idempotency window | `10` minutes | Same name+body+audience guard |

Exact setting key names to be finalized in Spec Kit.

---

## 13. Answered product decisions (full Q&A summary)

1. MVP audiences: scheme customers, multi-scheme, scheme contacts, phone list (SMS), email list (Email) — yes; combinable; no member hand-pick.
2. Filters: customer status, policy status, package — all mandatory **when** customer-policy audience included; multi-select ≥1 each; hidden otherwise. Include test users.
3. Multi-scheme: **union + smart dedupe** (not mathematical intersection).
4. Scheme contacts: both phones; skip if none; email via `SchemeContact.email`.
5. Pasted phones/emails: resolve to customer when possible; else send with null `customerId`.
6. Campaigns only via `admin_template_sms` / `admin_template_email`; ad hoc, not saveable; other templates edit/save only; UI separated.
7. Placeholder catalog: customer fields + optional policy fields when context exists.
8. Missing placeholders: block whole campaign + error CSV + Sentry.
9. Channels: SMS and Email tabs; channel-pure audiences; email paste on Email; phone paste on SMS only.
10. SMS segments: show character/segment count only; no max/warning.
11. Preview: count, per-scheme pills, first fitting sample, color-linked resolved pills.
12. Typed confirmation above configurable N (default 20).
13. AT bulk: investigate/improve batching in implementation (docs forthcoming).
14. Campaign entity with snapshot, delay, cancel, progress.
15. Idempotency: campaign id **or** name+body+audience within 10 minutes (configurable).
16. History: campaign list + per-delivery on customer tab; deliveries use admin template keys.
17. Send: admin only; view campaigns: admin + customer care.
18. Non-prod redirect: yes for campaigns.
19. Audit: full trace including pre-render body with placeholders.
20. Soft skips: soft-skipped report + CSV; no Sentry; empty-after-skips blocks send.
21. Email: editable subject with placeholders; HTML rich text; no attachments in MVP; English only.
22. Cancel: delay window + remaining `PENDING` after dispatch; any registration admin; leave `PROCESSING`/`SENT`.
23. Campaign name: required; globally unique forever; case-insensitive.
24. Combinable overlap: address/phone + content-hash only; no extra rule.
25. Dependants: out of scope.

---

## 14. Open items for Spec Kit / implementation (non-blocking product)

- Exact `system_settings` key names and snapshot field types.
- Prisma models for `MessagingCampaign`, audit events, link from `MessagingDelivery`.
- How campaign body overrides empty admin template rows in the worker render path.
- HTML sanitization policy for rich text email.
- GSM-7 vs Unicode segment counting details for the display counter.
- Africa's Talking multi-recipient batch size and error mapping.
- Formal acceptance scenarios and API contracts (Spec Kit artifacts).

---

## 15. Success criteria (draft)

- Admin can compose SMS/email campaigns only from admin template keys, with combinable audiences, preview, CSVs, delay, cancel, and idempotency.
- Non-admin templates are editable in a separate Templates experience without campaign send.
- Customer-linked deliveries appear on Customer Messages tab; campaigns visible to admin + customer care.
- Missing placeholders never partially send; Sentry receives recreate context for blocks only.
- Dedupe collapses identical resolved messages per phone/email; differing resolved content sends multiple times.
- Soft skips are reported; all-skipped audiences cannot send.
- Non-prod redirect unchanged for customer-linked campaign sends.
- Audit can answer: who sent what, to which audience definition, with which body/subject/template key, when, and cancel outcome.
```
