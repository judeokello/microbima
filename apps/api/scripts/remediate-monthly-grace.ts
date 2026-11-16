/**
 * Re-evaluate monthly policies that were suspended on the month mark, before the
 * 14-day grace that now starts on that due date.
 *
 * Prisma-only (no Nest bootstrap) so it runs on Fly prod images.
 * Status changes are written to entity_status_changes and enqueued on
 * lct_member_sync_targets — the same outcome as EntityStatusChangeService → LctSyncService.
 * INACTIVE → ACTIVE enqueues LCT ACTIVATE. No SMS is sent.
 *
 * Paid-through matches sumConfirmedPaidThroughAsOf: confirmed payments on or before
 * today count, including scheme payments dated before the policy start. Payments
 * dated after today do not count.
 *
 * Due date matches unpaidInstallmentDueDate for cadence 31: the month mark of the
 * first unpaid installment. Overdue 1–14 stays Active (grace). Overdue >14 is
 * Suspended, and 15 days after that suspension date is Inactive.
 *
 * Usage (local):
 *   pnpm --filter @microbima/api remediate:monthly-grace
 *   APPLY=1 pnpm --filter @microbima/api remediate:monthly-grace
 *   SCHEME_NAMES="Blessed Ladies Welfare" APPLY=1 pnpm --filter @microbima/api remediate:monthly-grace
 *
 * Usage (Fly, after deploy):
 *   fly ssh console -a <internal-api-app>
 *   cd /app
 *   APPLY=1 node apps/api/dist/scripts/remediate-monthly-grace.js
 *
 * Required env: DATABASE_URL
 * Dry-run unless APPLY=1.
 * Default cohort: every postpaid scheme whose frequency is MONTHLY (cadence 31).
 * Optional: SCHEME_NAMES (comma-separated; limits the cohort to those schemes)
 *           POLICY_IDS (comma-separated policy uuids)
 *           EXCLUDE_POLICY_NUMBERS (default MP/MFS/004, Stephen Ruru Mutura — do not touch)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  CustomerStatus,
  LctPendingAction,
  PaymentFrequency,
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

/** Matches PAYMENT_CADENCE.MONTHLY and SUSPEND / INACTIVE thresholds. */
const MONTHLY_CADENCE_DAYS = 31;
const SUSPEND_OVERDUE_AFTER_DAYS = 14;
const INACTIVE_AFTER_SUSPENDED_DAYS = 15;

const CONFIRMED: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.COMPLETED_PENDING_RECEIPT,
];

const REMEDIATION_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const LCT_REASON_STATUS_CHANGE = 'STATUS_CHANGE';
const REMEDIATION_KEY = 'monthly_grace_after_month_mark';

