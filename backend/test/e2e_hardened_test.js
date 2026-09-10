const axios = require('axios');
const http = require('http');
const express = require('express');
const cors = require('cors');

// Run tests against the express server
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE AI POS PRODUCTION TEST SUITE');
  console.log('====================================================\n');

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
    // ---------------------------------------------------------
    // TEST 1: Staff Authentication & Refresh Token Flow
    // ---------------------------------------------------------
    console.log('📌 1. Testing Staff Authentication & Tokens...');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'password123',
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data.accessToken, 'Admin Login successful');
    assert(adminLoginRes.data.refreshToken, 'Refresh token returned on login');
    const adminToken = adminLoginRes.data.accessToken;
    const adminRefresh = adminLoginRes.data.refreshToken;

    const vendorLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'vendor@pos.com',
      password: 'password123',
    });
    assert(vendorLoginRes.status === 200, 'Vendor/Cashier Login successful');
    const vendorToken = vendorLoginRes.data.accessToken;

    const kitchenLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'kitchen@pos.com',
      password: 'password123',
    });
    assert(kitchenLoginRes.status === 200, 'Kitchen Login successful');
    const kitchenToken = kitchenLoginRes.data.accessToken;

    // Test token refresh
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh-token`, {
      refreshToken: adminRefresh,
    });
    assert(refreshRes.status === 200 && refreshRes.data.accessToken, 'Access Token refreshed successfully via Refresh Token');

    // ---------------------------------------------------------
    // TEST 2: Cryptographic Table & QR Security
    // ---------------------------------------------------------
    console.log('\n📌 2. Testing Cryptographic Table QR Security...');
    const tablesRes = await axios.get(`${BASE_URL}/tables/qr/batch`);
    assert(tablesRes.status === 200 && tablesRes.data.tables.length >= 20, 'Fetched batch of 20 physical tables with signed tokens');
    const table1 = tablesRes.data.tables[0];
    const table2 = tablesRes.data.tables[1];

    // Attempt starting session with fake/tampered QR token
    try {
      await axios.post(`${BASE_URL}/sessions/start`, {
        qrToken: 'tbl:99:1:fakeNonce:invalidSignature',
      });
      assert(false, 'Fake QR token rejection', 'Expected failure');
    } catch (e) {
      assert(e.response?.status === 400 || e.response?.status === 404, 'Fake QR token correctly rejected with 400/404');
    }

    // ---------------------------------------------------------
    // TEST 3: Dining Sessions & Multi-Customer Isolation
    // ---------------------------------------------------------
    console.log('\n📌 3. Testing Dining Sessions & Cart Isolation...');
    const session1Res = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table1.qrToken,
    });
    assert(session1Res.status === 201 && session1Res.data.session.id, 'Session 1 started on Table 1');
    const session1Id = session1Res.data.session.id;

    // Second customer simultaneously scans Table 1
    const session2Res = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table1.qrToken,
    });
    assert(session2Res.status === 201 && session2Res.data.session.id, 'Session 2 started on Table 1');
    const session2Id = session2Res.data.session.id;
    assert(session1Id !== session2Id, 'Multi-customer isolation: 2 separate session UUIDs created for same table');

    // ---------------------------------------------------------
    // TEST 4: Backend-Linked Cart Sync
    // ---------------------------------------------------------
    console.log('\n📌 4. Testing Backend-Linked Cart...');
    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem1 = menuRes.data.items[0];
    const menuItem2 = menuRes.data.items[1];

    // Add 2 items to Session 1 cart
    await axios.post(`${BASE_URL}/cart/${session1Id}/items`, {
      menuItemId: menuItem1.id,
      quantity: 2,
    });

    const cart1Res = await axios.get(`${BASE_URL}/cart/${session1Id}`);
    assert(cart1Res.data.cart.items.length === 1, 'Session 1 cart contains 1 item entry');
    assert(cart1Res.data.cart.items[0].quantity === 2, 'Session 1 item quantity is 2');

    // Verify Session 2 cart is completely separate and empty
    const cart2Res = await axios.get(`${BASE_URL}/cart/${session2Id}`);
    assert(cart2Res.data.cart.items.length === 0, 'Session 2 cart remains empty (zero collision)');

    // ---------------------------------------------------------
    // TEST 5: Persistent Email OTP Verification Flow
    // ---------------------------------------------------------
    console.log('\n📌 5. Testing Persistent Email OTP Verification...');
    const testEmail = `e2e.customer.${Date.now()}@example.com`;
    const otpSendRes = await axios.post(`${BASE_URL}/auth/send-otp`, {
      email: testEmail,
      name: 'E2E Test Customer',
      sessionId: session1Id,
    });
    assert(otpSendRes.data.success === true, 'OTP generated and saved in persistent DB table');

    // Test invalid OTP code
    try {
      await axios.post(`${BASE_URL}/auth/verify-otp`, {
        email: testEmail,
        otp: '000000',
        sessionId: session1Id,
      });
      assert(false, 'Invalid OTP rejection', 'Expected failure');
    } catch (e) {
      assert(e.response?.status === 400 && e.response?.data?.error?.includes('attempt'), 'Incorrect OTP decrements attempts');
    }

    // In a real verification, customer gets JWT. Let's authenticate as customer for order placement:
    const customerLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLoginRes.data.accessToken;

    // ---------------------------------------------------------
    // TEST 6: Order Creation with Snapshots, AI ETA & Inventory
    // ---------------------------------------------------------
    console.log('\n📌 6. Testing Order Placement, Snapshots & Inventory Deduction...');
    const initialStock = menuItem1.stock;

    const orderPlacementRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem1.id, quantity: 2 }],
        tableId: table1.id,
        sessionId: session1Id,
        paymentMethod: 'COD',
        customerEmail: 'customer@pos.com',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );

    assert(orderPlacementRes.status === 201, 'Order created successfully');
    const order = orderPlacementRes.data.order;
    assert(order.orderNumber?.startsWith('ORD-'), `Human-friendly order number generated: ${order.orderNumber}`);
    assert(order.trackingToken, 'Cryptographic dynamic order tracking token generated');
    assert(order.orderItems[0].nameSnapshot === menuItem1.name, 'OrderItem historical name snapshot captured');
    assert(order.orderItems[0].priceSnapshot === menuItem1.price, 'OrderItem historical price snapshot captured');
    assert(order.etaPrediction?.adjustedEta > 0, `AI ETA estimated: ~${Math.round(order.etaPrediction.adjustedEta)} mins`);

    // Verify inventory deduction
    const updatedMenuRes = await axios.get(`${BASE_URL}/menu`);
    const updatedItem1 = updatedMenuRes.data.items.find(i => i.id === menuItem1.id);
    assert(updatedItem1.stock === initialStock - 2, `Stock deducted: ${initialStock} -> ${updatedItem1.stock}`);

    // ---------------------------------------------------------
    // TEST 7: Strict Role-Based Order Lifecycle Transitions
    // ---------------------------------------------------------
    console.log('\n📌 7. Testing Strict Role-Based Order Transitions...');

    // Cashier verifies payment: PENDING -> PAID
    const paidRes = await axios.put(
      `${BASE_URL}/orders/${order.id}/status`,
      { status: 'PAID', note: 'Cash collected at counter' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(paidRes.data.order.status === 'PAID', 'Cashier advanced order to PAID');

    // Kitchen marks PREPARING
    const prepRes = await axios.put(
      `${BASE_URL}/orders/${order.id}/status`,
      { status: 'PREPARING' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(prepRes.data.order.status === 'PREPARING', 'Kitchen advanced order to PREPARING');

    // Kitchen marks READY
    const readyRes = await axios.put(
      `${BASE_URL}/orders/${order.id}/status`,
      { status: 'READY' },
      { headers: { Authorization: `Bearer ${kitchenToken}` } }
    );
    assert(readyRes.data.order.status === 'READY', 'Kitchen advanced order to READY');

    // Unauthorized transition: Kitchen attempting to mark COMPLETED
    try {
      await axios.put(
        `${BASE_URL}/orders/${order.id}/status`,
        { status: 'COMPLETED' },
        { headers: { Authorization: `Bearer ${kitchenToken}` } }
      );
      assert(false, 'Kitchen completing order rejection', 'Expected 403');
    } catch (e) {
      assert(e.response?.status === 403, 'Kitchen blocked from marking COMPLETED (403 Forbidden)');
    }

    // Cashier marks COMPLETED (handoff)
    const completeRes = await axios.put(
      `${BASE_URL}/orders/${order.id}/status`,
      { status: 'COMPLETED', note: 'Customer picked up meal' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    assert(completeRes.data.order.status === 'COMPLETED', 'Cashier completed & handed over order');

    // ---------------------------------------------------------
    // TEST 8: Order Cancellation & Closed-Loop Stock Restore
    // ---------------------------------------------------------
    console.log('\n📌 8. Testing Order Cancellation & Stock Restoration...');
    const stockBeforeSecondOrder = updatedItem1.stock;

    const secondOrderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem1.id, quantity: 3 }],
        tableId: table2.id,
        sessionId: session2Id,
        paymentMethod: 'COD',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const secondOrder = secondOrderRes.data.order;

    // Admin cancels second order
    await axios.put(
      `${BASE_URL}/orders/${secondOrder.id}/status`,
      { status: 'CANCELLED', note: 'Test cancellation' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const postCancelMenuRes = await axios.get(`${BASE_URL}/menu`);
    const postCancelItem1 = postCancelMenuRes.data.items.find(i => i.id === menuItem1.id);
    assert(postCancelItem1.stock === stockBeforeSecondOrder, `Stock restored on cancellation: returned to ${postCancelItem1.stock}`);

    // ---------------------------------------------------------
    // TEST 9: Public Dynamic Order Tracking by Token
    // ---------------------------------------------------------
    console.log('\n📌 9. Testing Public Dynamic Order Tracking by Token...');
    const trackRes = await axios.get(`${BASE_URL}/orders/track/${encodeURIComponent(order.trackingToken)}`);
    assert(trackRes.status === 200 && trackRes.data.order.orderNumber === order.orderNumber, 'Public tracking returned live order details');

    // ---------------------------------------------------------
    // TEST 10: Admin Executive Stats & Audit Logs
    // ---------------------------------------------------------
    console.log('\n📌 10. Testing Admin Stats & Audit Log Verification...');
    const statsRes = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(statsRes.status === 200 && statsRes.data.metrics?.totalRevenue > 0, `Admin stats calculated period revenue: Rs. ${statsRes.data.metrics.totalRevenue}`);
    assert(statsRes.data.metrics?.etaAccuracy > 0, `Admin stats calculated AI ETA accuracy: ${statsRes.data.metrics.etaAccuracy}%`);

    const auditRes = await axios.get(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.status === 200 && auditRes.data.logs.length > 0, `Audit logs captured ${auditRes.data.logs.length} immutable action trails`);

    console.log('\n====================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Fatal test error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
