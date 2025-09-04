import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Maisha Poa partner
  const maishaPoaPartner = await prisma.partner.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      partnerName: 'Maisha Poa',
      website: 'https://www.maishapoa.co.ke',
      officeLocation: 'Lotus Plaza, parklands',
      isActive: true,
      partnerContacts: {
        create: [
          {
            contactName: 'John Mwangi',
            contactPhone: '254700123456',
            contactEmail: 'john@maishapoa.co.ke',
            isPrimary: true,
          },
          {
            contactName: 'Sarah Wanjiku',
            contactPhone: '254700123457',
            contactEmail: 'sarah@maishapoa.co.ke',
            isPrimary: false,
          },
        ],
      },
    },
  });

  console.log('✅ Created Maisha Poa partner:', maishaPoaPartner.id);

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '254700000001',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      idType: 'NATIONAL_ID',
      idNumber: '12345678',
      status: 'KYC_VERIFIED',
      onboardingStep: 'ACTIVE',
      createdByPartnerId: maishaPoaPartner.id,
      address: {
        create: {
          street: '123 Main St',
          city: 'Nairobi',
          state: 'Nairobi',
          postalCode: '00100',
          country: 'KE',
        },
      },
      dependants: {
        create: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: new Date('1992-05-15'),
            gender: 'FEMALE',
            relationship: 'SPOUSE',
            createdByPartnerId: maishaPoaPartner.id,
          },
          {
            firstName: 'Junior',
            lastName: 'Doe',
            dateOfBirth: new Date('2015-08-20'),
            gender: 'MALE',
            relationship: 'CHILD',
            createdByPartnerId: maishaPoaPartner.id,
          },
        ],
      },
      beneficiaries: {
        create: [
          {
            firstName: 'Jane',
            middleName: 'Marie',
            lastName: 'Doe',
            dateOfBirth: new Date('1992-05-15'),
            gender: 'FEMALE',
            idType: 'NATIONAL_ID',
            idNumber: '87654321',
            relationship: 'SPOUSE',
            percentage: 50,
            createdByPartnerId: maishaPoaPartner.id,
          },
          {
            firstName: 'Junior',
            lastName: 'Doe',
            dateOfBirth: new Date('2015-08-20'),
            gender: 'MALE',
            idType: 'BIRTH_CERTIFICATE',
            idNumber: 'BC-2015-001',
            relationship: 'CHILD',
            percentage: 30,
            createdByPartnerId: maishaPoaPartner.id,
          },
          {
            firstName: 'Sarah',
            lastName: 'Johnson',
            dateOfBirth: new Date('1988-12-10'),
            gender: 'FEMALE',
            idType: 'PASSPORT',
            idNumber: 'P12345678',
            relationship: 'SISTER',
            percentage: 20,
            createdByPartnerId: maishaPoaPartner.id,
          },
        ],
      },
      onboardingProgress: {
        create: {
          currentStep: 'ACTIVE',
          completedSteps: ['BASIC_INFO', 'KYC_VERIFICATION', 'PLAN_SELECTION', 'PAYMENT_SETUP'],
          basicInfoCompleted: true,
          kycCompleted: true,
          planSelected: true,
          paymentSetupCompleted: true,
        },
      },
      kycVerification: {
        create: {
          status: 'VERIFIED',
          verificationMethod: 'MANUAL',
          verifiedAt: new Date(),
          verifiedBy: 'system',
        },
      },
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '254700000002',
      dateOfBirth: new Date('1985-03-15'),
      gender: 'FEMALE',
      idType: 'PASSPORT',
      idNumber: 'A12345678',
      status: 'PENDING_KYC',
      onboardingStep: 'BASIC_INFO',
      createdByPartnerId: maishaPoaPartner.id,
      address: {
        create: {
          street: '456 Oak Ave',
          city: 'Mombasa',
          state: 'Mombasa',
          postalCode: '80100',
          country: 'KE',
        },
      },
      beneficiaries: {
        create: [
          {
            firstName: 'Michael',
            lastName: 'Smith',
            dateOfBirth: new Date('1980-07-20'),
            gender: 'MALE',
            idType: 'MILITARY',
            idNumber: 'MIL-001-2020',
            relationship: 'BROTHER',
            percentage: 100,
            createdByPartnerId: maishaPoaPartner.id,
          },
        ],
      },
      onboardingProgress: {
        create: {
          currentStep: 'BASIC_INFO',
          completedSteps: ['BASIC_INFO'],
          basicInfoCompleted: true,
          kycCompleted: false,
          planSelected: false,
          paymentSetupCompleted: false,
        },
      },
      kycVerification: {
        create: {
          status: 'PENDING',
          verificationMethod: 'MANUAL',
        },
      },
    },
  });

  // Create PartnerCustomer relationships
  await prisma.partnerCustomer.upsert({
    where: {
      partnerId_partnerCustomerId: {
        partnerId: maishaPoaPartner.id,
        partnerCustomerId: 'CUST-001',
      },
    },
    update: {},
    create: {
      partnerId: maishaPoaPartner.id,
      customerId: customer1.id,
      partnerCustomerId: 'CUST-001',
    },
  });

  await prisma.partnerCustomer.upsert({
    where: {
      partnerId_partnerCustomerId: {
        partnerId: maishaPoaPartner.id,
        partnerCustomerId: 'CUST-002',
      },
    },
    update: {},
    create: {
      partnerId: maishaPoaPartner.id,
      customerId: customer2.id,
      partnerCustomerId: 'CUST-002',
    },
  });

  // Create sample policies with paymentCadence
  await prisma.policy.upsert({
    where: { policyNumber: 'POL-001-2024' },
    update: {},
    create: {
      policyNumber: 'POL-001-2024',
      customerId: customer1.id,
      productName: 'Health Plus',
      planName: 'Gold',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      premium: 5000.00,
      frequency: 'MONTHLY',
      paymentCadence: 30, // 30 days for monthly
    },
  });

  await prisma.policy.upsert({
    where: { policyNumber: 'POL-002-2024' },
    update: {},
    create: {
      policyNumber: 'POL-002-2024',
      customerId: customer1.id,
      productName: 'Life Shield',
      planName: 'Premium',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      premium: 15000.00,
      frequency: 'QUARTERLY',
      paymentCadence: 90, // 90 days for quarterly
    },
  });

  await prisma.policy.upsert({
    where: { policyNumber: 'POL-003-2024' },
    update: {},
    create: {
      policyNumber: 'POL-003-2024',
      customerId: customer2.id,
      productName: 'Motor Insurance',
      planName: 'Basic',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      premium: 25000.00,
      frequency: 'ANNUALLY',
      paymentCadence: 365, // 365 days for annually
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Created ${await prisma.partner.count()} partners`);
  console.log(`📊 Created ${await prisma.customer.count()} customers`);
  console.log(`📊 Created ${await prisma.beneficiary.count()} beneficiaries`);
  console.log(`📊 Created ${await prisma.policy.count()} policies`);
  console.log(`📊 Created ${await prisma.partnerCustomer.count()} partner-customer relationships`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });