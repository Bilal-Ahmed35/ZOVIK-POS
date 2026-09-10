const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runRealtimeAuthSyncTests() {
  console.log('================================================================');
  console.log('🧪 TESTING REALTIME AUTH SYNCHRONIZATION & CONCURRENT REFRESH');
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
    // STEP 1: Authenticate all 3 roles independently (Simulating separate tabs)
    // ------------------------------------------------------------------------
    console.log('📌 1. Logging in Vendor, Kitchen & Customer accounts...');
    
    // Vendor Session (Tab 1)
    const vendorLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'vendor@pos.com',
      password: 'password123',
    });
    const vendorToken = vendorLogin.data.accessToken;
    const vendorRefresh = vendorLogin.data.refreshToken;
    assert(vendorToken && vendorRefresh, 'Vendor session tokens acquired');

    // Kitchen Session (Tab 2)
    const kitchenLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'kitchen@pos.com',
      password: 'password123',
    });
    const kitchenToken = kitchenLogin.data.accessToken;
    const kitchenRefresh = kitchenLogin.data.refreshToken;
    assert(kitchenToken && kitchenRefresh, 'Kitchen session tokens acquired');

    // Customer Session (Tab 3)
    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLogin.data.accessToken;
    const customerRefresh = customerLogin.data.refreshToken;
    assert(customerToken && customerRefresh, 'Customer session tokens acquired');

    // ------------------------------------------------------------------------
    // STEP 2: Customer places a new order
    // ------------------------------------------------------------------------
    console.log('\n📌 2. Customer places a new order...');
    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem = menuRes.data.items[0];

    const orderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'COD',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(orderRes.status === 201 && orderRes.data.order.id, `Order placed: #${orderRes.data.order.orderNumber}`);
    const orderId = orderRes.data.order.id;

    // Verify payment so Kitchen can process order
    await axios.put(
      `${BASE_URL}/payments/${orderId}/verify`,
      { approve: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );

    // ------------------------------------------------------------------------
    // STEP 3: Vendor Dashboard receives realtime event & executes API calls
    // ------------------------------------------------------------------------
    console.log('\n📌 3. Vendor executes API calls using Vendor credentials (post-order sync)...');
    
    const vendorOrdersRes = await axios.get(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    assert(vendorOrdersRes.status === 200, 'Vendor GET /api/orders returns 200 OK');

    const vendorAlertsRes = await axios.get(`${BASE_URL}/inventory/alerts`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    assert(vendorAlertsRes.status === 200, 'Vendor GET /api/inventory/alerts returns 200 OK');

    // ------------------------------------------------------------------------
    // STEP 4: Kitchen Dashboard receives realtime event & advances order
    // ------------------------------------------------------------------------
    console.log('\n📌 4. Kitchen executes API calls using Kitchen credentials...');
    
    const kitchenOrdersRes = await axios.get(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });
    assert(kitchenOrdersRes.status === 200, 'Kitchen GET /api/orders returns 200 OK');

    // Kitchen marks order as PREPARING
    const kitchenPrepRes = await axios.put(
      `${BASE_URL}/orders/${orderId}/status`,
      { status: 'PREPARING' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(kitchenPrepRes.status === 200 && kitchenPrepRes.data.order.status === 'PREPARING', 'Kitchen transitions order to PREPARING without refresh (200 OK)');

    // Kitchen marks order as READY
    const kitchenReadyRes = await axios.put(
      `${BASE_URL}/orders/${orderId}/status`,
      { status: 'READY' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(kitchenReadyRes.status === 200 && kitchenReadyRes.data.order.status === 'READY', 'Kitchen transitions order to READY without refresh (200 OK)');

    // ------------------------------------------------------------------------
    // STEP 5: Verify Unauthorized Access is strictly rejected
    // ------------------------------------------------------------------------
    console.log('\n📌 5. Verifying Customer token is rejected from Kitchen/Vendor endpoints...');
    try {
      await axios.put(
        `${BASE_URL}/orders/${orderId}/status`,
        { status: 'PREPARING' },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'Customer advance order rejection', 'Expected 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer token correctly blocked from PREPARING (403 Forbidden)');
    }

    try {
      await axios.get(`${BASE_URL}/inventory/alerts`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert(false, 'Customer inventory alert rejection', 'Expected 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer token correctly blocked from /inventory/alerts (403 Forbidden)');
    }

    // ------------------------------------------------------------------------
    // STEP 6: Concurrent Token Refresh Simulation
    // ------------------------------------------------------------------------
    console.log('\n📌 6. Testing Concurrent Token Refresh Flow...');
    
    // Refresh the vendor token
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh-token`, {
      refreshToken: vendorRefresh,
    });
    assert(refreshRes.status === 200 && refreshRes.data.accessToken, 'Refresh token request returned fresh access token');
    const newVendorToken = refreshRes.data.accessToken;

    // Fire 5 concurrent requests using the refreshed token
    const concurrentRequests = await Promise.all([
      axios.get(`${BASE_URL}/orders`, { headers: { Authorization: `Bearer ${newVendorToken}` } }),
      axios.get(`${BASE_URL}/inventory`, { headers: { Authorization: `Bearer ${newVendorToken}` } }),
      axios.get(`${BASE_URL}/inventory/alerts`, { headers: { Authorization: `Bearer ${newVendorToken}` } }),
      axios.get(`${BASE_URL}/inventory/logs`, { headers: { Authorization: `Bearer ${newVendorToken}` } }),
      axios.get(`${BASE_URL}/menu`, { headers: { Authorization: `Bearer ${newVendorToken}` } }),
    ]);

    const allSucceeded = concurrentRequests.every(r => r.status === 200);
    assert(allSucceeded, 'All 5 concurrent post-refresh requests resolved with 200 OK');

    console.log('\n================================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in realtime auth sync test:', err.response?.data || err.message);
    process.exit(1);
  }
}

runRealtimeAuthSyncTests();
