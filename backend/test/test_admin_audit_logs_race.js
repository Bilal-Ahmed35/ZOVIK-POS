const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5001/api';
const ACCESS_SECRET = process.env.JWT_SECRET || 'pos_system_jwt_access_secret_key_2026';

async function runAdminAuditLogsRaceTests() {
  console.log('================================================================');
  console.log('🧪 TESTING ADMIN AUDIT LOGS LOADING & AUTH RACE CONDITION FIX');
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
    // TEST 1: Fresh Admin Login -> Fetch /api/admin/audit-logs immediately -> 200 OK (no 403)
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: Fresh Admin login & immediate audit log retrieval...');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'password123',
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data.accessToken, 'Admin Login successful');
    const adminToken = adminLoginRes.data.accessToken;
    const adminRefreshToken = adminLoginRes.data.refreshToken;
    const adminUser = adminLoginRes.data.user;

    assert(adminUser.role === 'ADMIN', 'Logged in user role is ADMIN');

    // Immediately fetch audit-logs with valid Admin token
    const auditRes1 = await axios.get(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes1.status === 200 && Array.isArray(auditRes1.data.logs), 'Fresh Admin token GET /api/admin/audit-logs returns 200 OK with logs (No 403)');

    // ------------------------------------------------------------------------
    // TEST 2: Refresh / Restored Admin Session -> audit logs load with 200 OK
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: Restored Admin session audit log retrieval...');
    const auditRes2 = await axios.get(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes2.status === 200 && auditRes2.data.logs.length > 0, 'Restored session GET /api/admin/audit-logs returns 200 OK');

    // ------------------------------------------------------------------------
    // TEST 3: Expired Admin access token -> Auto refresh -> audit logs load 200 OK
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Expired Admin access token & automatic token refresh...');
    // Create an expired Admin access token
    const expiredAdminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'ADMIN', name: adminUser.name, branchId: adminUser.branchId },
      ACCESS_SECRET,
      { expiresIn: '-10s' } // Expired 10 seconds ago
    );

    // Verify server rejects expired token with 401 TOKEN_EXPIRED (not 403)
    try {
      await axios.get(`${BASE_URL}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${expiredAdminToken}` },
      });
      assert(false, 'Expired token check', 'Expected 401');
    } catch (err) {
      assert(err.response?.status === 401, 'Server rejects expired token with 401 TOKEN_EXPIRED (not 403)');
    }

    // Refresh token request
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh-token`, {
      refreshToken: adminRefreshToken,
    });
    assert(refreshRes.status === 200 && refreshRes.data.accessToken, 'Token refresh request succeeded');
    const newAdminToken = refreshRes.data.accessToken;

    // Retry request with new token
    const auditRes3 = await axios.get(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${newAdminToken}` },
    });
    assert(auditRes3.status === 200 && auditRes3.data.logs.length > 0, 'Audit logs fetched successfully with refreshed Admin token (200 OK)');

    // ------------------------------------------------------------------------
    // TEST 4: Customer/Vendor/Kitchen forbidden from audit-logs
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Customer/Vendor/Kitchen access restriction...');
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

    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'customer@pos.com',
      password: 'password123',
    });
    const customerToken = customerLogin.data.accessToken;

    // Vendor check
    try {
      await axios.get(`${BASE_URL}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      assert(false, 'Vendor audit logs access', 'Expected 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Vendor correctly blocked from audit logs (403 Forbidden)');
    }

    // Kitchen check
    try {
      await axios.get(`${BASE_URL}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${kitchenToken}` },
      });
      assert(false, 'Kitchen audit logs access', 'Expected 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Kitchen correctly blocked from audit logs (403 Forbidden)');
    }

    // Customer check
    try {
      await axios.get(`${BASE_URL}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert(false, 'Customer audit logs access', 'Expected 403');
    } catch (err) {
      assert(err.response?.status === 403, 'Customer correctly blocked from audit logs (403 Forbidden)');
    }

    // ------------------------------------------------------------------------
    // TEST 5: Customer activity does not pollute or compromise Admin token
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Customer activity isolation...');
    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem = menuRes.data.items[0];

    // Customer places order
    const orderRes = await axios.post(
      `${BASE_URL}/orders`,
      {
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
        paymentMethod: 'COD',
        tableId: 1,
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert(orderRes.status === 201, 'Customer placed order successfully');

    // Admin audit logs request still uses Admin token and succeeds
    const auditRes5 = await axios.get(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${newAdminToken}` },
    });
    assert(auditRes5.status === 200 && auditRes5.data.logs.length > 0, 'Admin audit logs continue returning 200 OK post-customer order');

    console.log('\n================================================================');
    console.log(`📊 ADMIN AUDIT LOGS RACE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in admin audit logs test:', err.response?.data || err.message);
    process.exit(1);
  }
}

runAdminAuditLogsRaceTests();
