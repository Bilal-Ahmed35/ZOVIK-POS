const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runThreeIssuesTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING FIXES FOR ISSUES 1, 2, AND 3');
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
    // Fetch real signed tables
    const batchRes = await axios.get(`${BASE_URL}/tables/qr/batch`);
    const tables = batchRes.data.tables;
    const table1 = tables.find(t => t.tableNumber === 'Table 1') || tables[0];
    const table2 = tables.find(t => t.tableNumber === 'Table 2') || tables[1];
    const table4 = tables.find(t => t.tableNumber === 'Table 4') || tables[3];

    // Staff accounts
    const vendorLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'vendor@pos.com',
      password: 'password123',
    });
    const vendorToken = vendorLogin.data.accessToken;

    const kitchenLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'kitchen@pos.com',
      password: 'password123',
    });
    const kitchenToken = kitchenLogin.data.accessToken;

    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem = menuRes.data.items[0];

    // ------------------------------------------------------------------------
    // ISSUE 2 TEST: Mandatory Email OTP Verification per Session
    // ------------------------------------------------------------------------
    console.log('📌 ISSUE 2: Testing Email OTP Verification Flow...');
    
    // Start session on Table 2
    const sessionRes2 = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table2.qrToken,
    });
    const session2Id = sessionRes2.data.session.id;
    assert(session2Id, 'Dining Session created on Table 2');

    const customerEmail2 = `customer.table2.${Date.now()}@example.com`;

    // 1. Send OTP
    const sendOtpRes = await axios.post(`${BASE_URL}/auth/send-otp`, {
      email: customerEmail2,
      name: 'Table 2 Customer',
      sessionId: session2Id,
    });
    assert(sendOtpRes.data.success === true, 'OTP code generated & stored in DB');

    // 2. Wrong OTP rejection
    try {
      await axios.post(`${BASE_URL}/auth/verify-otp`, {
        email: customerEmail2,
        otp: '999999',
        sessionId: session2Id,
      });
      assert(false, 'Wrong OTP rejection', 'Expected failure');
    } catch (e) {
      assert(e.response?.status === 400 && e.response?.data?.error?.includes('attempt'), 'Incorrect OTP rejected with attempts decremented');
    }

    // 3. Customer login (or verified OTP)
    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLogin.data.accessToken;

    // ------------------------------------------------------------------------
    // ISSUE 1 TEST: Active Order Scoping by SessionId (Table 2 vs Table 4)
    // ------------------------------------------------------------------------
    console.log('\n📌 ISSUE 1: Testing Session-Specific Active Order Scoping...');

    // Place an Order in Session 2 (Table 2)
    const orderTable2Res = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        tableId: table2.id,
        sessionId: session2Id,
        paymentMethod: 'COD',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const orderTable2 = orderTable2Res.data.order;
    assert(orderTable2.sessionId === session2Id, `Order placed in Session 2 (Table 2): #${orderTable2.orderNumber}`);

    // Start Session on Table 4 and place an order
    const sessionRes4 = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table4.qrToken,
    });
    const session4Id = sessionRes4.data.session.id;

    const orderTable4Res = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        tableId: table4.id,
        sessionId: session4Id,
        paymentMethod: 'COD',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const orderTable4 = orderTable4Res.data.order;
    assert(orderTable4.sessionId === session4Id, `Order placed in Session 4 (Table 4): #${orderTable4.orderNumber}`);

    // Query active orders for Session 2 (Table 2)
    const session2OrdersRes = await axios.get(`${BASE_URL}/orders?sessionId=${session2Id}`, {
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'X-Session-ID': session2Id,
      },
    });
    const session2Orders = session2OrdersRes.data.orders;
    assert(session2Orders.length === 1 && session2Orders[0].id === orderTable2.id, 'Session 2 returns ONLY Table 2 order');
    assert(!session2Orders.some(o => o.id === orderTable4.id), 'Table 4 order NEVER appears in Session 2');

    // ------------------------------------------------------------------------
    // ISSUE 3 TEST: Online Wallet Payment Verification Flow (Easypaisa/JazzCash)
    // ------------------------------------------------------------------------
    console.log('\n📌 ISSUE 3: Testing Online Wallet Flow (Easypaisa / JazzCash)...');

    const walletTxId = `TXN-EASY-${Date.now()}`;
    const onlineOrderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 2 }],
        tableId: table1.id,
        paymentMethod: 'Easypaisa',
        paymentStatus: 'PENDING_VERIFICATION',
        paymentTxId: walletTxId,
        status: 'PAYMENT_PENDING',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const onlineOrder = onlineOrderRes.data.order;
    assert(onlineOrder.status === 'PAYMENT_PENDING' && onlineOrder.paymentStatus === 'PENDING_VERIFICATION', 'Online order placed with PAYMENT_PENDING');

    // 1. Kitchen cannot prepare while PAYMENT_PENDING
    try {
      await axios.put(
        `${BASE_URL}/orders/${onlineOrder.id}/status`,
        { status: 'PREPARING' },
        { headers: { Authorization: `Bearer ${kitchenToken}` } }
      );
      assert(false, 'Kitchen prepare unverified order rejection', 'Expected failure');
    } catch (e) {
      assert(e.response?.status === 400 || e.response?.status === 403, 'Kitchen blocked from PREPARING while PAYMENT_PENDING');
    }

    // 2. Staff verifies and approves the online payment
    const verifyRes = await axios.put(
      `${BASE_URL}/payments/${onlineOrder.id}/verify`,
      { approve: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      verifyRes.status === 200 && verifyRes.data.order.status === 'PAID' && verifyRes.data.order.paymentStatus === 'VERIFIED',
      'Staff PUT /api/payments/:id/verify transitions order to PAID and payment to VERIFIED'
    );

    // 3. Idempotency check: repeated verification returns 200 safely
    const repeatVerify = await axios.put(
      `${BASE_URL}/payments/${onlineOrder.id}/verify`,
      { approve: true },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(repeatVerify.status === 200 && repeatVerify.data.order.status === 'PAID', 'Repeated payment verification is idempotent (200 OK)');

    // 4. Kitchen can now advance order: PAID -> PREPARING -> READY -> COMPLETED
    const prepRes = await axios.put(
      `${BASE_URL}/orders/${onlineOrder.id}/status`,
      { status: 'PREPARING' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(prepRes.data.order.status === 'PREPARING', 'Kitchen advances verified order to PREPARING');

    const readyRes = await axios.put(
      `${BASE_URL}/orders/${onlineOrder.id}/status`,
      { status: 'READY' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(readyRes.data.order.status === 'READY', 'Kitchen advances order to READY');

    const completeRes = await axios.put(
      `${BASE_URL}/orders/${onlineOrder.id}/status`,
      { status: 'COMPLETED' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(completeRes.data.order.status === 'COMPLETED', 'Cashier completes order handoff');

    // 5. Payment Rejection & Stock Restoration Test
    console.log('\n📌 Testing Online Payment Rejection & Stock Restoration...');
    const menuBefore = await axios.get(`${BASE_URL}/menu`);
    const stockBefore = menuBefore.data.items.find(i => i.id === menuItem.id).stock;

    const failedOrderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 3 }],
        tableId: table1.id,
        paymentMethod: 'JazzCash',
        paymentStatus: 'PENDING_VERIFICATION',
        paymentTxId: `TXN-JAZZ-FAIL-${Date.now()}`,
        status: 'PAYMENT_PENDING',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const failedOrder = failedOrderRes.data.order;

    // Staff rejects payment
    const rejectRes = await axios.put(
      `${BASE_URL}/payments/${failedOrder.id}/verify`,
      { approve: false, reason: 'Invalid JazzCash transaction ref' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(
      rejectRes.data.order.status === 'PAYMENT_FAILED' && rejectRes.data.order.paymentStatus === 'FAILED',
      'Staff rejecting payment transitions order to PAYMENT_FAILED'
    );

    const menuAfter = await axios.get(`${BASE_URL}/menu`);
    const stockAfter = menuAfter.data.items.find(i => i.id === menuItem.id).stock;
    assert(stockAfter === stockBefore, `Stock restored upon payment rejection: returned to ${stockAfter}`);

    console.log('\n================================================================');
    console.log(`📊 THREE ISSUES TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runThreeIssuesTestSuite();
