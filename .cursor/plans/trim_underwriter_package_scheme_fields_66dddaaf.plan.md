---
name: Trim underwriter package scheme fields
overview: Trim free-text user entries on frontend and API for create/edit underwriter, package, scheme, and scheme-contact. Add frontend maxLength on all text inputs so users cannot exceed DB limits. Optional values use trim-or-null. Existing data is fixed manually.
todos: []
isProject: false
---

# Trim free-text fields: Underwriter, Package, Scheme, Scheme contacts

## 1. Field list and max lengths (for UI and API)

All free-text fields and their **max lengths** (must match DB/API). Use these for frontend `maxLength` and backend trim.


| Area           | Field          | Max length | Required |
| -------------- | -------------- | ---------- | -------- |
| Underwriter    | name           | 100        | Yes      |
|                | shortName      | 50         | Yes      |
|                | website        | 100        | Yes      |
|                | officeLocation | 200        | Yes      |
|                | logoPath       | 200        | No       |
| Package        | name           | 100        | Yes      |
|                | description    | 500        | Yes      |
|                | logoPath       | 200        | No       |
| Scheme         | schemeName     | 100        | Yes      |
|                | description    | 300        | Yes      |
| Scheme contact | firstName      | 50         | Yes      |
|                | otherName      | 50         | No       |
|                | phoneNumber    | 15         | Yes      |
|                | phoneNumber2   | 15         | No       |
|                | email          | 100        | No       |
|                | designation    | 100        | No       |
|                | notes          | 500        | No       |


Optional fields: after trim, if empty use **trim-or-null** (send null/omit or empty string per API contract).

---

## 2. Frontend (agent-registration)

### 2.1 Trim on submit

When building the payload for create/update API calls, trim every string field. For **optional** fields, use trim-or-null: if `value.trim() === ''` then send `null`, `undefined`, or omit the field (per API contract). Apply in: create underwriter dialog, edit underwriter page, create package dialog, edit package page, create scheme dialog, edit scheme (scheme detail page), add/edit scheme contact dialog.

### 2.2 maxLength on every text input

Add `maxLength={N}` to every `<Input>` and `<textarea>` so the user cannot type more than the DB allows. Use the table in section 1.

**Files to update:**

- **Create underwriter** [create-underwriter-dialog.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/_components/create-underwriter-dialog.tsx): name (100), shortName (50), website (100), officeLocation (200). Add maxLength to each; trim (and trimOrNull for optional) on submit.
- **Edit underwriter** [underwriters/[underwriterId]/page.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/page.tsx): name (100), shortName (50), website (100), officeLocation (200). Add maxLength; trim on submit.
- **Create package** [create-package-dialog.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/_components/create-package-dialog.tsx): name (100), description (500). Add maxLength; trim on submit.
- **Edit package** [packages/[packageId]/page.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx): name (100), description (500). Add maxLength; trim on submit.
- **Create scheme** [create-scheme-dialog.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/_components/create-scheme-dialog.tsx): schemeName (100), description (300). Add maxLength; trim on submit.
- **Edit scheme and scheme contact** [packages/[packageId]/schemes/[schemeId]/page.tsx](apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/schemes/[schemeId]/page.tsx): Scheme edit form: schemeName (100), description (300). Contact dialog: firstName (50), otherName (50), phoneNumber (15), phoneNumber2 (15), email (100), designation (100), notes (500). Add maxLength to each; trim on submit, trimOrNull for optional contact fields.

Ensure no text field in these areas is missing maxLength; textareas get maxLength as well.

---

## 3. Backend (API) trim and trim-or-null

**Trim at the API layer for both create and update:** wherever the API accepts payloads and writes to the DB (create or update), trim all relevant string fields in the service **before** calling Prisma create/update. This ensures data is normalized regardless of which client (UI or other) sends it. For **optional** string fields, use trim-or-null: after trim, if empty set to `null` so the DB does not store empty strings where null is allowed.

### 3.1 Underwriter

- **[underwriter.service.ts](apps/api/src/services/underwriter.service.ts)**
  - **createUnderwriter:** Trim `name`, `shortName`, `website`, `officeLocation`; trim `logoPath` if present, trimOrNull for `logoPath`. Keep existing website normalization on trimmed `website`.
  - **updateUnderwriter:** Trim each provided string; optional `logoPath` → trimOrNull.

### 3.2 Package

- **[product-management.service.ts](apps/api/src/services/product-management.service.ts)**
  - **createPackage:** Trim `name`, `description`; trimOrNull for `logoPath` if present.
  - **updatePackage:** Trim `name`, `description`, `logoPath` when present; trimOrNull for optional `logoPath`.

### 3.3 Scheme

- **[product-management.service.ts](apps/api/src/services/product-management.service.ts)**
  - **createScheme:** Trim `schemeName`, `description` before `tx.scheme.create`.
  - **updateScheme:** Trim `schemeName`, `description` when present.

### 3.4 Scheme contact

- **[scheme-contact.service.ts](apps/api/src/services/scheme-contact.service.ts)**
  - **createContact:** Trim all string fields; trimOrNull for `otherName`, `phoneNumber2`, `email`, `designation`, `notes`.
  - **updateContact:** Trim each provided string; optional fields → trimOrNull.

### 3.5 Helpers

Use a shared helper for optional fields, e.g. `trimOrNull(value: string | undefined): string | null` (return `null` when trimmed value is empty). Use plain trim for required fields. Apply trim **before** uniqueness/validation.

---

## 4. Out of scope

- **Existing data:** You will fix manually; no backfill script.
- **Postpaid payment** fields on scheme page: not in this scope.

---

## 5. Execution order

1. **Backend:** Add trim and trimOrNull in underwriter.service, product-management.service (package + scheme), scheme-contact.service.
2. **Frontend:** For each listed component/page: add maxLength to every text input/textarea per the table in section 1; on submit, trim all string values and use trimOrNull for optional fields before calling the API.
3. Run lint and build; fix any issues.
