/**
 * ONE-OFF — Reprocess 20 SITI Mobility B2B IPN rows that failed on empty MSISDN.
 *
 * These Organization-to-Organization transfers arrived with MSISDN="" and were
 * left as blob-only rows (`isProcessed=false`). After deploying the empty-MSISDN
 * fix, run this script once in production, then delete it.
 *
 * Hardcoded cohort (do not generalize): the 20 ids/TransIDs/messageBlobs below.
 *
 * ── Local / CI ──
 *
 *   LIST_ONLY=1 pnpm --filter @microbima/api reprocess:siti-empty-msisdn-ipns
 *   DRY_RUN=1   pnpm --filter @microbima/api reprocess:siti-empty-msisdn-ipns
 *               pnpm --filter @microbima/api reprocess:siti-empty-msisdn-ipns
 *
 * ── On Fly (after empty-MSISDN fix is deployed; DATABASE_URL present) ──
 *
 *   fly ssh console -a <internal-api-app>
 *   LIST_ONLY=1 node apps/api/dist/scripts/reprocess-siti-empty-msisdn-ipns.js
 *   DRY_RUN=1   node apps/api/dist/scripts/reprocess-siti-empty-msisdn-ipns.js
 *               node apps/api/dist/scripts/reprocess-siti-empty-msisdn-ipns.js
 *
 * Required env: DATABASE_URL
 *
 * Optional env:
 *   DRY_RUN=1   — log intended updates only; no writes
 *   LIST_ONLY=1 — print the 20 hardcoded rows + current DB status; exit
 *
 * Notes:
 *   - Reuses existing mpesa_payment_report_items rows (does not insert duplicates).
 *   - Creates policy_payments when BillRefNumber matches a policy.paymentAcNumber.
 *   - Does NOT call activatePolicy (same as backfill-unmapped-mpesa-payments).
 *     If a matched policy is PENDING_ACTIVATION, the script warns.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import {
  MpesaPaymentSource,
  MpesaStatementReasonType,
  PrismaClient,
} from '@prisma/client';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const dryRun = process.env.DRY_RUN === '1';
const listOnly = process.env.LIST_ONLY === '1';

type HardcodedIpn = {
  id: string;
  transactionReference: string;
  messageBlob: string;
};

type IpnPayload = {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
};

/** Hardcoded SITI Mobility B2B IPNs that failed empty-MSISDN validation. */
const SITI_IPN_ROWS: HardcodedIpn[] = [
  {
    id: '92b46830-656a-4f0f-ad91-55c13ac876ed',
    transactionReference: 'UH4SP1L7W6',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UH4SP1L7W6","TransTime":"20260804091330","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"155599.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'a1bf83f5-8b1e-4f66-87e3-f752f4d6a82e',
    transactionReference: 'UH3SP1KV1N',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UH3SP1KV1N","TransTime":"20260803225941","TransAmount":"10.00","BusinessShortCode":"4125223","BillRefNumber":"21960760","InvoiceNumber":"OK","OrgAccountBalance":"155732.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '01d0e2da-637f-4af7-9a9b-76013d6dffe9',
    transactionReference: 'UH3SP1KAF6',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UH3SP1KAF6","TransTime":"20260803152952","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"150592.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '4579e7e5-fa46-40c4-bed7-f19259eaf01a',
    transactionReference: 'UH2SP1IDBZ',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UH2SP1IDBZ","TransTime":"20260802100257","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"133358.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '4cad0f5d-7f2e-4d4c-81fb-fd74497da37a',
    transactionReference: 'UH1SP1GZLF',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UH1SP1GZLF","TransTime":"20260801120559","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"121289.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '81922176-388b-4bfd-927f-0ec3878c8b21',
    transactionReference: 'UGVSP1EXYV',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGVSP1EXYV","TransTime":"20260731115751","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"103680.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'e8fa7f61-21ac-4c25-8140-5132fe42c4d7',
    transactionReference: 'UGUSP1D7AT',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGUSP1D7AT","TransTime":"20260730105501","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"90673.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '39d47f86-3aed-4109-a76d-281040970aba',
    transactionReference: 'UGTSP1BZDG',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGTSP1BZDG","TransTime":"20260729134303","TransAmount":"500.00","BusinessShortCode":"4125223","BillRefNumber":"22153443","InvoiceNumber":"OK","OrgAccountBalance":"74803.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'f0a458ed-2efe-414a-a190-f157d1e15321',
    transactionReference: 'UGTSP1BXIY',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGTSP1BXIY","TransTime":"20260729125442","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"73942.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'f1bf3cc9-c323-4897-bfc6-9e61287e1c70',
    transactionReference: 'UGSSP1A0MC',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGSSP1A0MC","TransTime":"20260728100427","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"42091.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '624f00c0-08af-4de5-a4ce-d64660a9b6fa',
    transactionReference: 'UGRSP186NY',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGRSP186NY","TransTime":"20260727073122","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"46889.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'b3ad019a-dbc9-4b3b-b18f-445248ca5f81',
    transactionReference: 'UGQSP17IXR',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGQSP17IXR","TransTime":"20260726170219","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"41801.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'c0a8db62-e92b-44e8-b94b-b19397549459',
    transactionReference: 'UGPSP15ZHR',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGPSP15ZHR","TransTime":"20260725170317","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"42018.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '9ad612ae-5594-4c85-9666-e4fc640e22e0',
    transactionReference: 'UGPSP15FWY',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGPSP15FWY","TransTime":"20260725101831","TransAmount":"300.00","BusinessShortCode":"4125223","BillRefNumber":"22153443","InvoiceNumber":"OK","OrgAccountBalance":"36924.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '58448f78-5c64-48ec-b08e-cacbfdcc72ec',
    transactionReference: 'UGOSP1435J',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGOSP1435J","TransTime":"20260724121106","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"24785.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'c1f8ad22-f906-45f0-abe8-155162724d5e',
    transactionReference: 'UGNSP12W9V',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGNSP12W9V","TransTime":"20260723174240","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"19338.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'd9f083a8-5cbc-4816-a8a4-56e65780b070',
    transactionReference: 'UGLSP0ZDEH',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGLSP0ZDEH","TransTime":"20260721121837","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"46286.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: 'ade0130c-e86d-43e3-9f48-018256adab05',
    transactionReference: 'UGKSP0XSWA',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGKSP0XSWA","TransTime":"20260720142115","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"36218.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '05479ebf-f7eb-462a-9bdf-63960cd92024',
    transactionReference: 'UGKSP0XMCG',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGKSP0XMCG","TransTime":"20260720102825","TransAmount":"137.00","BusinessShortCode":"4125223","BillRefNumber":"22153443","InvoiceNumber":"OK","OrgAccountBalance":"31050.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
  {
    id: '1f767271-caf6-4dab-aaac-caf302ed863a',
    transactionReference: 'UGJSP0WANG',
    messageBlob:
      '{"TransactionType":"Organization To Organization Transfer","TransID":"UGJSP0WANG","TransTime":"20260719132751","TransAmount":"152.00","BusinessShortCode":"4125223","BillRefNumber":"22841047","InvoiceNumber":"OK","OrgAccountBalance":"23698.00","ThirdPartyTransID":"","MSISDN":"","FirstName":"SITI MOBILITY TECHNOLOGIES LIMITED B2C"}',
  },
];

function parsePayload(messageBlob: string): IpnPayload {
  const payload = JSON.parse(messageBlob) as IpnPayload;
  if (!payload.TransID || !payload.TransAmount || !payload.TransTime) {
    throw new Error('messageBlob missing TransID, TransAmount, or TransTime');
  }
  return payload;
}

/** M-Pesa TransTime YYYYMMDDHHmmss → UTC Date (mirrors MpesaIpnService). */
function parseTransactionTime(transTime: string): Date {
  if (transTime.length !== 14) {
    return new Date();
  }
  const year = parseInt(transTime.substring(0, 4), 10);
  const month = parseInt(transTime.substring(4, 6), 10) - 1;
  const day = parseInt(transTime.substring(6, 8), 10);
  const hours = parseInt(transTime.substring(8, 10), 10);
  const minutes = parseInt(transTime.substring(10, 12), 10);
  const seconds = parseInt(transTime.substring(12, 14), 10);
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

function mapTransactionTypeToReasonType(transactionType: string): MpesaStatementReasonType {
  const normalized = transactionType.trim();
  if (normalized === 'Pay Bill' || normalized === 'Buy Goods') {
    return MpesaStatementReasonType.PayBill_STK;
  }
  if (normalized === 'CustomerPayBillOnline') {
    return MpesaStatementReasonType.Paybill_MobileApp;
  }
  return MpesaStatementReasonType.Unmapped;
}

/**
 * Empty / whitespace / missing MSISDN → null (the bug this cohort hit).
 * These 20 blobs all have MSISDN=""; keep logic defensive for the one-off.
 */
function msisdnForStorage(msisdn: string | undefined): string | null {
  if (msisdn == null || typeof msisdn !== 'string') return null;
  const trimmed = msisdn.trim();
  return trimmed === '' ? null : trimmed;
}

type RowResult =
  | 'processed'
  | 'skipped_already_processed'
  | 'skipped_not_found'
  | 'skipped_ref_mismatch'
  | 'failed';

async function reprocessOne(row: HardcodedIpn): Promise<{
  result: RowResult;
  mapped: boolean;
  detail: string;
}> {
  const existing = await prisma.mpesaPaymentReportItem.findUnique({
    where: { id: row.id },
    select: {
      id: true,
      transactionReference: true,
      isProcessed: true,
      isMapped: true,
      source: true,
    },
  });

  if (!existing) {
    return { result: 'skipped_not_found', mapped: false, detail: 'row not found in DB' };
  }

  if (existing.transactionReference !== row.transactionReference) {
    return {
      result: 'skipped_ref_mismatch',
      mapped: false,
      detail: `DB ref=${existing.transactionReference} != expected ${row.transactionReference}`,
    };
  }

  if (existing.isProcessed) {
    return {
      result: 'skipped_already_processed',
      mapped: existing.isMapped,
      detail: `already isProcessed=true isMapped=${existing.isMapped}`,
    };
  }

  const payload = parsePayload(row.messageBlob);
  if (payload.TransID !== row.transactionReference) {
    throw new Error(
      `Blob TransID ${payload.TransID} does not match hardcoded ref ${row.transactionReference}`
    );
  }

  const amount = parseFloat(payload.TransAmount);
  if (Number.isNaN(amount)) {
    throw new Error(`Invalid TransAmount: ${payload.TransAmount}`);
  }

  const transactionTime = parseTransactionTime(payload.TransTime);
  const reasonType = mapTransactionTypeToReasonType(payload.TransactionType);
  const msisdn = msisdnForStorage(payload.MSISDN);
  const accountNumber = payload.BillRefNumber?.trim() || null;

  if (dryRun) {
    return {
      result: 'processed',
      mapped: false,
      detail: `DRY_RUN would set isProcessed=true amount=${amount} accountNumber=${accountNumber} msisdn=${msisdn}`,
    };
  }

  await prisma.mpesaPaymentReportItem.update({
    where: { id: row.id },
    data: {
      transactionReference: payload.TransID,
      completionTime: transactionTime,
      initiationTime: transactionTime,
      paymentDetails: payload.TransactionType,
      transactionStatus: 'Completed',
      paidIn: amount,
      withdrawn: 0,
      accountBalance: payload.OrgAccountBalance ? parseFloat(payload.OrgAccountBalance) : 0,
      balanceConfirmed: null,
      reasonType,
      otherPartyInfo: null,
      linkedTransactionId: null,
      accountNumber,
      msisdn,
      firstName: payload.FirstName ?? null,
      middleName: payload.MiddleName ?? null,
      lastName: payload.LastName ?? null,
      businessShortCode: payload.BusinessShortCode,
      source: MpesaPaymentSource.IPN,
      isProcessed: true,
    },
  });

  let mapped = false;

  if (accountNumber) {
    const existingPayment = await prisma.policyPayment.findFirst({
      where: {
        transactionReference: payload.TransID,
        detachedAt: null,
      },
      select: { id: true },
    });

    if (existingPayment) {
      await prisma.mpesaPaymentReportItem.update({
        where: { id: row.id },
        data: { isMapped: true },
      });
      mapped = true;
      return {
        result: 'processed',
        mapped,
        detail: `processed; policy_payment already exists id=${existingPayment.id}`,
      };
    }

    const policy = await prisma.policy.findFirst({
      where: { paymentAcNumber: accountNumber },
      select: {
        id: true,
        status: true,
        customer: { select: { idNumber: true } },
      },
    });

    if (!policy) {
      return {
        result: 'processed',
        mapped: false,
        detail: `processed IPN; no policy for BillRefNumber=${accountNumber}`,
      };
    }

    await prisma.policyPayment.create({
      data: {
        policyId: policy.id,
        paymentType: 'MPESA',
        transactionReference: payload.TransID,
        amount,
        accountNumber: policy.customer?.idNumber ?? null,
        details: `IPN payment - ${payload.TransactionType} (SITI empty-MSISDN reprocess)`,
        expectedPaymentDate: transactionTime,
        actualPaymentDate: transactionTime,
        paymentStatus: 'COMPLETED',
        paymentMessageBlob: JSON.stringify({
          firstName: payload.FirstName,
          middleName: payload.MiddleName,
          lastName: payload.LastName,
          businessShortCode: payload.BusinessShortCode,
          reprocess: 'siti-empty-msisdn',
        }),
      },
    });

    await prisma.mpesaPaymentReportItem.update({
      where: { id: row.id },
      data: { isMapped: true },
    });
    mapped = true;

    if (policy.status === 'PENDING_ACTIVATION') {
      console.warn(
        `[WARN] ${row.transactionReference}: policy ${policy.id} is PENDING_ACTIVATION — activate via app if appropriate (script does not call activatePolicy)`
      );
    }

    return {
      result: 'processed',
      mapped,
      detail: `processed + mapped to policy ${policy.id}`,
    };
  }

  return {
    result: 'processed',
    mapped: false,
    detail: 'processed IPN; no BillRefNumber',
  };
}

async function main(): Promise<void> {
  console.log(
    JSON.stringify({
      event: 'REPROCESS_SITI_EMPTY_MSISDN_START',
      dryRun,
      listOnly,
      hardcodedCount: SITI_IPN_ROWS.length,
    })
  );

  if (SITI_IPN_ROWS.length !== 20) {
    throw new Error(`Expected 20 hardcoded rows, found ${SITI_IPN_ROWS.length}`);
  }

  if (listOnly) {
    for (const row of SITI_IPN_ROWS) {
      const existing = await prisma.mpesaPaymentReportItem.findUnique({
        where: { id: row.id },
        select: {
          id: true,
          transactionReference: true,
          isProcessed: true,
          isMapped: true,
          paidIn: true,
          accountNumber: true,
          msisdn: true,
        },
      });
      const payload = parsePayload(row.messageBlob);
      console.log(
        [
          row.id,
          row.transactionReference,
          payload.TransAmount,
          payload.BillRefNumber ?? '',
          existing
            ? `db:isProcessed=${existing.isProcessed};isMapped=${existing.isMapped};paidIn=${existing.paidIn};accountNumber=${existing.accountNumber};msisdn=${existing.msisdn}`
            : 'db:NOT_FOUND',
        ].join('\t')
      );
    }
    console.log(
      JSON.stringify({
        event: 'REPROCESS_SITI_EMPTY_MSISDN_LIST_ONLY_DONE',
        hardcodedCount: SITI_IPN_ROWS.length,
      })
    );
    return;
  }

  const counts = {
    processed: 0,
    mapped: 0,
    skipped_already_processed: 0,
    skipped_not_found: 0,
    skipped_ref_mismatch: 0,
    failed: 0,
  };

  for (const row of SITI_IPN_ROWS) {
    const correlationId = `reprocess-siti-${row.transactionReference}`;
    try {
      const outcome = await reprocessOne(row);
      counts[outcome.result] += 1;
      if (outcome.mapped) counts.mapped += 1;
      console.log(`[${correlationId}] ${outcome.result}: ${outcome.detail}`);
    } catch (err) {
      counts.failed += 1;
      console.error(
        `[${correlationId}] failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    JSON.stringify({
      event: 'REPROCESS_SITI_EMPTY_MSISDN_DONE',
      dryRun,
      hardcodedCount: SITI_IPN_ROWS.length,
      processed: counts.processed,
      mapped: counts.mapped,
      skippedAlreadyProcessed: counts.skipped_already_processed,
      skippedNotFound: counts.skipped_not_found,
      skippedRefMismatch: counts.skipped_ref_mismatch,
      failed: counts.failed,
    })
  );

  console.log('');
  console.log('=== Summary ===');
  console.log(`Hardcoded rows:              ${SITI_IPN_ROWS.length}`);
  console.log(`Processed:                   ${counts.processed}`);
  console.log(`  of which mapped to policy: ${counts.mapped}`);
  console.log(`Skipped (already processed): ${counts.skipped_already_processed}`);
  console.log(`Skipped (not found):         ${counts.skipped_not_found}`);
  console.log(`Skipped (ref mismatch):      ${counts.skipped_ref_mismatch}`);
  console.log(`Failed:                      ${counts.failed}`);

  if (counts.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
