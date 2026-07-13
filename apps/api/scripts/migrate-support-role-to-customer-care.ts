/**
 * Rename legacy `support` role to `customer_care` in Supabase user_metadata.roles.
 *
 * Roles live only in Supabase auth user_metadata (not in Postgres). Any existing
 * users who were given `support` for messaging access must be migrated so the
 * renamed authorization checks continue to work.
 *
 * Usage:
 *   From repo root: pnpm exec ts-node -r dotenv/config apps/api/scripts/migrate-support-role-to-customer-care.ts
 *   From apps/api:  npx ts-node -r dotenv/config scripts/migrate-support-role-to-customer-care.ts
 *
 * Required env (e.g. in apps/api/.env):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: DRY_RUN=1 to only log what would be updated without calling Supabase.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(__dirname, '..', '.env') });

const dryRun = process.env.DRY_RUN === '1';
const LEGACY_ROLE = 'support';
const NEW_ROLE = 'customer_care';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function migrateRoles(roles: unknown): { changed: boolean; roles: string[] } {
  if (!Array.isArray(roles)) {
    return { changed: false, roles: [] };
  }
  const asStrings = roles.filter((r): r is string => typeof r === 'string');
  if (!asStrings.includes(LEGACY_ROLE)) {
    return { changed: false, roles: asStrings };
  }
  const next = [
    ...new Set(asStrings.map((r) => (r === LEGACY_ROLE ? NEW_ROLE : r))),
  ];
  return { changed: true, roles: next };
}

async function main() {
  console.log(`Migrate user_metadata.roles: ${LEGACY_ROLE} → ${NEW_ROLE}`);
  if (dryRun) console.log('DRY_RUN=1: no Supabase updates will be made.\n');

  const supabase = getSupabase();
  let page = 1;
  const perPage = 100;
  let scanned = 0;
  let updated = 0;
  let failed = 0;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }
    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      scanned++;
      const currentMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { changed, roles } = migrateRoles(currentMeta.roles);
      if (!changed) continue;

      console.log(
        `${dryRun ? '[DRY RUN] Would update' : 'Updating'} user ${user.id} (${user.email ?? 'no-email'}): roles → [${roles.join(', ')}]`
      );

      if (dryRun) {
        updated++;
        continue;
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...currentMeta, roles },
      });
      if (updateError) {
        console.warn(`⚠ Failed to update ${user.id}: ${updateError.message}`);
        failed++;
      } else {
        updated++;
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log(`\nDone. Scanned=${scanned}, updated=${updated}, failed=${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
