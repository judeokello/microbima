# Data Model: Customer Self-Service Portal

**Feature**: `001-customer-self-service` | **Date**: 2026-04-06

## Prisma / application database

### Customer (extend existing model)

| Field | Type | Notes |
|-------|------|--------|
| `portalPinSetupCompletedAt` | `DateTime?` | **Null** until first-time PIN flow completes (FR-006). Set once; immutable for “un-complete” in v1. |

**No** `supabaseUserId` column — identity coupling: **`Customer.id` === `auth.users.id`** (plan).

### SystemSetting (existing)

| key | value (JSON) | Purpose |
|-----|----------------|---------|
| `general_support_number` | string per existing convention | FR-016 — `0746907934` |
| `medical_support_number` | string per existing convention | FR-016 — `0113569606` |

Confirm encoding with `SystemSettingsService` consumer code before seeding.

## Supabase Auth (`auth.users`)

| Attribute | Value |
|-----------|--------|
| `id` | UUID = `Customer.id` |
| `email` | `{normalizedNationalPhone}@maishapoa.customer` |
| `encrypted_password` | Initially = hash(OTP); after setup = hash(4-digit PIN) |
| `user_metadata.roles` | `['customer']` |
| `user_metadata` (optional) | `InitialPasswordReset` or equivalent boolean mirror |

## State transitions (portal PIN)

```
[Customer created] → portalPinSetupCompletedAt = null
                  → Auth user created with password = OTP
                  → Welcome SMS queued (OTP + link + numbers)

[Member signs in with OTP] → session established
[Member submits valid PIN+confirm] → API updates Auth password
                                  → portalPinSetupCompletedAt = now()
                                  → Follow-up SMS queued
[Member signs in thereafter] → only chosen PIN (OTP invalid)
```

## Messaging placeholders (logical)

| Placeholder | Source |
|-------------|--------|
| `first_name`, `last_name`, `email` | Customer (existing) |
| `otp` / `one_time_pin` | Generated at registration |
| `customer_specific_weblogin` | Base URL + `/self/customer/{customerId}` |
| `medical_support_number`, `general_support_number` | `SystemSetting` |
| Follow-up template | Personal link + copy (no OTP) |

## Entities (spec glossary mapping)

- **Customer** — unchanged relations to policies/products; new portal field above.  
- **Portal account** — Auth row tied 1:1 to Customer.id.  
- **OTP** — Initial password only; not stored long-term in plain text beyond secure generation + Auth write.
