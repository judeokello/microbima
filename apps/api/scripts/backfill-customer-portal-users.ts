/**
 * T042 step 2 — Backfill Supabase Auth + welcome SMS for legacy customers without portal accounts.
 *
 * Run **after** step 1 (`backfill-customer-portal-announcement.ts`) so legacy members receive
 * context about the new portal before the OTP/login SMS arrives.
 *
 * Legacy cohort: Postgres `customers` rows that predate portal provisioning — no Supabase
 * Auth user (`auth.users.id` = `customers.id`), `portalPinSetupCompletedAt` still null.
 *
 * For each eligible customer the script:
 *   1. Creates a Supabase Auth user (synthetic email + 6-digit OTP password, `roles: ['customer']`)
 *   2. Enqueues `customer_created` SMS (OTP + personal link + support numbers) — unless SKIP_SMS=1
 *   3. Leaves `portalPinSetupCompletedAt` null so the member completes forced PIN setup on first sign-in
 *
 * Does NOT use national ID on the portal (FR-009). OTP is the initial password until PIN setup (FR-008).
 *
 * ── Recommended rollout (staging → production) ──
 *
 *   0. Step 1 first — announcement SMS (see backfill-customer-portal-announcement.ts):
 *        DRY_RUN=1 CUSTOMER_IDS=<uuid> pnpm --filter @microbima/api backfill:customer-portal-announcement
 *        LIMIT=1 pnpm --filter @microbima/api backfill:customer-portal-announcement
 *
 *   1. Preview cohort:
 *        LIST_ONLY=1 pnpm --filter @microbima/api backfill:customer-portal
 *
 *   2. Dry-run one known customer:
 *        DRY_RUN=1 CUSTOMER_IDS=<uuid> pnpm --filter @microbima/api backfill:customer-portal
 *
 *   3. Process one customer, watch SMS in admin / messaging_deliveries / Africa's Talking:
 *        LIMIT=1 DELAY_MS=0 pnpm --filter @microbima/api backfill:customer-portal
 *
 *   4. Batch with pause between SMS (monitor carrier):
 *        LIMIT=10 DELAY_MS=30000 pnpm --filter @microbima/api backfill:customer-portal
 *
 *   5. Resume later with OFFSET (ordered by createdAt asc):
 *        OFFSET=10 LIMIT=10 DELAY_MS=30000 pnpm --filter @microbima/api backfill:customer-portal
 *
 * ── On Fly (after deploy; env + secrets already present) ──
 *
 *   fly ssh console -a <internal-api-app>
 *   LIST_ONLY=1 node apps/api/dist/scripts/backfill-customer-portal-users.js
 *   DRY_RUN=1 LIMIT=1 node apps/api/dist/scripts/backfill-customer-portal-users.js
 *   LIMIT=1 node apps/api/dist/scripts/backfill-customer-portal-users.js
 *
 * Required env:
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORTAL_PUBLIC_URL
 *
 * Optional env:
 *   DRY_RUN=1              — log actions only; no Supabase or DB writes
 *   LIST_ONLY=1            — print eligible customer count + ids; exit
 *   CUSTOMER_IDS=a,b,c     — process only these UUIDs (overrides OFFSET/LIMIT selection)
 *   LIMIT=n                — max customers per run (default: no limit)
 *   OFFSET=n               — skip first n eligible customers (default 0)
 *   SKIP_SMS=1             — create Auth user only; do not enqueue welcome SMS
 *   DELAY_MS=n             — pause between customers (default 0)
 *   INCLUDE_TEST_USERS=1   — include customers with isTestUser=true (default: exclude)
 *   STATUS=ACTIVE          — comma-separated CustomerStatus values (default ACTIVE)
 *   FORCE_PASSWORD_RESET=1 — if Auth user exists but PIN not complete, set new OTP password + SMS
 *   REQUIRE_ANNOUNCEMENT=1  — skip customers without a prior portal_legacy_announcement delivery (step 1)
 *   CORRELATION_PREFIX=x   — prefix for messaging correlation ids (default backfill-t042)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, CustomerStatus } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SYNTHETIC_DOMAIN = 'maishapoa.customer';
const PORTAL_REGISTRATION_OTP_LENGTH = 6;
const ANNOUNCEMENT_TEMPLATE_KEY = 'portal_legacy_announcement';

/** Minimal phone normalisation for script use (254XXXXXXXXX). */
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (normalized.startsWith('254')) {
    if (normalized.length !== 12) throw new Error(`Invalid 254… phone length: ${normalized.length}`);
    return normalized;
  }
  if (normalized.length === 9) return `254${normalized}`;
  throw new Error(`Unsupported phone format: ${phone}`);
}

function buildSyntheticCustomerEmail(storedPhone: string): { national07: string; email: string } {
  const international = normalizePhoneNumber(storedPhone);
  const national07 = `0${international.slice(3)}`;
  return { national07, email: `${national07}@${SYNTHETIC_DOMAIN}` };
}

