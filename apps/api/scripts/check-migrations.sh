#!/bin/bash

# Advanced Drift Detection and Resolution Script
# This script provides detailed information about migration drift

set -e

echo "🔍 Advanced Migration Drift Detection"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the API directory (apps/api)"
    exit 1
fi

echo "📊 Detailed Migration Status:"
echo ""

# Get detailed migration status
MIGRATION_OUTPUT=$(npx prisma migrate status 2>&1 || true)

echo "$MIGRATION_OUTPUT"
echo ""

# Check for specific drift indicators
if echo "$MIGRATION_OUTPUT" | grep -q "drift"; then
    echo "🚨 DRIFT DETECTED!"
    echo ""
    echo "📋 Drift Resolution Steps:"
    echo "1. Identify the problematic migration from the output above"
    echo "2. Check what changes are causing the drift"
    echo "3. Resolve using: npx prisma migrate resolve --applied [MIGRATION_NAME]"
    echo ""
    
    # Try to extract migration names from the output
    echo "🔍 Detected migration names:"
    echo "$MIGRATION_OUTPUT" | grep -o "[0-9]\{14\}_[a-zA-Z_]*" | sort -u || echo "   (Could not auto-detect migration names)"
    echo ""
    
elif echo "$MIGRATION_OUTPUT" | grep -q "Database schema is up to date"; then
    echo "✅ No drift detected - database is up to date"
    
elif echo "$MIGRATION_OUTPUT" | grep -q "Following migrations have not yet been applied"; then
    echo "📋 Pending migrations detected:"
    echo "$MIGRATION_OUTPUT" | grep -A 10 "Following migrations have not yet been applied"
    echo ""
    echo "💡 To apply pending migrations:"
    echo "   npx prisma migrate deploy"
    
else
    echo "⚠️  Unknown migration status. Please review the output above."
fi

echo ""
echo "📚 Available Migration Commands:"
echo "   npx prisma migrate status          - Check migration status"
echo "   npx prisma migrate deploy           - Apply pending migrations"
echo "   npx prisma migrate resolve --applied [name] - Mark migration as applied"
echo "   npx prisma migrate reset            - Reset database (DANGEROUS!)"
echo ""
echo "🌱 Seed Data Commands:"
echo "   npx prisma db execute --file prisma/seed-product-management.sql --schema prisma/schema.prisma"
echo "   npx prisma db execute --file prisma/migrate-existing-customers.sql --schema prisma/schema.prisma"
