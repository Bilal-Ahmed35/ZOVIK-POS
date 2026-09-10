require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API = 'http://localhost:5001/api';

async function testCompleteSessionAndOrderFlow() {
  console.log('=== TESTING COMPLETE DINING SESSION & ORDER FLOW ===\n');

  // 1. Open table / Start Session
  console.log('[1] Initializing Table 4 Dining Session...');
  const sessionRes = await axios.post(`${API}/sessions/start`, { tableNumber: '4' });
  const session = sessionRes.data.session;
  console.log(`- Active Session ID: ${session.id} (Table: ${session.table.tableNumber})`);

  // 2. Verify Customer OTP
  console.log('\n[2] Verifying Customer Email via OTP...');
  const customerEmail = `session_test_${Date.now()}@pos.com`;
  await axios.post(`${API}/auth/send-otp`, {
    email: customerEmail,
    name: 'Session Test Customer',
    sessionId: session.id,
  });

  await new Promise(r => setTimeout(r, 300));
  const logContent = fs.readFileSync(path.join(__dirname, 'email_logs.txt'), 'utf8');
  const entries = logContent.split('================================================================================');
  const targetEntry = entries.reverse().find(e => e.includes(customerEmail));
  const otpMatch = targetEntry ? targetEntry.match(/SwipeBite Verification Code:\s*(\d{6})/) : null;
  const otp = otpMatch ? otpMatch[1] : null;

  console.log(`- Received OTP for ${customerEmail}: ${otp}`);
  const verifyRes = await axios.post(`${API}/auth/verify-otp`, {
    email: customerEmail,
    name: 'Session Test Customer',
    otp,
    sessionId: session.id,
  });
  console.log(`- Customer verified. User ID: ${verifyRes.data.user.id}`);

  // 3. Fetch Menu & Select Items (Zinger Burger & Classic Beef Cheeseburger)
  console.log('\n[3] Fetching Menu & Selecting Items...');
  const menuRes = await axios.get(`${API}/menu`);
  const items = menuRes.data.items;
  const zinger = items.find(i => i.name.includes('Zinger Burger')) || items[0];
  const beef = items.find(i => i.name.includes('Classic Beef Cheeseburger')) || items[1];

  console.log(`- Selected Item 1: ${zinger.name} (Rs. ${zinger.price})`);
  console.log(`- Selected Item 2: ${beef.name} (Rs. ${beef.price})`);

  // 4. Calculate AI ETA
  console.log('\n[4] Requesting AI ETA Prediction...');
  const etaRes = await axios.post(`${API}/eta`, {
    items: [
      { menuItemId: zinger.id, quantity: 1 },
      { menuItemId: beef.id, quantity: 1 },
    ],
  });
  console.log(`- AI Predicted ETA: ${etaRes.data.estimatedTime} mins (Kitchen Load: ${etaRes.data.kitchenLoad})`);

  // 5. Place Order with session.id
  console.log('\n[5] Placing Order with Session ID...');
  const orderRes = await axios.post(`${API}/orders`, {
    items: [
      { menuItemId: zinger.id, quantity: 1 },
      { menuItemId: beef.id, quantity: 1 },
    ],
    tableId: 'Table 4',
    sessionId: session.id,
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    customerEmail,
    emailVerified: true,
  }, {
    headers: { Authorization: `Bearer ${verifyRes.data.accessToken}` }
  });

  const order = orderRes.data.order;
  console.log(`- Order Placed Successfully! Order #: ${order.orderNumber}`);
  console.log(`- Linked Session ID in DB: ${order.sessionId}`);
  console.log(`- Total Amount: Rs. ${order.total}`);

  // 6. Database Verification
  console.log('\n[6] Verifying Order in SQLite/Prisma Database...');
  const dbOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { session: true, orderItems: true },
  });
  console.log(`- DB Order ID: ${dbOrder.id}`);
  console.log(`- DB Linked Session ID: ${dbOrder.sessionId} (Matches Session? ${dbOrder.sessionId === session.id})`);
  console.log(`- DB Order Items count: ${dbOrder.orderItems.length}`);

  // 7. Check Vendor & Kitchen Visibility
  console.log('\n[7] Checking Order Visibility in Staff Dashboards...');
  const vendorLogin = await axios.post(`${API}/auth/login`, { email: 'vendor@pos.com', password: 'password123' });
  const vendorOrders = await axios.get(`${API}/orders`, { headers: { Authorization: `Bearer ${vendorLogin.data.accessToken}` } });
  const isVendorVisible = vendorOrders.data.orders.some(o => o.id === order.id);
  console.log(`- Visible in Vendor Dashboard: ${isVendorVisible}`);

  // 8. Order Tracking URL
  console.log('\n[8] Testing Order Tracking URL...');
  const trackRes = await axios.get(`${API}/orders/track/${order.trackingToken}`);
  console.log(`- Public Order Tracker Status: ${trackRes.data.order.status}`);

  console.log('\n=== COMPLETE DINING SESSION & ORDER FLOW TEST SUCCESSFUL! ===');
}

testCompleteSessionAndOrderFlow()
  .catch(err => {
    console.error('Session test error details:', err.response ? err.response.data : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
