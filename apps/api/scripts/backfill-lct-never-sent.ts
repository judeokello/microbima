/**
 * Backfill LCT sync targets for members who were never emailed to LCT.
 *
 * Creates/updates `lct_member_sync_targets` for principal + spouse/child member
 * numbers on syncable policies (non-test), and enqueues pending actions when
 * `lastSentAt` is null so the admin Pending tab is populated.
 *
 * ── Recommended rollout ──
 *
 *   1. Preview:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:lct-never-sent
 *
 *   2. Dry-run a slice:
 *        DRY_RUN=1 LIMIT=10 pnpm --filter @microbima/api backfill:lct-never-sent
 *
 *   3. Apply:
 *        LIMIT=50 pnpm --filter @microbima/api backfill:lct-never-sent
 *        pnpm --filter @microbima/api backfill:lct-never-sent
 *
 * ── On Fly (after deploy; DATABASE_URL present) ──
 *
 *   fly ssh console -a maishapoa-staging-internal-api
 *   LIST_ONLY=1 node apps/api/dist/scripts/backfill-lct-never-sent.js
 *   DRY_RUN=1 LIMIT=10 node apps/api/dist/scripts/backfill-lct-never-sent.js
 *   node apps/api/dist/scripts/backfill-lct-never-sent.js
 *
 * Required env: DATABASE_URL
 *
 * Optional env:
 *   DRY_RUN=1
 *   LIST_ONLY=1
 *   LIMIT=n                 — max policies to process
 *   OFFSET=n                — skip first n matching policies
 *   POLICY_IDS=a,b,c
 *   CUSTOMER_IDS=a,b,c
 *   STATUSES=ACTIVE         — comma list; default ACTIVE,SUSPENDED,INACTIVE,DEACTIVATED,TERMINATED,EXPIRED
 *   CORRELATION_PREFIX=x    — default backfill-lct-never-sent
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  DependantRelationship,
  LctPendingAction,
  LctSubjectType,
  PolicyStatus,
  PrismaClient,
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
const correlationPrefix = process.env.CORRELATION_PREFIX ?? 'backfill-lct-never-sent';

const policyIdsFilter = process.env.POLICY_IDS
  ? process.env.POLICY_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;
const customerIdsFilter = process.env.CUSTOMER_IDS
  ? process.env.CUSTOMER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

const DEFAULT_STATUSES: PolicyStatus[] = [
  PolicyStatus.ACTIVE,
  PolicyStatus.SUSPENDED,
  PolicyStatus.INACTIVE,
  PolicyStatus.DEACTIVATED,
  PolicyStatus.TERMINATED,
  PolicyStatus.EXPIRED,
];

const statusesFilter: PolicyStatus[] = process.env.STATUSES
  ? process.env.STATUSES.split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is PolicyStatus =>
        (DEFAULT_STATUSES as string[]).includes(s)
      )
  : DEFAULT_STATUSES;

const LCT_FAMILY: DependantRelationship[] = [
  DependantRelationship.SPOUSE,
  DependantRelationship.CHILD,
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
      limit: limit ?? null,
      offset,
      statuses: statusesFilter,
      policyIds: policyIdsFilter ?? null,
      customerIds: customerIdsFilter ?? null,
    })
  );

  const policies = await prisma.policy.findMany({
    where: {
      status: { in: statusesFilter },
      customer: {
        isTestUser: false,
        ...(customerIdsFilter?.length ? { id: { in: customerIdsFilter } } : {}),
      },
      ...(policyIdsFilter?.length ? { id: { in: policyIdsFilter } } : {}),
      policyMemberPrincipals: { some: {} },
    },
    select: {
      id: true,
      status: true,
      productName: true,
      customerId: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          idNumber: true,
        },
      },
      policyMemberPrincipals: {
        select: { memberNumber: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
    skip: offset,
    take: limit,
  });

  console.log(`Found ${policies.length} policy candidate(s)`);

  if (listOnly) {
    for (const p of policies) {
      const action = mapPolicyStatusToLctAction(p.status);
      console.log(
        [
          p.id,
          p.status,
          action ?? 'SKIP',
          p.policyMemberPrincipals[0]?.memberNumber ?? 'NO_MEMBER',
          `${p.customer.firstName} ${p.customer.lastName}`,
          p.customer.idNumber,
          p.productName,
        ].join(' | ')
      );
    }
    return;
  }

  let policiesProcessed = 0;
  let targetsUpserted = 0;
  let targetsEnqueued = 0;
  let targetsSkippedAlreadySent = 0;
  let targetsSkippedOpenBatch = 0;
  let targetsSkippedNoAction = 0;
  let orphanPolicies = 0;

  for (const policy of policies) {
    const action = mapPolicyStatusToLctAction(policy.status);
    if (!action) {
      targetsSkippedNoAction++;
      continue;
    }

    const principal = await prisma.policyMemberPrincipal.findFirst({
      where: { policyId: policy.id },
    });
    if (!principal) {
      orphanPolicies++;
      console.warn(`[${correlationId}] skip policy ${policy.id}: no PolicyMemberPrincipal`);
      continue;
    }

    const dependantMembers = await prisma.policyMemberDependant.findMany({
      where: {
        policyId: policy.id,
        dependant: {
          deletedAt: null,
          relationship: { in: LCT_FAMILY },
        },
      },
      select: {
        memberNumber: true,
        dependantId: true,
        dependant: {
          select: {
            relationship: true,
            idNumber: true,
          },
        },
      },
    });

    type Row = {
      memberNumber: string;
      subjectType: LctSubjectType;
      dependantId: string | null;
      errorCode: string | null;
    };

    const rows: Row[] = [
      {
        memberNumber: principal.memberNumber,
        subjectType: LctSubjectType.PRINCIPAL,
        dependantId: null,
        errorCode: null,
      },
      ...dependantMembers.map((dm) => {
        let errorCode: string | null = null;
        if (
          dm.dependant.relationship === DependantRelationship.SPOUSE &&
          !(dm.dependant.idNumber ?? '').trim()
        ) {
          errorCode = 'MISSING_SPOUSE_ID';
        }
        return {
          memberNumber: dm.memberNumber,
          subjectType: LctSubjectType.DEPENDANT,
          dependantId: dm.dependantId,
          errorCode,
        };
      }),
    ];

    for (const row of rows) {
      if (dryRun) {
        const existing = await prisma.lctMemberSyncTarget.findUnique({
          where: { memberNumber: row.memberNumber },
          select: {
            lastSentAt: true,
            openBatchId: true,
            pendingAction: true,
          },
        });
        targetsUpserted++;
        if (existing?.lastSentAt) {
          targetsSkippedAlreadySent++;
        } else if (existing?.openBatchId) {
          targetsSkippedOpenBatch++;
        } else if (row.errorCode) {
          console.log(
            `[dry-run] would upsert ERROR ${row.memberNumber} ${row.errorCode} (no pending)`
          );
        } else {
          targetsEnqueued++;
          console.log(
            `[dry-run] would enqueue ${row.memberNumber} action=${action} policy=${policy.id}`
          );
        }
        continue;
      }

      const target = await prisma.lctMemberSyncTarget.upsert({
        where: { memberNumber: row.memberNumber },
        create: {
          policyId: policy.id,
          memberNumber: row.memberNumber,
          subjectType: row.subjectType,
          customerId: policy.customerId,
          dependantId: row.dependantId,
          pendingReasons: [],
          errorCode: row.errorCode,
        },
        update: {
          policyId: policy.id,
          customerId: policy.customerId,
          dependantId: row.dependantId,
          subjectType: row.subjectType,
          errorCode: row.errorCode,
        },
      });
      targetsUpserted++;

      if (target.lastSentAt) {
        targetsSkippedAlreadySent++;
        continue;
      }
      if (target.openBatchId) {
        targetsSkippedOpenBatch++;
        continue;
      }
      // Errors tab only — do not put on Pending until data fixed
      if (row.errorCode) {
        await prisma.lctMemberSyncTarget.update({
          where: { id: target.id },
          data: {
            pendingAction: null,
            pendingReasons: [],
            pendingSince: null,
          },
        });
        continue;
      }

      const reasons = Array.from(
        new Set([...(target.pendingReasons ?? []), 'NEW'])
      );
      await prisma.lctMemberSyncTarget.update({
        where: { id: target.id },
        data: {
          pendingAction: action,
          pendingReasons: reasons,
          pendingSince: target.pendingSince ?? new Date(),
          errorCode: null,
        },
      });
      targetsEnqueued++;
    }

    policiesProcessed++;
  }

  console.log(
    JSON.stringify({
      correlationId,
      dryRun,
      policiesProcessed,
      targetsUpserted,
      targetsEnqueued,
      targetsSkippedAlreadySent,
      targetsSkippedOpenBatch,
      targetsSkippedNoAction,
      orphanPolicies,
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
