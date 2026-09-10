const axios = require('axios');
require('dotenv').config();

const API = 'http://localhost:5001/api';

async function runAudit() {
  console.log('=== STARTING END-TO-END APPLICATION AUDIT ===\n');

  // 1. Menu API
  console.log('[1] Testing Menu API...');
  const menuRes = await axios.get(`${API}/menu`);
  console.log(`- Menu items retrieved: ${menuRes.data.items.length}`);
  const uniqueImages = new Set(menuRes.data.items.map(i => i.imageUrl));
  console.log(`- Unique image URLs: ${uniqueImages.size}/${menuRes.data.items.length}`);

  // 2. OTP Request & Verification
  console.log('\n[2] Testing Auth & OTP System...');
  const email = `audit_customer_${Date.now()}@pos.com`;
  const otpRes = await axios.post(`${API}/auth/send-otp`, {
    email,
    name: 'Audit Customer',
    sessionId: null
  });
  console.log(`- Send OTP Response: ${otpRes.data.message}`);

  // Wait for async email logger to finish writing
  await new Promise(r => setTimeout(r, 300));

  // Read latest OTP specifically for this customer from log file
  const fs = require('fs');
  const path = require('path');
  const logContent = fs.readFileSync(path.join(__dirname, 'email_logs.txt'), 'utf8');
  const entries = logContent.split('================================================================================');
  const targetEntry = entries.reverse().find(e => e.includes(email));
  const match = targetEntry ? targetEntry.match(/SwipeBite Verification Code:\s*(\d{6})/) : null;
  const latestOtp = match ? match[1] : '000000';
  console.log(`- Extracted OTP from email log: ${latestOtp}`);

  const verifyRes = await axios.post(`${API}/auth/verify-otp`, {
    email,
    name: 'Audit Customer',
    otp: latestOtp
  });
  console.log(`- Verify OTP Response: user ID ${verifyRes.data.user.id}, token generated.`);

  // 3. Dining Session
  console.log('\n[3] Testing Table Session...');
  const sessionRes = await axios.post(`${API}/sessions/start`, {
    tableNumber: '1'
  });
  const sessionId = sessionRes.data.session.id;
  console.log(`- Active session created for Table 1: ID ${sessionId}`);

  // 4. AI ETA Calculation
  console.log('\n[4] Testing AI ETA Prediction Service...');
  const firstItem = menuRes.data.items[0];
  const etaRes = await axios.post(`${API}/eta`, {
    items: [{ menuItemId: firstItem.id, quantity: 2 }]
  });
  console.log(`- Calculated ETA for ${firstItem.name}: ${etaRes.data.estimatedTime} mins (Load: ${etaRes.data.kitchenLoad})`);

  // 5. Order Placement
  console.log('\n[5] Testing Order Placement...');
  const orderRes = await axios.post(`${API}/orders`, {
    items: [
      { menuItemId: firstItem.id, quantity: 2 },
      { menuItemId: menuRes.data.items[1].id, quantity: 1 }
    ],
    tableId: 1,
    sessionId: sessionId,
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    customerEmail: email,
    emailVerified: true
  }, {
    headers: { Authorization: `Bearer ${verifyRes.data.accessToken}` }
  });
  const order = orderRes.data.order;
  console.log(`- Order Created: ${order.orderNumber} (Total: Rs. ${order.total}, Tracking Token: ${order.trackingToken})`);

  // 6. Public QR Tracking
  console.log('\n[6] Testing Public QR Order Tracking...');
  const trackRes = await axios.get(`${API}/orders/track/${order.trackingToken}`);
  console.log(`- Tracking details retrieved for Order #${trackRes.data.order.orderNumber}: Status = ${trackRes.data.order.status}`);

  // 7. Vendor / Cashier Login & Order Update
  console.log('\n[7] Testing Vendor Dashboard API...');
  const vendorLogin = await axios.post(`${API}/auth/login`, {
    email: 'vendor@pos.com',
    password: 'password123'
  });
  const vendorToken = vendorLogin.data.accessToken;
  console.log(`- Vendor logged in: ${vendorLogin.data.user.name}`);

  const vendorOrders = await axios.get(`${API}/orders`, {
    headers: { Authorization: `Bearer ${vendorToken}` }
  });
  console.log(`- Total orders retrieved by Vendor: ${vendorOrders.data.orders.length}`);

  // 8. Kitchen Board Status Update
  console.log('\n[8] Testing Kitchen Board API...');
  const kitchenLogin = await axios.post(`${API}/auth/login`, {
    email: 'kitchen@pos.com',
    password: 'password123'
  });
  const kitchenToken = kitchenLogin.data.accessToken;
  
  const prepStatusRes = await axios.put(`${API}/orders/${order.id}/status`, {
    status: 'PREPARING',
    note: 'Kitchen started preparation'
  }, {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  console.log(`- Order status updated to PREPARING: ${prepStatusRes.data.order.status}`);
  
  const readyStatusRes = await axios.put(`${API}/orders/${order.id}/status`, {
    status: 'READY'
  }, {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  console.log(`- Order status updated to READY: ${readyStatusRes.data.order.status}`);

  const completeStatusRes = await axios.put(`${API}/orders/${order.id}/status`, {
    status: 'COMPLETED'
  }, {
    headers: { Authorization: `Bearer ${vendorToken}` }
  });
  console.log(`- Order status updated to COMPLETED: ${completeStatusRes.data.order.status}`);

  // 9. Admin Analytics & Inventory AI Forecasting
  console.log('\n[9] Testing Admin Dashboard & AI Demand Forecast...');
  const adminLogin = await axios.post(`${API}/auth/login`, {
    email: 'admin@pos.com',
    password: 'password123'
  });
  const adminToken = adminLogin.data.accessToken;

  const adminStats = await axios.get(`${API}/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`- Admin Stats: Total Revenue Rs. ${adminStats.data.metrics.totalRevenue}, Active Orders = ${adminStats.data.metrics.activeOrdersCount}`);

  const invForecast = await axios.post(`${API}/inventory/recalculate-forecasts`, {}, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`- Inventory Demand Forecast Items: ${invForecast.data.forecasts?.length || 0} items evaluated via ML model.`);

  console.log('\n=== END-TO-END APPLICATION AUDIT SUCCESSFUL! ALL TESTS PASSED! ===');
}

runAudit().catch(err => {
  console.error('Audit Failure:', err.response?.data || err.message);
  process.exit(1);
});
