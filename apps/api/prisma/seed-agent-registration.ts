import { PrismaClient } from '@prisma/client'

/**
 * Seed Agent Registration Data
 *
 * Seeds deferred requirement defaults aligned with care-ops / LCT completeness:
 * - Spouse: firstName, lastName, idNumber, gender, dateOfBirth
 * - Child: firstName, lastName, dateOfBirth, gender
 * - Beneficiary: firstName, lastName, idType, idNumber (care-ops only; never sent to LCT)
 *
 * @param prisma - PrismaClient instance (optional, creates new if not provided)
 */
export async function seedAgentRegistrationData(prismaInstance?: PrismaClient) {
  const prisma = prismaInstance || new PrismaClient()
  const shouldDisconnect = !prismaInstance

  try {
    console.log('🌱 Starting Agent Registration seed data...')

    const deferredRequirements = [
      { entityKind: 'SPOUSE', fieldPath: 'firstName', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'lastName', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'idNumber', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'gender', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'dateOfBirth', isRequired: true },

      { entityKind: 'CHILD', fieldPath: 'firstName', isRequired: true },
      { entityKind: 'CHILD', fieldPath: 'lastName', isRequired: true },
      { entityKind: 'CHILD', fieldPath: 'dateOfBirth', isRequired: true },
      { entityKind: 'CHILD', fieldPath: 'gender', isRequired: true },

      { entityKind: 'BENEFICIARY', fieldPath: 'firstName', isRequired: true },
      { entityKind: 'BENEFICIARY', fieldPath: 'lastName', isRequired: true },
      { entityKind: 'BENEFICIARY', fieldPath: 'idType', isRequired: true },
      { entityKind: 'BENEFICIARY', fieldPath: 'idNumber', isRequired: true },
    ]

    // Retire legacy spouse/child idType-only deferrals that are no longer required
    const retired = [
      { entityKind: 'SPOUSE', fieldPath: 'idType' },
      { entityKind: 'CHILD', fieldPath: 'idType' },
      { entityKind: 'CHILD', fieldPath: 'idNumber' },
    ] as const

    for (const req of retired) {
      await prisma.deferredRequirementDefault.deleteMany({
        where: {
          entityKind: req.entityKind as never,
          fieldPath: req.fieldPath,
        },
      })
    }

    for (const req of deferredRequirements) {
      await prisma.deferredRequirementDefault.upsert({
        where: {
          entityKind_fieldPath: {
            entityKind: req.entityKind as never,
            fieldPath: req.fieldPath,
          },
        },
        update: { isRequired: req.isRequired },
        create: {
          entityKind: req.entityKind as never,
          fieldPath: req.fieldPath,
          isRequired: req.isRequired,
        },
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

async function main() {
  try {
    await seedAgentRegistrationData()
  } catch (error) {
    console.error('❌ Error seeding Agent Registration data:', error)
    throw error
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
