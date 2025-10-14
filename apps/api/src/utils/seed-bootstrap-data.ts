/**
 * Post-Bootstrap Seed Utility
 * 
 * This function seeds essential data that requires a createdBy user reference.
 * It should be called AFTER creating the bootstrap user.
 * 
 * @param userId - The UUID of the bootstrap user
 */

import { PrismaClient } from '@prisma/client';

export async function seedBootstrapData(userId: string): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('🌱 Seeding bootstrap data...');

    // Seed Maisha Poa partner
    const partner = await prisma.partner.upsert({
      where: { id: 1 },
      update: {}, // Don't update if exists
      create: {
        id: 1,
        partnerName: 'Maisha Poa',
        website: 'www.maishapoa.co.ke',
        officeLocation: 'Lotus Plaza, Parklands, Nairobi',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      },
    });

    console.log('✅ Maisha Poa partner seeded:', partner.id);

    // Seed MfanisiGo bundled product
    const product = await prisma.$executeRaw`
      INSERT INTO "bundled_products" ("name", "description", "created_by")
      VALUES ('MfanisiGo', 'Owned by the OOD drivers', ${userId}::uuid)
      ON CONFLICT DO NOTHING
    `;

    console.log('✅ MfanisiGo product seeded');

    console.log('✅ Bootstrap data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding bootstrap data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Alternative: Seed using raw SQL for more control
 */
export async function seedBootstrapDataRaw(userId: string): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('🌱 Seeding bootstrap data (raw SQL)...');

    // Seed Maisha Poa partner
    await prisma.$executeRaw`
      INSERT INTO "partners" ("id", "partnerName", "website", "officeLocation", "isActive", "createdAt", "updatedAt", "createdBy")
      VALUES (
        1,
        'Maisha Poa',
        'www.maishapoa.co.ke',
        'Lotus Plaza, Parklands, Nairobi',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        ${userId}::uuid
      )
      ON CONFLICT (id) DO NOTHING
    `;

    console.log('✅ Maisha Poa partner seeded');

    // Seed MfanisiGo bundled product
    await prisma.$executeRaw`
      INSERT INTO "bundled_products" ("name", "description", "created_by")
      VALUES ('MfanisiGo', 'Owned by the OOD drivers', ${userId}::uuid)
      ON CONFLICT DO NOTHING
    `;

    console.log('✅ MfanisiGo product seeded');

    console.log('✅ Bootstrap data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding bootstrap data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

