/**
 * Import legacy product-pricing JSON into package_pricing_categories + package_plan_rates.
 *
 * Both Mfanisi Boda and Mfanisi Go sheets are always imported — they exist on staging
 * and master. Do not treat a missing package in local Supabase as optional coverage.
 *
 * Usage (from repo root or apps/api):
 *   DATABASE_URL=... pnpm exec ts-node -r dotenv/config apps/api/scripts/migrate-package-pricing-json.ts
 *
 * Requires DATABASE_URL pointing at the target environment (staging/production/local).
 * Fails if either JSON file is missing or either package slug is not in that DB.
 */

import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, PaymentFrequency } from '@prisma/client';
import {
  flattenLegacyRatesForPlan,
  mapLegacyJsonCategories,
  mapLegacyPlanRates,
  type LegacyProductPricingJson,
} from '../src/services/package-pricing/package-pricing-migrate.util';

config({ path: resolve(__dirname, '..', '.env') });

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Canonical migration inputs — both packages on staging/master. */
const JSON_FILES = [
  resolve(__dirname, '../prisma/data/mfanisi-boda-pricing.json'),
  resolve(__dirname, '../prisma/data/mfanisi-go-pricing.json'),
] as const;

const REQUIRED_SLUGS = ['mfanisi-boda', 'mfanisi-go'] as const;

const MIGRATION_USER = '00000000-0000-0000-0000-000000000001';

function loadJson(path: string): LegacyProductPricingJson {
  if (!existsSync(path)) {
    throw new Error(`Required pricing JSON missing: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as LegacyProductPricingJson;
}

async function ensurePlan(
  prisma: PrismaClient,
  packageId: number,
  planKey: string,
  planName: string
): Promise<number> {
  const existing = await prisma.packagePlan.findFirst({
    where: {
      packageId,
      name: { equals: planName, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.packagePlan.create({
    data: {
      packageId,
      name: planName,
      isActive: true,
      createdBy: MIGRATION_USER,
      updatedBy: MIGRATION_USER,
    },
  });
  console.log(`  Created plan "${planName}" (id=${created.id})`);
  return created.id;
}

async function importPackage(prisma: PrismaClient, json: LegacyProductPricingJson): Promise<void> {
  const slug = json.packageSlug;
  console.log(`\nImporting pricing for slug "${slug}"…`);

  const pkg = await prisma.package.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });

  if (!pkg) {
    throw new Error(
      `Package with slug "${slug}" not found in DATABASE_URL target. ` +
        `Both ${REQUIRED_SLUGS.join(' and ')} must exist (as on staging/master) before running this migration.`
    );
  }

  const categories = mapLegacyJsonCategories(json);
  const categoryIdByKey = new Map<string, number>();

  for (const cat of categories) {
    const upserted = await prisma.packagePricingCategory.upsert({
      where: { packageId_key: { packageId: pkg.id, key: cat.key } },
      create: {
        packageId: pkg.id,
        key: cat.key,
        displayName: cat.display,
        kind: cat.kind,
        maxMembers: cat.maxMembers,
        sortOrder: cat.sortOrder,
        createdBy: MIGRATION_USER,
        updatedBy: MIGRATION_USER,
      },
      update: {
        displayName: cat.display,
        kind: cat.kind,
        maxMembers: cat.maxMembers,
        sortOrder: cat.sortOrder,
        updatedBy: MIGRATION_USER,
      },
    });
    categoryIdByKey.set(cat.key, upserted.id);
  }

  const planIdByKey = new Map<string, number>();
  for (const [planKey, plan] of Object.entries(json.plans)) {
    const planId = await ensurePlan(prisma, pkg.id, planKey, plan.name);
    planIdByKey.set(planKey, planId);

    const rates = mapLegacyPlanRates(plan);
    const rows = flattenLegacyRatesForPlan(planKey, rates);

    for (const row of rows) {
      const planIdResolved = planIdByKey.get(row.planKey);
      const categoryId = categoryIdByKey.get(row.categoryKey);
      if (planIdResolved == null || categoryId == null) continue;

      await prisma.packagePlanRate.upsert({
        where: {
          packagePlanId_packagePricingCategoryId_frequency: {
            packagePlanId: planIdResolved,
            packagePricingCategoryId: categoryId,
            frequency: row.frequency as PaymentFrequency,
          },
        },
        create: {
          packagePlanId: planIdResolved,
          packagePricingCategoryId: categoryId,
          frequency: row.frequency as PaymentFrequency,
          amount: row.amount,
          createdBy: MIGRATION_USER,
          updatedBy: MIGRATION_USER,
        },
        update: {
          amount: row.amount,
          updatedBy: MIGRATION_USER,
        },
      });
    }
  }

  console.log(
    `  OK: ${categories.length} categories, ${Object.keys(json.plans).length} plans for package "${pkg.name}" (id=${pkg.id})`
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  console.log(`Using DATABASE_URL=${databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Importing both required packages: ${REQUIRED_SLUGS.join(', ')}`);

  const payloads = JSON_FILES.map((file) => loadJson(file));
  const loadedSlugs = payloads.map((p) => p.packageSlug);
  for (const required of REQUIRED_SLUGS) {
    if (!loadedSlugs.includes(required)) {
      throw new Error(
        `Pricing JSON set must include packageSlug "${required}". Loaded: ${loadedSlugs.join(', ')}`
      );
    }
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    for (const json of payloads) {
      await importPackage(prisma, json);
    }
    console.log('\nMigration complete for mfanisi-boda and mfanisi-go.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
