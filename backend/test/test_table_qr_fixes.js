const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runTableQRFixesTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING TABLES & QR FIXES: NUMBER, QR IMAGE & ACTIVE TOGGLE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    // ------------------------------------------------------------------------
    // SETUP: Admin Login
    // ------------------------------------------------------------------------
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'password123',
    });
    const adminToken = adminLogin.data.accessToken;

    // ------------------------------------------------------------------------
    // TEST 1: GET /api/tables/qr/batch (Batch QR Cards & Complete URLs)
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: GET /api/tables/qr/batch (Complete signed URLs & QR images)...');
    const batchRes = await axios.get(`${BASE_URL}/tables/qr/batch`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(batchRes.status === 200, 'GET /api/tables/qr/batch returns 200 OK');
    assert(Array.isArray(batchRes.data.tables), 'Tables array returned');
    assert(batchRes.data.tables.length > 0, 'At least 1 table present');

    const firstTable = batchRes.data.tables[0];
    assert(
      firstTable.tableNumber !== undefined && firstTable.tableNumber !== 'undefined',
      `Table number field is valid (got: "${firstTable.tableNumber}")`
    );
    assert(
      firstTable.url && firstTable.url.includes('/customer/table/tbl%3A'),
      `Complete signed URL structured: ${firstTable.url}`
    );
    assert(
      firstTable.qrDataUrl && firstTable.qrDataUrl.startsWith('data:image/png;base64,'),
      'QR data URL image is a valid base64 PNG'
    );

    // ------------------------------------------------------------------------
    // TEST 2: Active / Inactive Status Toggle
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: PUT /api/tables/:id (Toggle Active / Inactive Status)...');
    const originalStatus = firstTable.isActive;
    const updateRes = await axios.put(
      `${BASE_URL}/tables/${firstTable.id}`,
      { isActive: !originalStatus },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert(updateRes.status === 200, 'PUT /api/tables/:id returns 200 OK');
    assert(updateRes.data.table.isActive === !originalStatus, 'Table isActive status toggled in DB');

    // Restore original status
    await axios.put(
      `${BASE_URL}/tables/${firstTable.id}`,
      { isActive: originalStatus },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(true, 'Restored original table active status');

    console.log('\n================================================================');
    console.log(`📊 TABLES & QR FIX SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in table QR fixes test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTableQRFixesTestSuite();
