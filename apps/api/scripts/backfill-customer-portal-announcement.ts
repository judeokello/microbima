/**
 * T042 step 1 — Pre-notification SMS for legacy customers before portal OTP backfill.
 *
 * Legacy members have no context for a sudden OTP/login SMS. This script sends a
 * separate announcement first (`portal_legacy_announcement` template), then you run
 * `backfill-customer-portal-users.ts` (step 2) after a suitable delay.
 *
 * Template copy (SMS):
 *   "Dear {first_name} {last_name}, MaishaPoa now has a website that you can use to
 *   view your account details like payments made, pending payments and your hospital
 *   access cards. You will receive a message shortly with login details. We appreciate
 *   working with you."
 *
 * ── Recommended rollout (staging → production) ──
 *
 *   1. Apply template seed on the target DB:
 *        apps/api/prisma/seed-messaging.sql (includes portal_legacy_announcement)
 *
 *   2. Preview cohort:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:customer-portal-announcement
 *
 *   3. Dry-run one customer:
 *        DRY_RUN=1 CUSTOMER_IDS=<uuid> pnpm --filter @microbima/api backfill:customer-portal-announcement
 *
 *   4. Send to one customer; confirm SMS in messaging_deliveries / Africa's Talking:
 *        LIMIT=1 pnpm --filter @microbima/api backfill:customer-portal-announcement
 *
 *   5. Batch with pause:
 *        LIMIT=10 DELAY_MS=30000 pnpm --filter @microbima/api backfill:customer-portal-announcement
 *
 *   6. After members have received this (hours/days), run step 2:
 *        LIMIT=1 pnpm --filter @microbima/api backfill:customer-portal
 *
 * ── On Fly ──
 *
 *   fly ssh console -a <internal-api-app>
 *   LIST_ONLY=1 node apps/api/dist/scripts/backfill-customer-portal-announcement.js
 *   DRY_RUN=1 CUSTOMER_IDS=<uuid> node apps/api/dist/scripts/backfill-customer-portal-announcement.js
 *   LIMIT=1 node apps/api/dist/scripts/backfill-customer-portal-announcement.js
 *
 * Required env: DATABASE_URL
 *
 * Optional env:
 *   DRY_RUN=1              — log actions only; no DB writes
 *   LIST_ONLY=1            — print eligible customers; exit
 *   CUSTOMER_IDS=a,b,c     — process only these UUIDs
 *   LIMIT=n                — max customers per run
 *   OFFSET=n               — skip first n eligible customers
 *   DELAY_MS=n             — pause between customers (default 0)
 *   INCLUDE_TEST_USERS=1   — include isTestUser=true (default: exclude)
 *   STATUS=ACTIVE          — comma-separated CustomerStatus values
 *   FORCE=1                — enqueue even if announcement already sent (PENDING/SENT)
 *   CORRELATION_PREFIX=x   — default backfill-t042-announce
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, CustomerStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const TEMPLATE_KEY = 'portal_legacy_announcement';

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const dryRun = process.env.DRY_RUN === '1';
const listOnly = process.env.LIST_ONLY === '1';
const force = process.env.FORCE === '1';
const includeTestUsers = process.env.INCLUDE_TEST_USERS === '1';
const delayMs = Math.max(0, parseInt(process.env.DELAY_MS ?? '0', 10) || 0);
const limit = process.env.LIMIT ? Math.max(1, parseInt(process.env.LIMIT, 10)) : undefined;
const offset = Math.max(0, parseInt(process.env.OFFSET ?? '0', 10) || 0);
const correlationPrefix = process.env.CORRELATION_PREFIX ?? 'backfill-t042-announce';
const customerIdsFilter = process.env.CUSTOMER_IDS
  ? process.env.CUSTOMER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : undefined;

const VALID_STATUSES = new Set<string>(Object.values(CustomerStatus));
const statusFilter: CustomerStatus[] = (process.env.STATUS ?? 'ACTIVE')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    if (!VALID_STATUSES.has(s)) {
      throw new Error(`Invalid STATUS value "${s}". Valid: ${[...VALID_STATUSES].join(', ')}`);
    }
    return s as CustomerStatus;
  });

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  status: CustomerStatus;
  isTestUser: boolean;
  createdAt: Date;
};

function serializePlaceholderContext(
  values: Record<string, string | number | boolean | Date>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

async function announcementAlreadyQueued(customerId: string): Promise<boolean> {
  const existing = await prisma.messagingDelivery.findFirst({
    where: {
      customerId,
      templateKey: TEMPLATE_KEY,
      channel: 'SMS',
      status: { in: ['PENDING', 'PROCESSING', 'RETRY_WAIT', 'SENT'] },
    },
    select: { id: true, status: true },
  });
  return !!existing;
}

async function enqueueAnnouncementSms(params: {
  customerId: string;
  placeholderValues: Record<string, string>;
  correlationId: string;
}): Promise<string[]> {
  const route = await prisma.messagingRoute.findUnique({
    where: { templateKey: TEMPLATE_KEY },
  });
  if (!route) {
    throw new Error(
      `No messaging route for templateKey=${TEMPLATE_KEY}. Run apps/api/prisma/seed-messaging.sql on this database first.`,
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: { id: true, phoneNumber: true, defaultMessagingLanguage: true },
  });
  if (!customer) {
    throw new Error(`Customer not found: ${params.customerId}`);
  }

  const settingsRows = await prisma.systemSetting.findMany({ select: { key: true, value: true } });
  let defaultLanguage = 'en';
  for (const row of settingsRows) {
    if (row.key === 'defaultMessagingLanguage' && typeof row.value === 'string') {
      defaultLanguage = row.value;
    }
  }

  const requestedLanguage = customer.defaultMessagingLanguage ?? defaultLanguage;
  const enqueuePlaceholderContext = serializePlaceholderContext(params.placeholderValues);
  const createdIds: string[] = [];
  const now = new Date();
  const smsMaxAttempts = 2;

  if (route.smsEnabled) {
    const recipient = customer.phoneNumber;
    const delivery = await prisma.messagingDelivery.create({
      data: {
        channel: 'SMS',
        customerId: customer.id,
        templateKey: TEMPLATE_KEY,
        requestedLanguage,
        correlationId: params.correlationId,
        recipientPhone: recipient ?? null,
        status: recipient ? 'PENDING' : 'FAILED',
        attemptCount: 0,
        maxAttempts: smsMaxAttempts,
        lastError: recipient ? null : 'Phone number not set for customer',
        renderedBody: '',
        createdAt: now,
        enqueuePlaceholderContext,
      },
    });
    createdIds.push(delivery.id);
  }

  return createdIds;
}

async function fetchCandidateCustomers(): Promise<CustomerRow[]> {
  return prisma.customer.findMany({
    where: {
      status: { in: statusFilter },
      portalPinSetupCompletedAt: null,
      ...(includeTestUsers ? {} : { isTestUser: false }),
      ...(customerIdsFilter ? { id: { in: customerIdsFilter } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      status: true,
      isTestUser: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('T042 step 1: Legacy portal announcement SMS');
  console.log(`  Template: ${TEMPLATE_KEY}`);
  console.log(`  STATUS filter: ${statusFilter.join(', ')}`);
  console.log(`  INCLUDE_TEST_USERS: ${includeTestUsers}`);
  if (dryRun) console.log('  DRY_RUN=1 — no writes');
  if (listOnly) console.log('  LIST_ONLY=1 — preview only');
  if (force) console.log('  FORCE=1 — re-enqueue even if announcement already queued/sent');
  console.log('');

  const allCandidates = await fetchCandidateCustomers();
  console.log(`Found ${allCandidates.length} Postgres candidate(s).\n`);

  const eligible: CustomerRow[] = [];
  let alreadySent = 0;

  for (const c of allCandidates) {
    if (!force && (await announcementAlreadyQueued(c.id))) {
      alreadySent++;
      continue;
    }
    eligible.push(c);
  }

  console.log(`${eligible.length} eligible (${alreadySent} skipped — announcement already queued/sent).\n`);

  const window = eligible.slice(offset, limit !== undefined ? offset + limit : undefined);

  if (listOnly) {
    for (const c of window) {
      console.log(`  ${c.id}  ${c.firstName} ${c.lastName}  ${c.phoneNumber}  created=${c.createdAt.toISOString()}`);
    }
    console.log(`\nWould process ${window.length} customer(s) (OFFSET=${offset}${limit !== undefined ? `, LIMIT=${limit}` : ''}).`);
    return;
  }

  if (window.length === 0) {
    console.log('Nothing to process.');
    return;
  }

  let enqueued = 0;
  let failed = 0;

  for (let i = 0; i < window.length; i++) {
    const customer = window[i];
    const correlationId = `${correlationPrefix}-${randomUUID()}`;
    const label = `[${i + 1}/${window.length}] ${customer.id} (${customer.firstName} ${customer.lastName})`;

    try {
      if (dryRun) {
        console.log(`${label}`);
        console.log(`  [DRY RUN] would enqueue ${TEMPLATE_KEY} SMS to ${customer.phoneNumber}`);
        enqueued++;
        continue;
      }

      const deliveryIds = await enqueueAnnouncementSms({
        customerId: customer.id,
        correlationId,
        placeholderValues: {
          first_name: customer.firstName,
          last_name: customer.lastName,
        },
      });

      console.log(`${label} — SMS enqueued: deliveryIds=[${deliveryIds.join(', ')}] correlationId=${correlationId}`);
      enqueued++;

      if (delayMs > 0 && i < window.length - 1) {
        console.log(`  Waiting ${delayMs}ms before next customer…`);
        await sleep(delayMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${label} — ERROR: ${msg}`);
      failed++;
    }
  }

  console.log('\n── Summary ──');
  console.log(`  Processed window: ${window.length}`);
  console.log(`  SMS enqueued:     ${enqueued}`);
  console.log(`  Failed:           ${failed}`);
  if (limit !== undefined || offset > 0) {
    const remaining = Math.max(0, eligible.length - offset - window.length);
    console.log(`  Remaining:        ${remaining} (use OFFSET=${offset + window.length} to continue)`);
  }
  console.log('\nNext: after members receive this message, run backfill:customer-portal (step 2) for OTP + Auth.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
