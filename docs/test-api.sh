#!/bin/bash

# MicroBima API Test Script
# This script provides a quick way to test the API endpoints

set -e

# Configuration
BASE_URL="http://localhost:3000"
API_PREFIX="api"
CORRELATION_ID="test-$(date +%s)-$(openssl rand -hex 4)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to make HTTP requests
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local headers=$4
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -H "x-correlation-id: $CORRELATION_ID" \
             $headers \
             -d "$data" \
             "$url"
    else
        curl -s -X "$method" \
             -H "x-correlation-id: $CORRELATION_ID" \
             $headers \
             "$url"
    fi
}

# Function to extract JSON value
extract_json_value() {
    local json=$1
    local key=$2
    echo "$json" | jq -r ".$key // empty"
}

# Check if API is running
check_api_health() {
    print_status "Checking API health..."
    
    local health_response=$(make_request "GET" "$BASE_URL/health")
    local status=$(extract_json_value "$health_response" "status")
    
    if [ "$status" = "ok" ]; then
        print_success "API is healthy"
        return 0
    else
        print_error "API health check failed"
        echo "Response: $health_response"
        return 1
    fi
}

# Test 1: Create Partner
test_create_partner() {
    print_status "Testing partner creation..."
    
    local partner_data='{
        "partnerName": "Test Insurance Ltd",
        "website": "https://test-insurance.com",
        "officeLocation": "Nairobi, Kenya"
    }'
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/internal/partner-management/partners" "$partner_data")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        PARTNER_ID=$(extract_json_value "$response" "data.partnerId")
        print_success "Partner created successfully: $PARTNER_ID"
        return 0
    else
        print_error "Partner creation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 2: Generate API Key
test_generate_api_key() {
    print_status "Testing API key generation..."
    
    local api_key_data="{\"partnerId\": \"$PARTNER_ID\"}"
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/internal/partner-management/api-keys" "$api_key_data")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        API_KEY=$(extract_json_value "$response" "data.apiKey")
        print_success "API key generated successfully: ${API_KEY:0:20}..."
        return 0
    else
        print_error "API key generation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 3: Validate API Key
test_validate_api_key() {
    print_status "Testing API key validation..."
    
    local validate_data="{\"apiKey\": \"$API_KEY\"}"
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/v1/partner-management/api-keys/validate" "$validate_data")
    local status=$(extract_json_value "$response" "status")
    local valid=$(extract_json_value "$response" "data.valid")
    
    if [ "$status" = "200" ] && [ "$valid" = "true" ]; then
        print_success "API key validation successful"
        return 0
    else
        print_error "API key validation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 4: Create Customer
test_create_customer() {
    print_status "Testing customer creation..."
    
    local customer_data='{
        "partnerCustomerId": "test-cust-001",
        "correlationId": "'$CORRELATION_ID'",
        "product": {
            "productId": "prod-001",
            "productName": "Micro Health Insurance",
            "planId": "plan-basic",
            "planName": "Basic Plan",
            "premiumAmount": 500,
            "currency": "KES",
            "coverageAmount": 50000,
            "coveragePeriod": "1 year"
        },
        "principalMember": {
            "firstName": "John",
            "middleName": "Test",
            "lastName": "Doe",
            "dateOfBirth": "1990-05-15",
            "gender": "Male",
            "nationalId": "12345678",
            "phoneNumber": "+254712345678",
            "email": "john.doe@test.com",
            "address": {
                "street": "123 Test Street",
                "city": "Nairobi",
                "state": "Nairobi County",
                "postalCode": "00100",
                "country": "Kenya"
            },
            "occupation": "Software Engineer",
            "maritalStatus": "Single",
            "emergencyContact": {
                "name": "Jane Doe",
                "relationship": "Sister",
                "phoneNumber": "+254723456789"
            }
        },
        "referredBy": "Test Agent"
    }'
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/customers" "$customer_data" "-H \"x-api-key: $API_KEY\"")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        CUSTOMER_ID=$(extract_json_value "$response" "data.principalId")
        print_success "Customer created successfully: $CUSTOMER_ID"
        return 0
    else
        print_error "Customer creation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 5: Get Customer
test_get_customer() {
    print_status "Testing customer retrieval..."
    
    local response=$(make_request "GET" "$BASE_URL/$API_PREFIX/customers/$CUSTOMER_ID" "" "-H \"x-api-key: $API_KEY\"")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "200" ]; then
        print_success "Customer retrieved successfully"
        return 0
    else
        print_error "Customer retrieval failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 6: Get All Customers
test_get_customers() {
    print_status "Testing customer list retrieval..."
    
    local response=$(make_request "GET" "$BASE_URL/$API_PREFIX/customers?page=1&limit=10" "" "-H \"x-api-key: $API_KEY\"")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "200" ]; then
        print_success "Customer list retrieved successfully"
        return 0
    else
        print_error "Customer list retrieval failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 7: Get Partners
test_get_partners() {
    print_status "Testing partner list retrieval..."
    
    local response=$(make_request "GET" "$BASE_URL/$API_PREFIX/internal/partner-management/partners?page=1&limit=10")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "200" ]; then
        print_success "Partner list retrieved successfully"
        return 0
    else
        print_error "Partner list retrieval failed"
        echo "Response: $response"
        return 1
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "MicroBima API Test Suite"
    echo "=========================================="
    echo "Base URL: $BASE_URL"
    echo "Correlation ID: $CORRELATION_ID"
    echo "=========================================="
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq to run this script."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed. Please install curl to run this script."
        exit 1
    fi
    
    # Run tests
    local tests_passed=0
    local total_tests=7
    
    check_api_health && ((tests_passed++))
    test_create_partner && ((tests_passed++))
    test_generate_api_key && ((tests_passed++))
    test_validate_api_key && ((tests_passed++))
    test_create_customer && ((tests_passed++))
    test_get_customer && ((tests_passed++))
    test_get_customers && ((tests_passed++))
    test_get_partners && ((tests_passed++))
    
    echo "=========================================="
    echo "Test Results: $tests_passed/$total_tests tests passed"
    echo "=========================================="
    
    if [ $tests_passed -eq $total_tests ]; then
        print_success "All tests passed! 🎉"
        exit 0
    else
        print_error "Some tests failed. Please check the output above."
        exit 1
    fi
}

# Run main function
main "$@"
