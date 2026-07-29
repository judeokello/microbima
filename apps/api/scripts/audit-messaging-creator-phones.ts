/**
 * Audit customers.createdBy users for missing Supabase user_metadata.phone.
 *
 * Non-prod messaging redirects customer-linked SMS/email to the registering user's
 * phone. Run this (and backfill-user-metadata-phone.ts) on staging before relying
 * on that redirect so Sentry stays quiet.
 *
 * Usage:
 *   From repo root: pnpm exec ts-node -r dotenv/config apps/api/scripts/audit-messaging-creator-phones.ts
 *   From apps/api:  npx ts-node -r dotenv/config scripts/audit-messaging-creator-phones.ts
 *
 * Required env (e.g. in apps/api/.env):
 *   - DATABASE_URL
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Related: scripts/backfill-user-metadata-phone.ts (fills phone from brand_ambassadors)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function main() {
  console.log('Audit: messaging creator phones (customers.createdBy → user_metadata.phone)\n');

  const nullCreatedByCount = await prisma.customer.count({
    where: { createdBy: null },
  });
  console.log(`Customers with createdBy IS NULL: ${nullCreatedByCount}`);

  const creators = await prisma.customer.findMany({
    where: { createdBy: { not: null } },
    select: { createdBy: true },
    distinct: ['createdBy'],
  });

  const creatorIds = creators
    .map((c) => c.createdBy)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  console.log(`Distinct createdBy user IDs: ${creatorIds.length}\n`);

  if (creatorIds.length === 0) {
    console.log('Nothing more to check.');
    return;
  }

  const supabase = getSupabase();
  const missingPhone: Array<{ userId: string; email: string | null; reason: string }> = [];
  let ok = 0;

  for (const userId of creatorIds) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user) {
      missingPhone.push({
        userId,
        email: null,
        reason: error?.message ?? 'user not found',
      });
      continue;
    }
    const meta = (data.user.user_metadata ?? {}) as { phone?: unknown };
    const phone = typeof meta.phone === 'string' ? meta.phone.trim() : '';
    if (!phone) {
      missingPhone.push({
        userId,
        email: data.user.email ?? null,
        reason: 'user_metadata.phone missing',
      });
      continue;
    }
    ok++;
  }

  console.log(`Creators with phone set: ${ok}`);
  console.log(`Creators missing phone / user: ${missingPhone.length}\n`);

  if (missingPhone.length > 0) {
    console.log('Problems:');
    for (const row of missingPhone) {
      console.log(`  - ${row.userId} email=${row.email ?? 'n/a'} (${row.reason})`);
    }
    console.log(
      '\nFix BA phones with: pnpm exec ts-node -r dotenv/config apps/api/scripts/backfill-user-metadata-phone.ts',
    );
    process.exitCode = 1;
  } else {
    console.log('All distinct creators have user_metadata.phone set.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