const dryRun = process.env.APPLY !== '1';
const schemeNames = (process.env.SCHEME_NAMES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const policyIdFilter = (process.env.POLICY_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
/** Stephen Ruru Mutura, TAIMBA LIMITED. Left out of this remediation on purpose. */
const excludePolicyNumbers = new Set(
  (process.env.EXCLUDE_POLICY_NUMBERS ?? 'MP/MFS/004')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

type Tx = Prisma.TransactionClient;
type MemberStatus = 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'INACTIVE';

function utcDayStart(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 0, 0, 0, 0));
}

function utcDayEnd(y: number, monthIndex0: number, day: number): Date {
  return new Date(Date.UTC(y, monthIndex0, day, 23, 59, 59, 999));
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

function policyStatusFor(disposition: MemberStatus): PolicyStatus {
  if (disposition === 'SUSPENDED') return PolicyStatus.SUSPENDED;
  if (disposition === 'INACTIVE') return PolicyStatus.INACTIVE;
  return PolicyStatus.ACTIVE;
}

/**
 * Same rules as unpaidInstallmentDueDate + grace/suspend/inactive thresholds.
 * Monthly due date is the accrual day of the first unpaid installment.
 */
function classifyMonthly(params: {
  startDate: Date;
  installmentAmount: number;
  paidThroughAsOf: number;
  expectedInstallmentCount: number | null;
  asOfUtc: Date;
}): {
  disposition: MemberStatus;
  nextDue: Date;
  overdue: number;
  arrears: number;
  expectedPremium: number;
  suspendOn: Date | null;
} {
  const start = utcDayStart(
    params.startDate.getUTCFullYear(),
    params.startDate.getUTCMonth(),
    params.startDate.getUTCDate()
  );
  const inclusive =
    utcCalendarDaysBetween(start, params.asOfUtc) + 1;
  let periods = Math.floor(Math.max(0, inclusive) / MONTHLY_CADENCE_DAYS);
  if (
    params.expectedInstallmentCount != null &&
    params.expectedInstallmentCount > 0 &&
    periods > params.expectedInstallmentCount
  ) {
    periods = params.expectedInstallmentCount;
  }
  const expectedPremium = periods * params.installmentAmount;
  const arrears = Math.max(0, expectedPremium - params.paidThroughAsOf);
  const paidPeriods = Math.floor(params.paidThroughAsOf / params.installmentAmount);

  const nextDue =
    arrears > 0
      ? addUtcCalendarDays(start, (paidPeriods + 1) * MONTHLY_CADENCE_DAYS - 1)
      : addUtcCalendarDays(start, (periods + 1) * MONTHLY_CADENCE_DAYS - 1);
  const overdue = arrears > 0 ? Math.max(0, utcCalendarDaysBetween(nextDue, params.asOfUtc)) : 0;

  if (arrears <= 0 || overdue <= 0) {
    return {
      disposition: 'ACTIVE',
      nextDue,
      overdue,
      arrears,
      expectedPremium,
      suspendOn: null,
    };
  }
  if (overdue <= SUSPEND_OVERDUE_AFTER_DAYS) {
    return {
      disposition: 'GRACE',
      nextDue,
      overdue,
      arrears,
      expectedPremium,
      suspendOn: null,
    };
  }

  const suspendOn = addUtcCalendarDays(nextDue, SUSPEND_OVERDUE_AFTER_DAYS + 1);
  const daysSuspended = utcCalendarDaysBetween(suspendOn, params.asOfUtc);
  if (daysSuspended >= INACTIVE_AFTER_SUSPENDED_DAYS) {
    return {
      disposition: 'INACTIVE',
      nextDue,
      overdue,
      arrears,
      expectedPremium,
      suspendOn,
    };
  }
  return {
    disposition: 'SUSPENDED',
    nextDue,
    overdue,
    arrears,
    expectedPremium,
    suspendOn,
  };
}

function lctAction(toStatus: PolicyStatus): LctPendingAction | null {
  if (toStatus === PolicyStatus.ACTIVE) return LctPendingAction.ACTIVATE;
  if (toStatus === PolicyStatus.SUSPENDED) return LctPendingAction.SUSPENDED;
  return null;
}

async function enqueueLct(
  tx: Tx,
  params: { policyId: string; customerId: string; fromStatus: PolicyStatus; toStatus: PolicyStatus }
): Promise<number> {
  const action = lctAction(params.toStatus);
  if (!action) return 0;
  if (params.toStatus === PolicyStatus.ACTIVE && params.fromStatus === PolicyStatus.ACTIVE) return 0;
  if (params.toStatus === PolicyStatus.SUSPENDED && params.fromStatus === PolicyStatus.SUSPENDED) {
    return 0;
  }

  const customer = await tx.customer.findUnique({
    where: { id: params.customerId },
    select: { isTestUser: true },
  });
  if (customer?.isTestUser) return 0;

  const targets = await tx.lctMemberSyncTarget.findMany({
    where: { policyId: params.policyId },
  });

  let queued = 0;
  for (const target of targets) {
    if (target.dependantId) {
      const dep = await tx.dependant.findUnique({
        where: { id: target.dependantId },
        select: { deletedAt: true },
      });
      if (dep?.deletedAt) continue;
    }
    const reason =
      action === LctPendingAction.ACTIVATE && target.lastSentAt == null
        ? 'NEW'
        : LCT_REASON_STATUS_CHANGE;
    const reasons =
      target.pendingAction && target.pendingAction !== action
        ? [reason]
        : Array.from(new Set([...(target.pendingReasons ?? []), reason]));
    await tx.lctMemberSyncTarget.update({
      where: { id: target.id },
      data: {
        pendingAction: action,
        pendingReasons: reasons,
        pendingSince: target.pendingSince ?? new Date(),
      },
    });
    queued += 1;
  }
  return queued;
}

async function syncCustomer(
  tx: Tx,
  customerId: string,
  correlationId: string
): Promise<void> {
  const policies = await tx.policy.findMany({
    where: {
      customerId,
      status: {
        in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_ACTIVATION, PolicyStatus.SUSPENDED],
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
    if (
      customer.status !== CustomerStatus.SUSPENDED &&
      customer.status !== CustomerStatus.DEACTIVATED &&
      customer.status !== CustomerStatus.TERMINATED &&
      customer.status !== CustomerStatus.PENDING_ACTIVATION
    ) {
      nextStatus = CustomerStatus.PENDING_ACTIVATION;
    }
  } else if (hasSuspended) {
    if (customer.status !== CustomerStatus.SUSPENDED) {
      nextStatus = CustomerStatus.SUSPENDED;
    }
  } else if (customer.status !== CustomerStatus.DEACTIVATED) {
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
    data: {
      status: nextStatus,
      deactivatedAt: nextStatus === CustomerStatus.DEACTIVATED ? new Date() : null,
    },
  });
}

async function applyDisposition(
  tx: Tx,
  params: {
    policyId: string;
    customerId: string;
    fromStatus: PolicyStatus;
    disposition: MemberStatus;
    nextDue: Date;
    overdue: number;
    arrears: number;
    expectedPremium: number;
    suspendOn: Date | null;
    correlationId: string;
    asOfUtc: Date;
  }
): Promise<number> {
  const toStatus = policyStatusFor(params.disposition);
  const inGrace = params.disposition === 'GRACE';
  const reason =
    toStatus === PolicyStatus.ACTIVE
      ? `Remediate monthly cadence: month-mark due ${params.nextDue.toISOString().slice(0, 10)}; overdue ${params.overdue} day(s); restoring Active`
      : `Remediate monthly cadence: overdue ${params.overdue} days after month mark; set ${toStatus}`;

  await tx.entityStatusChange.create({
    data: {
      entityType: StatusChangeEntityType.POLICY,
      customerId: params.customerId,
      policyId: params.policyId,
      fromStatus: params.fromStatus,
      toStatus,
      reason,
      trigger: StatusChangeTrigger.SYSTEM,
      changedBy: REMEDIATION_ACTOR_ID,
      correlationId: params.correlationId,
      metadata: {
        remediation: REMEDIATION_KEY,
        overdueDays: params.overdue,
        arrears: params.arrears,
        expectedPremium: params.expectedPremium,
        anchorDueDate: params.nextDue.toISOString(),
        inGrace,
      },
    },
  });

  const lctQueued = await enqueueLct(tx, {
    policyId: params.policyId,
    customerId: params.customerId,
    fromStatus: params.fromStatus,
    toStatus,
  });

  if (inGrace) {
    await tx.entityStatusChange.create({
      data: {
        entityType: StatusChangeEntityType.POLICY,
        customerId: params.customerId,
        policyId: params.policyId,
        fromStatus: PolicyStatus.ACTIVE,
        toStatus: 'ACTIVE_GRACE',
        reason: `Premium overdue ${params.overdue} day(s); entered grace`,
        trigger: StatusChangeTrigger.SYSTEM,
        changedBy: REMEDIATION_ACTOR_ID,
        correlationId: params.correlationId,
        metadata: {
          remediation: REMEDIATION_KEY,
          overdueDays: params.overdue,
          arrears: params.arrears,
          anchorDueDate: params.nextDue.toISOString(),
        },
      },
    });
  }

  await tx.policy.update({
    where: { id: params.policyId },
    data:
      toStatus === PolicyStatus.ACTIVE
        ? {
            status: PolicyStatus.ACTIVE,
            suspendedAt: null,
            inactivatedAt: null,
            inGracePeriod: inGrace,
            graceEnteredAt: inGrace ? params.asOfUtc : null,
            overdueAnchorDueDate: inGrace ? params.nextDue : null,
            deactivatedAt: null,
          }
        : toStatus === PolicyStatus.SUSPENDED
          ? {
              status: PolicyStatus.SUSPENDED,
              suspendedAt: params.suspendOn ?? params.asOfUtc,
              inactivatedAt: null,
              inGracePeriod: false,
              graceEnteredAt: null,
              overdueAnchorDueDate: null,
            }
          : {
              status: PolicyStatus.INACTIVE,
              inactivatedAt: params.asOfUtc,
              suspendedAt: null,
              inGracePeriod: false,
              graceEnteredAt: null,
              overdueAnchorDueDate: null,
            },
  });

  await syncCustomer(tx, params.customerId, params.correlationId);
  return lctQueued;
}

async function main(): Promise<void> {
  console.log(`Remediate monthly grace (${dryRun ? 'DRY_RUN' : 'APPLY'})`);
  console.log(
    schemeNames.length
      ? `Schemes: ${schemeNames.join(', ')}`
      : 'Schemes: all postpaid MONTHLY'
  );
  console.log(`Excluded policy numbers: ${[...excludePolicyNumbers].join(', ') || '(none)'}`);
  if (policyIdFilter.length) {
    console.log(`POLICY_IDS filter: ${policyIdFilter.join(', ')}`);
  }

  const asOfUtc = new Date();
  const asOfEnd = utcDayEnd(asOfUtc.getUTCFullYear(), asOfUtc.getUTCMonth(), asOfUtc.getUTCDate());
  const correlationId = `remediate-monthly-grace-${asOfUtc.toISOString()}`;

  try {
    const schemes = await prisma.scheme.findMany({
      where: {
        isPostpaid: true,
        frequency: PaymentFrequency.MONTHLY,
        ...(schemeNames.length
          ? {
              OR: schemeNames.map((name) => ({
                schemeName: { equals: name, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
      select: {
        schemeName: true,
        packageSchemes: {
          select: {
            packageId: true,
            packageSchemeCustomers: { select: { customerId: true } },
          },
        },
      },
    });

    if (schemes.length === 0) {
      throw new Error(
        schemeNames.length
          ? `No postpaid monthly schemes matched: ${schemeNames.join(', ')}`
          : 'No postpaid monthly schemes found'
      );
    }
    console.log(`Matched schemes: ${schemes.map((s) => s.schemeName).join(', ')}`);

    const packageIds = new Set<number>();
    const customerIds = new Set<string>();
    const schemeByCustomerPackage = new Map<string, string>();
    for (const scheme of schemes) {
      for (const ps of scheme.packageSchemes) {
        packageIds.add(ps.packageId);
        for (const link of ps.packageSchemeCustomers) {
          customerIds.add(link.customerId);
          schemeByCustomerPackage.set(`${link.customerId}:${ps.packageId}`, scheme.schemeName);
        }
      }
    }

    const policies = await prisma.policy.findMany({
      where: {
        paymentCadence: MONTHLY_CADENCE_DAYS,
        frequency: PaymentFrequency.MONTHLY,
        status: { in: [PolicyStatus.SUSPENDED, PolicyStatus.INACTIVE] },
        premium: { gt: 0 },
        startDate: { not: null },
        packageId: { in: [...packageIds] },
        customerId: { in: [...customerIds] },
        ...(policyIdFilter.length ? { id: { in: policyIdFilter } } : {}),
      },
      select: {
        id: true,
        policyNumber: true,
        customerId: true,
        packageId: true,
        status: true,
        premium: true,
        startDate: true,
        endDate: true,
        expectedInstallmentCount: true,
        customer: { select: { status: true, isTestUser: true } },
        policyPayments: {
          where: { detachedAt: null },
          select: { amount: true, paymentStatus: true, expectedPaymentDate: true },
        },
      },
      orderBy: { policyNumber: 'asc' },
    });

    let activated = 0;
    let graced = 0;
    let suspended = 0;
    let inactivated = 0;
    let leftInactive = 0;
    let skipped = 0;
    let lctTargets = 0;

    for (const policy of policies) {
      const schemeName =
        schemeByCustomerPackage.get(`${policy.customerId}:${policy.packageId}`) ?? '—';
      if (policy.policyNumber && excludePolicyNumbers.has(policy.policyNumber)) {
        console.log(
          JSON.stringify({
            policyNumber: policy.policyNumber,
            schemeName,
            action: 'skip_excluded',
            currentStatus: policy.status,
          })
        );
        skipped += 1;
        continue;
      }
      if (!policy.startDate) {
        skipped += 1;
        continue;
      }
      if (policy.endDate && asOfUtc.getTime() >= policy.endDate.getTime()) {
        console.log(
          JSON.stringify({
            policyNumber: policy.policyNumber,
            schemeName,
            action: 'skip_end_date_passed',
            currentStatus: policy.status,
          })
        );
        skipped += 1;
        continue;
      }

      const autoSuspended = await prisma.entityStatusChange.findFirst({
        where: {
          policyId: policy.id,
          toStatus: PolicyStatus.SUSPENDED,
          reason: { startsWith: 'Premium overdue' },
        },
        select: { id: true },
      });
      if (!autoSuspended) {
        console.log(
          JSON.stringify({
            policyNumber: policy.policyNumber,
            schemeName,
            action: 'skip_not_auto_suspended',
            currentStatus: policy.status,
          })
        );
        skipped += 1;
        continue;
      }

      const installmentAmount = Number(policy.premium);
      const paidThroughAsOf = policy.policyPayments
        .filter(
          (pm) => CONFIRMED.includes(pm.paymentStatus) && pm.expectedPaymentDate <= asOfEnd
        )
        .reduce((sum, pm) => sum + Number(pm.amount), 0);

      const math = classifyMonthly({
        startDate: policy.startDate,
        installmentAmount,
        paidThroughAsOf,
        expectedInstallmentCount: policy.expectedInstallmentCount,
        asOfUtc,
      });
      const targetStatus = policyStatusFor(math.disposition);
      const action =
        targetStatus === policy.status
          ? 'unchanged'
          : math.disposition === 'GRACE'
            ? 'activate_grace'
            : math.disposition === 'ACTIVE'
              ? 'activate'
              : math.disposition === 'SUSPENDED'
                ? 'suspend'
                : 'inactivate';

      const targetCount = await prisma.lctMemberSyncTarget.count({
        where: { policyId: policy.id },
      });

      console.log(
        JSON.stringify({
          schemeName,
          policyNumber: policy.policyNumber,
          policyId: policy.id,
          currentStatus: policy.status,
          customerStatus: policy.customer.status,
          disposition: math.disposition,
          action,
          paidThroughAsOf,
          expectedPremium: math.expectedPremium,
          arrears: Math.round(math.arrears * 100) / 100,
          nextDue: math.nextDue.toISOString().slice(0, 10),
          overdueDays: math.overdue,
          lctTargets: targetCount,
          isTestUser: policy.customer.isTestUser,
        })
      );

      if (action === 'unchanged') {
        if (policy.status === PolicyStatus.INACTIVE) leftInactive += 1;
        continue;
      }

      if (dryRun) {
        if (action === 'activate') activated += 1;
        else if (action === 'activate_grace') graced += 1;
        else if (action === 'suspend') suspended += 1;
        else if (action === 'inactivate') inactivated += 1;
        if (!policy.customer.isTestUser && action !== 'inactivate') lctTargets += targetCount;
        continue;
      }

      const queued = await prisma.$transaction((tx) =>
        applyDisposition(tx, {
          policyId: policy.id,
          customerId: policy.customerId,
          fromStatus: policy.status,
          disposition: math.disposition,
          nextDue: math.nextDue,
          overdue: math.overdue,
          arrears: math.arrears,
          expectedPremium: math.expectedPremium,
          suspendOn: math.suspendOn,
          correlationId,
          asOfUtc,
        })
      );
      lctTargets += queued;
      if (action === 'activate') activated += 1;
      else if (action === 'activate_grace') graced += 1;
      else if (action === 'suspend') suspended += 1;
      else if (action === 'inactivate') inactivated += 1;
    }

    console.log(
      JSON.stringify({
        dryRun,
        policies: policies.length,
        activated,
        graced,
        suspended,
        inactivated,
        leftInactive,
        skipped,
        lctTargets,
        correlationId,
      })
    );
    if (dryRun) {
      console.log('Dry run only. Re-run with APPLY=1 to persist changes and enqueue LCT.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
