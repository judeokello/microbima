// Test script to check partners API
const fetch = require('node-fetch');

async function testPartnersAPI() {
  try {
    console.log('🔍 Testing Partners API...');
    
    // Test without authentication (should fail)
    console.log('\n1. Testing without authentication:');
    const response1 = await fetch('http://localhost:3000/api/internal/partner-management/partners?limit=100');
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    // Test with a dummy token (should also fail but differently)
    console.log('\n2. Testing with dummy token:');
    const response2 = await fetch('http://localhost:3000/api/internal/partner-management/partners?limit=100', {
      headers: {
        'Authorization': 'Bearer dummy-token',
        'x-correlation-id': 'test-123'
      }
    });
    const data2 = await response2.json();
    console.log('Status:', response2.status);
    console.log('Response:', JSON.stringify(data2, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testPartnersAPI();
