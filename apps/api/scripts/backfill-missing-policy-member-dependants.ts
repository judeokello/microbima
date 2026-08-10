/**
 * Backfill missing policy_member_dependants for customers who have dependants
 * but no PMD row (Sharon create-time race, late adds before Jul 28 backfill, etc.).
 *
 * Same symptom for Sharon/Kailani, Polycarp, Benjamin, Joseph — different causes,
 * identical repair via planMissingPolicyMemberDependants + LCT targets.
 *
 * Usage:
 *   LIST_ONLY=1 pnpm --filter @microbima/api backfill:missing-policy-member-dependants
 *   DRY_RUN=1 pnpm --filter @microbima/api backfill:missing-policy-member-dependants
 *   APPLY=1 pnpm --filter @microbima/api backfill:missing-policy-member-dependants
 *   APPLY=1 POLICY_IDS=<uuid>,... pnpm --filter @microbima/api backfill:missing-policy-member-dependants
 *
 * Fly (after deploy):
 *   APPLY=1 node apps/api/dist/scripts/backfill-missing-policy-member-dependants.js
 *
 * Required env: DATABASE_URL
 * Dry-run by default unless APPLY=1.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  LctPendingAction,
  LctSubjectType,
  PolicyStatus,
  PrismaClient,
} from '@prisma/client';
import { planMissingPolicyMemberDependants } from '../src/utils/policy-member-dependant-backfill.util';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const apply = process.env.APPLY === '1';
const dryRun = !apply;
const listOnly = process.env.LIST_ONLY === '1';
const correlationPrefix =
  process.env.CORRELATION_PREFIX ?? 'backfill-missing-pmd';

const policyIdsFilter = process.env.POLICY_IDS
  ? process.env.POLICY_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : undefined;

const DEFAULT_STATUSES: PolicyStatus[] = [
  PolicyStatus.ACTIVE,
  PolicyStatus.SUSPENDED,
  PolicyStatus.INACTIVE,
  PolicyStatus.EXPIRED,
];

function mapPolicyStatusToLctAction(status: PolicyStatus): LctPendingAction | null {
  switch (status) {
    case PolicyStatus.ACTIVE:
      return LctPendingAction.ACTIVATE;
    case PolicyStatus.SUSPENDED:
      return LctPendingAction.SUSPENDED;
    case PolicyStatus.INACTIVE:
    case PolicyStatus.DEACTIVATED:
    case PolicyStatus.TERMINATED:
    case PolicyStatus.EXPIRED:
      return LctPendingAction.DEACTIVATE;
    default:
      return null;
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const correlationId = `${correlationPrefix}-${new Date().toISOString()}`;
  console.log(
    JSON.stringify({
      correlationId,
      dryRun,
      listOnly,
      policyIds: policyIdsFilter ?? null,
    })
  );

  const policies = await prisma.policy.findMany({
    where: {
      status: { in: DEFAULT_STATUSES },
      ...(policyIdsFilter?.length ? { id: { in: policyIdsFilter } } : {}),
      policyMemberPrincipals: { some: {} },
      customer: { isTestUser: false },
    },
    select: {
      id: true,
      status: true,
      policyNumber: true,
      customerId: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          dependants: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              relationship: true,
              createdAt: true,
            },
          },
        },
      },
      policyMemberPrincipals: {
        select: { memberNumber: true },
        take: 1,
      },
      policyMemberDependants: {
        select: { dependantId: true, memberNumber: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const planned = policies.flatMap((policy) => {
    const principalMn = policy.policyMemberPrincipals[0]?.memberNumber;
    if (!principalMn) return [];

    const existingIds = policy.policyMemberDependants.map((d) => d.dependantId);
    const existingSet = new Set(existingIds);
    const missingDependants = policy.customer.dependants.filter((d) => !existingSet.has(d.id));
    const rows = planMissingPolicyMemberDependants({
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      principalMemberNumber: principalMn,
      existingDependantIds: existingIds,
      missingDependants,
    });
    return rows.map((row) => ({
      ...row,
      status: policy.status,
      customerId: policy.customerId,
      customerName: `${policy.customer.firstName} ${policy.customer.lastName}`,
    }));
  });

  console.log(`Planned ${planned.length} missing PMD row(s) across policies`);
  for (const row of planned) {
    console.log(
      [
        row.policyNumber ?? row.policyId,
        row.status,
        row.customerName,
        row.dependantName,
        row.relationship,
        row.memberNumber,
      ].join(' | ')
    );
  }

  if (listOnly || planned.length === 0) {
    return;
  }

  if (dryRun) {
    console.log('Dry-run only (set APPLY=1 to write)');
    return;
  }

  let created = 0;
  for (const row of planned) {
    await prisma.$transaction(async (tx) => {
      await tx.policyMemberDependant.create({
        data: {
          dependantId: row.dependantId,
          policyId: row.policyId,
          memberNumber: row.memberNumber,
        },
      });

      const action = mapPolicyStatusToLctAction(row.status);
      await tx.lctMemberSyncTarget.upsert({
        where: { memberNumber: row.memberNumber },
        create: {
          policyId: row.policyId,
          memberNumber: row.memberNumber,
          subjectType: LctSubjectType.DEPENDANT,
          customerId: row.customerId,
          dependantId: row.dependantId,
          pendingReasons: action ? ['backfill_missing_pmd'] : [],
          pendingAction: action,
          pendingSince: action ? new Date() : null,
        },
        update: {
          policyId: row.policyId,
          dependantId: row.dependantId,
          subjectType: LctSubjectType.DEPENDANT,
          ...(action
            ? {
                pendingAction: action,
                pendingSince: new Date(),
                pendingReasons: ['backfill_missing_pmd'],
              }
            : {}),
        },
      });
    });
    created += 1;
    console.log(`[${correlationId}] created ${row.memberNumber} for ${row.dependantId}`);
  }

  console.log(`Created ${created} policy_member_dependants row(s)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
