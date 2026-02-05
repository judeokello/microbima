/**
 * Seed test data for STK Push periodic jobs (T042 expiration, T043 missing IPN).
 * Run from apps/api: npx ts-node -r dotenv/config scripts/seed-stk-job-test-data.ts
 * Or: pnpm exec ts-node -r dotenv/config scripts/seed-stk-job-test-data.ts
 *
 * Creates:
 * - T042: 2x PENDING requests with initiatedAt in the past (will be marked EXPIRED by job).
 * - T043: 2x COMPLETED requests with completedAt > 24h ago and no linked IPN (will be reported by missing-IPN job).
 *
 * Prints created IDs so you can verify via GET /internal/mpesa/stk-push/requests/:id after running jobs.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const NOW = new Date();

// T042: PENDING with initiatedAt 10 minutes ago (older than default 5-min timeout)
const T042_INITIATED_AT = new Date(NOW);
T042_INITIATED_AT.setUTCMinutes(T042_INITIATED_AT.getUTCMinutes() - 10);

// T043: COMPLETED with completedAt 25 hours ago (no IPN within 24h)
const T043_COMPLETED_AT = new Date(NOW);
T043_COMPLETED_AT.setUTCHours(T043_COMPLETED_AT.getUTCHours() - 25);
const T043_INITIATED_AT = new Date(T043_COMPLETED_AT);
T043_INITIATED_AT.setUTCMinutes(T043_INITIATED_AT.getUTCMinutes() - 5);

async function main() {
  const t042Ids: string[] = [];
  const t043Ids: string[] = [];

  // T042: Create 2 PENDING requests (will be expired by run-expiration job)
  for (let i = 1; i <= 2; i++) {
    const req = await prisma.mpesaStkPushRequest.create({
      data: {
        checkoutRequestId: `TEST-T042-${Date.now()}-${i}`,
        phoneNumber: '254722000000',
        amount: 100,
        accountReference: `TEST-POL-T042-${i}`,
        transactionDesc: `Test T042 expiration seed ${i}`,
        status: 'PENDING',
        initiatedAt: T042_INITIATED_AT,
      },
    });
    t042Ids.push(req.id);
  }

  // T043: Create 2 COMPLETED requests with completedAt > 24h ago, no linked IPN
  for (let i = 1; i <= 2; i++) {
    const req = await prisma.mpesaStkPushRequest.create({
      data: {
        checkoutRequestId: `TEST-T043-${Date.now()}-${i}`,
        phoneNumber: '254733000000',
        amount: 200,
        accountReference: `TEST-POL-T043-${i}`,
        transactionDesc: `Test T043 missing-IPN seed ${i}`,
        status: 'COMPLETED',
        resultCode: '0',
        resultDesc: 'Success',
        initiatedAt: T043_INITIATED_AT,
        completedAt: T043_COMPLETED_AT,
        linkedTransactionId: null,
      },
    });
    t043Ids.push(req.id);
  }

  console.log('Created STK Push test records. Use these IDs to verify via GET /internal/mpesa/stk-push/requests/:id\n');
  console.log('T042 (expiration job): PENDING requests with old initiatedAt – run POST .../jobs/run-expiration, then GET .../requests/:id to confirm status=EXPIRED');
  console.log('Created T042 IDs:', t042Ids.join(', '));
  console.log('');
  console.log('T043 (missing-IPN job): COMPLETED requests with no IPN within 24h – run POST .../jobs/run-missing-ipn-check, then check logs and GET .../jobs/debug?type=missing-ipn');
  console.log('Created T043 IDs:', t043Ids.join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
