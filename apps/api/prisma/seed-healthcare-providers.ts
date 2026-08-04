import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

type CountySeed = {
  id: number
  code: number
  name: string
  externalCode?: string
}

type SubCountySeed = {
  countyId: number
  name: string
  code: string
}

type ProviderSeedRow = {
  name: string
  countyId: number
}

type KenyaSeedFile = {
  counties: CountySeed[]
  subCounties: SubCountySeed[]
}

type PanelSeedFile = {
  source: { code: string; name: string; description?: string }
  packageSlug: string
  providers: ProviderSeedRow[]
}

function readJson<T>(filename: string): T {
  const filePath = path.join(__dirname, 'data', filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

/**
 * Seed Kenya counties/sub-counties, provider sources, master providers,
 * and the Mfanisi Go package panel. Idempotent via upserts / skipDuplicates.
 */
export async function seedHealthcareProviders(prisma: PrismaClient): Promise<void> {
  const kenya = readJson<KenyaSeedFile>('kenya-counties-subcounties.json')
  const panel = readJson<PanelSeedFile>('mfanisi-go-provider-panel.json')

  console.log(`📍 Seeding ${kenya.counties.length} counties...`)
  for (const county of kenya.counties) {
    await prisma.county.upsert({
      where: { id: county.id },
      create: {
        id: county.id,
        code: county.code,
        name: county.name,
        isActive: true,
      },
      update: {
        code: county.code,
        name: county.name,
        isActive: true,
      },
    })
  }

  console.log(`📍 Seeding ${kenya.subCounties.length} sub-counties...`)
  for (const sub of kenya.subCounties) {
    await prisma.subCounty.upsert({
      where: { code: sub.code },
      create: {
        countyId: sub.countyId,
        name: sub.name,
        code: sub.code,
        isActive: true,
      },
      update: {
        countyId: sub.countyId,
        name: sub.name,
        isActive: true,
      },
    })
  }

  console.log(`🏥 Seeding provider source ${panel.source.code}...`)
  const source = await prisma.providerSource.upsert({
    where: { code: panel.source.code },
    create: {
      code: panel.source.code,
      name: panel.source.name,
      description: panel.source.description ?? null,
      isActive: true,
      createdBy: 'seed',
    },
    update: {
      name: panel.source.name,
      description: panel.source.description ?? null,
      isActive: true,
    },
  })

  const pkg = await prisma.package.findFirst({
    where: { slug: panel.packageSlug },
    select: { id: true, name: true },
  })

  if (!pkg) {
    console.warn(
      `⚠️  Package slug "${panel.packageSlug}" not found; skipping provider panel membership`,
    )
  }

  console.log(`🏥 Upserting ${panel.providers.length} healthcare providers...`)
  const providerIds: number[] = []

  for (const row of panel.providers) {
    const existing = await prisma.healthcareProvider.findFirst({
      where: {
        name: row.name,
        countyId: row.countyId,
        sourceId: source.id,
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.healthcareProvider.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          // Keep subCountyId null — not present in LCT/CSP panel file
          subCountyId: null,
        },
      })
      providerIds.push(existing.id)
    } else {
      const created = await prisma.healthcareProvider.create({
        data: {
          name: row.name,
          countyId: row.countyId,
          subCountyId: null,
          sourceId: source.id,
          isActive: true,
          createdBy: 'seed',
        },
        select: { id: true },
      })
      providerIds.push(created.id)
    }
  }

  if (pkg) {
    console.log(`🔗 Linking ${providerIds.length} providers to package ${pkg.name}...`)
    await prisma.packageProvider.createMany({
      data: providerIds.map((healthcareProviderId) => ({
        packageId: pkg.id,
        healthcareProviderId,
        isActive: true,
        createdBy: 'seed',
      })),
      skipDuplicates: true,
    })
  }

  console.log('✅ Healthcare providers seed complete')
}
