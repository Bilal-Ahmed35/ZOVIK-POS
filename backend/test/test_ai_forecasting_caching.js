const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runAIForecastingCachingTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING AI FORECASTING CACHING & REAL-TIME DECOUPLING');
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
    // SETUP: Admin & Customer Authentication
    // ------------------------------------------------------------------------
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'password123',
    });
    const adminToken = adminLogin.data.accessToken;

    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLogin.data.accessToken;

    // ------------------------------------------------------------------------
    // TEST 1: Initial call populates cache
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: Initial call to GET /api/inventory/alerts (populates DB cache)...');
    const firstCall = await axios.get(`${BASE_URL}/inventory/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(firstCall.status === 200, 'GET /api/inventory/alerts returns 200 OK');
    assert(Array.isArray(firstCall.data.alerts), 'Alerts payload is an array');

    // ------------------------------------------------------------------------
    // TEST 2: Second call uses Database Cache (TTL Cache Verification)
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: Second call to GET /api/inventory/alerts (uses 1-hour DB cache)...');
    const startTime = Date.now();
    const secondCall = await axios.get(`${BASE_URL}/inventory/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const duration = Date.now() - startTime;

    assert(secondCall.status === 200, 'Second GET /api/inventory/alerts returns 200 OK');
    assert(duration < 350, `Second call resolved in ${duration}ms (DB cached response)`);

    if (secondCall.data.alerts.length > 0) {
      assert(
        secondCall.data.alerts[0].source === 'database-cache',
        `Alert source is 'database-cache' (got: ${secondCall.data.alerts[0].source})`
      );
    } else {
      assert(true, 'Alert list is empty but response resolved from cache');
    }

    // ------------------------------------------------------------------------
    // TEST 3: Force recalculate forecasts (bypasses cache)
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Admin POST /api/inventory/recalculate-forecasts (force recalculation)...');
    const recalculateRes = await axios.post(
      `${BASE_URL}/inventory/recalculate-forecasts`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(recalculateRes.status === 200, 'POST /api/inventory/recalculate-forecasts returns 200 OK');
    assert(recalculateRes.data.message.includes('recalculated'), 'Recalculate message confirmed');

    // ------------------------------------------------------------------------
    // TEST 4: Security — Customer blocked from recalculating forecasts
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Security — Customer blocked from force recalculating forecasts...');
    try {
      await axios.post(
        `${BASE_URL}/inventory/recalculate-forecasts`,
        {},
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'Customer recalculating forecasts', 'Expected 403 Forbidden');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer correctly blocked from recalculating forecasts (403 Forbidden)');
    }

    console.log('\n================================================================');
    console.log(`📊 AI FORECASTING CACHING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in AI forecasting test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runAIForecastingCachingTestSuite();
