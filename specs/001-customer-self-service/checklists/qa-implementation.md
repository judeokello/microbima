# Customer self-service — implementation QA checklist

Use this list before considering the feature done for release (manual or assisted). Tie results to [spec.md](../spec.md) success criteria and user stories.

## Auth and PIN (US1–US3, FR-008, FR-011)

- [ ] Generic `/self/customer`: sign-in with `07…` + OTP (first access) lands on forced PIN or home as expected.
- [ ] Generic login: after PIN setup, **old OTP** in the PIN field **fails**; **chosen PIN** succeeds.
- [ ] Deep link `/self/customer/:customerId`: context shows **masked** phone + names; unknown UUID yields **non-enumerating** response (same shape as valid, no leak).
- [ ] Session `sub` ≠ route `customerId`: **sign out** and **no** return URL to tampered path.
- [ ] PIN setup: 6-digit + confirm; rejects **guessable PINs** (all same digit / strict ascending–descending runs per **FR-019**) on UI and API; on success **refreshSession** (or equivalent); `portalPinSetupCompletedAt` / status API shows complete; **follow-up** message triggered (logs/outbox).

## Tampering (SC-002, FR-011, FR-012)

- [ ] Cross-customer URL with another user’s session: **no** other customer’s data; ends at generic sign-in without bad return URL.
- [ ] Invalid / other customer’s `productId` in URL: same security behaviour as spec.

## Products and payments (US4–US6, SC-003, SC-004)

- [ ] **One** product: products entry **redirects** to that product detail; full list still reachable via navigation.
- [ ] Zero / many products: list or empty state; **no** wrong auto-redirect.
- [ ] **One** selectable plan in Payments: filter **pre-selected** in **staff** customer view and **portal** payments tab.

## Messaging (US7, SC-005, SC-006, FR-005a, FR-018)

- [ ] New customer: **single** welcome includes OTP + personal link + both support numbers (values match settings).
- [ ] After PIN complete: **follow-up** includes personal link pattern; **no** registration OTP in copy.

## Regression / ops

- [ ] `pnpm lint` clean for touched packages; API errors use **`status`** (not `statusCode`) where applicable.

**Sign-off**: Name / date when the above was exercised (environment: \_\_\_\_).
