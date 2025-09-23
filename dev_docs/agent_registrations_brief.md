
# Agent Registrations – Build Brief (Next.js + NestJS + Prisma + Supabase)

**Goal:** Implement a BA/Activator web app and supporting APIs that capture customer (principal) details, next-of-kin (beneficiary), spouse, and children with **save-on-Next** behavior, **deferred‑mandatory** fields tracked via **Missing Requirements (MR)**, and a **BA dashboard** showing counts and earnings per period.

> This brief is optimized for Cursor IDE in a monorepo. It includes folder structure, endpoint contracts, Prisma models/migrations, UI wiring (wizard), and operational notes.

## **UPDATES & ALIGNMENTS**

### **API Endpoint Structure**
- **Updated endpoint naming**: Changed from `/page1`, `/page2` to `/customer`, `/beneficiary`, `/spouse`, `/children`, `/payment`
- **Consistent with existing patterns**: Following `/internal/customers` pattern from existing API

### **Database Schema Updates**
- **Enum naming**: Updated to `RegistrationEntityKind`, `RegistrationMissingStatus`, `BAPayoutStatus`
- **Existing model usage**: Confirmed using existing `Dependant` model for spouse/children
- **Partner relations**: All new models include `partnerId` for proper referential integrity

### **Authentication & RBAC**
- **Supabase User Metadata**: Using Supabase auth with custom metadata for role management
- **Two-step BA creation**: 
  1. Create Supabase user with metadata
  2. Create BrandAmbassador record in database
- **Role-based access**: `brand_ambassador` and `registration_admin` roles
- **Admin-only BA creation**: Only `registration_admin` can create BAs

### **Implementation Approach**
- **Rate configuration**: Set once per BA creation (no per-registration changes initially)
- **BA-Partner mapping**: Resolve `partnerId` from `userId` during authentication
- **Future product selection**: BA will select partner for customer registration (post-MVP)

---

## 1) Monorepo & App Structure

You said you’ll create an `agent-registrations` folder at the same level as your existing `api` folder.

```
repo-root/
├─ api/                           # NestJS app (existing)
│  └─ src/
│     └─ modules/
│        └─ agent-registrations/  # NEW: NestJS module (controller/service/DTOs)
│
├─ agent-registrations/           # NEW: Next.js app (wizard + dashboard + lists)
│  ├─ app/ (or pages/ if using Pages Router)
│  │  ├─ dashboard/
│  │  ├─ customers/
│  │  └─ register/                # multi-step wizard
│  │     ├─ page.tsx
│  │     ├─ Stepper.tsx
│  │     ├─ StepCustomer.tsx      # Page 1
│  │     ├─ StepBeneficiary.tsx   # Page 2
│  │     ├─ StepSpouse.tsx        # Page 3
│  │     └─ StepChildren.tsx      # Page 4
│  ├─ components/
│  │  ├─ MaskedPhone.tsx
│  │  ├─ DateRangePicker.tsx
│  │  └─ StatCard.tsx
│  ├─ lib/
│  │  ├─ api.ts                   # fetch wrappers to /internal/agent-registrations/*
│  │  └─ mask.ts                  # phone masking helpers
│  └─ ... (ui kit / shadcn / tailwind, etc)
│
├─ prisma/                        # Prisma schema & migrations (shared)
│  ├─ schema.prisma
│  └─ migrations/
└─ package.json (pnpm/yarn workspaces)
```

- **Yes, “wizard pages”** means a wizard **Stepper component** managing multi-step navigation. Each step **saves on Next** via the API. On the final Next, you trigger MPESA + submit.
- **Prisma-first for schema changes:** all new/altered tables are defined here, then `prisma migrate` updates the DB.


---

## 2) Business Rules Recap

- **Principal (Customer) – Page 1**
  - **Required now:** `firstName`, `lastName`, `phone`, `gender`, `idType (default=national)`, `idNumber` (you approved making these mandatory), plus **_no_** need to store counts on `customers`.
  - Create/patch **AgentRegistration** row (locks per‑registration rate; holds optional expected counts).

