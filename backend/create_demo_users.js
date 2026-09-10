require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const prisma = new PrismaClient();
const API = 'http://localhost:5001/api';

const demoAccounts = [
  { email: 'admin.demo@example.com', name: 'Demo System Admin', role: 'ADMIN', password: 'Demo@12345' },
  { email: 'vendor.demo@example.com', name: 'Demo Vendor Cashier', role: 'VENDOR', password: 'Demo@12345' },
  { email: 'kitchen.demo@example.com', name: 'Demo Kitchen Chef', role: 'KITCHEN', password: 'Demo@12345' },
  { email: 'customer.demo@example.com', name: 'Demo Customer', role: 'CUSTOMER', password: 'Demo@12345' },
];

async function createAndVerifyDemoAccounts() {
  console.log('=== CREATING & VERIFYING DEMO ACCOUNTS ===\n');

  // Fetch branch ID (use first active branch or ID 1)
  const branch = await prisma.branch.findFirst({ where: { isActive: true } });
  const branchId = branch ? branch.id : 1;

  const passwordHash = await bcrypt.hash('Demo@12345', 10);

  for (const acc of demoAccounts) {
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: acc.email },
        data: {
          password: passwordHash,
          name: acc.name,
          role: acc.role,
          branchId,
          isActive: true,
        },
      });
      console.log(`[VERIFIED/UPDATED] User: ${acc.email} (${acc.role})`);
    } else {
      await prisma.user.create({
        data: {
          email: acc.email,
          name: acc.name,
          password: passwordHash,
          role: acc.role,
          branchId,
          isActive: true,
        },
      });
      console.log(`[CREATED] User: ${acc.email} (${acc.role})`);
    }
  }

  console.log('\n--- TESTING LOGIN API FOR DEMO ACCOUNTS ---');
  const results = [];

  for (const acc of demoAccounts) {
    try {
      const res = await axios.post(`${API}/auth/login`, {
        email: acc.email,
        password: acc.password,
      });

      let route = '/customer';
      if (acc.role === 'ADMIN') route = '/admin';
      else if (acc.role === 'VENDOR') route = '/cashier';
      else if (acc.role === 'KITCHEN') route = '/kitchen';

      results.push({
        email: acc.email,
        role: acc.role,
        loginWorking: true,
        route,
        tokenReceived: Boolean(res.data.accessToken),
      });
      console.log(`✅ Login SUCCESS for ${acc.email} [${acc.role}] -> Token received. Route: ${route}`);
    } catch (err) {
      console.error(`❌ Login FAILED for ${acc.email}:`, err.response?.data || err.message);
      results.push({
        email: acc.email,
        role: acc.role,
        loginWorking: false,
        route: 'N/A',
        error: err.response?.data?.error || err.message,
      });
    }
  }

  console.log('\n=== DEMO ACCOUNTS SETUP COMPLETE ===');
}

createAndVerifyDemoAccounts()
  .catch(err => {
    console.error('Demo accounts setup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
