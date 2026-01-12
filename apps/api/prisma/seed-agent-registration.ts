import { PrismaClient } from '@prisma/client'

/**
 * Seed Agent Registration Data
 * 
 * This function seeds deferred requirement defaults for agent registration.
 * It can be called standalone or as part of the master seed process.
 * 
 * @param prisma - PrismaClient instance (optional, creates new if not provided)
 */
export async function seedAgentRegistrationData(prismaInstance?: PrismaClient) {
  const prisma = prismaInstance || new PrismaClient()
  const shouldDisconnect = !prismaInstance // Only disconnect if we created the instance

  try {
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
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect()
    }
  }
}

/**
 * Standalone execution (for backward compatibility)
 * This allows the file to still be run directly: ts-node seed-agent-registration.ts
 */
async function main() {
  try {
    await seedAgentRegistrationData()
  } catch (error) {
    console.error('❌ Error seeding Agent Registration data:', error)
    throw error
  }
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
