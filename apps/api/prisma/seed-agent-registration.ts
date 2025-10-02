import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedAgentRegistrationData() {
  console.log('🌱 Starting Agent Registration seed data...')

  // Seed DeferredRequirementDefault data
  const deferredRequirements = [
    // Spouse requirements
    { entityKind: 'SPOUSE', fieldPath: 'gender', isRequired: true },
    { entityKind: 'SPOUSE', fieldPath: 'idType', isRequired: true },
    { entityKind: 'SPOUSE', fieldPath: 'idNumber', isRequired: true },
    
    // Child requirements  
    { entityKind: 'CHILD', fieldPath: 'gender', isRequired: true },
    { entityKind: 'CHILD', fieldPath: 'idType', isRequired: true },
    { entityKind: 'CHILD', fieldPath: 'idNumber', isRequired: true },
    
    // Beneficiary requirements
    { entityKind: 'BENEFICIARY', fieldPath: 'firstName', isRequired: true },
    { entityKind: 'BENEFICIARY', fieldPath: 'lastName', isRequired: true },
    { entityKind: 'BENEFICIARY', fieldPath: 'idType', isRequired: true },
    { entityKind: 'BENEFICIARY', fieldPath: 'idNumber', isRequired: true },
  ]

  // Upsert each requirement
  for (const req of deferredRequirements) {
    await prisma.deferredRequirementDefault.upsert({
      where: {
        entityKind_fieldPath: {
          entityKind: req.entityKind as any,
          fieldPath: req.fieldPath
        }
      },
      update: {},
      create: {
        entityKind: req.entityKind as any,
        fieldPath: req.fieldPath,
        isRequired: req.isRequired
      }
    })
    console.log(`✅ Upserted requirement: ${req.entityKind}.${req.fieldPath}`)
  }

  console.log('✅ Agent Registration seed data completed!')
}

async function main() {
  try {
    await seedAgentRegistrationData()
  } catch (error) {
    console.error('❌ Error seeding Agent Registration data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
