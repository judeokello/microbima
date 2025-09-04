# MicroBima API Testing Guide

This guide provides comprehensive instructions for testing the MicroBima Customer Onboarding and Partner Management APIs using the provided Postman collection.

## 📋 Prerequisites

### 1. Environment Setup
- **Node.js** (v18 or higher)
- **Postman** (Desktop or Web)
- **MicroBima API** running locally on `http://localhost:3000`
- **jq** (for JSON processing in test script)
- **curl** (for HTTP requests in test script)

### 2. Start the API Server
```bash
cd apps/api
npm run start:dev
```

The API will be available at:
- **Base URL**: `http://localhost:3000`
- **API Prefix**: `api`
- **Swagger UI**: `http://localhost:3000/api-docs`

## 🚀 Quick Start

### Option 1: Automated Testing (Recommended)
Use the provided test script for quick validation:

```bash
# Make the script executable (if not already)
chmod +x docs/test-api.sh

# Run the test suite
./docs/test-api.sh
```

The script will:
- Check API health
- Create a test partner
- Generate an API key
- Validate the API key
- Create a test customer
- Retrieve customer data
- Test all endpoints automatically

### Option 2: Manual Testing with Postman

#### 1. Import the Collection
1. Open Postman
2. Click **Import** → **Upload Files**
3. Select `MicroBima_API_Collection.postman_collection.json`
4. The collection will be imported with all endpoints organized in folders

#### 2. Set Up Environment Variables
The collection uses the following variables (automatically set):
- `baseUrl`: `http://localhost:3000`
- `apiPrefix`: `api`
- `correlationId`: Auto-generated for each request
- `partnerId`: Set after creating a partner
- `apiKey`: Set after generating an API key
- `customerId`: Set after creating a customer

## 📚 API Testing Workflow

### Phase 1: Partner Management Setup

#### 1.1 Create a Partner (Internal API)
**Endpoint**: `POST /api/internal/partner-management/partners`

**Purpose**: Create a new partner in the system

**Request Body**:
```json
{
  "partnerName": "Acme Insurance Ltd",
  "website": "https://acme-insurance.com",
  "officeLocation": "Nairobi, Kenya"
}
```