- **Beneficiary (Next of Kin) – Page 2**
  - Optional at registration time but **deferred‑mandatory** (fields configurable per partner). Only create a `beneficiaries` row if data exists; otherwise write MRs.

- **Spouse – Page 3**
  - Optional initially. **Deferred‑mandatory:** `gender` (default **female** in UI, but can remain unset). Only create a `dependants` row if data exists; otherwise write MRs.

- **Children – Page 4**
  - Optional initially (0..n). **Deferred‑mandatory:** `gender`, `idType`, `idNumber`. Only create `dependants` rows for lines with data; write MRs for missing items/indices otherwise.

- **MR placeholders** are allowed without creating dependant/beneficiary rows. They reference `customerId`, `entityKind`, and optional `entityIndex` (e.g., child[1]) with `entityId = null` until a real row exists.

- **Final Next = MPESA prompt** → record payment and mark registration status accordingly.

- **Dashboard:** 4 cards — Today, Yesterday, This Week, Last Week — each shows **count** and **earned**; cards are tappable to filtered lists.


---

## 3) Prisma Models (Additive)

> Add these models to `schema.prisma`. If your existing model/table names differ, use `@@map` and `@map` to match DB names. The enums can reuse your existing ones (e.g., `Gender`, `IdType`) or be added if missing.

```prisma
// ---------------- Enums ----------------
enum RegistrationEntityKind {
  spouse
  child
  beneficiary
}

enum RegistrationMissingStatus {
  pending
  resolved
  waived
}

enum RegistrationStatus {
  draft
  submitted
  verified
  rejected
}

enum BAPayoutStatus {
  pending
  approved
  paid
}

// ---------------- Models ----------------
model BrandAmbassador {
  id                      String   @id @default(uuid())
  partnerId               Int
  userId                  String   // Supabase auth.users.id
  displayName             String?
  phone                   String?
  perRegistrationRateCents Int?
  isActive                Boolean  @default(true)
  createdAt               DateTime @default(now())

  partner                 Partner  @relation(fields: [partnerId], references: [id])

  @@map("brand_ambassadors")
}

model AgentRegistration {
  id              String   @id @default(uuid())
  partnerId       Int
  baId            String
  customerId      String
  expectedSpousesCount  Int    @default(0)
  expectedChildrenCount Int    @default(0)
  registeredAt    DateTime @default(now())
  status          RegistrationStatus @default(submitted)
  unitRateCents   Int

  partner         Partner  @relation(fields: [partnerId], references: [id])
  ba              BrandAmbassador @relation(fields: [baId], references: [id])
  customer        Customer @relation(fields: [customerId], references: [id])

  missingRequirements MissingRequirement[]
  payouts         BAPayout[]

  @@map("agent_registrations")
}

model MissingRequirement {
  id            String   @id @default(uuid())
  partnerId     Int
  customerId    String
  registrationId String?
  entityKind    RegistrationEntityKind
  entityId      String?  // nullable until real row exists
  entityIndex   Int?     // child[1], spouse[1], beneficiary=1
  fieldPath     String   // e.g., "gender", "idType", "idNumber"
  status        RegistrationMissingStatus @default(pending)
  source        String   // "ba" | "cc_agent" | "bot"
  createdAt     DateTime @default(now())
  resolvedAt    DateTime?
  resolvedBy    String?  // Supabase user id
  resolvedChannel String?

  partner       Partner  @relation(fields: [partnerId], references: [id])
  customer      Customer @relation(fields: [customerId], references: [id])
  registration  AgentRegistration? @relation(fields: [registrationId], references: [id])

  @@index([customerId, status], map: "idx_mr_customer_status")
  @@map("missing_requirements")
}

model BAPayout {
  id            String   @id @default(uuid())
  baId          String
  registrationId String?
  amountCents   Int
  periodWeek    DateTime?
  status        BAPayoutStatus @default(pending)
  createdAt     DateTime @default(now())
  paidAt        DateTime?
  reference     String?

  ba            BrandAmbassador @relation(fields: [baId], references: [id])
  registration  AgentRegistration? @relation(fields: [registrationId], references: [id])

  @@map("ba_payouts")
}

model DeferredRequirementDefault {
  id         Int      @id @default(autoincrement())
  entityKind RegistrationEntityKind
  fieldPath  String
  isRequired Boolean  @default(true)

  @@unique([entityKind, fieldPath])
  @@map("deferred_requirements_default")
}

model DeferredRequirementPartner {
  id         Int      @id @default(autoincrement())
  partnerId  Int
  entityKind RegistrationEntityKind
  fieldPath  String
  isRequired Boolean  @default(true)

  partner    Partner  @relation(fields: [partnerId], references: [id])

  @@unique([partnerId, entityKind, fieldPath])
  @@map("deferred_requirements_partner")
}

// ------------- Minimal additions to existing models -------------
// NOTE: If your existing Prisma models are named differently, adjust accordingly.

model Customer {
  id            String   @id
  // ... your existing fields (idType, idNumber are required, etc.)
  hasMissingRequirements Boolean @default(false)

  // relations
  registrations AgentRegistration[]
  missingRequirements MissingRequirement[]

  @@map("customers")
}

model Partner {
  id            Int      @id
  // ... your existing fields (incl. default BA rate if you have one)

  brandAmbassadors BrandAmbassador[]
  registrations    AgentRegistration[]
  missingRequirements MissingRequirement[]
  deferredPartner  DeferredRequirementPartner[]

  @@map("partners")
}
```

