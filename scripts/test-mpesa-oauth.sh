#!/bin/bash

# M-Pesa OAuth Test Script
# Tests M-Pesa Daraja API OAuth token generation
# This helps verify credentials and base URL configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔐 M-Pesa OAuth Authentication Test"
echo "===================================="
echo ""

# Check if .env file exists (try multiple locations)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Try different .env file locations
if [ -f "$PROJECT_ROOT/apps/api/.env" ]; then
    ENV_FILE="$PROJECT_ROOT/apps/api/.env"
elif [ -f "$PROJECT_ROOT/.env" ]; then
    ENV_FILE="$PROJECT_ROOT/.env"
elif [ -f "apps/api/.env" ]; then
    ENV_FILE="apps/api/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "   Tried:"
    echo "   - $PROJECT_ROOT/apps/api/.env"
    echo "   - $PROJECT_ROOT/.env"
    echo "   - apps/api/.env"
    echo "   - .env"
    echo ""
    echo "   Please ensure your .env file exists in one of these locations."
    exit 1
fi

echo "📋 Reading configuration from $ENV_FILE..."
echo ""

# Read M-Pesa configuration from .env
# Use grep to extract values, handling quoted and unquoted values
CONSUMER_KEY=$(grep "^MPESA_CONSUMER_KEY=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
CONSUMER_SECRET=$(grep "^MPESA_CONSUMER_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
ENVIRONMENT=$(grep "^MPESA_ENVIRONMENT=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ' || echo "sandbox")
BASE_URL=$(grep "^MPESA_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ' || echo "")

# Determine base URL if not set
if [ -z "$BASE_URL" ]; then
    if [ "$ENVIRONMENT" = "production" ]; then
        BASE_URL="https://api.safaricom.co.ke/mpesa"
    else
        BASE_URL="https://sandbox.safaricom.co.ke/mpesa"
    fi
    echo -e "${YELLOW}⚠️  MPESA_BASE_URL not set in .env, using default for $ENVIRONMENT: $BASE_URL${NC}"
    echo ""
fi

# Validate required values
if [ -z "$CONSUMER_KEY" ]; then
    echo -e "${RED}❌ Error: MPESA_CONSUMER_KEY not found in .env${NC}"
    exit 1
fi

if [ -z "$CONSUMER_SECRET" ]; then
    echo -e "${RED}❌ Error: MPESA_CONSUMER_SECRET not found in .env${NC}"
    exit 1
fi

# Display configuration (mask secrets)
echo "📝 Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   Base URL: $BASE_URL"
echo "   Consumer Key: ${CONSUMER_KEY:0:10}...${CONSUMER_KEY: -4}"
echo "   Consumer Secret: ${CONSUMER_SECRET:0:10}...${CONSUMER_SECRET: -4}"
echo ""

# Construct OAuth URL
OAUTH_URL="${BASE_URL}/oauth/v1/generate?grant_type=client_credentials"

echo "🔗 OAuth URL: $OAUTH_URL"
echo ""

# Create Basic Auth header
echo "🔑 Creating Basic Auth header..."
CREDENTIALS="${CONSUMER_KEY}:${CONSUMER_SECRET}"
AUTH_HEADER=$(echo -n "$CREDENTIALS" | base64)

echo "📤 Sending OAuth request..."
echo ""

# Make OAuth request (with 15 second timeout)
# Use a temp file to avoid issues with response parsing
TEMP_FILE=$(mktemp)
TEMP_STDERR=$(mktemp)

# Make request with explicit timeout and error handling
set +e  # Don't exit on error
curl -s -w "%{http_code}" -o "$TEMP_FILE" --max-time 15 --connect-timeout 10 \
  -X GET "$OAUTH_URL" \
  -H "Authorization: Basic $AUTH_HEADER" \
  -H "Content-Type: application/json" \
  2>"$TEMP_STDERR"
CURL_EXIT_CODE=$?
set -e  # Re-enable exit on error

# Get HTTP code from temp file (last 3 characters)
HTTP_CODE=$(tail -c 4 "$TEMP_FILE" 2>/dev/null | grep -oE '[0-9]{3}' || echo "000")

# Extract HTTP status code (should be last 3 digits)
HTTP_CODE=$(echo "$HTTP_CODE" | grep -oE '[0-9]{3}$' || echo "000")

# Extract response body
RESPONSE_BODY=$(cat "$TEMP_FILE" 2>/dev/null || echo "")

# Check for curl errors
CURL_ERROR=$(cat "$TEMP_STDERR" 2>/dev/null || echo "")

rm -f "$TEMP_FILE" "$TEMP_STDERR"

# Handle curl exit codes
if [ $CURL_EXIT_CODE -ne 0 ]; then
    if [ $CURL_EXIT_CODE -eq 28 ]; then
        echo -e "${RED}❌ FAILED: Request timeout (exceeded 15 seconds)${NC}"
        echo ""
        echo "Possible issues:"
        echo "1. ❌ Network connectivity problem"
        echo "2. ❌ M-Pesa API is slow or unreachable"
        echo "3. ❌ Firewall/proxy blocking the request"
        echo ""
        if [ -n "$CURL_ERROR" ]; then
            echo "Curl error: $CURL_ERROR"
        fi
        exit 1
    elif [ $CURL_EXIT_CODE -eq 7 ]; then
        echo -e "${RED}❌ FAILED: Could not connect to M-Pesa API${NC}"
        echo ""
        echo "Possible issues:"
        echo "1. ❌ DNS resolution failed"
        echo "2. ❌ Network unreachable"
        echo "3. ❌ Firewall blocking connection"
        echo ""
        if [ -n "$CURL_ERROR" ]; then
            echo "Curl error: $CURL_ERROR"
        fi
        exit 1
    else
        echo -e "${RED}❌ FAILED: Curl error (exit code: $CURL_EXIT_CODE)${NC}"
        echo ""
        if [ -n "$CURL_ERROR" ]; then
            echo "Curl error: $CURL_ERROR"
        fi
        exit 1
    fi
fi

echo "📥 Response:"
echo "   HTTP Status: $HTTP_CODE"
echo ""

# Check response
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS! OAuth authentication working${NC}"
    echo ""
    
    # Parse and display token info
    if command -v jq &> /dev/null; then
        ACCESS_TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.access_token // empty')
        EXPIRES_IN=$(echo "$RESPONSE_BODY" | jq -r '.expires_in // empty')
        
        if [ -n "$ACCESS_TOKEN" ]; then
            echo "🎟️  Access Token: ${ACCESS_TOKEN:0:20}...${ACCESS_TOKEN: -10}"
            echo "⏰ Expires In: ${EXPIRES_IN} seconds"
            echo ""
            echo -e "${GREEN}✅ Your M-Pesa credentials are correct!${NC}"
            echo -e "${GREEN}✅ Base URL is correct!${NC}"
            echo ""
            echo "🚀 You can now test STK Push!"
        else
            echo -e "${YELLOW}⚠️  Response received but no access_token found${NC}"
            echo "Response body: $RESPONSE_BODY"
        fi
    else
        echo "Response body: $RESPONSE_BODY"
        echo ""
        echo -e "${GREEN}✅ OAuth request successful!${NC}"
        echo ""
        echo "💡 Tip: Install 'jq' for better JSON parsing:"
        echo "   sudo dnf install jq"
    fi
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ FAILED: 404 Not Found${NC}"
    echo ""
    echo "Possible issues:"
    echo "1. ❌ Wrong MPESA_BASE_URL in .env"
    echo "   Current: $BASE_URL"
    echo "   Expected for $ENVIRONMENT:"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "      https://api.safaricom.co.ke/mpesa"
    else
        echo "      https://sandbox.safaricom.co.ke/mpesa"
    fi
    echo ""
    echo "2. ❌ Wrong MPESA_ENVIRONMENT"
    echo "   Current: $ENVIRONMENT"
    echo "   Should be 'sandbox' for testing"
    echo ""
    echo "3. ❌ M-Pesa API endpoint changed (unlikely)"
    echo ""
    echo "Response body: $RESPONSE_BODY"
    exit 1
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ FAILED: 401 Unauthorized${NC}"
    echo ""
    echo "Possible issues:"
    echo "1. ❌ Wrong MPESA_CONSUMER_KEY"
    echo "2. ❌ Wrong MPESA_CONSUMER_SECRET"
    echo "3. ❌ Credentials don't match environment (sandbox vs production)"
    echo ""
    echo "Response body: $RESPONSE_BODY"
    exit 1
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ FAILED: Connection Error${NC}"
    echo ""
    if [ -n "$CURL_ERROR" ]; then
        echo "Curl error: $CURL_ERROR"
    else
        echo "Possible issues:"
        echo "1. ❌ Network connectivity problem"
        echo "2. ❌ DNS resolution failed"
        echo "3. ❌ Firewall blocking request"
        echo "4. ❌ M-Pesa API endpoint unreachable"
    fi
    echo ""
    echo "Try testing the URL manually:"
    echo "curl -v \"$OAUTH_URL\""
    exit 1
else
    echo -e "${RED}❌ FAILED: HTTP $HTTP_CODE${NC}"
    echo ""
    echo "Response body: $RESPONSE_BODY"
    exit 1
fi

echo ""
echo "===================================="
echo "✅ OAuth test complete!"

