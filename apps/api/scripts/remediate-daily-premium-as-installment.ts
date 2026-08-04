/**
 * Remediate policies where Policy.premium was stored as a daily rate instead of
 * installment (daily × paymentCadence) for non-daily frequencies.
 *
 * Prisma-only (no Nest bootstrap) so it runs on Fly prod images.
 * Still writes entity_status_changes and enqueues LCT pendingAction — same outcomes
 * as EntityStatusChangeService → LctSyncService.
 *
 * For each matching policy:
 *   1. Set premium = premium × paymentCadence
 *   2. Recompute Correct Status (arrears/overdue with corrected installment)
 *   3. If status mismatches, update policy + audit + LCT (no payment gate, no SMS)
 *
 * Usage (local):
 *   pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *   APPLY=1 pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *   POLICY_IDS=<uuid>,<uuid> APPLY=1 pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *
 * Usage (Fly, after deploy — prefer compiled JS):
 *   fly ssh console -a <internal-api-app>
 *   cd /app
 *   APPLY=1 node apps/api/dist/scripts/remediate-daily-premium-as-installment.js
 *
 * Or before next deploy (ts-node transpile-only, Prisma-only — no Nest):
 *   cd /app/apps/api
 *   APPLY=1 TS_NODE_TRANSPILE_ONLY=1 npx ts-node -r dotenv/config scripts/remediate-daily-premium-as-installment.ts
 *
 * Required env: DATABASE_URL
 * Dry-run by default unless APPLY=1.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  CustomerStatus,
  LctPendingAction,
  PaymentStatus,
  PolicyStatus,
  Prisma,
  PrismaClient,
  StatusChangeEntityType,
  StatusChangeTrigger,
} from '@prisma/client';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

/** Known daily rates from agent-registration public/product-pricing/mfanisi-go-pricing.json (± spouse). */
const DAILY_RATES = new Set([
  63, 111, 137, 76, 124, 150, // Silver
  84, 152, 189, 103, 171, 208, // Gold
]);

const CONFIRMED: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

const CLOSED_STATUSES = new Set<PolicyStatus>([
  PolicyStatus.DEACTIVATED,
  PolicyStatus.TERMINATED,
  PolicyStatus.EXPIRED,
]);

const REMEDIATION_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const LCT_REASON_STATUS_CHANGE = 'STATUS_CHANGE';

const dryRun = process.env.APPLY !== '1' && process.env.DRY_RUN !== '0';
const policyIdFilter = (process.env.POLICY_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type CorrectStatus = 'ACTIVE' | 'SUSPENDED';
type Tx = Prisma.TransactionClient;

function utcDayStart(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 0, 0, 0, 0));
}

function utcInclusiveCalendarDays(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((e - s) / 86400000) + 1;
}

function addUtcCalendarDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcCalendarDaysBetween(from: Date, to: Date): number {
  const a = utcDayStart(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = utcDayStart(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function computeCorrectStatus(params: {
  startDate: Date;
  paymentCadence: number;
  installmentAmount: number;
  totalPaid: number;
  asOfUtc: Date;
}): {
  correctStatus: CorrectStatus;
  correctExpected: number;
  correctArrears: number;
  overdueDays: number;
} {
  const { startDate, paymentCadence, installmentAmount, totalPaid, asOfUtc } = params;
  const start = utcDayStart(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const inclusiveDays = Math.max(0, utcInclusiveCalendarDays(start, asOfUtc));
  const periods = Math.floor(inclusiveDays / paymentCadence);
  const expectedPremium = periods * installmentAmount;
  const premiumDue = Math.max(0, expectedPremium - totalPaid);
  const paidPeriods =
    installmentAmount > 0 ? Math.floor(totalPaid / installmentAmount) : 0;

  let overdueDays = 0;
  if (premiumDue > 0) {
    const nextDue = addUtcCalendarDays(start, paidPeriods * paymentCadence);
    overdueDays = Math.max(0, utcCalendarDaysBetween(nextDue, asOfUtc));
  }

  const correctStatus: CorrectStatus =
    premiumDue <= 0 || overdueDays <= 14 ? 'ACTIVE' : 'SUSPENDED';

  return {
    correctStatus,
    correctExpected: expectedPremium,
    correctArrears: premiumDue,
    overdueDays,
  };
}

function mapPolicyStatusToLctAction(status: string): LctPendingAction | null {
  if (status === PolicyStatus.ACTIVE) return LctPendingAction.ACTIVATE;
  if (status === PolicyStatus.SUSPENDED) return LctPendingAction.SUSPENDED;
  if (
    status === PolicyStatus.INACTIVE ||
    status === PolicyStatus.DEACTIVATED ||
    status === PolicyStatus.TERMINATED ||
    status === PolicyStatus.EXPIRED
  ) {
    return LctPendingAction.DEACTIVATE;
  }
  return null;
}

function shouldEnqueueStatusChange(fromStatus: string, toStatus: string): boolean {
  const toAction = mapPolicyStatusToLctAction(toStatus);
  if (!toAction) return false;
  if (toStatus === PolicyStatus.ACTIVE) return fromStatus !== PolicyStatus.ACTIVE;
  if (toStatus === PolicyStatus.SUSPENDED) return fromStatus !== PolicyStatus.SUSPENDED;
  return false;
}

function isPolicyEndDatePassed(endDate: Date | null | undefined, asOfUtc: Date): boolean {
  if (endDate == null) return false;
  return asOfUtc.getTime() >= endDate.getTime();
}

async function enqueueLctForPolicyStatus(
  tx: Tx,
  params: {
    policyId: string;
    customerId: string;
    fromStatus: string;
    toStatus: string;
  }
): Promise<void> {
  if (!shouldEnqueueStatusChange(params.fromStatus, params.toStatus)) return;

  const customer = await tx.customer.findUnique({
    where: { id: params.customerId },
    select: { isTestUser: true },
  });
  if (customer?.isTestUser) return;

  const action = mapPolicyStatusToLctAction(params.toStatus);
  if (!action) return;

  const targets = await tx.lctMemberSyncTarget.findMany({
    where: { policyId: params.policyId },
  });

  for (const target of targets) {
    if (target.dependantId) {
      const dep = await tx.dependant.findUnique({
        where: { id: target.dependantId },
        select: { deletedAt: true },
      });
      if (dep?.deletedAt) continue;
    }

    const reasons = Array.from(
      new Set([...(target.pendingReasons ?? []), LCT_REASON_STATUS_CHANGE])
    );
    await tx.lctMemberSyncTarget.update({
      where: { id: target.id },
      data: {
        pendingAction: action,
        pendingReasons: reasons,
        pendingSince: target.pendingSince ?? new Date(),
      },
    });
  }
}

async function syncCustomerStatusAfterPolicyChange(
  tx: Tx,
  customerId: string,
  correlationId: string
): Promise<void> {
  const policies = await tx.policy.findMany({
    where: {
      customerId,
      status: {
        in: [
          PolicyStatus.ACTIVE,
          PolicyStatus.PENDING_ACTIVATION,
          PolicyStatus.SUSPENDED,
        ],
      },
    },
    select: { status: true },
  });

  const hasActive = policies.some((p) => p.status === PolicyStatus.ACTIVE);
  const hasPending = policies.some((p) => p.status === PolicyStatus.PENDING_ACTIVATION);
  const hasSuspended = policies.some((p) => p.status === PolicyStatus.SUSPENDED);

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;

  let nextStatus: CustomerStatus | null = null;
  if (hasActive) {
    if (
      customer.status === CustomerStatus.DEACTIVATED ||
      customer.status === CustomerStatus.SUSPENDED ||
      customer.status === CustomerStatus.TERMINATED
    ) {
      nextStatus = CustomerStatus.ACTIVE;
    }
  } else if (hasPending) {
    if (customer.status !== CustomerStatus.PENDING_ACTIVATION) {
      nextStatus = CustomerStatus.PENDING_ACTIVATION;
    }
  } else if (hasSuspended) {
    if (customer.status !== CustomerStatus.SUSPENDED) {
      nextStatus = CustomerStatus.SUSPENDED;
    }
  } else {
    nextStatus = CustomerStatus.DEACTIVATED;
  }

  if (nextStatus == null || nextStatus === customer.status) return;

  await tx.entityStatusChange.create({
    data: {
      entityType: StatusChangeEntityType.CUSTOMER,
      customerId,
      fromStatus: customer.status,
      toStatus: nextStatus,
      reason: 'Automatic customer status update after policy change',
      trigger: StatusChangeTrigger.SYSTEM,
      changedBy: REMEDIATION_ACTOR_ID,
      correlationId,
    },
  });

  await tx.customer.update({
    where: { id: customerId },
    data: { status: nextStatus },
  });
}

async function remediateStatusWithoutPaymentGate(
  tx: Tx,
  params: {
    policyId: string;
    customerId: string;
    fromStatus: PolicyStatus;
    toStatus: typeof PolicyStatus.ACTIVE | typeof PolicyStatus.SUSPENDED;
    endDate: Date | null;
    reason: string;
    correlationId: string;
    asOfUtc: Date;
  }
): Promise<void> {
  const { policyId, customerId, fromStatus, toStatus, endDate, reason, correlationId, asOfUtc } =
    params;

  if (fromStatus === toStatus) return;

  if (toStatus === PolicyStatus.ACTIVE) {
    if (fromStatus !== PolicyStatus.SUSPENDED) {
      throw new Error(`Remediate to ACTIVE only from SUSPENDED (was ${fromStatus})`);
    }
    if (isPolicyEndDatePassed(endDate, asOfUtc)) {
      throw new Error(`Policy ${policyId} cannot become Active after end date`);
    }
  } else if (toStatus === PolicyStatus.SUSPENDED) {
    if (fromStatus !== PolicyStatus.ACTIVE) {
      throw new Error(`Remediate to SUSPENDED only from ACTIVE (was ${fromStatus})`);
    }
  }

  await tx.entityStatusChange.create({
    data: {
      entityType: StatusChangeEntityType.POLICY,
      customerId,
      policyId,
      fromStatus,
      toStatus,
      reason,
      trigger: StatusChangeTrigger.SYSTEM,
      changedBy: REMEDIATION_ACTOR_ID,
      correlationId,
      metadata: { remediation: 'daily_premium_as_installment', noPaymentGate: true },
    },
  });

  await enqueueLctForPolicyStatus(tx, {
    policyId,
    customerId,
    fromStatus,
    toStatus,
  });

  await tx.policy.update({
    where: { id: policyId },
    data:
      toStatus === PolicyStatus.ACTIVE
        ? {
            status: PolicyStatus.ACTIVE,
            suspendedAt: null,
            inactivatedAt: null,
            inGracePeriod: false,
            graceEnteredAt: null,
            overdueAnchorDueDate: null,
            deactivatedAt: null,
          }
        : {
            status: PolicyStatus.SUSPENDED,
            suspendedAt: asOfUtc,
            inGracePeriod: false,
            graceEnteredAt: null,
            overdueAnchorDueDate: null,
          },
  });

  await syncCustomerStatusAfterPolicyChange(tx, customerId, correlationId);
}

async function main(): Promise<void> {
  console.log(`Remediate daily-as-installment premium (${dryRun ? 'DRY_RUN' : 'APPLY'})`);
  if (policyIdFilter.length) {
    console.log(`POLICY_IDS filter: ${policyIdFilter.join(', ')}`);
  }

  const asOfUtc = new Date();
  const correlationId = `remediate-daily-premium-${asOfUtc.toISOString()}`;

  try {
    const policies = await prisma.policy.findMany({
      where: {
        paymentCadence: { gt: 1 },
        premium: { gt: 0 },
        ...(policyIdFilter.length ? { id: { in: policyIdFilter } } : {}),
      },
      select: {
        id: true,
        policyNumber: true,
        customerId: true,
        status: true,
        premium: true,
        paymentCadence: true,
        frequency: true,
        startDate: true,
        endDate: true,
        customer: { select: { firstName: true, lastName: true } },
        policyPayments: {
          where: { detachedAt: null },
          select: {
            amount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cohort = policies.filter((p) => DAILY_RATES.has(Number(p.premium)));
    console.log(`Matched cohort: ${cohort.length} of ${policies.length} policies (cadence>1)`);

    let premiumFixed = 0;
    let activated = 0;
    let suspended = 0;
    let premiumOnly = 0;
    let skippedClosed = 0;

    for (const policy of cohort) {
      const oldPremium = Number(policy.premium);
      const newPremium = Math.round(oldPremium * policy.paymentCadence * 100) / 100;
      const name = `${policy.customer.firstName ?? ''} ${policy.customer.lastName ?? ''}`.trim();

      const totalPaid = policy.policyPayments
        .filter((pm) => CONFIRMED.includes(pm.paymentStatus))
        .reduce((sum, pm) => sum + Number(pm.amount), 0);

      let correctStatus: CorrectStatus | null = null;
      let math: ReturnType<typeof computeCorrectStatus> | null = null;
      if (policy.startDate && !CLOSED_STATUSES.has(policy.status)) {
        math = computeCorrectStatus({
          startDate: policy.startDate,
          paymentCadence: policy.paymentCadence,
          installmentAmount: newPremium,
          totalPaid,
          asOfUtc,
        });
        correctStatus = math.correctStatus;
      }

      const statusAction =
        correctStatus == null
          ? 'premium_only_closed'
          : policy.status === PolicyStatus.SUSPENDED && correctStatus === 'ACTIVE'
            ? 'activate'
            : policy.status === PolicyStatus.ACTIVE && correctStatus === 'SUSPENDED'
              ? 'suspend'
              : 'premium_only_aligned';

      console.log(
        JSON.stringify({
          policyId: policy.id,
          policyNumber: policy.policyNumber,
          name,
          frequency: policy.frequency,
          cadence: policy.paymentCadence,
          oldPremium,
          newPremium,
          totalPaid,
          currentStatus: policy.status,
          correctStatus,
          correctExpected: math?.correctExpected,
          correctArrears: math?.correctArrears,
          overdueDays: math?.overdueDays,
          statusAction,
        })
      );

      if (dryRun) {
        if (statusAction === 'activate') activated += 1;
        else if (statusAction === 'suspend') suspended += 1;
        else if (statusAction === 'premium_only_closed') skippedClosed += 1;
        else premiumOnly += 1;
        premiumFixed += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.policy.update({
          where: { id: policy.id },
          data: { premium: new Prisma.Decimal(newPremium.toFixed(2)) },
        });

        if (statusAction === 'activate') {
          await remediateStatusWithoutPaymentGate(tx, {
            policyId: policy.id,
            customerId: policy.customerId,
            fromStatus: policy.status,
            toStatus: PolicyStatus.ACTIVE,
            endDate: policy.endDate,
            reason:
              'Remediate: daily rate stored as installment; false suspension (no payment gate)',
            correlationId,
            asOfUtc,
          });
        } else if (statusAction === 'suspend') {
          await remediateStatusWithoutPaymentGate(tx, {
            policyId: policy.id,
            customerId: policy.customerId,
            fromStatus: policy.status,
            toStatus: PolicyStatus.SUSPENDED,
            endDate: policy.endDate,
            reason:
              'Remediate: underpaid vs corrected installment after daily×cadence fix',
            correlationId,
            asOfUtc,
          });
        }
      });

      if (statusAction === 'activate') activated += 1;
      else if (statusAction === 'suspend') suspended += 1;
      else if (statusAction === 'premium_only_closed') skippedClosed += 1;
      else premiumOnly += 1;
      premiumFixed += 1;
    }

    console.log(
      JSON.stringify({
        dryRun,
        premiumFixed,
        activated,
        suspended,
        premiumOnly,
        skippedClosed,
        correlationId,
      })
    );
    if (dryRun) {
      console.log('Dry run only. Re-run with APPLY=1 to persist changes.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