**Expected Response**:
```json
{
  "status": 201,
  "correlationId": "req-1234567890-abc123def",
  "message": "Partner created successfully",
  "data": {
    "partnerId": "partner_123456789",
    "partnerName": "Acme Insurance Ltd",
    "website": "https://acme-insurance.com",
    "officeLocation": "Nairobi, Kenya",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Action**: Copy the `partnerId` from the response and set it as the `partnerId` collection variable.

#### 1.2 Generate API Key for Partner (Internal API)
**Endpoint**: `POST /api/internal/partner-management/api-keys`

**Purpose**: Generate an API key for the created partner

**Request Body**:
```json
{
  "partnerId": "{{partnerId}}"
}
```

**Expected Response**:
```json
{
  "status": 201,
  "correlationId": "req-1234567890-abc123def",
  "message": "API key generated successfully",
  "data": {
    "apiKey": "mb_live_1234567890abcdef1234567890abcdef12345678",
    "partnerId": "partner_123456789",
    "isActive": true,
    "createdAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Action**: Copy the `apiKey` from the response and set it as the `apiKey` collection variable.

### Phase 2: Customer Management Testing

#### 2.1 Create a Customer
**Endpoint**: `POST /api/customers`

**Purpose**: Create a new customer with partner relationship

**Headers Required**:
- `x-api-key`: `{{apiKey}}`
- `x-correlation-id`: `{{correlationId}}`
- `Content-Type`: `application/json`

**Request Body**:
```json
{
  "partnerCustomerId": "cust-12345",
  "correlationId": "{{correlationId}}",
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
    "middleName": "Michael",
    "lastName": "Doe",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "nationalId": "12345678",
    "phoneNumber": "+254712345678",
    "email": "john.doe@example.com",
    "address": {
      "street": "123 Main Street",
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
  "beneficiaries": [
    {
      "firstName": "Alice",
      "middleName": "Marie",
      "lastName": "Doe",
      "dateOfBirth": "1995-03-20",
      "gender": "Female",
      "relationship": "Sister",
      "benefitPercentage": 50
    }
  ],
  "children": [
    {
      "firstName": "Bob",
      "middleName": "James",
      "lastName": "Doe",
      "dateOfBirth": "2010-08-10",
      "gender": "Male",
      "relationship": "Son"
    }
  ],
  "spouses": [
    {
      "firstName": "Sarah",
      "middleName": "Elizabeth",
      "lastName": "Doe",
      "dateOfBirth": "1992-12-05",
      "gender": "Female",
      "marriageDate": "2015-06-15"
    }
  ],
  "referredBy": "Agent Smith"
}
```

**Expected Response**:
```json
{
  "status": 201,
  "correlationId": "req-1234567890-abc123def",
  "message": "Customer created successfully",
  "data": {
    "principalId": "cust_1234567890",
    "partnerCustomerId": "cust-12345",
    "partnerId": "partner_123456789",
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+254712345678",
    "status": "active",
    "createdAt": "2024-01-15T10:40:00.000Z"
  }
}
```

**Action**: Copy the `principalId` from the response and set it as the `customerId` collection variable.

#### 2.2 Get Customer by ID
**Endpoint**: `GET /api/customers/{{customerId}}`

**Purpose**: Retrieve a specific customer by ID

**Headers Required**:
- `x-api-key`: `{{apiKey}}`
- `x-correlation-id`: `{{correlationId}}`

**Expected Response**:
```json
{
  "status": 200,
  "correlationId": "req-1234567890-abc123def",
  "message": "Customer retrieved successfully",
  "data": {
    "principalId": "cust_1234567890",
    "partnerCustomerId": "cust-12345",
    "partnerId": "partner_123456789",
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "nationalId": "12345678",
    "phoneNumber": "+254712345678",
    "email": "john.doe@example.com",
    "address": {
      "street": "123 Main Street",
      "city": "Nairobi",
      "state": "Nairobi County",
      "postalCode": "00100",
      "country": "Kenya"
    },
    "occupation": "Software Engineer",
    "maritalStatus": "Single",
    "status": "active",
    "createdAt": "2024-01-15T10:40:00.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

#### 2.3 Get All Customers
**Endpoint**: `GET /api/customers?page=1&limit=10`

**Purpose**: Retrieve paginated list of customers for the authenticated partner

**Headers Required**:
- `x-api-key`: `{{apiKey}}`
- `x-correlation-id`: `{{correlationId}}`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

**Expected Response**:
```json
{
  "status": 200,
  "correlationId": "req-1234567890-abc123def",
  "message": "Customers retrieved successfully",
  "data": {
    "customers": [
      {
        "principalId": "cust_1234567890",
        "partnerCustomerId": "cust-12345",
        "partnerId": "partner_123456789",
        "firstName": "John",
        "middleName": "Michael",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phoneNumber": "+254712345678",
        "status": "active",
        "createdAt": "2024-01-15T10:40:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### Phase 3: API Key Management Testing

#### 3.1 Validate API Key
**Endpoint**: `POST /api/v1/partner-management/api-keys/validate`

**Purpose**: Validate an API key (no authentication required)

**Request Body**:
```json
{
  "apiKey": "{{apiKey}}"
}
```

**Expected Response**:
```json
{
  "status": 200,
  "correlationId": "req-1234567890-abc123def",
  "message": "API key is valid",
  "data": {
    "valid": true,
    "partnerId": "partner_123456789",
    "partnerName": "Acme Insurance Ltd",
    "isActive": true
  }
}
```

#### 3.2 Generate New API Key (Authenticated)
**Endpoint**: `POST /api/v1/partner-management/api-keys`

**Purpose**: Generate a new API key for the authenticated partner

**Headers Required**:
- `x-api-key`: `{{apiKey}}`
- `x-correlation-id`: `{{correlationId}}`

**Request Body**:
```json
{
  "partnerId": "{{partnerId}}"
}
```

**Expected Response**:
```json
{
  "status": 201,
  "correlationId": "req-1234567890-abc123def",
  "message": "API key generated successfully",
  "data": {
    "apiKey": "mb_live_9876543210fedcba9876543210fedcba98765432",
    "partnerId": "partner_123456789",
    "isActive": true,
    "createdAt": "2024-01-15T10:45:00.000Z"
  }
}
```

#### 3.3 Deactivate API Key
**Endpoint**: `DELETE /api/v1/partner-management/api-keys`

**Purpose**: Deactivate an API key

**Headers Required**:
- `x-api-key`: `{{apiKey}}`
- `x-correlation-id`: `{{correlationId}}`

**Request Body**:
```json
{
  "apiKey": "{{apiKey}}"
}
```

**Expected Response**:
```json
{
  "status": 200,
  "correlationId": "req-1234567890-abc123def",
  "message": "API key deactivated successfully",
  "data": {
    "success": true
  }
}
```

## 🔍 Testing Scenarios

### 1. Authentication Testing
- **Valid API Key**: Should return 200/201 responses
- **Invalid API Key**: Should return 401 Unauthorized
- **Missing API Key**: Should return 401 Unauthorized
- **Inactive API Key**: Should return 401 Unauthorized

### 2. Correlation ID Testing
- **Valid Correlation ID**: Should be included in all responses
- **Missing Correlation ID**: Should return 400 Bad Request for public APIs
- **Empty Correlation ID**: Should return 400 Bad Request

### 3. Partner Scoping Testing
- **Valid Partner**: Should only access their own customers
- **Cross-Partner Access**: Should return 404 Not Found for other partners' customers

### 4. Validation Testing
- **Valid Data**: Should create/retrieve successfully
- **Invalid Data**: Should return 400 Bad Request with validation errors
- **Missing Required Fields**: Should return 400 Bad Request

### 5. Pagination Testing
- **Valid Pagination**: Should return correct page data
- **Invalid Page Numbers**: Should return 400 Bad Request
- **Large Limit**: Should be capped at 100

## 🚨 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/customers",
  "correlationId": "req-1234567890-abc123def",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "error": "Unauthorized",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/customers",
  "correlationId": "req-1234567890-abc123def"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Customer not found or not accessible to this partner",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/customers/cust_invalid",
  "correlationId": "req-1234567890-abc123def"
}
```

#### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/customers",
  "correlationId": "req-1234567890-abc123def"
}
```

## 📊 Performance Testing

### Load Testing Scenarios
1. **Create Multiple Customers**: Test bulk customer creation
2. **Concurrent API Key Validation**: Test multiple simultaneous validations
3. **Large Pagination**: Test with maximum limit (100 items)
4. **Rapid Successive Requests**: Test rate limiting behavior

### Monitoring Points
- **Response Times**: Should be < 200ms for 95% of requests
- **Memory Usage**: Monitor for memory leaks during bulk operations
- **Database Connections**: Ensure proper connection pooling
- **Error Rates**: Should be < 1% under normal load

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Refused
- **Cause**: API server not running
- **Solution**: Start the server with `npm run start:dev`

#### 2. 401 Unauthorized
- **Cause**: Invalid or missing API key
- **Solution**: Generate a new API key and update the collection variable

#### 3. 400 Bad Request
- **Cause**: Invalid request data or missing correlation ID
- **Solution**: Check request body and ensure correlation ID is set

#### 4. 404 Not Found
- **Cause**: Invalid endpoint or resource not found
- **Solution**: Verify endpoint URL and resource ID

#### 5. 500 Internal Server Error
- **Cause**: Server-side error
- **Solution**: Check server logs and database connectivity

### Debug Tips
1. **Check Server Logs**: Look for detailed error messages
2. **Verify Database**: Ensure database is running and accessible
3. **Test Health Endpoint**: Use `/health` to verify API status
4. **Check Swagger UI**: Use `/api-docs` to verify endpoint availability

## 📝 Test Data Management

### Sample Test Data
The collection includes comprehensive sample data for:
- **Partners**: Complete partner information
- **Customers**: Full customer profiles with family members
- **API Keys**: Valid API key formats
- **Correlation IDs**: Properly formatted request IDs

### Data Cleanup
After testing, you may want to clean up test data:
1. Deactivate test API keys
2. Remove test customers (if supported)
3. Remove test partners (if supported)

## 🎯 Success Criteria

A successful test run should demonstrate:
- ✅ All endpoints respond with expected status codes
- ✅ Authentication works correctly
- ✅ Partner scoping prevents cross-partner access
- ✅ Correlation IDs are properly tracked
- ✅ Validation errors are clear and helpful
- ✅ Pagination works correctly
- ✅ Error handling is consistent
- ✅ Response times are acceptable

## 🛠️ Test Script Usage

### Running the Test Script
The `test-api.sh` script provides automated testing of all API endpoints:

```bash
# Basic usage
./docs/test-api.sh

# With custom environment (optional)
source docs/test-env.example
./docs/test-api.sh
```

### Test Script Features
- **Automated Flow**: Tests the complete API workflow from partner creation to customer management
- **Health Checks**: Verifies API availability before running tests
- **Error Handling**: Provides clear error messages and exit codes
- **JSON Processing**: Uses `jq` for reliable JSON parsing
- **Colored Output**: Easy-to-read test results with color coding

### Customizing Test Data
You can customize test data by modifying the variables in the script or using the environment file:

```bash
# Copy the example environment file
cp docs/test-env.example docs/test-env.sh

# Edit the environment file
nano docs/test-env.sh

# Source the environment and run tests
source docs/test-env.sh
./docs/test-api.sh
```

### Test Script Output
The script provides detailed output including:
- ✅ **Success indicators** for passed tests
- ❌ **Error messages** for failed tests
- 📊 **Test summary** with pass/fail counts
- 🔍 **Response data** for debugging failed tests

## 📞 Support

If you encounter issues during testing:
1. Check the [API Documentation](http://localhost:3000/api-docs)
2. Review server logs for detailed error messages
3. Verify all prerequisites are met
4. Ensure database is properly configured
5. Run the test script to identify specific issues

---

**Happy Testing! 🚀**