function generatePortalRegistrationOtp(length = PORTAL_REGISTRATION_OTP_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();

const dryRun = process.env.DRY_RUN === '1';
const listOnly = process.env.LIST_ONLY === '1';
const skipSms = process.env.SKIP_SMS === '1';
const includeTestUsers = process.env.INCLUDE_TEST_USERS === '1';
const forcePasswordReset = process.env.FORCE_PASSWORD_RESET === '1';
const requireAnnouncement = process.env.REQUIRE_ANNOUNCEMENT === '1';
const delayMs = Math.max(0, parseInt(process.env.DELAY_MS ?? '0', 10) || 0);
const limit = process.env.LIMIT ? Math.max(1, parseInt(process.env.LIMIT, 10)) : undefined;
const offset = Math.max(0, parseInt(process.env.OFFSET ?? '0', 10) || 0);
const correlationPrefix = process.env.CORRELATION_PREFIX ?? 'backfill-t042';
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
  email: string | null;
  phoneNumber: string;
  portalPinSetupCompletedAt: Date | null;
  status: CustomerStatus;
  isTestUser: boolean;
  createdAt: Date;
};

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getPortalBaseUrl(): string {
  const base = process.env.PORTAL_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!base) {
    throw new Error('PORTAL_PUBLIC_URL (or NEXT_PUBLIC_APP_URL) is required for welcome SMS links');
  }
  return base.replace(/\/$/, '');
}

function coerceSystemSettingPhone(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'raw' in raw && typeof (raw as { raw: unknown }).raw === 'string') {
    return (raw as { raw: string }).raw;
  }
  return '';
}

async function getSupportNumbers(): Promise<{ general: string; medical: string }> {
  const [genRow, medRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'general_support_number' } }),
    prisma.systemSetting.findUnique({ where: { key: 'medical_support_number' } }),
  ]);
  return {
    general: coerceSystemSettingPhone(genRow?.value ?? null),
    medical: coerceSystemSettingPhone(medRow?.value ?? null),
  };
}

async function supabaseUserExists(supabase: SupabaseClient, customerId: string): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(customerId);
  return !error && !!data.user;
}

async function announcementWasSent(customerId: string): Promise<boolean> {
  const existing = await prisma.messagingDelivery.findFirst({
    where: {
      customerId,
      templateKey: ANNOUNCEMENT_TEMPLATE_KEY,
      channel: 'SMS',
      status: { in: ['PENDING', 'PROCESSING', 'RETRY_WAIT', 'SENT'] },
    },
    select: { id: true },
  });
  return !!existing;
}

async function ensureCustomerPortalUser(
  supabase: SupabaseClient,
  params: { customerId: string; syntheticEmail: string; otpPassword: string },
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const { customerId, syntheticEmail, otpPassword } = params;
  const exists = await supabaseUserExists(supabase, customerId);
  if (exists) {
    if (forcePasswordReset) {
      const { error } = await supabase.auth.admin.updateUserById(customerId, { password: otpPassword });
      if (error) {
        return { ok: false, error: error.message ?? String(error) };
      }
      return { ok: true, created: false };
    }
    return { ok: true, created: false };
  }

  const { error: createErr } = await supabase.auth.admin.createUser({
    id: customerId,
    email: syntheticEmail,
    password: otpPassword,
    email_confirm: true,
    user_metadata: { roles: ['customer'] },
  });

  if (!createErr) {
    return { ok: true, created: true };
  }

  const msg = createErr.message ?? String(createErr);
  if (await supabaseUserExists(supabase, customerId)) {
    return { ok: true, created: false };
  }
  return { ok: false, error: msg };
}

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