> If your existing `Customer`/`Partner` Prisma models already exist, **only add** the new relation fields and `hasMissingRequirements` boolean to `Customer`.


---

## 4) Migrations & Seeding

**Migrate** via Prisma:
1. Add these models to `schema.prisma`.
2. `pnpm prisma migrate dev -n "agent_registrations_and_mr"`

**Seed defaults** for deferred‑mandatory (aligns with your rules):
- `spouse`: `gender = required`
- `child`: `gender`, `idType`, `idNumber = required`
- `beneficiary`: typically `firstName`, `lastName`, `idType`, `idNumber` (tweakable)

You can write a Prisma seed script to upsert `DeferredRequirementDefault` rows, and on **partner creation** copy defaults to `DeferredRequirementPartner` for inheritance.

```ts
// prisma/seed.ts (snippet)
await prisma.deferredRequirementDefault.upsert({
  where: { entityKind_fieldPath: { entityKind: 'spouse', fieldPath: 'gender' } },
  update: {},
  create: { entityKind: 'spouse', fieldPath: 'gender', isRequired: true },
});

await prisma.deferredRequirementDefault.upsert({
  where: { entityKind_fieldPath: { entityKind: 'child', fieldPath: 'gender' } },
  update: {},
  create: { entityKind: 'child', fieldPath: 'gender', isRequired: true },
});
// ... child idType, idNumber
// ... beneficiary firstName, lastName, idType, idNumber
```


---

## 5) API: `/internal/agent-registrations/*` (NestJS)

### Endpoints

```
POST   /internal/agent-registrations
Body: { partnerId: number }
→ Creates a draft registration (locks per‑registration rate) and returns { registrationId, customerId }
```

```
PATCH  /internal/agent-registrations/:id/customer
Body: {
  customer: {
    firstName, middleName?, lastName, phone, gender,
    idType, idNumber
  },
  expectedSpousesCount?: number,
  expectedChildrenCount?: number
}
→ Upsert customer, upsert AgentRegistration counts, seed/update MR placeholders based on counts
```

```
PATCH  /internal/agent-registrations/:id/beneficiary
Body: { beneficiary?: { firstName?, middleName?, lastName?, gender?, phone?, idType?, idNumber? } }
→ If payload has any data, create/update beneficiary row and add MRs for missing required fields.
→ If no data and partner requires beneficiary fields, create MR placeholders (entityKind='beneficiary', entityIndex=1).
```

