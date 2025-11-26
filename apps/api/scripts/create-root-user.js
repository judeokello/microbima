#!/usr/bin/env node

/**
 * Create Root User Script (Node.js version)
 * 
 * This script creates a root user if no users exist in the database.
 * It is idempotent and safe to run multiple times.
 * 
 * Requirements:
 * - ROOT_USER_EMAIL environment variable
 * - ROOT_USER_PASSWORD environment variable
 * - ROOT_USER_DISPLAY_NAME environment variable (optional, defaults to "Root admin")
 * - DATABASE_URL environment variable
 * - PORT environment variable (optional, defaults to 3001)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`📋 ${message}`, 'cyan');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envFiles = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '../.env'),
    path.join(process.cwd(), '../../.env'),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      info(`Loading environment variables from: ${envFile}`);
      const envContent = fs.readFileSync(envFile, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        // Parse KEY=VALUE format
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          const value = trimmedLine.substring(equalIndex + 1).trim();
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = cleanValue;
          }
        }
      }
      break;
    }
  }
}

/**
 * Check if we're in the right directory
 */
function checkDirectory() {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    error('Please run this script from the API directory (apps/api)');
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvVars() {
  const required = ['ROOT_USER_EMAIL', 'ROOT_USER_PASSWORD', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/**
 * Check if users exist in the database using Prisma
 */
async function checkUsersExist(prisma) {
  try {
    info('Querying user count from auth.users...');
    
    // Query the auth.users table directly
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM auth.users
    `;
    
    const userCount = result[0]?.count ?? 0;
    return userCount;
  } catch (err) {
    warn(`Error querying user count: ${err instanceof Error ? err.message : String(err)}`);
    // If query fails, assume no users exist (safer to try creating)
    return 0;
  }
}

/**
 * Create root user via API call
 */
async function createRootUser() {
  const email = process.env.ROOT_USER_EMAIL;
  const password = process.env.ROOT_USER_PASSWORD;
  const displayName = process.env.ROOT_USER_DISPLAY_NAME ?? 'Root admin';
  const port = process.env.PORT ?? '3001';
  // Controller is @Controller('internal/bootstrap') with global prefix 'internal'
  // The global prefix is prepended, so the path is /internal/internal/bootstrap/create-user
  // But NestJS might handle this differently - try /internal/bootstrap/create-user first
  // (matching what agent-registration uses)
  const apiUrl = `http://localhost:${port}/internal/bootstrap/create-user`;
  const correlationId = `root-user-create-${Date.now()}`;

  info(`Email: ${email}`);
  info(`Display Name: ${displayName}`);
  info(`Calling bootstrap API endpoint: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
      }),
    });

    const responseBody = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseBody);
    } catch {
      responseData = { message: responseBody };
    }

    if (response.status === 201 || response.status === 200) {
      success('Root user created successfully!');
      info(`Response: ${JSON.stringify(responseData, null, 2)}`);
      return true;
    } else {
      error(`Failed to create root user`);
      info(`HTTP Status: ${response.status}`);
      info(`Response: ${JSON.stringify(responseData, null, 2)}`);
      return false;
    }
  } catch (err) {
    error(`Error calling API: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('👤 Checking if root user needs to be created...', 'cyan');

    // Check directory
    checkDirectory();

    // Load .env file if it exists (for local development)
    loadEnvFile();

    // Validate environment variables
    validateEnvVars();

    // Initialize Prisma Client
    const prisma = new PrismaClient();

    try {
      // Check if users exist
      info('Checking if users exist in database...');
      const userCount = await checkUsersExist(prisma);

      info(`User count: ${userCount}`);

      if (userCount > 0) {
        success(`Users already exist in database (count: ${userCount})`);
        info('Skipping root user creation');
        process.exit(0);
      }

      info(`No users found in database (count: ${userCount})`);
      log('🚀 Creating root user...', 'cyan');

      // Create root user
      const created = await createRootUser();

      if (created) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } finally {
      // Disconnect Prisma Client
      await prisma.$disconnect();
    }
  } catch (err) {
    error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();

