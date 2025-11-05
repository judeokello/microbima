#!/bin/bash
# Debug script for verification_required migration
# Run this on staging to diagnose migration issues

set -e

echo "🔍 Debugging Migration: verification_required_to_dependants"
echo "=========================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the API directory (apps/api)"
    exit 1
fi

echo "1️⃣ Checking Prisma version..."
npx prisma --version
echo ""

echo "2️⃣ Checking if migration file exists..."
if [ -f "prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql" ]; then
    echo "✅ Migration file exists"
    echo "   File size: $(wc -l < prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql) lines"
else
    echo "❌ Migration file NOT FOUND!"
    echo "   Expected: prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql"
    exit 1
fi
echo ""

echo "3️⃣ Checking migration status..."
set +e
MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
STATUS_EXIT=$?
set -e
echo "$MIGRATION_STATUS"
echo ""
if [ $STATUS_EXIT -eq 0 ]; then
    echo "✅ No pending migrations"
elif [ $STATUS_EXIT -eq 1 ]; then
    echo "⚠️  Pending migrations detected (exit code 1 is expected)"
else
    echo "❌ Migration status check failed with exit code $STATUS_EXIT"
fi
echo ""

echo "4️⃣ Checking if column already exists in database..."
COLUMN_CHECK=$(echo "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dependants' AND column_name = 'verificationRequired';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1 || true)
echo "$COLUMN_CHECK"
if echo "$COLUMN_CHECK" | grep -q "verificationRequired"; then
    echo "✅ Column already exists in database"
    echo "   If migration is not marked as applied, you may need to:"
    echo "   npx prisma migrate resolve --applied 20251105174320_add_verification_required_to_dependants"
else
    echo "❌ Column does NOT exist - migration needs to be applied"
fi
echo ""

echo "5️⃣ Checking migration history..."
HISTORY_CHECK=$(echo "SELECT migration_name, finished_at, applied_steps_count, rolled_back_at FROM _prisma_migrations WHERE migration_name LIKE '%verification%' ORDER BY started_at DESC LIMIT 5;" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1 || true)
echo "$HISTORY_CHECK"
echo ""

echo "6️⃣ Testing migration SQL syntax..."
echo "   Attempting to execute migration SQL..."
set +e
TEST_RESULT=$(cat prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql | npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1)
TEST_EXIT=$?
set -e
if [ $TEST_EXIT -eq 0 ]; then
    echo "✅ Migration SQL executed successfully"
    echo "$TEST_RESULT"
else
    echo "❌ Migration SQL execution failed (exit code $TEST_EXIT)"
    echo "$TEST_RESULT"
fi
echo ""

echo "7️⃣ Migration file content:"
echo "---"
cat prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql
echo "---"
echo ""

echo "📋 Summary:"
echo "   - Migration file exists: $([ -f "prisma/migrations/20251105174320_add_verification_required_to_dependants/migration.sql" ] && echo '✅' || echo '❌')"
echo "   - Column exists: $(echo "$COLUMN_CHECK" | grep -q "verificationRequired" && echo '✅' || echo '❌')"
echo "   - Migration status: $([ $STATUS_EXIT -eq 0 ] && echo '✅ Up to date' || echo '⚠️  Pending migrations')"
echo ""
echo "💡 Next steps:"
if echo "$COLUMN_CHECK" | grep -q "verificationRequired"; then
    if echo "$MIGRATION_STATUS" | grep -q "20251105174320"; then
        echo "   Migration is pending but column exists. Mark as applied:"
        echo "   npx prisma migrate resolve --applied 20251105174320_add_verification_required_to_dependants"
    fi
else
    echo "   Column doesn't exist. Run migration:"
    echo "   npx prisma migrate deploy"
fi

