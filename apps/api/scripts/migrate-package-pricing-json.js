#!/usr/bin/env node
/**
 * Import legacy product-pricing JSON into package_pricing_categories + package_plan_rates.
 *
 * Fly-friendly CommonJS (no ts-node). Reads JSON from prisma/data/.
 * Requires both mfanisi-boda and mfanisi-go packages to exist.
 *
 * On Fly (DATABASE_URL already set):
 *   cd /app/apps/api && node scripts/migrate-package-pricing-json.js
 *
 * From laptop:
 *   DATABASE_URL=... node apps/api/scripts/migrate-package-pricing-json.js
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { PrismaClient } = require('@prisma/client');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const REQUIRED_SLUGS = ['mfanisi-boda', 'mfanisi-go'];
const MIGRATION_USER = '00000000-0000-0000-0000-000000000001';

const JSON_FILES = [
  resolve(__dirname, '../prisma/data/mfanisi-boda-pricing.json'),
  resolve(__dirname, '../prisma/data/mfanisi-go-pricing.json'),
];

const BAND_KEYS = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
const BAND_TO_FREQ = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  annually: 'ANNUALLY',
};

function mapLegacyCategoryKey(key) {
  if (key === 'member_only') return { kind: 'MEMBER_ONLY', maxMembers: null };
  if (key === 'additional_spouse') return { kind: 'ADDITIONAL_SPOUSE', maxMembers: null };
  const upToMatch = /^up_to_(\d+)$/.exec(key);
  if (upToMatch) {
    return { kind: 'UP_TO_N', maxMembers: parseInt(upToMatch[1], 10) };
  }
  throw new Error(`Unknown legacy category key "${key}"`);
}

function pickRateBand(source) {
  const band = {};
  for (const key of BAND_KEYS) {
    const value = source[key];
    if (value != null && value > 0) band[key] = value;
  }
  return band;
}

function mapLegacyJsonCategories(json) {
  const byKey = new Map();
  let sortOrder = 0;
  for (const plan of Object.values(json.plans)) {
    for (const [key, cat] of Object.entries(plan.categories)) {
      if (byKey.has(key)) continue;
      const { kind, maxMembers } = mapLegacyCategoryKey(key);
      byKey.set(key, {
        key,
        display: cat.display,
        kind,
        maxMembers,
        sortOrder: sortOrder++,
      });
    }
    if (!byKey.has('additional_spouse')) {
      byKey.set('additional_spouse', {
        key: 'additional_spouse',
        display: 'Additional spouse',
        kind: 'ADDITIONAL_SPOUSE',
        maxMembers: null,
        sortOrder: sortOrder++,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapLegacyPlanRates(plan) {
  const rates = {};
  for (const [key, cat] of Object.entries(plan.categories)) {
    rates[key] = pickRateBand(cat);
  }
  rates.additional_spouse = pickRateBand(plan.additional_spouse);
  return rates;
}

function flattenLegacyRatesForPlan(planKey, rates) {
  const rows = [];
  for (const [categoryKey, band] of Object.entries(rates)) {
    for (const bandKey of BAND_KEYS) {
      const amount = band[bandKey];
      if (amount == null || amount <= 0) continue;
      rows.push({
        planKey,
        categoryKey,
        frequency: BAND_TO_FREQ[bandKey],
        amount,
      });
    }
  }
  return rows;
}

function loadJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Required pricing JSON missing: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function ensurePlan(prisma, packageId, planName) {
  const existing = await prisma.packagePlan.findFirst({
    where: { packageId, name: { equals: planName, mode: 'insensitive' } },
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

async function importPackage(prisma, json) {
  const slug = json.packageSlug;
  console.log(`\nImporting pricing for slug "${slug}"…`);

  const pkg = await prisma.package.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!pkg) {
    throw new Error(
      `Package with slug "${slug}" not found. Both ${REQUIRED_SLUGS.join(' and ')} must exist before running this migration.`
    );
  }

  const categories = mapLegacyJsonCategories(json);
  const categoryIdByKey = new Map();

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

  for (const [planKey, plan] of Object.entries(json.plans)) {
    const planId = await ensurePlan(prisma, pkg.id, plan.name);
    const rates = mapLegacyPlanRates(plan);
    const rows = flattenLegacyRatesForPlan(planKey, rates);

    for (const row of rows) {
      const categoryId = categoryIdByKey.get(row.categoryKey);
      if (categoryId == null) continue;

      await prisma.packagePlanRate.upsert({
        where: {
          packagePlanId_packagePricingCategoryId_frequency: {
            packagePlanId: planId,
            packagePricingCategoryId: categoryId,
            frequency: row.frequency,
          },
        },
        create: {
          packagePlanId: planId,
          packagePricingCategoryId: categoryId,
          frequency: row.frequency,
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
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  console.log(`Using DATABASE_URL=${databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Importing both required packages: ${REQUIRED_SLUGS.join(', ')}`);

  const payloads = JSON_FILES.map(loadJson);
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
