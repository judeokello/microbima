# Policy start and end date rules

Canonical implementation: [`apps/api/src/utils/policy-dates.util.ts`](../../apps/api/src/utils/policy-dates.util.ts)

Runtime date computation goes through `PolicyService.resolvePolicyDates()` inside `activatePolicy()`.

## End date (all policies)

```
endDate = startDate + 1 calendar year − 1 day   (same time of day, UTC)
```

Example: start `2026-03-19T01:02:25Z` → end `2027-03-18T01:02:25Z`

---

## Prepaid start date

```
startDate = earliest policy_payments.actualPaymentDate for the policy
```

The member pays individually; coverage starts when their first payment completes.

---

## Postpaid start date

Postpaid schemes receive **bulk CSV uploads**. Important distinctions:

| Situation | Counts toward this member's startDate? |
|-----------|----------------------------------------|
| Scheme payment uploaded **before** member joined | No — no `policy_payment` row for them |
| Payment uploaded **after** join but member **not in that CSV** | No — no row for them |
| First CSV upload **including this member's row** | **Yes** — this defines startDate |

```
startDate = actualPaymentDate of the earliest policy_payment that has a
            linked postpaid_scheme_payment_item (bulk-upload row for this member)
```

**Example timeline**

```
20 Apr  Scheme starts; bulk payment uploaded (member not enrolled yet)
25 Apr  Member joins → policy created (PENDING_ACTIVATION)
27 Apr  Bulk payment uploaded — member NOT in CSV (no contribution) → ignored
 3 May  Bulk payment uploaded — member IS in CSV → startDate = that row's actualPaymentDate
```

The April 27 upload does **not** set their start date even though it is chronologically the first payment after join. Only uploads where **their name appears** matter.

Each postpaid `policy_payment` is created only from a CSV row (`PostpaidSchemePaymentService`). The link to `postpaid_scheme_payment_items` is what identifies “this member contributed to this upload”.

`actualPaymentDate` on that row comes from the CSV **paid date** column when valid, otherwise the scheme payment **transactionDate**.

---

## When dates are set

| Scenario | At insert | When computed |
|----------|-----------|---------------|
| Prepaid, payment pending | `NULL` | First payment → `activatePolicy()` |
| Prepaid, payment complete | `NULL` | Same transaction → `activatePolicy()` |
| Postpaid registration | `NULL` | First bulk CSV row for member → `activatePolicy()` |
| Subsequent payments | Unchanged | Never recalculated |

---

## Backfill

[`apps/api/scripts/backfill-policy-dates.sql`](../../apps/api/scripts/backfill-policy-dates.sql)

- **Prepaid**: `MIN(actualPaymentDate)` on `policy_payments`
- **Postpaid**: `MIN(actualPaymentDate)` on `policy_payments` **inner join** `postpaid_scheme_payment_items`

Run STEP 1 preview before STEP 3 update.
