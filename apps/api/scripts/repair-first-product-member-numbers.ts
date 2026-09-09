/**
 * Repair first-product policies that were activated without copying live
 * dependants / parents onto policy_member_* (occupancy numbering regression).
 *
 * Re-issues member numbers in canonical order: principal → spouses → children → parents.
 * Uses the base policy number for [DIS]/[DISn] policies (member strings stay MFG300-00).
 * Skips additional-product policies (another package existed before this policy).
 * Does not touch PENDING_ACTIVATION policies that were never activated.
 *
 * Usage:
 *   LIST_ONLY=1 pnpm --filter @microbima/api repair:first-product-member-numbers
 *   DRY_RUN=1 pnpm --filter @microbima/api repair:first-product-member-numbers
 *   APPLY=1 pnpm --filter @microbima/api repair:first-product-member-numbers
 *   APPLY=1 POLICY_IDS=<uuid>,... pnpm --filter @microbima/api repair:first-product-member-numbers
 *
 * Fly (after deploy; run via ts-node like other src-importing backfills):
 *   APPLY=1 pnpm --filter @microbima/api repair:first-product-member-numbers
 *
 * Required env: DATABASE_URL
 * Dry-run by default unless APPLY=1.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  LctPendingAction,
  LctSubjectType,
  PrismaClient,
} from '@prisma/client';
import { isOccupyingPolicyStatus } from '../src/utils/occupying-policy.util';
import {
  isFirstProductEnrolment,
  planCanonicalHouseholdMemberNumbers,
} from '../src/utils/first-product-enrolment.util';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const apply = process.env.APPLY === '1';
const dryRun = !apply;
const listOnly = process.env.LIST_ONLY === '1';
const correlationPrefix =
  process.env.CORRELATION_PREFIX ?? 'repair-first-product-members';

const policyIdsFilter = process.env.POLICY_IDS
  ? process.env.POLICY_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : undefined;

function tempMemberNumber(policyId: string, slot: string, index: number): string {
  return `RPR-${policyId.slice(0, 8)}-${slot}${String(index).padStart(2, '0')}`;
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
      policyNumber: { not: null },
      ...(policyIdsFilter?.length ? { id: { in: policyIdsFilter } } : {}),
      policyMemberPrincipals: { some: {} },
      customer: { isTestUser: false },
    },
    select: {
      id: true,
      status: true,
      policyNumber: true,
      packageId: true,
      createdAt: true,
      customerId: true,
      package: { select: { name: true, parentsSupported: true } },
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
          parents: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              relationship: true,
              createdAt: true,
            },
          },
          policies: {
            select: { id: true, packageId: true, createdAt: true },
          },
        },
      },
      policyMemberPrincipals: {
        select: { id: true, memberNumber: true },
        take: 1,
      },
      policyMemberDependants: {
        select: { id: true, dependantId: true, memberNumber: true },
      },
      policyMemberParents: {
        select: { id: true, customerParentId: true, memberNumber: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const planned = policies.flatMap((policy) => {
    const principal = policy.policyMemberPrincipals[0];
    if (!principal || !/-\d{2}$/.test(principal.memberNumber)) return [];

    const firstProduct = isFirstProductEnrolment({
      packageId: policy.packageId,
      createdAt: policy.createdAt,
      otherPolicies: policy.customer.policies.filter((other) => other.id !== policy.id),
    });
    if (!firstProduct) return [];

    const pmdByDependantId = new Map(
      policy.policyMemberDependants.map((row) => [row.dependantId, row])
    );
    const pmpByParentId = new Map(
      policy.policyMemberParents.map((row) => [row.customerParentId, row])
    );

    const plan = planCanonicalHouseholdMemberNumbers({
      principalMemberNumber: principal.memberNumber,
      liveDependants: policy.customer.dependants.map((dependant) => ({
        ...dependant,
        currentMemberNumber: pmdByDependantId.get(dependant.id)?.memberNumber ?? null,
      })),
      liveParents: policy.customer.parents.map((parent) => ({
        ...parent,
        currentMemberNumber: pmpByParentId.get(parent.id)?.memberNumber ?? null,
      })),
      includeParents: policy.package.parentsSupported,
    });

    if (!plan.needsRepair) return [];

    return [
      {
        policyId: policy.id,
        status: policy.status,
        policyNumber: policy.policyNumber,
        packageName: policy.package.name,
        customerId: policy.customerId,
        customerName: `${policy.customer.firstName} ${policy.customer.lastName}`.trim(),
        principalMemberNumber: principal.memberNumber,
        occupying: isOccupyingPolicyStatus(policy.status),
        dependants: plan.dependants.map((row) => {
          const live = policy.customer.dependants.find((d) => d.id === row.id);
          return {
            ...row,
            name: live ? `${live.firstName} ${live.lastName}`.trim() : row.id,
            relationship: live?.relationship ?? 'DEPENDANT',
          };
        }),
        parents: plan.parents.map((row) => {
          const live = policy.customer.parents.find((p) => p.id === row.id);
          return {
            ...row,
            name: live ? `${live.firstName} ${live.lastName}`.trim() : row.id,
            relationship: live?.relationship ?? 'PARENT',
          };
        }),
      },
    ];
  });

  const customerIds = new Set(planned.map((row) => row.customerId));
  console.log(
    `Planned repair for ${planned.length} first-product polic${planned.length === 1 ? 'y' : 'ies'} ` +
      `across ${customerIds.size} customer(s)`
  );

  for (const row of planned) {
    console.log(
      [
        row.policyNumber ?? row.policyId,
        row.status,
        row.packageName,
        row.customerName,
        `deps ${row.dependants.map((d) => `${d.memberNumber}<=${d.currentMemberNumber ?? 'missing'}`).join(',') || 'none'}`,
        `parents ${row.parents.map((p) => `${p.memberNumber}<=${p.currentMemberNumber ?? 'missing'}`).join(',') || 'none'}`,
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

  let repaired = 0;
  for (const row of planned) {
    await prisma.$transaction(async (tx) => {
      for (const [index, dependant] of row.dependants.entries()) {
        await tx.policyMemberDependant.upsert({
          where: {
            policyId_dependantId: {
              policyId: row.policyId,
              dependantId: dependant.id,
            },
          },
          create: {
            policyId: row.policyId,
            dependantId: dependant.id,
            memberNumber: tempMemberNumber(row.policyId, 'D', index),
          },
          update: {
            memberNumber: tempMemberNumber(row.policyId, 'D', index),
          },
        });
      }

      for (const [index, parent] of row.parents.entries()) {
        await tx.policyMemberParent.upsert({
          where: {
            policyId_customerParentId: {
              policyId: row.policyId,
              customerParentId: parent.id,
            },
          },
          create: {
            policyId: row.policyId,
            customerParentId: parent.id,
            memberNumber: tempMemberNumber(row.policyId, 'P', index),
          },
          update: {
            memberNumber: tempMemberNumber(row.policyId, 'P', index),
          },
        });
      }

      for (const dependant of row.dependants) {
        await tx.policyMemberDependant.update({
          where: {
            policyId_dependantId: {
              policyId: row.policyId,
              dependantId: dependant.id,
            },
          },
          data: { memberNumber: dependant.memberNumber, updatedAt: new Date() },
        });
      }

      for (const parent of row.parents) {
        await tx.policyMemberParent.update({
          where: {
            policyId_customerParentId: {
              policyId: row.policyId,
              customerParentId: parent.id,
            },
          },
          data: { memberNumber: parent.memberNumber, updatedAt: new Date() },
        });
      }

      if (!row.occupying) {
        return;
      }

      for (const [index, dependant] of row.dependants.entries()) {
        const existingByPerson = await tx.lctMemberSyncTarget.findFirst({
          where: { policyId: row.policyId, dependantId: dependant.id },
        });
        const conflict = await tx.lctMemberSyncTarget.findUnique({
          where: { memberNumber: dependant.memberNumber },
        });

        if (conflict && conflict.policyId !== row.policyId) {
          console.warn(
            `[${correlationId}] skip LCT ${dependant.memberNumber}: owned by policy ${conflict.policyId}`
          );
          continue;
        }

        if (
          existingByPerson &&
          existingByPerson.memberNumber !== dependant.memberNumber &&
          conflict &&
          conflict.id !== existingByPerson.id
        ) {
          await tx.lctMemberSyncTarget.update({
            where: { id: conflict.id },
            data: { memberNumber: tempMemberNumber(row.policyId, 'L', index) },
          });
        }

        const target = existingByPerson
          ? await tx.lctMemberSyncTarget.update({
              where: { id: existingByPerson.id },
              data: {
                memberNumber: dependant.memberNumber,
                subjectType: LctSubjectType.DEPENDANT,
                dependantId: dependant.id,
                customerId: row.customerId,
              },
            })
          : await tx.lctMemberSyncTarget.upsert({
              where: { memberNumber: dependant.memberNumber },
              create: {
                policyId: row.policyId,
                memberNumber: dependant.memberNumber,
                subjectType: LctSubjectType.DEPENDANT,
                customerId: row.customerId,
                dependantId: dependant.id,
                pendingReasons: ['NEW'],
                pendingAction: LctPendingAction.ACTIVATE,
                pendingSince: new Date(),
              },
              update: {
                policyId: row.policyId,
                customerId: row.customerId,
                dependantId: dependant.id,
                subjectType: LctSubjectType.DEPENDANT,
              },
            });

        if (!target.lastSentAt && target.pendingAction !== LctPendingAction.ACTIVATE) {
          await tx.lctMemberSyncTarget.update({
            where: { id: target.id },
            data: {
              pendingAction: LctPendingAction.ACTIVATE,
              pendingReasons: Array.from(new Set([...(target.pendingReasons ?? []), 'NEW'])),
              pendingSince: target.pendingSince ?? new Date(),
            },
          });
        }
      }
    });

    repaired += 1;
    console.log(
      `[${correlationId}] repaired ${row.policyNumber ?? row.policyId} for ${row.customerName}`
    );
  }

  console.log(`Repaired ${repaired} polic${repaired === 1 ? 'y' : 'ies'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
