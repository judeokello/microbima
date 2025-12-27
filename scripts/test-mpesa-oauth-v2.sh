#!/bin/bash

# M-Pesa OAuth Test Script (Simplified Version)
# Tests M-Pesa Daraja API OAuth token generation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Find .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/apps/api/.env" ]; then
    ENV_FILE="$PROJECT_ROOT/apps/api/.env"
elif [ -f "$PROJECT_ROOT/.env" ]; then
    ENV_FILE="$PROJECT_ROOT/.env"
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

echo "🔐 M-Pesa OAuth Test"
echo "==================="
echo ""

# Read config
CONSUMER_KEY=$(grep "^MPESA_CONSUMER_KEY=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
CONSUMER_SECRET=$(grep "^MPESA_CONSUMER_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
ENVIRONMENT=$(grep "^MPESA_ENVIRONMENT=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ' || echo "sandbox")

if [ -z "$CONSUMER_KEY" ] || [ -z "$CONSUMER_SECRET" ]; then
    echo -e "${RED}❌ Missing credentials in .env${NC}"
    exit 1
fi

# Determine base URL
if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://api.safaricom.co.ke/mpesa"
else
    BASE_URL="https://sandbox.safaricom.co.ke/mpesa"
fi

OAUTH_URL="${BASE_URL}/oauth/v1/generate?grant_type=client_credentials"

echo "Environment: $ENVIRONMENT"
echo "Base URL: $BASE_URL"
echo "OAuth URL: $OAUTH_URL"
echo ""

# Create auth
AUTH=$(echo -n "${CONSUMER_KEY}:${CONSUMER_SECRET}" | base64)

echo "Sending OAuth request..."
echo ""

# Make request - use simple approach
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --max-time 15 --connect-timeout 10 \
  -X GET "$OAUTH_URL" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" 2>&1)

# Extract HTTP code and body
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2 || echo "000")
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS! OAuth authentication working${NC}"
    echo ""
    if command -v jq &> /dev/null; then
        echo "$RESPONSE_BODY" | jq '.'
        ACCESS_TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.access_token // empty')
        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo ""
            echo -e "${GREEN}✅ Access token received!${NC}"
        fi
    else
        echo "Response: $RESPONSE_BODY"
    fi
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ FAILED: 401 Unauthorized${NC}"
    echo "Response: $RESPONSE_BODY"
    echo ""
    echo "Check your MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ FAILED: 404 Not Found${NC}"
    echo "Response: $RESPONSE_BODY"
    echo ""
    echo "Check your MPESA_BASE_URL or MPESA_ENVIRONMENT"
    exit 1
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ FAILED: Connection error${NC}"
    echo "Response: $RESPONSE_BODY"
    echo ""
    echo "Possible network issue or timeout"
    exit 1
else
    echo -e "${RED}❌ FAILED: HTTP $HTTP_CODE${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

echo ""
echo "✅ Test complete!"


