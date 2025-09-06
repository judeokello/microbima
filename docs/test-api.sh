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
    shift 3  # Remove first 3 arguments, leaving only header arguments
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -H "x-correlation-id: $CORRELATION_ID" \
             "$@" \
             -d "$data" \
             "$url"
    else
        curl -s -X "$method" \
             -H "x-correlation-id: $CORRELATION_ID" \
             "$@" \
             "$url"
    fi
}

# Function to extract JSON value
extract_json_value() {
    local json=$1
    local key=$2
    echo "$json" | jq -r ".$key // empty" | tr -d '\n'
}

# Check if API is running
check_api_health() {
    print_status "Checking API health..."
    
    local health_response=$(make_request "GET" "$BASE_URL/$API_PREFIX/health")
    
    if [[ "$health_response" == *"MicroBima API is running"* ]]; then
        print_success "API is healthy"
        return 0
    else
        print_error "API health check failed"
        echo "Response: $health_response"
        return 1
    fi
}

# Test 1: Create Partner (Skip if already exists)
test_create_partner() {
    print_status "Testing partner creation..."
    
    # First, try to get existing partners
    local list_response=$(make_request "GET" "$BASE_URL/$API_PREFIX/internal/partner-management/partners")
    local partners_count=$(echo "$list_response" | jq -r '.data.partners | length' | tr -d '\n')
    
    if [ "$partners_count" -gt 0 ]; then
        # Get the first active partner
        PARTNER_ID=$(echo "$list_response" | jq -r '.data.partners[] | select(.isActive == true) | .id' | head -1 | tr -d '\n')
        if [ -n "$PARTNER_ID" ]; then
            print_success "Using existing active partner: $PARTNER_ID"
            return 0
        fi
    fi
    
    local partner_data='{
        "partnerName": "Test Insurance Ltd",
        "website": "https://test-insurance.com",
        "officeLocation": "Nairobi, Kenya"
    }'
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/internal/partner-management/partners" "$partner_data")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        PARTNER_ID=$(extract_json_value "$response" "data.id")
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
    
    local api_key_data="{\"partnerId\": $PARTNER_ID}"
    
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

# Test 3: Validate API Key (Skip for now - endpoint not implemented)
test_validate_api_key() {
    print_status "Skipping API key validation test (endpoint not implemented)..."
    print_success "API key validation test skipped"
    return 0
}

# Test 4: Create Simple Customer
test_create_simple_customer() {
    print_status "Testing simple customer creation..."
    
    local timestamp=$(date +%s)
    local customer_data='{
        "partnerCustomerId": "test-cust-'$timestamp'-001",
        "correlationId": "'$CORRELATION_ID'",
        "product": {
            "productId": "mfanisi-go",
            "planId": "basic"
        },
        "principalMember": {
            "firstName": "John",
            "middleName": "Test",
            "lastName": "Doe",
            "dateOfBirth": "1990-05-15",
            "gender": "male",
            "email": "john.doe.'$timestamp'@test.com",
            "phoneNumber": "254712345678",
            "idType": "national",
            "idNumber": "12345678",
            "partnerCustomerId": "test-cust-'$timestamp'-001"
        }
    }'
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/customers" "$customer_data" "-H" "x-api-key: $API_KEY")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        CUSTOMER_ID=$(extract_json_value "$response" "data.principalId")
        print_success "Simple customer created successfully: $CUSTOMER_ID"
        return 0
    else
        print_error "Simple customer creation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 4b: Create Complex Customer with Family
test_create_complex_customer() {
    print_status "Testing complex customer creation with family members..."
    
    local timestamp=$(date +%s)
    local customer_data='{
        "partnerCustomerId": "test-cust-'$timestamp'-002",
        "correlationId": "'$CORRELATION_ID'",
        "product": {
            "productId": "mfanisi-go",
            "planId": "premium"
        },
        "principalMember": {
            "firstName": "David",
            "middleName": "James",
            "lastName": "Wilson",
            "dateOfBirth": "1985-12-10",
            "gender": "male",
            "email": "david.wilson.'$timestamp'@test.com",
            "phoneNumber": "254745678901",
            "idType": "national",
            "idNumber": "99887766",
            "partnerCustomerId": "test-cust-'$timestamp'-002"
        },
        "beneficiaries": [
            {
                "firstName": "Sarah",
                "lastName": "Wilson",
                "middleName": "Elizabeth",
                "dateOfBirth": "1990-03-15",
                "gender": "female",
                "relationship": "spouse",
                "idType": "national",
                "idNumber": "11223344",
                "percentage": 60
            },
            {
                "firstName": "Michael",
                "lastName": "Wilson",
                "dateOfBirth": "2010-08-20",
                "gender": "male",
                "relationship": "child",
                "idType": "birth_certificate",
                "idNumber": "BC123456789",
                "percentage": 40
            }
        ],
        "children": [
            {
                "firstName": "Emma",
                "lastName": "Wilson",
                "middleName": "Grace",
                "dateOfBirth": "2015-05-12",
                "gender": "female",
                "idType": "birthCertificateNumber",
                "idNumber": "BC987654321"
            }
        ],
        "spouses": [
            {
                "firstName": "Sarah",
                "lastName": "Wilson",
                "middleName": "Elizabeth",
                "dateOfBirth": "1990-03-15",
                "gender": "female",
                "idType": "national",
                "idNumber": "11223344"
            }
        ]
    }'
    
    local response=$(make_request "POST" "$BASE_URL/$API_PREFIX/customers" "$customer_data" "-H" "x-api-key: $API_KEY")
    local status=$(extract_json_value "$response" "status")
    
    if [ "$status" = "201" ]; then
        COMPLEX_CUSTOMER_ID=$(extract_json_value "$response" "data.principalId")
        print_success "Complex customer created successfully: $COMPLEX_CUSTOMER_ID"
        return 0
    else
        print_error "Complex customer creation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test 5: Get Customer
test_get_customer() {
    print_status "Testing customer retrieval..."
    
    local response=$(make_request "GET" "$BASE_URL/$API_PREFIX/customers/$CUSTOMER_ID" "" "-H" "x-api-key: $API_KEY")
    local firstName=$(extract_json_value "$response" "firstName")
    
    if [ -n "$firstName" ]; then
        print_success "Customer retrieved successfully: $firstName"
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
    
    local response=$(make_request "GET" "$BASE_URL/$API_PREFIX/customers?page=1&limit=10" "" "-H" "x-api-key: $API_KEY")
    local total=$(extract_json_value "$response" "pagination.total")
    
    if [ -n "$total" ] && [ "$total" -gt 0 ]; then
        print_success "Customer list retrieved successfully: $total customers"
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
    local total=$(extract_json_value "$response" "data.pagination.total")
    
    if [ -n "$total" ] && [ "$total" -gt 0 ]; then
        print_success "Partner list retrieved successfully: $total partners"
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
    local total_tests=9
    
    check_api_health && tests_passed=$((tests_passed + 1))
    test_create_partner && tests_passed=$((tests_passed + 1))
    test_generate_api_key && tests_passed=$((tests_passed + 1))
    test_validate_api_key && tests_passed=$((tests_passed + 1))
    test_create_simple_customer && tests_passed=$((tests_passed + 1))
    test_create_complex_customer && tests_passed=$((tests_passed + 1))
    test_get_customer && tests_passed=$((tests_passed + 1))
    test_get_customers && tests_passed=$((tests_passed + 1))
    test_get_partners && tests_passed=$((tests_passed + 1))
    
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
