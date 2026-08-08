# Quickstart: Admin Messaging Campaigns

**Branch**: `004-admin-messaging-campaigns`  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Prerequisites

- API + Postgres running (local Docker or Fly staging)
- `registration_admin` user for compose; `customer_care` for history-only checks
- Africa’s Talking + SMTP configured as today for messaging
- Migrations applied (includes campaign tables, `CANCELLED` delivery status, settings seeds, admin template shells)

## Seed / settings check

Confirm system settings exist (or defaults via snapshot):

- `campaignConfirmThreshold` = 20  
- `campaignSmsDelaySeconds` = 120  
- `campaignEmailDelaySeconds` = 180  
- `campaignIdempotencyWindowMinutes` = 10  

Confirm templates/routes:

- `admin_template_sms` (SMS enabled)  
- `admin_template_email` (EMAIL enabled)  

## Happy path — SMS campaign (admin)

1. Open **Campaigns → Compose → SMS**.
2. Enter unique name, body with `{first_name}`, select scheme customers + required filters (customer status, policy status, package).
3. **Preview**: verify count, scheme pills, sample with highlighted placeholders, segment count.
4. If count ≥ 20, type exact campaign name to confirm.
5. **Send**: status `DELAYED`, countdown shown.
6. Optionally **Cancel** before countdown ends → no deliveries.
7. Or wait → dispatcher creates deliveries → worker sends → Customer Messages tab shows linked rows.
8. Campaign detail shows targeted / handed-off / receipt-confirmed counts.

## Failed preflight

1. Use a placeholder that cannot resolve for someone in the audience (e.g. `{policy_number}` with no matching policy).
2. Preview: session CSV download of errors (no history row).
3. Send: campaign saved as `FAILED_PREFLIGHT`, renamed to `{name}_failed1`, original name reusable; Sentry event created; no deliveries.

## Email path

1. Compose on Email tab: subject + rich HTML, scheme contacts and/or pasted emails (no phone list).
2. Soft-skips for missing emails; block if zero sendable.
3. Delay default 3 minutes.

## Templates (non-campaign)

1. Open **Templates** (admin only).
2. Select a non-admin template → edit → save.
3. Confirm automated event still uses updated copy; confirm campaign compose cannot send that template key.

## Customer care

1. As `customer_care`, open Campaigns → History.
2. View detail + download CSVs.
3. Confirm Compose / Cancel / Templates are unavailable.

## Non-prod

Customer-linked campaign SMS/email should redirect to registering user’s phone/email (existing messaging behavior).

## Useful API smoke (internal)

```bash
# Preview (admin JWT)
curl -sS -X POST "$API/internal/messaging/campaigns/preview" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @preview-payload.json | jq .

# Send
curl -sS -X POST "$API/internal/messaging/campaigns" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d @send-payload.json | jq .
```

See [contracts/openapi.yaml](./contracts/openapi.yaml) for schemas.
```