#!/bin/bash

# Test STK Push Script
# This script tests the STK Push endpoint with proper error handling

set -e

API_URL="http://localhost:3001"
ENDPOINT="${API_URL}/api/internal/mpesa/stk-push/test"

echo "🧪 Testing STK Push Endpoint"
echo "================================"
echo ""

# Check if API is running
echo "1. Checking if API is running..."
if curl -s -f "${API_URL}/health" > /dev/null 2>&1; then
    echo "   ✅ API is running"
else
    echo "   ❌ API is not running. Please start the API first."
    exit 1
fi

# Check ngrok
echo ""
echo "2. Checking ngrok status..."
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
if [ -n "$NGROK_URL" ]; then
    echo "   ✅ Ngrok is running: $NGROK_URL"
else
    echo "   ⚠️  Ngrok might not be running. Callback URLs may not work."
fi

# Test with invalid account reference (to verify endpoint works)
echo ""
echo "3. Testing endpoint with invalid account reference (should fail with validation error)..."
RESPONSE=$(curl -s -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254111873360",
    "amount": 2.00,
    "accountReference": "32423543",
    "transactionDesc": "Test payment"
  }')

# Extract correlation ID from response if available
CORRELATION_ID=$(echo "$RESPONSE" | jq -r '.error.correlationId // empty' 2>/dev/null || echo "")

if echo "$RESPONSE" | grep -q "NOT_FOUND.*Policy with payment account number"; then
    echo "   ✅ Endpoint is working (validation error as expected)"
    echo "   📝 Response: $(echo "$RESPONSE" | jq -r '.error.message' 2>/dev/null || echo "$RESPONSE")"
elif echo "$RESPONSE" | grep -q "OAuth token request failed"; then
    echo "   ❌ OAuth authentication failed"
    echo "   📝 Error: $(echo "$RESPONSE" | jq -r '.error.message' 2>/dev/null | head -c 200 || echo "$RESPONSE" | head -c 200)"
    echo ""
    echo "   🔍 This means the API cannot authenticate with M-Pesa."
    echo "   📋 Check the API logs below for details."
else
    echo "   ⚠️  Unexpected response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

# Check API logs for OAuth-related entries
echo ""
echo "4. Checking API logs for OAuth activity..."
API_LOG_FILE=".api.log"
if [ -f "$API_LOG_FILE" ]; then
    # Get timestamp from a few seconds ago to now
    CURRENT_TIME=$(date +%s)
    LOG_START_TIME=$((CURRENT_TIME - 10))
    
    # Extract OAuth-related logs from the last 30 seconds
    echo "   📄 Recent OAuth logs from .api.log:"
    echo ""
    
    # Find OAUTH_TOKEN_REQUEST logs
    OAUTH_REQUESTS=$(grep -a "OAUTH_TOKEN_REQUEST" "$API_LOG_FILE" | tail -3 | sed 's/.*{"event"/{"event"/' | sed 's/.*LOG.*MpesaDarajaApiService.*//' | grep -o '{"event":"OAUTH_TOKEN_REQUEST"[^}]*}' | head -1)
    if [ -n "$OAUTH_REQUESTS" ]; then
        echo "   📤 OAuth Request:"
        echo "$OAUTH_REQUESTS" | jq -r '. | "      URL: \(.url)\n      Correlation ID: \(.correlationId)\n      Timestamp: \(.timestamp)"' 2>/dev/null || echo "      $OAUTH_REQUESTS"
        echo ""
    fi
    
    # Find OAUTH_TOKEN_ERROR logs
    OAUTH_ERRORS=$(grep -a "OAUTH_TOKEN_ERROR" "$API_LOG_FILE" | tail -3 | sed 's/.*{"event"/{"event"/' | sed 's/.*ERROR.*MpesaDarajaApiService.*//' | grep -o '{"event":"OAUTH_TOKEN_ERROR"[^}]*}' | head -1)
    if [ -n "$OAUTH_ERRORS" ]; then
        echo "   ❌ OAuth Error:"
        echo "$OAUTH_ERRORS" | jq -r '. | "      Status: \(.status) \(.statusText)\n      URL: \(.url)\n      Base URL: \(.baseUrl)\n      Environment: \(.environment)\n      Error Body: \(.errorBody)\n      Correlation ID: \(.correlationId)"' 2>/dev/null || echo "      $OAUTH_ERRORS"
        echo ""
    fi
    
    # If no OAuth logs found, show last few lines
    if [ -z "$OAUTH_REQUESTS" ] && [ -z "$OAUTH_ERRORS" ]; then
        echo "   ⚠️  No OAuth logs found in recent entries."
        echo "   📝 Last 5 log lines:"
        tail -5 "$API_LOG_FILE" | sed 's/^/      /'
        echo ""
    fi
else
    echo "   ⚠️  API log file (.api.log) not found."
    echo "   💡 Logs are usually in the terminal where you ran 'pnpm dev:api'"
    echo ""
fi

echo ""
echo "================================"
echo "📋 Expected Log Flow:"
echo ""
echo "When STK Push works correctly, you should see these logs in .api.log:"
echo ""
echo "1. STK_PUSH_INITIATION_START"
echo "   → Shows phone number, amount, account reference"
echo ""
echo "2. STK_PUSH_REQUEST_CREATED"
echo "   → Shows the database record was created"
echo ""
echo "3. OAUTH_TOKEN_REQUEST"
echo "   → Shows the OAuth URL being called"
echo "   → Should be: https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials"
echo ""
echo "4. OAUTH_TOKEN_GENERATED (success) OR OAUTH_TOKEN_ERROR (failure)"
echo "   → Success: Shows access token was received"
echo "   → Failure: Shows HTTP status and error details"
echo ""
echo "5. STK_PUSH_SUCCESS (if OAuth worked)"
echo "   → Shows CheckoutRequestID from M-Pesa"
echo "   → Then M-Pesa sends STK Push to your phone"
echo ""
echo "6. STK_PUSH_CALLBACK_RECEIVED (when customer responds)"
echo "   → Shows callback from M-Pesa with result"
echo ""
echo "================================"
echo "📋 Next Steps:"
echo ""
echo "If OAuth is failing (404 error):"
echo "1. ✅ Verify M-Pesa credentials in apps/api/.env:"
echo "   - MPESA_CONSUMER_KEY"
echo "   - MPESA_CONSUMER_SECRET"
echo "   - MPESA_ENVIRONMENT=sandbox"
echo "   - MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa (optional)"
echo ""
echo "2. ✅ Test OAuth directly:"
echo "   ./scripts/test-mpesa-oauth-simple.sh"
echo ""
echo "3. ✅ If OAuth test works but API doesn't:"
echo "   - Restart the API"
echo "   - Check that API is reading from correct .env file"
echo ""
echo "If OAuth works but STK Push doesn't arrive:"
echo "1. ✅ Verify ngrok is running and URL matches .env"
echo "2. ✅ Check phone number format (must be 254XXXXXXXXX)"
echo "3. ✅ Verify MPESA_BUSINESS_SHORT_CODE=174379 (sandbox)"
echo "4. ✅ Check ngrok web interface: http://127.0.0.1:4040"
echo ""

