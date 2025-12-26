#!/bin/bash

# Simple M-Pesa OAuth Test (matches Postman behavior)
# Uses curl -u flag instead of manual Basic Auth header

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find .env
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

echo "🔐 M-Pesa OAuth Test (Postman-style)"
echo "===================================="
echo ""

# Read credentials
CONSUMER_KEY=$(grep "^MPESA_CONSUMER_KEY=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
CONSUMER_SECRET=$(grep "^MPESA_CONSUMER_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')

if [ -z "$CONSUMER_KEY" ] || [ -z "$CONSUMER_SECRET" ]; then
    echo -e "${RED}❌ Missing credentials${NC}"
    exit 1
fi

echo "📋 Configuration:"
echo "   Consumer Key: ${CONSUMER_KEY:0:20}..."
echo "   URL: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
echo ""

# Test OAuth using curl -u (same as Postman Basic Auth)
echo "📤 Sending OAuth request..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 15 \
  -X GET "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  -u "${CONSUMER_KEY}:${CONSUMER_SECRET}")

# Extract HTTP code (last line) and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "📥 Response:"
echo "   HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS! OAuth authentication working${NC}"
    echo ""
    if command -v jq &> /dev/null; then
        echo "$BODY" | jq '.'
        ACCESS_TOKEN=$(echo "$BODY" | jq -r '.access_token // empty')
        EXPIRES_IN=$(echo "$BODY" | jq -r '.expires_in // empty')
        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo ""
            echo -e "${GREEN}✅ Access Token: ${ACCESS_TOKEN:0:20}...${NC}"
            echo -e "${GREEN}✅ Expires In: ${EXPIRES_IN} seconds${NC}"
        fi
    else
        echo "$BODY"
    fi
    echo ""
    echo -e "${GREEN}✅ Your M-Pesa credentials are correct!${NC}"
    echo -e "${GREEN}✅ You can now test STK Push!${NC}"
    exit 0
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ FAILED: 401 Unauthorized${NC}"
    echo "Response: $BODY"
    echo ""
    echo "Check your MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ FAILED: 404 Not Found${NC}"
    echo "Response: $BODY"
    exit 1
else
    echo -e "${RED}❌ FAILED: HTTP $HTTP_CODE${NC}"
    echo "Response: $BODY"
    exit 1
fi
