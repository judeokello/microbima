/**
 * Rebuild MissingRequirement rows from live spouse/child/beneficiary/parent data.
 *
 * Purges existing MR rows, then recreates PENDING rows for current gaps and
 * refreshes customer.hasMissingRequirements.
 *
 * Field lists must match DEFERRED_REQUIRED_FIELDS in completeness.util.ts.
 *
 * ── Recommended rollout ──
 *
 *   1. Preview:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:missing-requirements
 *
 *   2. Dry-run:
 *        DRY_RUN=1 LIMIT=20 pnpm --filter @microbima/api backfill:missing-requirements
 *
 *   3. Apply:
 *        pnpm --filter @microbima/api backfill:missing-requirements
 *
 * Required env: DATABASE_URL
 * Optional: DRY_RUN=1, LIST_ONLY=1, LIMIT=n, OFFSET=n, CUSTOMER_IDS=a,b
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  DependantRelationship,
  PrismaClient,
  RegistrationEntityKind,
  RegistrationMissingStatus,
} from '@prisma/client';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1';
const listOnly = process.env.LIST_ONLY === '1';
const limit = process.env.LIMIT ? Math.max(1, parseInt(process.env.LIMIT, 10)) : undefined;
const offset = process.env.OFFSET ? Math.max(0, parseInt(process.env.OFFSET, 10)) : 0;
const customerIdsFilter = process.env.CUSTOMER_IDS
  ? process.env.CUSTOMER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

const MISSING_NOK_FIELD_PATH = 'record';

const REQUIRED: Record<string, string[]> = {
  SPOUSE: ['firstName', 'lastName', 'idType', 'idNumber', 'gender', 'dateOfBirth'],
  CHILD: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
  BENEFICIARY: [
    'firstName',
    'lastName',
    'idType',
    'idNumber',
    'phoneNumber',
    'gender',
    'relationship',
  ],
  PARENT: [
    'firstName',
    'lastName',
    'relationship',
    'idType',
    'idNumber',
    'gender',
    'dateOfBirth',
  ],
};

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function missingFields(kind: keyof typeof REQUIRED, person: Record<string, unknown>): string[] {
  return (REQUIRED[kind] ?? []).filter((field) => isBlank(person[field]));
}

type Desired = {
  entityKind: RegistrationEntityKind;
  entityId: string | null;
  fieldPath: string;
};

async function desiredForCustomer(customerId: string): Promise<Desired[]> {
  const [dependants, beneficiaries, parents] = await Promise.all([
    prisma.dependant.findMany({
      where: {
        customerId,
        deletedAt: null,
        relationship: { in: [DependantRelationship.SPOUSE, DependantRelationship.CHILD] },
      },
    }),
    prisma.beneficiary.findMany({ where: { customerId, deletedAt: null } }),
    prisma.customerParent.findMany({ where: { customerId, deletedAt: null } }),
  ]);

  const desired: Desired[] = [];
  for (const dep of dependants) {
    const kind =
      dep.relationship === DependantRelationship.SPOUSE
        ? RegistrationEntityKind.SPOUSE
        : RegistrationEntityKind.CHILD;
    for (const fieldPath of missingFields(kind, dep as unknown as Record<string, unknown>)) {
      desired.push({ entityKind: kind, entityId: dep.id, fieldPath });
    }
  }
  if (beneficiaries.length === 0) {
    desired.push({
      entityKind: RegistrationEntityKind.BENEFICIARY,
      entityId: null,
      fieldPath: MISSING_NOK_FIELD_PATH,
    });
  } else {
    for (const ben of beneficiaries) {
      for (const fieldPath of missingFields(
        'BENEFICIARY',
        ben as unknown as Record<string, unknown>
      )) {
        desired.push({
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: ben.id,
          fieldPath,
        });
      }
    }
  }
  for (const parent of parents) {
    for (const fieldPath of missingFields(
      'PARENT',
      parent as unknown as Record<string, unknown>
    )) {
      desired.push({
        entityKind: RegistrationEntityKind.PARENT,
        entityId: parent.id,
        fieldPath,
      });
    }
  }
  return desired;
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: {
      isTestUser: false,
      ...(customerIdsFilter ? { id: { in: customerIdsFilter } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hasMissingRequirements: true,
      registrations: {
        select: { id: true, partnerId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });

  console.log(
    `Found ${customers.length} customer(s) dryRun=${dryRun} listOnly=${listOnly}`
  );

  let skippedNoRegistration = 0;
  let pendingToCreate = 0;

  for (const c of customers) {
    const registration = c.registrations[0];
    if (!registration) {
      skippedNoRegistration += 1;
      console.log(`${c.id} ${c.firstName} ${c.lastName} SKIP no agent_registration`);
      continue;
    }
    const desired = await desiredForCustomer(c.id);
    pendingToCreate += desired.length;
    console.log(
      `${c.id} ${c.firstName} ${c.lastName} hasMissing=${c.hasMissingRequirements} pendingWouldBe=${desired.length}`
    );
  }

  console.log(
    `Preview: pendingWouldBe=${pendingToCreate} skippedNoRegistration=${skippedNoRegistration}`
  );

  if (listOnly) {
    return;
  }

  if (dryRun) {
    console.log('Dry-run: no writes.');
    return;
  }

  const deleteResult = await prisma.missingRequirement.deleteMany({});
  console.log(`Purged ${deleteResult.count} missing_requirements row(s)`);

  await prisma.customer.updateMany({
    where: customerIdsFilter ? { id: { in: customerIdsFilter } } : {},
    data: { hasMissingRequirements: false },
  });

  let created = 0;
  let flagged = 0;
  for (const c of customers) {
    const registration = c.registrations[0];
    if (!registration) continue;

    const desired = await desiredForCustomer(c.id);
    if (desired.length === 0) continue;

    await prisma.missingRequirement.createMany({
      data: desired.map((d) => ({
        registrationId: registration.id,
        customerId: c.id,
        partnerId: registration.partnerId,
        entityKind: d.entityKind,
        entityId: d.entityId,
        fieldPath: d.fieldPath,
        status: RegistrationMissingStatus.PENDING,
      })),
    });
    created += desired.length;

    await prisma.customer.update({
      where: { id: c.id },
      data: { hasMissingRequirements: true },
    });
    flagged += 1;
  }

  console.log(
    `Done. created=${created} customersFlagged=${flagged} skippedNoRegistration=${skippedNoRegistration}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
