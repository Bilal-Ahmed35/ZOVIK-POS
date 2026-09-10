const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runPaymentAvailabilityTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING PAYMENT METHOD AVAILABILITY & VERIFICATION SYSTEM');
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
    // SETUP: Staff & Customer Authentication
    // ------------------------------------------------------------------------
    const vendorLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'vendor@pos.com',
      password: 'password123',
    });
    const vendorToken = vendorLogin.data.accessToken;

    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLogin.data.accessToken;

    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem = menuRes.data.items[0];

    // Reset payment settings to default OPEN / OPEN
    await axios.put(
      `${BASE_URL}/payments/settings`,
      { codEnabled: true, onlineEnabled: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );

    // ------------------------------------------------------------------------
    // TEST 1: Both COD OPEN & Online OPEN
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: COD OPEN / Online OPEN...');
    const settingsRes1 = await axios.get(`${BASE_URL}/payments/settings`);
    assert(
      settingsRes1.data.codEnabled === true && settingsRes1.data.onlineEnabled === true,
      'GET /api/payments/settings returns codEnabled: true & onlineEnabled: true'
    );

    // Customer places COD order
    const codOrderRes1 = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'COD',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(codOrderRes1.status === 201, 'COD order placed successfully when COD is OPEN');

    // Customer places Online order
    const onlineOrderRes1 = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'Easypaisa',
        paymentTxId: `TXN-EASY-OPEN-${Date.now()}`,
        paymentStatus: 'PENDING_VERIFICATION',
        status: 'PAYMENT_PENDING',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(onlineOrderRes1.status === 201, 'Online order placed successfully when Online is OPEN');

    // ------------------------------------------------------------------------
    // TEST 2: COD OPEN / Online CLOSED
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: COD OPEN / Online CLOSED...');
    const updateSettingsRes2 = await axios.put(
      `${BASE_URL}/payments/settings`,
      { codEnabled: true, onlineEnabled: false },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      updateSettingsRes2.data.settings.codEnabled === true && updateSettingsRes2.data.settings.onlineEnabled === false,
      'Vendor closes Online payment (codEnabled: true, onlineEnabled: false)'
    );

    // Online order placement must be rejected by backend
    try {
      await axios.post(
        `${BASE_URL}/orders`,
        {
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
          paymentMethod: 'Easypaisa',
          paymentTxId: `TXN-EASY-CLOSED-${Date.now()}`,
          paymentStatus: 'PENDING_VERIFICATION',
          status: 'PAYMENT_PENDING',
          tableId: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'Online order when Online is CLOSED', 'Expected 400 rejection');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.error?.includes('Online Payment is currently unavailable'),
        'Backend rejects Online order with "Online Payment is currently unavailable" when Online is CLOSED'
      );
    }

    // COD order placement still succeeds
    const codOrderRes2 = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'COD',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(codOrderRes2.status === 201, 'COD order succeeds when COD is OPEN');

    // ------------------------------------------------------------------------
    // TEST 3: COD CLOSED / Online OPEN
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: COD CLOSED / Online OPEN...');
    const updateSettingsRes3 = await axios.put(
      `${BASE_URL}/payments/settings`,
      { codEnabled: false, onlineEnabled: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      updateSettingsRes3.data.settings.codEnabled === false && updateSettingsRes3.data.settings.onlineEnabled === true,
      'Vendor closes COD payment (codEnabled: false, onlineEnabled: true)'
    );

    // COD order placement must be rejected by backend
    try {
      await axios.post(
        `${BASE_URL}/orders`,
        {
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
          paymentMethod: 'COD',
          tableId: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'COD order when COD is CLOSED', 'Expected 400 rejection');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.error?.includes('Pay at Counter is currently unavailable'),
        'Backend rejects COD order with "Pay at Counter is currently unavailable" when COD is CLOSED'
      );
    }

    // Online order placement succeeds
    const onlineOrderRes3 = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'JazzCash',
        paymentTxId: `TXN-JAZZ-OPEN-${Date.now()}`,
        paymentStatus: 'PENDING_VERIFICATION',
        status: 'PAYMENT_PENDING',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(onlineOrderRes3.status === 201, 'Online order succeeds when Online is OPEN');

    // ------------------------------------------------------------------------
    // TEST 4: Both COD CLOSED / Online CLOSED
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: COD CLOSED / Online CLOSED...');
    await axios.put(
      `${BASE_URL}/payments/settings`,
      { codEnabled: false, onlineEnabled: false },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );

    try {
      await axios.post(
        `${BASE_URL}/orders`,
        {
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
          paymentMethod: 'COD',
          tableId: 1,
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'Order placement when both CLOSED', 'Expected 400 rejection');
    } catch (err) {
      assert(
        err.response?.status === 400 && err.response?.data?.error?.includes('kitchen is currently closed'),
        'Backend rejects order with "kitchen is currently closed" when both payment methods are CLOSED'
      );
    }

    // ------------------------------------------------------------------------
    // TEST 5: Security — Customer cannot alter payment settings
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Security — Customer forbidden from modifying payment settings...');
    try {
      await axios.put(
        `${BASE_URL}/payments/settings`,
        { codEnabled: true, onlineEnabled: true },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      assert(false, 'Customer modifying payment settings', 'Expected 403 Forbidden');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer correctly blocked from modifying payment availability settings (403 Forbidden)');
    }

    // Restore settings to OPEN / OPEN for verification tests
    await axios.put(
      `${BASE_URL}/payments/settings`,
      { codEnabled: true, onlineEnabled: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );

    // ------------------------------------------------------------------------
    // TEST 6: Payment Verification — COD & Online Orders
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 6: Payment Verification (COD & Online)...');

    // 1. Verify COD Order
    const codOrder = codOrderRes1.data.order;
    const verifyCodRes = await axios.put(
      `${BASE_URL}/payments/${codOrder.id}/verify`,
      { approve: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      verifyCodRes.status === 200 && verifyCodRes.data.order.status === 'PAID' && verifyCodRes.data.order.paymentStatus === 'VERIFIED',
      'Staff verifying COD payment transitions order to PAID and payment to VERIFIED'
    );

    // 2. Verify Online Order
    const onlineOrder = onlineOrderRes1.data.order;
    const verifyOnlineRes = await axios.put(
      `${BASE_URL}/payments/${onlineOrder.id}/verify`,
      { approve: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      verifyOnlineRes.status === 200 && verifyOnlineRes.data.order.status === 'PAID' && verifyOnlineRes.data.order.paymentStatus === 'VERIFIED',
      'Staff verifying Online payment transitions order to PAID and payment to VERIFIED'
    );

    // 3. Reject Online Order & Verify Stock Restore
    const onlineOrderReject = onlineOrderRes3.data.order;
    const rejectOnlineRes = await axios.put(
      `${BASE_URL}/payments/${onlineOrderReject.id}/verify`,
      { approve: false, reason: 'Invalid wallet transaction ID' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      rejectOnlineRes.status === 200 && rejectOnlineRes.data.order.status === 'PAYMENT_FAILED' && rejectOnlineRes.data.order.paymentStatus === 'FAILED',
      'Staff rejecting Online payment transitions order to PAYMENT_FAILED'
    );

    console.log('\n================================================================');
    console.log(`📊 PAYMENT AVAILABILITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in payment availability test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runPaymentAvailabilityTestSuite();
