const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testTableSwitchingFlow() {
  console.log('===========================================================');
  console.log('🧪 TESTING TABLE SWITCHING TOKEN FLOW & VERIFICATION');
  console.log('===========================================================\n');

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
    // Fetch real signed tables from DB
    const batchRes = await axios.get(`${BASE_URL}/tables/qr/batch`);
    const tables = batchRes.data.tables;
    const table1 = tables.find(t => t.tableNumber === 'Table 1') || tables[0];
    const table2 = tables.find(t => t.tableNumber === 'Table 2') || tables[1];

    console.log(`Table 1 Token: ${table1.qrToken}`);
    console.log(`Table 2 Token: ${table2.qrToken}\n`);

    // ------------------------------------------------------------------------
    // CASE 1: Normal Table 1 QR scan -> session starts successfully
    // ------------------------------------------------------------------------
    console.log('📌 CASE 1: Normal Table 1 QR scan...');
    const session1Res = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table1.qrToken,
    });
    assert(session1Res.status === 201 && session1Res.data.session.id, 'Session 1 started successfully on Table 1');
    const session1Id = session1Res.data.session.id;

    // Add items to Table 1 cart
    const menuRes = await axios.get(`${BASE_URL}/menu`);
    const menuItem1 = menuRes.data.items[0];
    await axios.post(`${BASE_URL}/cart/${session1Id}/items`, {
      menuItemId: menuItem1.id,
      quantity: 3,
    });

    const cart1Check = await axios.get(`${BASE_URL}/cart/${session1Id}`);
    assert(cart1Check.data.cart.items.length === 1 && cart1Check.data.cart.items[0].quantity === 3, 'Table 1 cart populated with 3 items');

    // ------------------------------------------------------------------------
    // CASE 2: Active Table 1 session -> scan Table 2 with complete signed token
    // ------------------------------------------------------------------------
    console.log('\n📌 CASE 2: Scanning Table 2 (Table Switching Flow)...');
    
    // Simulate user choosing "Start New Table 2 Session"
    // Payload sent by frontend: { qrToken: "<complete-signed-Table-2-token>" }
    const session2Res = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: table2.qrToken,
    });
    assert(session2Res.status === 201 && session2Res.data.session.id, 'Table 2 session created successfully using complete signed token');
    const session2Id = session2Res.data.session.id;
    assert(session2Id !== session1Id, 'New session has distinct UUID from Table 1');

    // ------------------------------------------------------------------------
    // CASE 3: New Table 2 cart is empty & Table 1 cart remains unchanged
    // ------------------------------------------------------------------------
    console.log('\n📌 CASE 3: Verifying Cart Isolation on Table Switch...');
    const cart2Check = await axios.get(`${BASE_URL}/cart/${session2Id}`);
    assert(cart2Check.data.cart.items.length === 0, 'New Table 2 cart is empty');

    const cart1PostSwitch = await axios.get(`${BASE_URL}/cart/${session1Id}`);
    assert(
      cart1PostSwitch.data.cart.items.length === 1 && cart1PostSwitch.data.cart.items[0].quantity === 3,
      'Old Table 1 cart and session remain completely unchanged in database'
    );

    // ------------------------------------------------------------------------
    // CASE 4: URL-Encoded Table 2 Token handling (e.g. tbl%3A2%3A1%3A...)
    // ------------------------------------------------------------------------
    console.log('\n📌 CASE 4: Testing URL-Encoded Table Token...');
    const encodedTable2Token = encodeURIComponent(table2.qrToken);
    console.log(`Encoded Token: ${encodedTable2Token}`);
    const encodedSessionRes = await axios.post(`${BASE_URL}/sessions/start`, {
      qrToken: encodedTable2Token,
    });
    assert(encodedSessionRes.status === 201 && encodedSessionRes.data.session.table.tableNumber === 'Table 2', 'URL-encoded token decoded and verified without breaking signature');

    // ------------------------------------------------------------------------
    // CASE 5: Malformed Token Rejection
    // ------------------------------------------------------------------------
    console.log('\n📌 CASE 5: Testing Malformed Token Rejection...');
    try {
      await axios.post(`${BASE_URL}/sessions/start`, {
        qrToken: 'malformed_non_table_token',
      });
      assert(false, 'Malformed token rejection', 'Expected failure');
    } catch (e) {
      assert(
        e.response?.status === 400 && e.response?.data?.error?.includes('Malformed'),
        'Malformed token correctly rejected with 400 Bad Request ("Malformed table token structure.")'
      );
    }

    // ------------------------------------------------------------------------
    // CASE 6: Fake / Tampered Token Rejection (HMAC Signature Enforced)
    // ------------------------------------------------------------------------
    console.log('\n📌 CASE 6: Testing Fake/Tampered HMAC Signature Rejection...');
    const tamperedToken = table2.qrToken.replace(/.$/, 'X'); // alter last character of signature
    try {
      await axios.post(`${BASE_URL}/sessions/start`, {
        qrToken: tamperedToken,
      });
      assert(false, 'Tampered token rejection', 'Expected failure');
    } catch (e) {
      assert(
        e.response?.status === 400 && e.response?.data?.error?.includes('signature'),
        'Tampered token rejected with 400 Bad Request ("Cryptographic signature mismatch.")'
      );
    }

    console.log('\n===========================================================');
    console.log(`📊 TABLE SWITCHING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Error in table switching test:', err.response?.data || err.message);
    process.exit(1);
  }
}

testTableSwitchingFlow();
