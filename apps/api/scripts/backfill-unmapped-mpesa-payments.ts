/**
 * Work item B — Backfill unmapped M-Pesa report items onto existing policies as policy_payments.
 *
 * Finds policies where `paymentAcNumber` matches `mpesa_payment_report_items.accountNumber`
 * (normalized) and the item's `transactionReference` is not yet in `policy_payments`.
 * Creates COMPLETED MPESA policy_payments and sets isMapped/isProcessed on the items.
 *
 * Mirrors PolicyService.mapUnmappedMpesaItemsToPolicy (registration-time A / recovery).
 * Does **not** call activatePolicy (Nest DI). If a policy remains PENDING_ACTIVATION after
 * mapping, the script logs a warning — activate via app/recovery if needed.
 *
 * ── Recommended rollout ──
 *
 *   1. Preview targets:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:unmapped-mpesa-payments
 *
 *   2. Dry-run one customer (from Query 5 / C investigation):
 *        DRY_RUN=1 CUSTOMER_IDS=<uuid> pnpm --filter @microbima/api backfill:unmapped-mpesa-payments
 *
 *   3. Apply one customer:
 *        CUSTOMER_IDS=<uuid> pnpm --filter @microbima/api backfill:unmapped-mpesa-payments
 *
 *   4. Batch:
 *        LIMIT=10 pnpm --filter @microbima/api backfill:unmapped-mpesa-payments
 *
 * ── On Fly (after deploy; DATABASE_URL present) ──
 *
 *   fly ssh console -a <internal-api-app>
 *   LIST_ONLY=1 node apps/api/dist/scripts/backfill-unmapped-mpesa-payments.js
 *   DRY_RUN=1 CUSTOMER_IDS=<uuid> node apps/api/dist/scripts/backfill-unmapped-mpesa-payments.js
 *   CUSTOMER_IDS=<uuid> node apps/api/dist/scripts/backfill-unmapped-mpesa-payments.js
 *
 * Required env: DATABASE_URL
 *
 * Optional env:
 *   DRY_RUN=1              — log actions only; no writes
 *   LIST_ONLY=1            — print target policies + missing receipt counts; exit
 *   CUSTOMER_IDS=a,b,c     — only these customer UUIDs
 *   POLICY_IDS=a,b,c       — only these policy UUIDs
 *   LIMIT=n                — max policies to process
 *   SOURCE=IPN             — filter report items by source (default IPN; use ALL for any)
 *   CORRELATION_PREFIX=x   — default backfill-unmapped-mpesa
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const dryRun = process.env.DRY_RUN === '1';
const listOnly = process.env.LIST_ONLY === '1';
const limit = process.env.LIMIT ? Math.max(1, parseInt(process.env.LIMIT, 10)) : undefined;
const correlationPrefix = process.env.CORRELATION_PREFIX ?? 'backfill-unmapped-mpesa';
const sourceFilter = (process.env.SOURCE ?? 'IPN').trim().toUpperCase();
const customerIdsFilter = process.env.CUSTOMER_IDS
  ? process.env.CUSTOMER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;
const policyIdsFilter = process.env.POLICY_IDS
  ? process.env.POLICY_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

function normalizeAccountNumber(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s/g, '');
}

type TargetPolicy = {
  policyId: string;
  customerId: string;
  paymentAcNumber: string;
  status: string;
  customerName: string;
  idNumber: string;
  missingCount: number;
};

type MissingItem = {
  id: string;
  transactionReference: string;
  paidIn: Prisma.Decimal | number;
  completionTime: Date;
  accountNumber: string | null;
  isMapped: boolean;
  isProcessed: boolean;
};

async function findTargetPolicies(): Promise<TargetPolicy[]> {
  type Row = {
    policy_id: string;
    customer_id: string;
    payment_ac_number: string;
    status: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    id_number: string;
    missing_count: bigint;
  };

  const sourceClause =
    sourceFilter === 'ALL'
      ? Prisma.sql``
      : Prisma.sql`AND i.source::text = ${sourceFilter}`;

  const customerClause = customerIdsFilter?.length
    ? Prisma.sql`AND p."customerId" IN (${Prisma.join(customerIdsFilter)})`
    : Prisma.sql``;

  const policyClause = policyIdsFilter?.length
    ? Prisma.sql`AND p.id IN (${Prisma.join(policyIdsFilter)})`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p.id AS policy_id,
      p."customerId" AS customer_id,
      p."paymentAcNumber" AS payment_ac_number,
      p.status::text AS status,
      c."firstName" AS first_name,
      c."middleName" AS middle_name,
      c."lastName" AS last_name,
      c."idNumber" AS id_number,
      COUNT(DISTINCT i."transactionReference")::bigint AS missing_count
    FROM policies p
    INNER JOIN customers c ON c.id = p."customerId"
    INNER JOIN mpesa_payment_report_items i
      ON REPLACE(TRIM(COALESCE(i."accountNumber", '')), ' ', '')
       = REPLACE(TRIM(COALESCE(p."paymentAcNumber", '')), ' ', '')
     AND i."paidIn" > 0
     AND i."transactionReference" IS NOT NULL
     AND i."completionTime" IS NOT NULL
     ${sourceClause}
    LEFT JOIN policy_payments pp ON pp."transactionReference" = i."transactionReference"
    WHERE p."paymentAcNumber" IS NOT NULL
      AND NULLIF(REPLACE(TRIM(COALESCE(p."paymentAcNumber", '')), ' ', ''), '') IS NOT NULL
      AND pp.id IS NULL
      ${customerClause}
      ${policyClause}
    GROUP BY
      p.id, p."customerId", p."paymentAcNumber", p.status,
      c."firstName", c."middleName", c."lastName", c."idNumber"
    HAVING COUNT(DISTINCT i."transactionReference") > 0
    ORDER BY COUNT(DISTINCT i."transactionReference") DESC, p.id
  `;

  let targets = rows.map((r) => ({
    policyId: r.policy_id,
    customerId: r.customer_id,
    paymentAcNumber: r.payment_ac_number,
    status: r.status,
    customerName: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
    idNumber: r.id_number,
    missingCount: Number(r.missing_count),
  }));

  if (limit != null) {
    targets = targets.slice(0, limit);
  }

  return targets;
}

async function loadMissingItems(paymentAcNumber: string): Promise<MissingItem[]> {
  const normalized = normalizeAccountNumber(paymentAcNumber);
  const sourceClause =
    sourceFilter === 'ALL'
      ? Prisma.sql``
      : Prisma.sql`AND i.source::text = ${sourceFilter}`;

  return prisma.$queryRaw<MissingItem[]>`
    SELECT
      i.id,
      i."transactionReference",
      i."paidIn",
      i."completionTime",
      i."accountNumber",
      i."isMapped",
      i."isProcessed"
    FROM mpesa_payment_report_items i
    LEFT JOIN policy_payments pp ON pp."transactionReference" = i."transactionReference"
    WHERE i."paidIn" > 0
      AND i."transactionReference" IS NOT NULL
      AND i."completionTime" IS NOT NULL
      AND REPLACE(TRIM(COALESCE(i."accountNumber", '')), ' ', '') = ${normalized}
      AND pp.id IS NULL
      ${sourceClause}
    ORDER BY i."completionTime" ASC
  `;
}

async function mapPolicy(
  target: TargetPolicy,
  correlationId: string
): Promise<{ mappedCount: number; skippedDuplicate: number }> {
  const items = await loadMissingItems(target.paymentAcNumber);
  const seenRefs = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seenRefs.has(item.transactionReference)) return false;
    seenRefs.add(item.transactionReference);
    return true;
  });

  if (uniqueItems.length === 0) {
    console.log(`[${correlationId}] No missing items for policy ${target.policyId}`);
    return { mappedCount: 0, skippedDuplicate: 0 };
  }

  if (dryRun) {
    console.log(
      `[${correlationId}] DRY_RUN would map ${uniqueItems.length} payment(s) to policy ${target.policyId} (${target.customerName})`
    );
    for (const item of uniqueItems.slice(0, 5)) {
      console.log(
        `  - ${item.transactionReference} amount=${Number(item.paidIn)} at ${item.completionTime.toISOString()}`
      );
    }
    if (uniqueItems.length > 5) {
      console.log(`  ... and ${uniqueItems.length - 5} more`);
    }
    return { mappedCount: uniqueItems.length, skippedDuplicate: 0 };
  }

  let mappedCount = 0;
  let skippedDuplicate = 0;

  await prisma.$transaction(async (tx) => {
    const refs = uniqueItems.map((i) => i.transactionReference);
    const existing = await tx.policyPayment.findMany({
      where: { transactionReference: { in: refs } },
      select: { transactionReference: true },
    });
    const existingRefs = new Set(existing.map((p) => p.transactionReference));

    for (const item of uniqueItems) {
      if (existingRefs.has(item.transactionReference)) {
        skippedDuplicate++;
        if (!item.isMapped || !item.isProcessed) {
          await tx.mpesaPaymentReportItem.update({
            where: { id: item.id },
            data: { isProcessed: true, isMapped: true },
          });
        }
        continue;
      }

      await tx.policyPayment.create({
        data: {
          policyId: target.policyId,
          paymentType: 'MPESA',
          transactionReference: item.transactionReference,
          amount: Number(item.paidIn),
          accountNumber: item.accountNumber ?? null,
          expectedPaymentDate: item.completionTime,
          actualPaymentDate: item.completionTime,
          details: 'Mapped from historical M-Pesa payment (backfill B)',
          paymentStatus: 'COMPLETED',
        },
      });
      existingRefs.add(item.transactionReference);
      mappedCount++;

      await tx.mpesaPaymentReportItem.update({
        where: { id: item.id },
        data: { isProcessed: true, isMapped: true },
      });
    }
  });

  console.log(
    `[${correlationId}] Mapped ${mappedCount} payment(s) to policy ${target.policyId} (${target.customerName}); skippedDuplicates=${skippedDuplicate}`
  );

  if (target.status === 'PENDING_ACTIVATION' && mappedCount > 0) {
    console.warn(
      `[${correlationId}] WARN: policy ${target.policyId} is still PENDING_ACTIVATION — activate via app if appropriate (script does not call activatePolicy)`
    );
  }

  return { mappedCount, skippedDuplicate };
}

async function main(): Promise<void> {
  console.log(
    JSON.stringify({
      event: 'BACKFILL_UNMAPPED_MPESA_START',
      dryRun,
      listOnly,
      sourceFilter,
      limit: limit ?? null,
      customerIds: customerIdsFilter ?? null,
      policyIds: policyIdsFilter ?? null,
    })
  );

  const targets = await findTargetPolicies();
  const totalMissing = targets.reduce((sum, t) => sum + t.missingCount, 0);

  console.log(
    `Found ${targets.length} policy(ies) with ${totalMissing} missing M-Pesa receipt(s) (source=${sourceFilter})`
  );

  if (listOnly) {
    for (const t of targets) {
      console.log(
        [
          t.policyId,
          t.customerId,
          t.status,
          t.missingCount,
          t.paymentAcNumber,
          t.idNumber,
          t.customerName,
        ].join('\t')
      );
    }
    return;
  }

  let policiesProcessed = 0;
  let totalMapped = 0;
  let totalSkipped = 0;
  let errors = 0;

  for (const target of targets) {
    const correlationId = `${correlationPrefix}-${target.policyId.slice(0, 8)}`;
    try {
      const result = await mapPolicy(target, correlationId);
      policiesProcessed++;
      totalMapped += result.mappedCount;
      totalSkipped += result.skippedDuplicate;
    } catch (err) {
      errors++;
      console.error(
        `[${correlationId}] ERROR policy ${target.policyId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  console.log(
    JSON.stringify({
      event: 'BACKFILL_UNMAPPED_MPESA_DONE',
      dryRun,
      policiesProcessed,
      totalMapped,
      totalSkipped,
      errors,
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
