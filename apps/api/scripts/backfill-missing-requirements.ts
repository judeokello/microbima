/**
 * Backfill / reconcile MissingRequirement rows from live dependant & beneficiary data
 * using aligned deferred field rules (spouse/child/beneficiary).
 *
 * Also clears legacy LCT errorCode MISSING_SPOUSE_ID (incomplete rows now stay on Pending).
 *
 * ── Recommended rollout ──
 *
 *   1. Preview customers:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:missing-requirements
 *
 *   2. Dry-run:
 *        DRY_RUN=1 LIMIT=20 pnpm --filter @microbima/api backfill:missing-requirements
 *
 *   3. Apply:
 *        pnpm --filter @microbima/api backfill:missing-requirements
 *
 * ── On Fly ──
 *
 *   LIST_ONLY=1 node apps/api/dist/scripts/backfill-missing-requirements.js
 *   node apps/api/dist/scripts/backfill-missing-requirements.js
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

const REQUIRED: Record<string, string[]> = {
  SPOUSE: ['firstName', 'lastName', 'idNumber', 'gender', 'dateOfBirth'],
  CHILD: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
  BENEFICIARY: ['firstName', 'lastName', 'idType', 'idNumber'],
};

const RETIRED: Array<{ entityKind: RegistrationEntityKind; fieldPath: string }> = [
  { entityKind: RegistrationEntityKind.SPOUSE, fieldPath: 'idType' },
  { entityKind: RegistrationEntityKind.CHILD, fieldPath: 'idType' },
  { entityKind: RegistrationEntityKind.CHILD, fieldPath: 'idNumber' },
];

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function missingFields(
  kind: 'SPOUSE' | 'CHILD' | 'BENEFICIARY',
  person: Record<string, unknown>
): string[] {
  return (REQUIRED[kind] ?? []).filter((field) => isBlank(person[field]));
}

async function syncCustomer(customerId: string): Promise<{
  created: number;
  resolved: number;
  pending: number;
}> {
  const registration = await prisma.agentRegistration.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  if (!registration) {
    return { created: 0, resolved: 0, pending: 0 };
  }

  const [dependants, beneficiaries, existingPending] = await Promise.all([
    prisma.dependant.findMany({
      where: {
        customerId,
        deletedAt: null,
        relationship: { in: [DependantRelationship.SPOUSE, DependantRelationship.CHILD] },
      },
    }),
    prisma.beneficiary.findMany({ where: { customerId, deletedAt: null } }),
    prisma.missingRequirement.findMany({
      where: { customerId, status: RegistrationMissingStatus.PENDING },
    }),
  ]);

  const desired = new Map<
    string,
    { entityKind: RegistrationEntityKind; entityId: string; fieldPath: string }
  >();

  for (const dep of dependants) {
    const kind =
      dep.relationship === DependantRelationship.SPOUSE
        ? RegistrationEntityKind.SPOUSE
        : RegistrationEntityKind.CHILD;
    for (const fieldPath of missingFields(kind, dep as unknown as Record<string, unknown>)) {
      desired.set(`${kind}:${dep.id}:${fieldPath}`, {
        entityKind: kind,
        entityId: dep.id,
        fieldPath,
      });
    }
  }
  for (const ben of beneficiaries) {
    for (const fieldPath of missingFields(
      'BENEFICIARY',
      ben as unknown as Record<string, unknown>
    )) {
      desired.set(`${RegistrationEntityKind.BENEFICIARY}:${ben.id}:${fieldPath}`, {
        entityKind: RegistrationEntityKind.BENEFICIARY,
        entityId: ben.id,
        fieldPath,
      });
    }
  }

  let resolved = 0;
  let created = 0;

  if (!dryRun) {
    for (const mr of existingPending) {
      const isRetired = RETIRED.some(
        (r) => r.entityKind === mr.entityKind && r.fieldPath === mr.fieldPath
      );
      const key = mr.entityId ? `${mr.entityKind}:${mr.entityId}:${mr.fieldPath}` : null;
      const stillNeeded = key ? desired.has(key) : false;
      let legacyStillNeeded = false;
      if (!mr.entityId && !isRetired) {
        legacyStillNeeded = Array.from(desired.values()).some(
          (d) => d.entityKind === mr.entityKind && d.fieldPath === mr.fieldPath
        );
      }
      if (isRetired || (mr.entityId && !stillNeeded) || (!mr.entityId && !legacyStillNeeded)) {
        await prisma.missingRequirement.update({
          where: { id: mr.id },
          data: {
            status: RegistrationMissingStatus.RESOLVED,
            resolvedAt: new Date(),
            resolvedBy: 'backfill-missing-requirements',
          },
        });
        resolved += 1;
      } else if (!mr.entityId && legacyStillNeeded) {
        const match = Array.from(desired.values()).find(
          (d) => d.entityKind === mr.entityKind && d.fieldPath === mr.fieldPath
        );
        if (match) {
          await prisma.missingRequirement.update({
            where: { id: mr.id },
            data: { entityId: match.entityId },
          });
        }
      }
    }

    const pendingAfter = await prisma.missingRequirement.findMany({
      where: { customerId, status: RegistrationMissingStatus.PENDING },
    });
    const pendingKeys = new Set(
      pendingAfter
        .filter((mr) => mr.entityId)
        .map((mr) => `${mr.entityKind}:${mr.entityId}:${mr.fieldPath}`)
    );
    const toCreate = Array.from(desired.entries())
      .filter(([key]) => !pendingKeys.has(key))
      .map(([, value]) => ({
        registrationId: registration.id,
        customerId,
        partnerId: registration.partnerId,
        entityKind: value.entityKind,
        entityId: value.entityId,
        fieldPath: value.fieldPath,
        status: RegistrationMissingStatus.PENDING,
      }));
    if (toCreate.length) {
      await prisma.missingRequirement.createMany({ data: toCreate });
      created = toCreate.length;
    }

    const pending = await prisma.missingRequirement.count({
      where: { customerId, status: RegistrationMissingStatus.PENDING },
    });
    await prisma.customer.update({
      where: { id: customerId },
      data: { hasMissingRequirements: pending > 0 },
    });
    return { created, resolved, pending };
  }

  return { created: desired.size, resolved: 0, pending: desired.size };
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: {
      isTestUser: false,
      ...(customerIdsFilter ? { id: { in: customerIdsFilter } } : {}),
      OR: [
        { registrations: { some: {} } },
        { hasMissingRequirements: true },
        { missingRequirements: { some: {} } },
        {
          dependants: {
            some: {
              deletedAt: null,
              relationship: { in: [DependantRelationship.SPOUSE, DependantRelationship.CHILD] },
            },
          },
        },
      ],
    },
    select: { id: true, firstName: true, lastName: true, hasMissingRequirements: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });

  console.log(
    `Found ${customers.length} customer(s) dryRun=${dryRun} listOnly=${listOnly}`
  );

  if (listOnly) {
    for (const c of customers) {
      console.log(`${c.id} ${c.firstName} ${c.lastName} hasMissing=${c.hasMissingRequirements}`);
    }
    return;
  }

  let totalCreated = 0;
  let totalResolved = 0;
  for (const c of customers) {
    const result = await syncCustomer(c.id);
    totalCreated += result.created;
    totalResolved += result.resolved;
    console.log(
      `${c.id} created=${result.created} resolved=${result.resolved} pending=${result.pending}`
    );
  }

  if (!dryRun) {
    const cleared = await prisma.lctMemberSyncTarget.updateMany({
      where: { errorCode: 'MISSING_SPOUSE_ID' },
      data: { errorCode: null },
    });
    console.log(`Cleared MISSING_SPOUSE_ID on ${cleared.count} LCT sync target(s)`);
  }

  console.log(`Done. created=${totalCreated} resolved=${totalResolved}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
