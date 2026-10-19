import { PrismaClient } from '@prisma/client'

/**
 * Seeds deferred requirement defaults aligned with care-ops completeness:
 * - Spouse: firstName, lastName, idType, idNumber, gender, dateOfBirth
 * - Child: firstName, lastName, dateOfBirth, gender
 * - Beneficiary: firstName, lastName, idType, idNumber, phoneNumber, gender, relationship
 * - Parent: firstName, lastName, relationship, idType, idNumber, gender, dateOfBirth
 */
export async function seedAgentRegistrationData(prismaInstance?: PrismaClient) {
  const prisma = prismaInstance || new PrismaClient()
  const shouldDisconnect = !prismaInstance

  try {
    console.log('🌱 Starting Agent Registration seed data...')

    const deferredRequirements = [
      { entityKind: 'SPOUSE', fieldPath: 'firstName', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'lastName', isRequired: true },
      { entityKind: 'SPOUSE', fieldPath: 'idType', isRequired: true },
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
      { entityKind: 'BENEFICIARY', fieldPath: 'phoneNumber', isRequired: true },
      { entityKind: 'BENEFICIARY', fieldPath: 'gender', isRequired: true },
      { entityKind: 'BENEFICIARY', fieldPath: 'relationship', isRequired: true },

      { entityKind: 'PARENT', fieldPath: 'firstName', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'lastName', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'relationship', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'idType', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'idNumber', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'gender', isRequired: true },
      { entityKind: 'PARENT', fieldPath: 'dateOfBirth', isRequired: true },
    ]

    const retired = [
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
  const prisma = new PrismaClient()
  try {
    await seedAgentRegistrationData(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
