#!/bin/bash

# Create Root User Script
# This script creates a root user if no users exist in the database
# It is idempotent and safe to run multiple times

set -e

echo "👤 Checking if root user needs to be created..."

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the API directory (apps/api)"
    exit 1
fi

# Load .env file if it exists (for local development)
# Try multiple possible .env file locations
ENV_FILES=(
    ".env"
    "../.env"
    "../../.env"
)

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        echo "📄 Loading environment variables from: $env_file"
        # Export variables from .env file
        # Use set -a to automatically export all variables
        set -a
        # Source the file, but filter out comments and empty lines first
        # This creates a temporary file with cleaned content
        TEMP_ENV=$(mktemp)
        grep -v '^#' "$env_file" | grep -v '^[[:space:]]*$' > "$TEMP_ENV"
        source "$TEMP_ENV"
        rm -f "$TEMP_ENV"
        set +a
        break
    fi
done

# Check if required environment variables are set
if [ -z "$ROOT_USER_EMAIL" ]; then
    echo "❌ Error: ROOT_USER_EMAIL environment variable is not set"
    exit 1
fi

if [ -z "$ROOT_USER_PASSWORD" ]; then
    echo "❌ Error: ROOT_USER_PASSWORD environment variable is not set"
    exit 1
fi

# Set display name (default to "Root admin" if not provided)
DISPLAY_NAME="${ROOT_USER_DISPLAY_NAME:-Root admin}"

echo "📧 Email: $ROOT_USER_EMAIL"
echo "👤 Display Name: $DISPLAY_NAME"

# Check if users exist in auth.users table
echo "🔍 Checking if users exist in database..."

# Get the user count using psql (more reliable than prisma db execute for getting results)
# First check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Use psql to get the count directly (t = tuples only, A = unaligned output)
echo "📊 Querying user count from auth.users..."
USER_COUNT=$(echo "SELECT COUNT(*) FROM auth.users;" | psql "$DATABASE_URL" -t -A 2>&1 | grep -oE '^[0-9]+' | head -1 || echo "0")

# If psql failed, try with prisma db execute as fallback
if [ -z "$USER_COUNT" ] || ! [[ "$USER_COUNT" =~ ^[0-9]+$ ]]; then
    echo "⚠️  psql query failed, trying alternative method..."
    # Fallback: Use a simple Node.js script with Prisma Client
    USER_COUNT=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$queryRaw\`SELECT COUNT(*)::int as count FROM auth.users\`
          .then(result => { console.log(result[0]?.count || 0); process.exit(0); })
          .catch(err => { console.error(err); process.exit(1); });
    " 2>/dev/null | grep -oE '^[0-9]+' | head -1 || echo "0")
fi

# Convert to integer (handle potential non-numeric output)
USER_COUNT=$((USER_COUNT + 0))

echo "📊 User count: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
    echo "✅ Users already exist in database (count: $USER_COUNT)"
    echo "⏭️  Skipping root user creation"
    exit 0
fi

echo "📊 No users found in database (count: $USER_COUNT)"
echo "🚀 Creating root user..."

# Make API call to create user
# Use PORT environment variable if set (Fly.io sets this to 3000), otherwise default to 3001 for local development
API_PORT="${PORT:-3001}"
API_URL="http://localhost:${API_PORT}/api/internal/bootstrap/create-user"
CORRELATION_ID="root-user-create-$(date +%s)"

echo "📡 Calling bootstrap API endpoint: $API_URL"

# Make the API call
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-correlation-id: $CORRELATION_ID" \
    -d "{
        \"email\": \"$ROOT_USER_EMAIL\",
        \"password\": \"$ROOT_USER_PASSWORD\",
        \"displayName\": \"$DISPLAY_NAME\"
    }" 2>&1)

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check if the request was successful
if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Root user created successfully!"
    echo "📋 Response: $BODY"
    exit 0
else
    echo "❌ Failed to create root user"
    echo "📋 HTTP Status: $HTTP_CODE"
    echo "📋 Response: $BODY"
    exit 1
fi

