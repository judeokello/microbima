import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { seedAgentRegistrationData } from './seed-agent-registration'

const prisma = new PrismaClient()

/**
 * Master Seed File
 * 
 * This file orchestrates all seeding operations for local development.
 * It runs automatically when you execute `prisma migrate reset` or `npx prisma db seed`.
 * 
 * Order of operations:
 * 1. Create root user (if no users exist)
 * 2. Seed bootstrap data (Maisha Poa partner)
 * 3. Seed product management data (underwriters, products, packages, etc.)
 * 4. Seed payment sequence data
 * 5. Seed agent registration data (deferred requirements)
 * 
 * Note: This file is ONLY used in local development.
 * Staging/production use individual SQL seed files executed via CI/CD.
 */

/**
 * Check if any users exist in auth.users table
 */
async function checkUsersExist(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count FROM auth.users
    `
    const count = Number(result[0]?.count || 0)
    return count > 0
  } catch (error) {
    console.error('❌ Error checking users:', error)
    // If auth.users doesn't exist (e.g., shadow database), assume no users
    return false
  }
}

/**
 * Create root user using Supabase admin client
 */
async function createRootUser(): Promise<string | null> {
  const rootUserEmail = process.env.ROOT_USER_EMAIL
  const rootUserPassword = process.env.ROOT_USER_PASSWORD
  const rootUserDisplayName = process.env.ROOT_USER_DISPLAY_NAME || 'Root admin'

  if (!rootUserEmail || !rootUserPassword) {
    console.warn('⚠️  ROOT_USER_EMAIL or ROOT_USER_PASSWORD not set, skipping root user creation')
    return null
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, skipping root user creation')
    return null
  }

  try {
    console.log('👤 Creating root user...')
    console.log(`📧 Email: ${rootUserEmail}`)
    console.log(`👤 Display Name: ${rootUserDisplayName}`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: user, error } = await supabase.auth.admin.createUser({
      email: rootUserEmail,
      password: rootUserPassword,
      email_confirm: true, // Verify email automatically
      user_metadata: {
        roles: ['registration_admin', 'brand_ambassador'],
        displayName: rootUserDisplayName
      }
    })

    if (error) {
      console.error('❌ Error creating root user:', error.message)
      return null
    }

    if (!user?.user?.id) {
      console.error('❌ User created but no ID returned')
      return null
    }

    console.log(`✅ Root user created successfully: ${user.user.id}`)
    return user.user.id
  } catch (error) {
    console.error('❌ Unexpected error creating root user:', error)
    return null
  }
}

/**
 * Execute a SQL seed file
 */
async function executeSqlSeedFile(filename: string): Promise<void> {
  const filePath = path.join(__dirname, filename)
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  SQL seed file not found: ${filename}`)
    return
  }

  console.log(`📝 Executing SQL seed file: ${filename}`)
  
  try {
    const sql = fs.readFileSync(filePath, 'utf-8')
    await prisma.$executeRawUnsafe(sql)
    console.log(`✅ Completed: ${filename}`)
  } catch (error) {
    console.error(`❌ Error executing ${filename}:`, error)
    throw error
  }
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting master seed process...')
  console.log('=' .repeat(60))

  try {
    // Step 1: Check if users exist, create root user if needed
    const usersExist = await checkUsersExist()
    
    if (!usersExist) {
      console.log('📊 No users found in database')
      await createRootUser()
    } else {
      console.log('✅ Users already exist in database, skipping root user creation')
    }

    console.log('')
    console.log('📦 Seeding application data...')
    console.log('-' .repeat(60))

    // Step 2: Seed bootstrap data (Maisha Poa partner)
    await executeSqlSeedFile('seed-bootstrap.sql')

    // Step 3: Seed product management data (underwriters, products, packages, etc.)
    await executeSqlSeedFile('seed-product-management.sql')

    // Step 4: Seed payment sequence data
    await executeSqlSeedFile('seed-payment-sequence.sql')

    // Step 5: Seed agent registration data (deferred requirements)
    console.log('📝 Seeding agent registration data...')
    await seedAgentRegistrationData(prisma)

    console.log('')
    console.log('=' .repeat(60))
    console.log('✅ Master seed process completed successfully!')
  } catch (error) {
    console.error('')
    console.error('=' .repeat(60))
    console.error('❌ Master seed process failed:', error)
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