```
PATCH  /internal/agent-registrations/:id/spouse
Body: { spouse?: { firstName?, middleName?, lastName?, gender?, phone?, idType?, idNumber? } }
→ If no data and expectedSpousesCount > 0: leave placeholders only.
→ If data provided: create dependant (relationship='SPOUSE') and add/resolve MR for gender.
```

```
PATCH  /internal/agent-registrations/:id/children
Body: { children?: [ { firstName?, middleName?, lastName?, gender?, idType?, idNumber? } ] }
→ For each non-empty line: create dependant (relationship='CHILD'), add/resolve MRs for gender/idType/idNumber.
→ For missing child indices up to expectedChildrenCount: keep MR placeholders (entityId = null).
```

```
PATCH  /internal/agent-registrations/:id/payment
→ Trigger MPESA STK prompt (your logic), record payment, return { missingSummary[] } and status.
```

```
POST   /internal/agent-registrations/:id/submit
→ Final submission after payment, mark registration as completed.
```

```
GET    /internal/agent-registrations?dateFrom=&dateTo=
Auth: BA → own records only. Returns masked list (firstName + maskedPhone + registeredAt + status).
```

```
GET    /internal/agent-registrations/:id
Auth: BA → masked fields; CC/ADMIN → full PII.
```

```
GET    /internal/missing-requirements?partnerId=&status=pending&entityKind=child|spouse|beneficiary
Auth: CC/ADMIN → queue for completion.
```

```
POST   /internal/missing-requirements/:id/resolve
Body: { fieldValue, resolvedChannel }
→ If entityId is null, create the missing dependant/beneficiary row then write the field.
→ Mark MR resolved, set customer.hasMissingRequirements=false if no more pending.
```

### DTO Tips

- Use Zod or class-validator to **detect “any data provided”** for spouse/child/beneficiary (non-empty fields) before deciding to create rows.
- **Masking**: In BA list/detail serializers, mask phone like `+2547*** **123`. Keep raw in CC/ADMIN views.


---

## 6) Wizard UX (Next.js)

- **Stepper.tsx**: handles steps (1–4), shows “Next” and “Previous”. On **Next**, call the corresponding PATCH. On the **final** Next, call `/submit`.
- **StepCustomer.tsx (Page 1)**: required fields + defaults; optional fields okay; `idType` default “national”.
- **StepBeneficiary.tsx (Page 2)**: entire form optional; saving creates MR placeholders if left blank (per partner config).
- **StepSpouse.tsx (Page 3)**: default `gender="female"` in the UI but allow leaving it blank; create row only if any data entered.
- **StepChildren.tsx (Page 4)**: dynamic list; create row only for non-empty lines. Leave gender unset by default.

**Form libs**: React Hook Form + Zod recommended (cursor-friendly).

**MPESA**: After `/submit`, show a modal “We sent a payment prompt to your phone…” and poll for the transaction result or accept a webhook that flips status.


---

## 7) Dashboard & Lists

**Cards** (BA-only): Today / Yesterday / This Week / Last Week → each shows `count` and `earned = SUM(unitRateCents)` from `AgentRegistration`. Clicking a card opens `/customers?period=...` listing masked customers. Implement with Prisma date filters using the `Africa/Nairobi` tz.

**Masked list item** example:
```
John  •  +2547*** **123  •  Today 12:14  •  submitted
```


---

## 8) MR Evaluation Logic (Service Pseudocode)

