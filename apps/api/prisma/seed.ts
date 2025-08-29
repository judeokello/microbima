import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+254700000001',
      dateOfBirth: new Date('1990-01-01'),
      idType: 'NATIONAL_ID',
      idNumber: '12345678',
      status: 'KYC_VERIFIED',
      onboardingStep: 'ACTIVE',
      address: {
        create: {
          street: '123 Main St',
          city: 'Nairobi',
          state: 'Nairobi',
          postalCode: '00100',
          country: 'KE'
        }
      },
      dependents: {
        create: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: new Date('1992-05-15'),
            relationship: 'SPOUSE',
            isBeneficiary: true
          },
          {
            firstName: 'Junior',
            lastName: 'Doe',
            dateOfBirth: new Date('2015-08-20'),
            relationship: 'CHILD',
            isBeneficiary: true
          }
        ]
      },
      beneficiaries: {
        create: [
          {
            firstName: 'Jane',
            middleName: 'Marie',
            lastName: 'Doe',
            idType: 'NATIONAL_ID',
            idNumber: '87654321',
            gender: 'FEMALE'
          },
          {
            firstName: 'Junior',
            lastName: 'Doe',
            idType: 'BIRTH_CERTIFICATE',
            idNumber: 'BC-2015-001',
            gender: 'MALE'
          },
          {
            firstName: 'Sarah',
            lastName: 'Johnson',
            idType: 'PASSPORT',
            idNumber: 'P12345678',
            gender: 'FEMALE'
          }
        ]
      },
      onboardingProgress: {
        create: {
          currentStep: 'ACTIVE',
          completedSteps: ['BASIC_INFO', 'KYC_VERIFICATION', 'PLAN_SELECTION', 'PAYMENT_SETUP'],
          basicInfoCompleted: true,
          kycCompleted: true,
          planSelected: true,
          paymentSetupCompleted: true
        }
      },
      kycVerification: {
        create: {
          status: 'VERIFIED',
          verificationMethod: 'MANUAL',
          verifiedAt: new Date(),
          verifiedBy: 'system'
        }
      }
    }
  })

  const customer2 = await prisma.customer.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '+254700000002',
      dateOfBirth: new Date('1985-03-15'),
      idType: 'PASSPORT',
      idNumber: 'A12345678',
      status: 'PENDING_KYC',
      onboardingStep: 'BASIC_INFO',
      address: {
        create: {
          street: '456 Oak Ave',
          city: 'Mombasa',
          state: 'Mombasa',
          postalCode: '80100',
          country: 'KE'
        }
      },
      beneficiaries: {
        create: [
          {
            firstName: 'Michael',
            lastName: 'Smith',
            idType: 'MILITARY',
            idNumber: 'MIL-001-2020',
            gender: 'MALE'
          }
        ]
      },
      onboardingProgress: {
        create: {
          currentStep: 'BASIC_INFO',
          completedSteps: ['BASIC_INFO'],
          basicInfoCompleted: true,
          kycCompleted: false,
          planSelected: false,
          paymentSetupCompleted: false
        }
      },
      kycVerification: {
        create: {
          status: 'PENDING',
          verificationMethod: 'MANUAL'
        }
      }
    }
  })

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
      paymentCadence: 30  // 30 days for monthly
    }
  })

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
      paymentCadence: 90  // 90 days for quarterly
    }
  })

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
      paymentCadence: 365  // 365 days for annually
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log(`📊 Created ${await prisma.customer.count()} customers`)
  console.log(`📊 Created ${await prisma.beneficiary.count()} beneficiaries`)
  console.log(`📊 Created ${await prisma.policy.count()} policies`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
