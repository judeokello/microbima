/**
 * T056: Backfill user_metadata.phone for existing Brand Ambassadors.
 *
 * For each row in brand_ambassadors with a phoneNumber, updates the corresponding
 * Supabase auth user's user_metadata to include phone (merged with existing metadata).
 *
 * Usage:
 *   From repo root: pnpm exec ts-node -r dotenv/config apps/api/scripts/backfill-user-metadata-phone.ts
 *   From apps/api:  npx ts-node -r dotenv/config scripts/backfill-user-metadata-phone.ts
 *
 * Required env (e.g. in apps/api/.env):
 *   - DATABASE_URL (Prisma / app DB)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: DRY_RUN=1 to only log what would be updated without calling Supabase.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function main() {
  console.log('T056: Backfill user_metadata.phone for Brand Ambassadors');
  if (dryRun) console.log('DRY_RUN=1: no Supabase updates will be made.\n');

  const bas = await prisma.brandAmbassador.findMany({
    where: { phoneNumber: { not: null } },
    select: { id: true, userId: true, displayName: true, phoneNumber: true },
  });

  console.log(`Found ${bas.length} Brand Ambassador(s) with phoneNumber.\n`);

  if (bas.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const supabase = getSupabase();
  let updated = 0;
  let failed = 0;

  for (const ba of bas) {
    const phone = ba.phoneNumber!;
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would set user_metadata.phone for userId=${ba.userId} (${ba.displayName}) to ${phone}`);
        updated++;
        continue;
      }

      const { data: user, error: getUserError } = await supabase.auth.admin.getUserById(ba.userId);
      if (getUserError || !user) {
        console.warn(`⚠ Could not get user ${ba.userId}: ${getUserError?.message ?? 'no user'}`);
        failed++;
        continue;
      }

      const currentMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { error: updateError } = await supabase.auth.admin.updateUserById(ba.userId, {
        user_metadata: { ...currentMeta, phone },
      });

      if (updateError) {
        console.warn(`⚠ Failed to update ${ba.userId}: ${updateError.message}`);
        failed++;
      } else {
        console.log(`✅ ${ba.displayName} (${ba.userId}): user_metadata.phone set`);
        updated++;
      }
    } catch (err) {
      console.warn(`⚠ Error processing ${ba.userId}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
