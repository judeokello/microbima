#!/bin/bash

# Production Database Migration Helper Script
# This script helps identify and resolve drift issues in production

set -e

echo "🔍 Production Database Migration Helper"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the API directory (apps/api)"
    exit 1
fi

echo "📊 Checking migration status..."
echo ""

# Run migration status check
npx prisma migrate status

echo ""
echo "🔍 If drift is detected, here's how to resolve it:"
echo ""
echo "1. Identify the problematic migration from the output above"
echo "2. Use this command to mark it as applied:"
echo "   npx prisma migrate resolve --applied [MIGRATION_NAME]"
echo ""
echo "3. Common migration names in this project:"
echo "   - 20250903093411_init"
echo "   - 20251016141718_add_email_phone_to_dependants"
echo "   - 20251025115644_add_product_management_tables"
echo ""
echo "4. After resolving drift, retry the migration:"
echo "   npx prisma migrate deploy"
echo ""
echo "5. Then run seed data:"
echo "   npx prisma db execute --file prisma/seed-product-management.sql --schema prisma/schema.prisma"
echo "   npx prisma db execute --file prisma/migrate-existing-customers.sql --schema prisma/schema.prisma"
echo ""
echo "⚠️  Always verify the migration status after resolution!"