```ts
async function ensurePlaceholdersForCounts(reg: AgentRegistration) {
  // spouse expectations
  for (let i = 1; i <= reg.expectedSpousesCount; i++) {
    await upsertMR({ partnerId: reg.partnerId, customerId: reg.customerId,
      registrationId: reg.id, entityKind: 'spouse', entityIndex: i, fieldPath: 'gender' });
  }
  // child expectations
  for (let i = 1; i <= reg.expectedChildrenCount; i++) {
    for (const field of ['gender', 'idType', 'idNumber']) {
      await upsertMR({ partnerId: reg.partnerId, customerId: reg.customerId,
        registrationId: reg.id, entityKind: 'child', entityIndex: i, fieldPath: field });
    }
  }
  await updateCustomerFlag(reg.customerId);
}

async function onCreateOrUpdateSpouse(depId: string, index?: number) {
  // resolve placeholders that match (entityKind=spouse, entityIndex) → set entityId=depId
  // if gender missing on payload, keep/create MR with entityId=depId & fieldPath='gender'
  await updateCustomerFlag(customerId);
}

async function onCreateOrUpdateChild(depId: string, index?: number, fieldsProvided: Partial<Child>) {
  // resolve or create MRs for gender/idType/idNumber per field presence
  await updateCustomerFlag(customerId);
}

async function updateCustomerFlag(customerId: string) {
  const pending = await prisma.missingRequirement.count({ where: { customerId, status: 'pending' } });
  await prisma.customer.update({
    where: { id: customerId },
    data: { hasMissingRequirements: pending > 0 }
  });
}
```


---

## 9) Config Inheritance (Defaults → Partner)

On **partner creation**:
1. Copy rows from `DeferredRequirementDefault` into `DeferredRequirementPartner(partnerId=...)`.
2. Your MR logic should **check partner overrides first**, then fall back to defaults.

> This gives you global sane defaults and per-partner flexibility.


---

## 10) Security, Roles & Auth

- **Supabase Auth** supplies user identity and roles/claims. Store the BA’s mapping in `BrandAmbassador(userId)` and enforce:
  - BA can only see **their** registrations and masked PII.
  - CC/ADMIN can see/resolve MRs and full PII.
- Consider an authorization guard that injects `baId` for BA role and filters queries centrally.


---

## 11) Sequence (Mermaid)

```mermaid
sequenceDiagram
  participant BA as Brand Ambassador (Next.js)
  participant API as NestJS /internal/*
  participant DB as Postgres (Prisma)

  BA->>API: POST /agent-registrations { partnerId }
  API->>DB: create AgentRegistration (locks rate)
  API-->>BA: { registrationId, customerId }

  BA->>API: PATCH /:id/page1 { customer, expectedCounts }
  API->>DB: upsert customer, upsert counts, seed MR placeholders
  API-->>BA: OK

  BA->>API: PATCH /:id/page2 { beneficiary? }
  API->>DB: create beneficiary if data; else MRs
  API-->>BA: OK

  BA->>API: PATCH /:id/page3 { spouse? }
  API->>DB: create dependant if data; else keep MRs
  API-->>BA: OK

  BA->>API: PATCH /:id/page4 { children[]? }
  API->>DB: create dependants for rows with data; MRs for missing
  API-->>BA: OK

  BA->>API: POST /:id/submit
  API->>DB: record MPESA init + payment record
  API-->>BA: { status, missingSummary[] }
```


---

## 12) Implementation Checklist (Cursor-friendly)

- [ ] Add Prisma models & relations above; run `prisma migrate`.
- [ ] Seed `DeferredRequirementDefault` and hook partner creation to copy defaults → `DeferredRequirementPartner`.
- [ ] Implement NestJS module `/internal/agent-registrations` with endpoints & DTOs.
- [ ] Implement MR service with placeholder creation and resolution helpers.
- [ ] Implement BA authorization guard + masking serializer.
- [ ] Scaffold Next.js wizard (Stepper + Steps) and wire PATCH calls per step.
- [ ] Implement final submit → MPESA prompt + payment record.
- [ ] Build dashboard cards and filtered customer list views.
- [ ] QA: zero spouse/children flows; partial data; MR placeholder mapping; flag updates.
- [ ] Add tests for MR invariants and registration earnings totals.


---

## 13) Notes & Defaults

- **ID Type default**: “national” at UI and server validation.
- **Spouse gender default**: “female” **in UI only**; still optional initially.
- **Children gender**: no default selection.
- **No dependant/beneficiary rows** are created unless data present on that step.
- **MRs** always created for missing deferred fields and/or missing indices.
- **Customer can be 0 spouses / 0 children** (supported).

---

**End of brief.** Feel free to paste sections into Cursor to scaffold files, DTOs, and components.
