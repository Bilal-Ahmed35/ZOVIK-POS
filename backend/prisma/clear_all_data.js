const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllDummyData() {
  console.log('🧹 Starting complete database cleanup...\n');

  try {
    // Step 1: Clear all transactional/order data (in FK-safe order)
    console.log('Step 1: Clearing Audit Logs...');
    await prisma.auditLog.deleteMany({});

    console.log('Step 2: Clearing Demand Forecasts...');
    await prisma.demandForecast.deleteMany({});

    console.log('Step 3: Clearing ETA Predictions...');
    await prisma.eTAPrediction.deleteMany({});

    console.log('Step 4: Clearing Order Status History...');
    await prisma.orderStatusHistory.deleteMany({});

    console.log('Step 5: Clearing Order Items...');
    await prisma.orderItem.deleteMany({});

    console.log('Step 6: Clearing Payments...');
    await prisma.payment.deleteMany({});

    console.log('Step 7: Clearing Orders...');
    await prisma.order.deleteMany({});

    console.log('Step 8: Clearing Cart Items...');
    await prisma.cartItem.deleteMany({});

    console.log('Step 9: Clearing Carts...');
    await prisma.cart.deleteMany({});

    console.log('Step 10: Clearing Email OTPs...');
    await prisma.emailOTP.deleteMany({});

    console.log('Step 11: Clearing Sessions...');
    await prisma.session.deleteMany({});

    console.log('Step 12: Clearing Menu Items...');
    await prisma.menuItem.deleteMany({});

    console.log('Step 13: Clearing Inventory Logs...');
    await prisma.inventoryLog.deleteMany({});

    console.log('Step 14: Clearing Inventory Items...');
    await prisma.inventoryItem.deleteMany({});

    console.log('\n✅ All dummy/transactional data cleared successfully!');
    console.log('✅ Branch, Tables, and Demo Accounts are preserved.');
    console.log('\n📋 Database is now clean and ready for real data.\n');

  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllDummyData();
