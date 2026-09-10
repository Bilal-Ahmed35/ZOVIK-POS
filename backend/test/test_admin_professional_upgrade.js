const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runAdminProfessionalUpgradeTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING ADMIN PANEL PROFESSIONAL UPGRADE ENDPOINTS & SECURITY');
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
    // TEST 1: Admin Customer Roster Endpoint
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: GET /api/admin/customers (Customer Roster & Analytics)...');
    const customerRes = await axios.get(`${BASE_URL}/admin/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(customerRes.status === 200, 'GET /api/admin/customers returns 200 OK');
    assert(Array.isArray(customerRes.data.customers), 'Customers payload is an array');

    // ------------------------------------------------------------------------
    // TEST 2: Admin Order Status History Endpoint
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: GET /api/admin/order-history (Status Transition Timeline)...');
    const historyRes = await axios.get(`${BASE_URL}/admin/order-history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(historyRes.status === 200, 'GET /api/admin/order-history returns 200 OK');
    assert(Array.isArray(historyRes.data.history), 'History payload is an array');

    // ------------------------------------------------------------------------
    // TEST 3: Admin Branch Roster Endpoint
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: GET /api/admin/branches (Branch Roster)...');
    const branchRes = await axios.get(`${BASE_URL}/admin/branches`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(branchRes.status === 200, 'GET /api/admin/branches returns 200 OK');
    assert(Array.isArray(branchRes.data.branches), 'Branches payload is an array');

    // ------------------------------------------------------------------------
    // TEST 4: Admin Staff Password Reset
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: POST /api/admin/staff/:id/reset-password...');
    const staffListRes = await axios.get(`${BASE_URL}/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const targetStaff = staffListRes.data.staff[0];
    if (targetStaff) {
      const resetRes = await axios.post(
        `${BASE_URL}/admin/staff/${targetStaff.id}/reset-password`,
        { password: 'password123' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(resetRes.status === 200, 'Password reset succeeded');
      assert(resetRes.data.message.includes('Password reset successfully'), 'Reset response confirmed');
    } else {
      assert(true, 'No staff found to reset password');
    }

    // ------------------------------------------------------------------------
    // TEST 5: Security — Customer Forbidden from Admin Upgrade Endpoints
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Security — Customer blocked from admin endpoints (403 Forbidden)...');
    try {
      await axios.get(`${BASE_URL}/admin/customers`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert(false, 'Customer accessed admin customers endpoint', 'Expected 403 Forbidden');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer correctly blocked from GET /api/admin/customers (403 Forbidden)');
    }

    console.log('\n================================================================');
    console.log(`📊 ADMIN UPGRADE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in admin upgrade test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runAdminProfessionalUpgradeTestSuite();
