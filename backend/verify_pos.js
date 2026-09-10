const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5001/api';
const EMAIL_LOG_PATH = path.join(__dirname, 'email_logs.txt');

const runTest = async () => {
  console.log('=== SwipeBite POS API E2E Verification ===');

  // 0. Ensure clean logs
  if (fs.existsSync(EMAIL_LOG_PATH)) {
    fs.unlinkSync(EMAIL_LOG_PATH);
    console.log('Cleared existing email logs.');
  }

  // 1. Fetch menu (Public)
  console.log('\n[1] Fetching menu items...');
  const menuRes = await axios.get(`${API_BASE}/menu`);
  const items = menuRes.data.items;
  console.log(`Fetched ${items.length} active menu items.`);
  if (items.length === 0) {
    throw new Error('No menu items returned!');
  }
  const testItem = items[0];
  console.log(`Test Item: ${testItem.name} (ID: ${testItem.id}, Price: $${testItem.price})`);

  // 2. Request OTP
  const studentEmail = 'guest-student@university.edu';
  const studentName = 'Alex Mercer';
  console.log(`\n[2] Requesting OTP for ${studentName} (${studentEmail})...`);
  const otpSendRes = await axios.post(`${API_BASE}/auth/send-otp`, {
    email: studentEmail,
    name: studentName
  });
  console.log('OTP Send Response:', otpSendRes.data);

  // 3. Extract OTP from local email logs
  console.log('\n[3] Reading email logs to extract OTP...');
  if (!fs.existsSync(EMAIL_LOG_PATH)) {
    throw new Error('Email logs file was not created. OTP sending failed!');
  }
  const logsContent = fs.readFileSync(EMAIL_LOG_PATH, 'utf8');
  const otpMatch = logsContent.match(/Verification Code: (\d{6})/);
  if (!otpMatch) {
    throw new Error('Could not find 6-digit OTP code in the email log!');
  }
  const otp = otpMatch[1];
  console.log(`Extracted OTP from logs: ${otp}`);

  // 4. Verify OTP (Registration & JWT token generation)
  console.log('\n[4] Verifying OTP and logging in guest...');
  const otpVerifyRes = await axios.post(`${API_BASE}/auth/verify-otp`, {
    email: studentEmail,
    name: studentName,
    otp: otp
  });
  console.log('OTP Verify Response:', {
    success: otpVerifyRes.data.success,
    user: otpVerifyRes.data.user,
    tokenPresent: !!otpVerifyRes.data.accessToken
  });
  const token = otpVerifyRes.data.accessToken;

  // 5. Test public ETA Endpoint
  console.log('\n[5] Calculating ETA Prediction (Public)...');
  const etaRes = await axios.post(`${API_BASE}/eta`, {
    items: [{ menuItemId: testItem.id, quantity: 2 }]
  });
  console.log('ETA Prediction:', etaRes.data);
  if (!etaRes.data.estimatedTime || !etaRes.data.explanation) {
    throw new Error('Invalid ETA or explanation returned!');
  }

  // 6. Place Online Paid Order
  console.log('\n[6] Placing pre-paid Online Order...');
  const orderPayload = {
    items: [{ menuItemId: testItem.id, quantity: 2 }],
    tableId: 'Table 9',
    paymentMethod: 'Easypaisa',
    paymentStatus: 'Paid',
    paymentTxId: 'TX-GUEST-' + Date.now(),
    status: 'PAID'
  };

  const orderRes = await axios.post(`${API_BASE}/orders`, orderPayload, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const order = orderRes.data.order;
  console.log(`Placed pre-paid Order ID: #${order.id}. Status: ${order.status}. Payment: ${order.paymentStatus}`);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Check order placement confirmation email in logs
  console.log('\n[7] Checking Order Placement Confirmation Email in logs...');
  await sleep(500);
  const placementLog = fs.readFileSync(EMAIL_LOG_PATH, 'utf8');
  if (!placementLog.includes(`Order Confirmed - SwipeBite POS #${order.id}`)) {
    throw new Error('Confirmation email not found in logs!');
  }
  console.log('✓ Order Placement Email correctly written to logs.');

  // 8. Log in as Kitchen Staff to mark Order as READY
  console.log('\n[8] Logging in as Kitchen Staff...');
  const kitchenLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: 'kitchen@pos.com',
    password: 'password123'
  });
  const kitchenToken = kitchenLogin.data.accessToken;
  console.log('Kitchen staff logged in successfully.');

  // Update order status to READY
  console.log(`\n[9] Updating Order ID #${order.id} status to READY...`);
  const statusRes = await axios.put(`${API_BASE}/orders/${order.id}/status`, {
    status: 'READY'
  }, {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  console.log(`Order status updated:`, statusRes.data.message);

  // Check order ready email in logs
  console.log('\n[10] Checking Order Ready Email in logs...');
  await sleep(500);
  const readyLog = fs.readFileSync(EMAIL_LOG_PATH, 'utf8');
  if (!readyLog.includes(`Order Ready for Pickup! - SwipeBite POS #${order.id}`)) {
    throw new Error('Order Ready email not found in logs!');
  }
  console.log('✓ Order Ready Email correctly written to logs.');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
};

runTest().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  if (err.response) {
    console.error('Response data:', err.response.data);
  }
  process.exit(1);
});
