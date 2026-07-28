/**
 * Remediate policies where Policy.premium was stored as a daily rate instead of
 * installment (daily × paymentCadence) for non-daily frequencies.
 *
 * For each matching policy:
 *   1. Set premium = premium × paymentCadence
 *   2. Recompute Correct Status (arrears/overdue with corrected installment)
 *   3. If status mismatches, call PolicyLifecycleService.remediateStatusWithoutPaymentGate
 *      (EntityStatusChange → LCT; no paid >= expected+2w gate; no SMS)
 *
 * Usage:
 *   DRY_RUN=1 pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *   pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *   POLICY_IDS=<uuid>,<uuid> DRY_RUN=1 pnpm --filter @microbima/api remediate:daily-premium-as-installment
 *
 * Required env: DATABASE_URL (and other AppModule secrets when not DRY_RUN Nest bootstrap).
 * DRY_RUN defaults to on unless APPLY=1 is set (safer default).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import {
  PaymentStatus,
  PolicyStatus,
  Prisma,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PolicyLifecycleService } from '../src/services/policy-lifecycle.service';
import {
  computeExpectedPremiumThroughAsOf,
  computePremiumDueAndExcess,
  utcDayStart,
} from '../src/utils/premium-statement-math';
import { addUtcCalendarDays } from '../src/utils/installment-backfill.util';
import { daysOverdue } from '../src/utils/policy-due-date.util';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

/** Known daily rates from agent-registration public/insurance-pricing.json (± spouse). */
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

const dryRun = process.env.APPLY !== '1' && process.env.DRY_RUN !== '0';
const policyIdFilter = (process.env.POLICY_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type CorrectStatus = 'ACTIVE' | 'SUSPENDED';

function computeCorrectStatus(params: {
  startDate: Date;
  paymentCadence: number;
  installmentAmount: number;
  totalPaid: number;
  asOfUtc: Date;
}): { correctStatus: CorrectStatus; correctExpected: number; correctArrears: number; overdueDays: number } {
  const { startDate, paymentCadence, installmentAmount, totalPaid, asOfUtc } = params;
  const { expectedPremium } = computeExpectedPremiumThroughAsOf({
    policyStart: startDate,
    statementGenerationUtc: asOfUtc,
    paymentCadenceDays: paymentCadence,
    installmentAmount,
  });
  const { premiumDue } = computePremiumDueAndExcess(expectedPremium, totalPaid);
  const paidPeriods =
    installmentAmount > 0 ? Math.floor(totalPaid / installmentAmount) : 0;

  let overdueDays = 0;
  if (premiumDue > 0) {
    const start = utcDayStart(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    );
    const nextDue = addUtcCalendarDays(start, paidPeriods * paymentCadence);
    overdueDays = daysOverdue({ nextUnpaidDueDate: nextDue, asOfUtc });
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

async function main(): Promise<void> {
  console.log(`Remediate daily-as-installment premium (${dryRun ? 'DRY_RUN' : 'APPLY'})`);
  if (policyIdFilter.length) {
    console.log(`POLICY_IDS filter: ${policyIdFilter.join(', ')}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const lifecycle = app.get(PolicyLifecycleService);
    const asOfUtc = new Date();
    const correlationId = `remediate-daily-premium-${asOfUtc.toISOString()}`;

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
        customer: { select: { firstName: true, lastName: true } },
        policyPayments: {
          where: { detachedAt: null },
          select: {
            amount: true,
            paymentStatus: true,
            expectedPaymentDate: true,
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
      const newPremium =
        Math.round(oldPremium * policy.paymentCadence * 100) / 100;
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

      await prisma.policy.update({
        where: { id: policy.id },
        data: { premium: new Prisma.Decimal(newPremium.toFixed(2)) },
      });
      premiumFixed += 1;

      if (statusAction === 'activate') {
        await lifecycle.remediateStatusWithoutPaymentGate({
          policyId: policy.id,
          toStatus: PolicyStatus.ACTIVE,
          reason:
            'Remediate: daily rate stored as installment; false suspension (no payment gate)',
          correlationId,
        });
        activated += 1;
      } else if (statusAction === 'suspend') {
        await lifecycle.remediateStatusWithoutPaymentGate({
          policyId: policy.id,
          toStatus: PolicyStatus.SUSPENDED,
          reason:
            'Remediate: underpaid vs corrected installment after daily×cadence fix',
          correlationId,
        });
        suspended += 1;
      } else if (statusAction === 'premium_only_closed') {
        skippedClosed += 1;
      } else {
        premiumOnly += 1;
      }
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
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
