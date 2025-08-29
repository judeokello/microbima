require('dotenv').config({ path: '../../.env' });
const { execSync } = require('child_process');

console.log('Starting Prisma Studio with environment variables...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');

try {
  execSync('npx prisma studio', { stdio: 'inherit' });
} catch (error) {
  console.error('Error starting Prisma Studio:', error.message);
}
