import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seeding...');

  // Create a simple partner
  const partner = await prisma.partner.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      partnerName: 'Test Partner',
      website: 'https://test.com',
      officeLocation: 'Test Location',
      isActive: true,
    },
  });

  console.log('✅ Created partner:', partner.id);

  // Create a simple customer
  const customer = await prisma.customer.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '254700000000',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      idType: 'NATIONAL_ID',
      idNumber: '12345678',
      status: 'KYC_VERIFIED',
      onboardingStep: 'ACTIVE',
      createdByPartnerId: partner.id,
    },
  });

  console.log('✅ Created customer:', customer.id);

  console.log('✅ Simple seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
