/**
 * One-time backfill: trim leading/trailing spaces from onboarding free-text fields.
 *
 * Tables: customers, dependants, beneficiaries, partner_customers, addresses.
 * Run inside Fly (same app as API) so DATABASE_URL and secrets are available.
 *
 * Usage (on Fly after deploy):
 *   fly ssh console -a <internal-api-app>
 *   DRY_RUN=1 node apps/api/dist/scripts/trim-onboarding-text-fields.js   # preview
 *   node apps/api/dist/scripts/trim-onboarding-text-fields.js            # run for real
 *
 * Required env: DATABASE_URL
 * Optional: DRY_RUN=1 to log what would be updated without writing (uses a transaction that is rolled back).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env from apps/api when running locally (compiled: dist/scripts -> ..,.. = api; ts-node: scripts -> .. = api); on Fly, env is already set
const envPath = __dirname.includes('dist')
  ? resolve(__dirname, '..', '..', '.env')
  : resolve(__dirname, '..', '.env');
config({ path: envPath });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1';

interface TableResult {
  table: string;
  rowsAffected: number;
}

async function runTrimBackfill(): Promise<TableResult[]> {
  const results: TableResult[] = [];
  let dryRunResults: TableResult[] = [];

  await prisma
    .$transaction(async (tx) => {
      // Customers
      const customersResult = await tx.$executeRawUnsafe(`
      UPDATE customers SET
        "firstName" = TRIM("firstName"),
        "middleName" = NULLIF(TRIM(COALESCE("middleName", '')), ''),
        "lastName" = TRIM("lastName"),
        email = CASE WHEN email IS NOT NULL THEN NULLIF(TRIM(email), '') ELSE NULL END,
        "phoneNumber" = TRIM("phoneNumber"),
        "idNumber" = TRIM("idNumber")
    `);
      const customerCount = typeof customersResult === 'number' ? customersResult : 0;
      results.push({ table: 'customers', rowsAffected: customerCount });
      console.log(`customers: ${customerCount} rows ${dryRun ? 'would be updated' : 'updated'}`);

      // Dependants
      const dependantsResult = await tx.$executeRawUnsafe(`
      UPDATE dependants SET
        "firstName" = TRIM("firstName"),
        "middleName" = NULLIF(TRIM(COALESCE("middleName", '')), ''),
        "lastName" = TRIM("lastName"),
        email = CASE WHEN email IS NOT NULL THEN NULLIF(TRIM(email), '') ELSE NULL END,
        "phoneNumber" = CASE WHEN "phoneNumber" IS NOT NULL THEN NULLIF(TRIM("phoneNumber"), '') ELSE NULL END,
        "idNumber" = CASE WHEN "idNumber" IS NOT NULL THEN NULLIF(TRIM("idNumber"), '') ELSE NULL END
    `);
      const dependantsCount = typeof dependantsResult === 'number' ? dependantsResult : 0;
      results.push({ table: 'dependants', rowsAffected: dependantsCount });
      console.log(`dependants: ${dependantsCount} rows ${dryRun ? 'would be updated' : 'updated'}`);

      // Beneficiaries
      const beneficiariesResult = await tx.$executeRawUnsafe(`
      UPDATE beneficiaries SET
        "firstName" = TRIM("firstName"),
        "middleName" = NULLIF(TRIM(COALESCE("middleName", '')), ''),
        "lastName" = TRIM("lastName"),
        email = CASE WHEN email IS NOT NULL THEN NULLIF(TRIM(email), '') ELSE NULL END,
        "phoneNumber" = CASE WHEN "phoneNumber" IS NOT NULL THEN NULLIF(TRIM("phoneNumber"), '') ELSE NULL END,
        "idNumber" = CASE WHEN "idNumber" IS NOT NULL THEN NULLIF(TRIM("idNumber"), '') ELSE NULL END,
        relationship = CASE WHEN relationship IS NOT NULL THEN NULLIF(TRIM(relationship), '') ELSE NULL END,
        "relationshipDescription" = CASE WHEN "relationshipDescription" IS NOT NULL THEN NULLIF(TRIM("relationshipDescription"), '') ELSE NULL END
    `);
      const beneficiariesCount = typeof beneficiariesResult === 'number' ? beneficiariesResult : 0;
      results.push({ table: 'beneficiaries', rowsAffected: beneficiariesCount });
      console.log(`beneficiaries: ${beneficiariesCount} rows ${dryRun ? 'would be updated' : 'updated'}`);

      // Partner_customers
      const partnerCustomersResult = await tx.$executeRawUnsafe(`
      UPDATE partner_customers SET partner_customer_id = TRIM(partner_customer_id)
    `);
      const partnerCustomersCount = typeof partnerCustomersResult === 'number' ? partnerCustomersResult : 0;
      results.push({ table: 'partner_customers', rowsAffected: partnerCustomersCount });
      console.log(`partner_customers: ${partnerCustomersCount} rows ${dryRun ? 'would be updated' : 'updated'}`);

      // Addresses
      const addressesResult = await tx.$executeRawUnsafe(`
      UPDATE addresses SET
        street = TRIM(street),
        city = TRIM(city),
        state = TRIM(state),
        "postalCode" = TRIM("postalCode"),
        country = TRIM(country)
    `);
      const addressesCount = typeof addressesResult === 'number' ? addressesResult : 0;
      results.push({ table: 'addresses', rowsAffected: addressesCount });
      console.log(`addresses: ${addressesCount} rows ${dryRun ? 'would be updated' : 'updated'}`);

      if (dryRun) {
        dryRunResults = [...results];
        throw new Error('DRY_RUN_ROLLBACK');
      }
    })
    .catch((err: Error & { message?: string }) => {
      if (err?.message === 'DRY_RUN_ROLLBACK') {
        return;
      }
      throw err;
    });

  return dryRunResults.length > 0 ? dryRunResults : results;
}

async function main(): Promise<void> {
  console.log('Trim onboarding text fields — started');
  if (dryRun) {
    console.log('DRY_RUN=1: changes will be rolled back (no writes).\n');
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is required.');
    process.exit(1);
  }

  try {
    const results = await runTrimBackfill();

    const totalRows = results.reduce((sum, r) => sum + r.rowsAffected, 0);
    const tableCount = results.length;

    if (dryRun) {
      console.log(`\nDry run complete. Would update ${totalRows} rows across ${tableCount} tables.`);
    } else {
      console.log(`\nDone. Total: ${tableCount} tables, ${totalRows} rows updated.`);
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
