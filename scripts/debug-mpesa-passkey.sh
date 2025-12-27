#!/bin/bash

# Debug M-Pesa Passkey Format
# This script helps diagnose passkey issues without exposing the full value

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔍 M-Pesa Passkey Debug Tool"
echo "============================"
echo ""

# Find .env file
ENV_FILE="./apps/api/.env"
if [ ! -f "$ENV_FILE" ]; then
    print_error ".env file not found at $ENV_FILE"
    exit 1
fi

print_info "Reading passkey from $ENV_FILE..."
echo ""

# Extract passkey (handle quotes)
PASSKEY=$(grep "^MPESA_PASSKEY=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')

if [ -z "$PASSKEY" ]; then
    print_error "MPESA_PASSKEY not found in .env"
    exit 1
fi

# Analyze passkey
PASSKEY_LENGTH=${#PASSKEY}
FIRST_10=${PASSKEY:0:10}
LAST_10=${PASSKEY: -10}

echo "📊 Passkey Analysis:"
echo "   Length: $PASSKEY_LENGTH characters"
echo "   First 10 chars: $FIRST_10..."
echo "   Last 10 chars: ...$LAST_10"
echo ""

# Check for common issues
print_info "Checking for common issues..."

# Check length
if [ "$PASSKEY_LENGTH" -gt 200 ]; then
    print_warning "Passkey is VERY LONG ($PASSKEY_LENGTH chars)!"
    echo "   Typical M-Pesa Security Credential: 64-128 characters"
    echo "   Your passkey might be:"
    echo "   - Double-encoded (already Base64, being encoded again)"
    echo "   - Includes extra whitespace/newlines"
    echo "   - Wrong value entirely"
    echo ""
fi

# Check for newlines
if echo "$PASSKEY" | grep -q $'\n'; then
    print_error "Passkey contains newlines! This will break password generation."
    echo "   Fix: Remove newlines from .env file"
    echo ""
fi

# Check for whitespace
if echo "$PASSKEY" | grep -q '[[:space:]]'; then
    print_warning "Passkey contains whitespace! This might cause issues."
    echo "   Fix: Remove all spaces/tabs from passkey in .env file"
    echo ""
fi

# Check if it looks like Base64
if echo "$PASSKEY" | grep -qE '^[A-Za-z0-9+/=]+$'; then
    print_success "Passkey format looks like Base64 (valid characters)"
else
    print_warning "Passkey contains non-Base64 characters"
    echo "   Valid Base64 chars: A-Z, a-z, 0-9, +, /, ="
    echo ""
fi

# Check if it's a typical length
if [ "$PASSKEY_LENGTH" -ge 64 ] && [ "$PASSKEY_LENGTH" -le 128 ]; then
    print_success "Passkey length is in typical range (64-128 chars)"
elif [ "$PASSKEY_LENGTH" -ge 80 ] && [ "$PASSKEY_LENGTH" -le 120 ]; then
    print_success "Passkey length is in Base64-encoded range (80-120 chars)"
else
    print_warning "Passkey length is unusual"
    echo "   Expected: 64-128 chars (hex) or 80-120 chars (Base64)"
    echo "   Your passkey: $PASSKEY_LENGTH chars"
    echo ""
fi

echo "📋 Recommendations:"
echo ""
echo "1. Verify passkey source:"
echo "   - Go to https://developer.safaricom.co.ke/"
echo "   - My Apps → Select your sandbox app"
echo "   - Test Credentials → Security Credential"
echo "   - Click 'Generate' and copy the value"
echo ""
echo "2. Check .env format:"
echo "   ✅ CORRECT: MPESA_PASSKEY='your_passkey_here'"
echo "   ✅ CORRECT: MPESA_PASSKEY=\"your_passkey_here\""
echo "   ❌ WRONG: MPESA_PASSKEY=your_passkey_here (if special chars)"
echo ""
echo "3. Common issues:"
echo "   - Passkey should be ONE line (no newlines)"
echo "   - Passkey should be quoted if it has special chars (+, /, =)"
echo "   - Passkey should be the 'Security Credential' NOT Consumer Secret"
echo ""