async function enqueueCustomerCreatedSms(params: {
  customerId: string;
  placeholderValues: Record<string, string>;
  correlationId: string;
}): Promise<string[]> {
  const route = await prisma.messagingRoute.findUnique({
    where: { templateKey: 'customer_created' },
  });
  if (!route) {
    throw new Error('No messaging route for templateKey=customer_created');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: { id: true, phoneNumber: true, defaultMessagingLanguage: true },
  });
  if (!customer) {
    throw new Error(`Customer not found: ${params.customerId}`);
  }

  const settingsRow = await prisma.systemSetting.findMany({ select: { key: true, value: true } });
  const smsMaxAttempts = 2;
  let defaultLanguage = 'en';
  for (const row of settingsRow) {
    if (row.key === 'defaultMessagingLanguage' && typeof row.value === 'string') {
      defaultLanguage = row.value;
    }
  }

  const requestedLanguage = customer.defaultMessagingLanguage ?? defaultLanguage;
  const enqueuePlaceholderContext = serializePlaceholderContext(params.placeholderValues);
  const createdIds: string[] = [];
  const now = new Date();

  if (route.smsEnabled) {
    const recipient = customer.phoneNumber;
    const delivery = await prisma.messagingDelivery.create({
      data: {
        channel: 'SMS',
        customerId: customer.id,
        templateKey: 'customer_created',
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
  const where = {
    status: { in: statusFilter },
    portalPinSetupCompletedAt: null,
    ...(includeTestUsers ? {} : { isTestUser: false }),
    ...(customerIdsFilter ? { id: { in: customerIdsFilter } } : {}),
  };

  return prisma.customer.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      portalPinSetupCompletedAt: true,
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
  console.log('T042 step 2: Backfill customer portal Auth users + welcome SMS');
  console.log(`  STATUS filter: ${statusFilter.join(', ')}`);
  console.log(`  INCLUDE_TEST_USERS: ${includeTestUsers}`);
  if (dryRun) console.log('  DRY_RUN=1 — no writes');
  if (listOnly) console.log('  LIST_ONLY=1 — preview only');
  if (skipSms) console.log('  SKIP_SMS=1 — Auth only, no welcome SMS');
  if (forcePasswordReset) console.log('  FORCE_PASSWORD_RESET=1 — reset OTP for existing Auth users');
  if (requireAnnouncement) console.log('  REQUIRE_ANNOUNCEMENT=1 — only customers with step-1 announcement SMS');
  console.log('');

  const supabase = getSupabase();
  const portalBase = getPortalBaseUrl();
  const support = await getSupportNumbers();

  const allCandidates = await fetchCandidateCustomers();
  console.log(`Found ${allCandidates.length} Postgres candidate(s) (status in [${statusFilter.join(', ')}], portalPinSetupCompletedAt null).`);

  const eligible: CustomerRow[] = [];
  let skippedNoAnnouncement = 0;
  for (const c of allCandidates) {
    const hasAuth = await supabaseUserExists(supabase, c.id);
    if (hasAuth && !forcePasswordReset) {
      continue;
    }
    if (hasAuth && forcePasswordReset && c.portalPinSetupCompletedAt) {
      continue;
    }
    if (requireAnnouncement && !(await announcementWasSent(c.id))) {
      skippedNoAnnouncement++;
      continue;
    }
    eligible.push(c);
  }

  console.log(`${eligible.length} eligible after Supabase check (no Auth user, or FORCE_PASSWORD_RESET with incomplete PIN).`);
  if (requireAnnouncement) {
    console.log(`  (${skippedNoAnnouncement} skipped — no ${ANNOUNCEMENT_TEMPLATE_KEY} delivery yet)`);
  }
  console.log('');

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

  let provisioned = 0;
  let smsEnqueued = 0;
  let failed = 0;

  for (let i = 0; i < window.length; i++) {
    const customer = window[i];
    const correlationId = `${correlationPrefix}-${randomUUID()}`;
    const label = `[${i + 1}/${window.length}] ${customer.id} (${customer.firstName} ${customer.lastName})`;

    try {
      const { email: syntheticEmail } = buildSyntheticCustomerEmail(customer.phoneNumber);
      const otp = generatePortalRegistrationOtp();
      const personalLink = `${portalBase}/self/customer/${customer.id}`;

      if (dryRun) {
        console.log(`${label}`);
        console.log(`  [DRY RUN] syntheticEmail=${syntheticEmail} otp=****** personalLink=${personalLink}`);
        if (!skipSms) console.log(`  [DRY RUN] would enqueue customer_created SMS`);
        provisioned++;
        continue;
      }

      const authResult = await ensureCustomerPortalUser(supabase, {
        customerId: customer.id,
        syntheticEmail,
        otpPassword: otp,
      });

      if (!authResult.ok) {
        console.warn(`${label} — Auth FAILED: ${authResult.error}`);
        failed++;
        continue;
      }

      const authAction = authResult.created ? 'created' : forcePasswordReset ? 'password reset' : 'already exists';
      console.log(`${label} — Supabase Auth ${authAction}`);

      if (!skipSms) {
        const deliveryIds = await enqueueCustomerCreatedSms({
          customerId: customer.id,
          correlationId,
          placeholderValues: {
            first_name: customer.firstName,
            last_name: customer.lastName,
            email: customer.email ?? '',
            otp,
            customer_specific_weblogin: personalLink,
            general_support_number: support.general,
            medical_support_number: support.medical,
          },
        });
        console.log(`  SMS enqueued: deliveryIds=[${deliveryIds.join(', ')}] correlationId=${correlationId}`);
        smsEnqueued++;
      } else {
        console.log(`  SMS skipped (SKIP_SMS=1). OTP was: ${otp}`);
      }

      provisioned++;

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
  console.log(`  Provisioned:      ${provisioned}`);
  console.log(`  SMS enqueued:     ${smsEnqueued}`);
  console.log(`  Failed:           ${failed}`);
  if (limit !== undefined || offset > 0) {
    const remaining = Math.max(0, eligible.length - offset - window.length);
    console.log(`  Remaining:        ${remaining} (use OFFSET=${offset + window.length} to continue)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
