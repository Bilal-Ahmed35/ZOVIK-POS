require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generateTableToken } = require('../src/services/qrSecurityService');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Complete POS Database Seed ---');

  // 0. Clean all tables in correct dependency order
  console.log('Cleaning existing data...');
  await prisma.orderStatusHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.emailOTP.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.eTAPrediction.deleteMany();
  await prisma.demandForecast.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.session.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.table.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  // 1. Create Default Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'ZovikPOS Main Campus Canteen',
      address: 'University Campus Plaza, Block A',
      phone: '+92 300 1234567',
      isActive: true,
    },
  });
  console.log(`Created Branch: ${branch.name} (ID: ${branch.id})`);

  // 2. Create 20 Physical Tables with signed cryptographic QR tokens
  console.log('Creating signed physical tables...');
  for (let i = 1; i <= 20; i++) {
    const tableNumber = String(i);
    const qrToken = generateTableToken(tableNumber, branch.id);
    await prisma.table.create({
      data: {
        branchId: branch.id,
        tableNumber: `Table ${tableNumber}`,
        qrToken,
        isActive: true,
      },
    });
  }
  console.log('Created 20 signed tables (Table 1 to Table 20).');

  // 3. Create Default Users (Admin, Cashier/Vendor, Kitchen, Customer)
  const passwordHash = await bcrypt.hash('Redline742454', 10);
  const usersData = [
    { email: 'admin@zovikpos.com', name: 'System Administrator', role: 'ADMIN', branchId: branch.id },
    { email: 'cashier@zovikpos.com', name: 'Cashier / Vendor', role: 'VENDOR', branchId: branch.id },
    { email: 'vendor@zovikpos.com', name: 'Cashier / Vendor', role: 'VENDOR', branchId: branch.id },
    { email: 'kitchen@zovikpos.com', name: 'Kitchen Staff', role: 'KITCHEN', branchId: branch.id },
    { email: 'customer@zovikpos.com', name: 'Customer Account', role: 'CUSTOMER', branchId: branch.id },
    { email: 'admin@pos.com', name: 'System Admin', role: 'ADMIN', branchId: branch.id },
    { email: 'vendor@pos.com', name: 'Main Vendor Cashier', role: 'VENDOR', branchId: branch.id },
    { email: 'kitchen@pos.com', name: 'Kitchen Chef', role: 'KITCHEN', branchId: branch.id },
    { email: 'customer@pos.com', name: 'John Doe Customer', role: 'CUSTOMER', branchId: branch.id },
  ];

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: passwordHash,
        role: u.role,
        branchId: u.branchId,
        isActive: true,
      },
    });
    console.log(`Created user: ${user.name} (${user.role})`);
  }

  // 4. Create Suppliers
  console.log('Creating suppliers...');
  const suppliersData = [
    { name: 'Metro Wholesale Pakistan', contactPerson: 'Ali Ahmed', phone: '0300-1112233', email: 'sales@metro.pk', address: 'Lahore Highway Hub' },
    { name: 'K&N\'s Poultry Supplies', contactPerson: 'Tariq Hassan', phone: '0321-4445566', email: 'orders@kns.pk', address: 'Industrial Area Sector 5' },
    { name: 'Dawn Bread Industry', contactPerson: 'Usman Farooq', phone: '0333-7778899', email: 'supply@dawnbread.com', address: 'Plaza Estate Block B' },
    { name: 'Nestlé Pakistan Dairy', contactPerson: 'Sara Khan', phone: '0302-8889900', email: 'b2b@nestle.pk', address: 'Dairy Complex Zone 2' },
    { name: 'National Foods Pakistan', contactPerson: 'Bilal Malik', phone: '0315-5556677', email: 'distribution@nfoods.com', address: 'Spices & Sauces Hub' },
  ];

  const createdSuppliers = {};
  for (const s of suppliersData) {
    const sup = await prisma.supplier.create({ data: s });
    createdSuppliers[s.name] = sup.id;
  }

  // 5. Create Categories
  const categoriesData = [
    { name: 'Burgers', slug: 'burgers' },
    { name: 'Pizza', slug: 'pizza' },
    { name: 'Pasta', slug: 'pasta' },
    { name: 'Sandwiches', slug: 'sandwiches' },
    { name: 'Fried Chicken', slug: 'fried-chicken' },
    { name: 'Fries', slug: 'fries' },
    { name: 'Rice & Biryani', slug: 'rice-biryani' },
    { name: 'Wraps', slug: 'wraps' },
    { name: 'Salads', slug: 'salads' },
    { name: 'Desserts & Cakes', slug: 'desserts-cakes' },
    { name: 'Beverages & Shakes', slug: 'beverages-shakes' },
    { name: 'Breakfast', slug: 'breakfast' },
  ];

  for (const cat of categoriesData) {
    await prisma.category.create({ data: cat });
  }

  // 6. Create Raw Ingredients (InventoryItems)
  console.log('Creating raw ingredient inventory items...');
  const rawIngredientsData = [
    // Meat / Protein
    { name: 'Chicken Fillet', category: 'Meat / Protein', unit: 'KG', stockLevel: 50, minThreshold: 10, maxThreshold: 100, costPrice: 850, supplierId: createdSuppliers['K&N\'s Poultry Supplies'] },
    { name: 'Chicken Wings', category: 'Meat / Protein', unit: 'PCS', stockLevel: 500, minThreshold: 100, maxThreshold: 1000, costPrice: 35, supplierId: createdSuppliers['K&N\'s Poultry Supplies'] },
    { name: 'Beef Patty', category: 'Meat / Protein', unit: 'PCS', stockLevel: 200, minThreshold: 40, maxThreshold: 500, costPrice: 180, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Chicken Boti / Tikka', category: 'Meat / Protein', unit: 'KG', stockLevel: 40, minThreshold: 8, maxThreshold: 80, costPrice: 900, supplierId: createdSuppliers['K&N\'s Poultry Supplies'] },
    { name: 'Shredded Shawarma Chicken', category: 'Meat / Protein', unit: 'KG', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 880, supplierId: createdSuppliers['K&N\'s Poultry Supplies'] },
    { name: 'Pepperoni Slices', category: 'Meat / Protein', unit: 'PACK', stockLevel: 25, minThreshold: 5, maxThreshold: 50, costPrice: 600, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },

    // Bakery
    { name: 'Burger Bun', category: 'Bakery', unit: 'PCS', stockLevel: 300, minThreshold: 50, maxThreshold: 600, costPrice: 25, supplierId: createdSuppliers['Dawn Bread Industry'] },
    { name: 'Pizza Dough Base', category: 'Bakery', unit: 'PCS', stockLevel: 100, minThreshold: 20, maxThreshold: 200, costPrice: 60, supplierId: createdSuppliers['Dawn Bread Industry'] },
    { name: 'Tortilla / Paratha Bread', category: 'Bakery', unit: 'PCS', stockLevel: 200, minThreshold: 40, maxThreshold: 400, costPrice: 30, supplierId: createdSuppliers['Dawn Bread Industry'] },
    { name: 'Sourdough Bread Slices', category: 'Bakery', unit: 'PACK', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 150, supplierId: createdSuppliers['Dawn Bread Industry'] },

    // Dairy
    { name: 'Mozzarella Cheese', category: 'Dairy', unit: 'KG', stockLevel: 25, minThreshold: 5, maxThreshold: 50, costPrice: 1400, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },
    { name: 'Cheddar Cheese Slice', category: 'Dairy', unit: 'PACK', stockLevel: 40, minThreshold: 8, maxThreshold: 80, costPrice: 450, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },
    { name: 'Fresh Milk', category: 'Dairy', unit: 'L', stockLevel: 60, minThreshold: 15, maxThreshold: 120, costPrice: 210, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },
    { name: 'Fresh Cream', category: 'Dairy', unit: 'L', stockLevel: 20, minThreshold: 4, maxThreshold: 40, costPrice: 550, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },
    { name: 'Butter', category: 'Dairy', unit: 'KG', stockLevel: 15, minThreshold: 3, maxThreshold: 30, costPrice: 1200, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },
    { name: 'Vanilla Ice Cream', category: 'Dairy', unit: 'PCS', stockLevel: 20, minThreshold: 4, maxThreshold: 40, costPrice: 800, supplierId: createdSuppliers['Nestlé Pakistan Dairy'] },

    // Vegetables
    { name: 'Fresh Potatoes', category: 'Vegetables', unit: 'KG', stockLevel: 100, minThreshold: 20, maxThreshold: 200, costPrice: 110, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Tomatoes', category: 'Vegetables', unit: 'KG', stockLevel: 40, minThreshold: 10, maxThreshold: 80, costPrice: 120, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Onions', category: 'Vegetables', unit: 'KG', stockLevel: 50, minThreshold: 10, maxThreshold: 100, costPrice: 90, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Lettuce', category: 'Vegetables', unit: 'KG', stockLevel: 20, minThreshold: 5, maxThreshold: 40, costPrice: 180, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Jalapeño Slices', category: 'Vegetables', unit: 'BOTTLE', stockLevel: 15, minThreshold: 3, maxThreshold: 30, costPrice: 350, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Bell Peppers', category: 'Vegetables', unit: 'KG', stockLevel: 20, minThreshold: 4, maxThreshold: 40, costPrice: 220, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Fresh Mint Leaves', category: 'Vegetables', unit: 'G', stockLevel: 2000, minThreshold: 400, maxThreshold: 4000, costPrice: 0.5, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },

    // Dry Goods
    { name: 'Basmati Rice', category: 'Dry Goods', unit: 'KG', stockLevel: 150, minThreshold: 30, maxThreshold: 300, costPrice: 320, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'All-Purpose Flour', category: 'Dry Goods', unit: 'KG', stockLevel: 80, minThreshold: 15, maxThreshold: 160, costPrice: 140, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Fettuccine Pasta', category: 'Dry Goods', unit: 'KG', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 400, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Penne Pasta', category: 'Dry Goods', unit: 'KG', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 380, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Sugar', category: 'Dry Goods', unit: 'KG', stockLevel: 50, minThreshold: 10, maxThreshold: 100, costPrice: 150, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },

    // Sauces & Condiments
    { name: 'Mayonnaise', category: 'Sauces & Condiments', unit: 'KG', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 500, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Ketchup', category: 'Sauces & Condiments', unit: 'KG', stockLevel: 30, minThreshold: 6, maxThreshold: 60, costPrice: 350, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Garlic Tahini Dip', category: 'Sauces & Condiments', unit: 'KG', stockLevel: 15, minThreshold: 3, maxThreshold: 30, costPrice: 650, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Pizza Tomato Sauce', category: 'Sauces & Condiments', unit: 'KG', stockLevel: 25, minThreshold: 5, maxThreshold: 50, costPrice: 420, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Buffalo Hot Sauce', category: 'Sauces & Condiments', unit: 'L', stockLevel: 20, minThreshold: 4, maxThreshold: 40, costPrice: 750, supplierId: createdSuppliers['National Foods Pakistan'] },

    // Cooking Oil
    { name: 'Cooking Oil', category: 'Cooking Oil', unit: 'L', stockLevel: 120, minThreshold: 25, maxThreshold: 240, costPrice: 480, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },

    // Spices
    { name: 'Cardamom & Spices', category: 'Spices', unit: 'G', stockLevel: 3000, minThreshold: 500, maxThreshold: 6000, costPrice: 2, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Biryani Spices Mix', category: 'Spices', unit: 'KG', stockLevel: 10, minThreshold: 2, maxThreshold: 20, costPrice: 1100, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Peri Peri Masala', category: 'Spices', unit: 'KG', stockLevel: 8, minThreshold: 2, maxThreshold: 16, costPrice: 950, supplierId: createdSuppliers['National Foods Pakistan'] },

    // Beverages
    { name: 'Tea Leaves (Karak)', category: 'Beverages', unit: 'KG', stockLevel: 15, minThreshold: 3, maxThreshold: 30, costPrice: 1300, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Espresso Coffee Beans', category: 'Beverages', unit: 'KG', stockLevel: 10, minThreshold: 2, maxThreshold: 20, costPrice: 2200, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Mango Pulp', category: 'Beverages', unit: 'KG', stockLevel: 25, minThreshold: 5, maxThreshold: 50, costPrice: 450, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Strawberry Puree', category: 'Beverages', unit: 'KG', stockLevel: 20, minThreshold: 4, maxThreshold: 40, costPrice: 520, supplierId: createdSuppliers['National Foods Pakistan'] },
    { name: 'Peach Syrup', category: 'Beverages', unit: 'BOTTLE', stockLevel: 12, minThreshold: 3, maxThreshold: 24, costPrice: 850, supplierId: createdSuppliers['National Foods Pakistan'] },

    // Packaging
    { name: 'Takeaway Burger Box', category: 'Packaging', unit: 'PCS', stockLevel: 500, minThreshold: 100, maxThreshold: 1000, costPrice: 12, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Pizza Box (12 inch)', category: 'Packaging', unit: 'PCS', stockLevel: 300, minThreshold: 50, maxThreshold: 600, costPrice: 35, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
    { name: 'Beverage Cups & Lids', category: 'Packaging', unit: 'PCS', stockLevel: 800, minThreshold: 150, maxThreshold: 1500, costPrice: 8, supplierId: createdSuppliers['Metro Wholesale Pakistan'] },
  ];

  const inventoryMap = {};
  for (const rawData of rawIngredientsData) {
    const inv = await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: rawData.name,
        category: rawData.category,
        unit: rawData.unit,
        stockLevel: rawData.stockLevel,
        minThreshold: rawData.minThreshold,
        maxThreshold: rawData.maxThreshold,
        costPrice: rawData.costPrice,
        supplierId: rawData.supplierId,
      }
    });

    await prisma.inventoryLog.create({
      data: {
        inventoryItemId: inv.id,
        quantityBefore: 0,
        quantityAfter: rawData.stockLevel,
        changeQty: rawData.stockLevel,
        type: 'RESTOCK',
        reason: 'Initial raw ingredient inventory provisioning',
        cost: rawData.costPrice * rawData.stockLevel,
        supplierId: rawData.supplierId,
      }
    });

    inventoryMap[rawData.name] = inv;
  }
  console.log(`Created ${Object.keys(inventoryMap).length} raw ingredient inventory items.`);

  // 7. Create Menu Items (Finished Canteen Products)
  console.log('Creating menu items...');
  const menuItemsData = [
    { name: 'Zinger Burger', description: 'Crispy deep-fried spicy chicken fillet with lettuce & mayo in a sesame bun.', price: 450, category: 'Burgers', stock: 50, prepTime: 12, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80' },
    { name: 'Classic Beef Cheeseburger', description: 'Juicy smashed beef patty topped with melted cheddar, pickles & house sauce.', price: 550, category: 'Burgers', stock: 40, prepTime: 14, imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&auto=format&fit=crop&q=80' },
    { name: 'Spicy Jalapeño Smash Burger', description: 'Double beef patty with charred jalapeños, spicy mayo, and pepper jack cheese.', price: 520, category: 'Burgers', stock: 35, prepTime: 15, imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=700&auto=format&fit=crop&q=80' },
    { name: 'Margherita Pizza', description: 'Classic Italian stone-baked pizza with rich tomato sauce, fresh mozzarella & basil.', price: 750, category: 'Pizza', stock: 30, prepTime: 18, imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=700&auto=format&fit=crop&q=80' },
    { name: 'Chicken Tikka Supreme Pizza', description: 'Loaded with smoky chicken tikka boti, onions, bell peppers & mozzarella cheese.', price: 950, category: 'Pizza', stock: 25, prepTime: 20, imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=80' },
    { name: 'Pepperoni Passion Pizza', description: 'Savory Italian beef pepperoni slices over melted mozzarella cheese.', price: 890, category: 'Pizza', stock: 25, prepTime: 18, imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=700&auto=format&fit=crop&q=80' },
    { name: 'Creamy Chicken Alfredo Pasta', description: 'Fettuccine pasta tossed in rich parmesan garlic white cream sauce with grilled chicken.', price: 650, category: 'Pasta', stock: 30, prepTime: 16, imageUrl: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=700&auto=format&fit=crop&q=80' },
    { name: 'Spicy Penne Arrabbiata', description: 'Penne pasta in a fiery garlic chili tomato red sauce with fresh herbs.', price: 580, category: 'Pasta', stock: 30, prepTime: 15, imageUrl: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=700&auto=format&fit=crop&q=80' },
    { name: 'Club Sandwich Supreme', description: 'Triple decker toast with grilled chicken, egg omelette, cheese, lettuce & tomatoes.', price: 480, category: 'Sandwiches', stock: 40, prepTime: 10, imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=700&auto=format&fit=crop&q=80' },
    { name: 'Grilled Cheese Toastie', description: 'Golden buttery toasted sourdough stuffed with melted cheddar & mozzarella.', price: 320, category: 'Sandwiches', stock: 45, prepTime: 8, imageUrl: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=700&auto=format&fit=crop&q=80' },
    { name: 'Crispy Fried Chicken Bucket', description: '4 pieces of golden crunchy fried chicken served with garlic dip & spicy dip.', price: 680, category: 'Fried Chicken', stock: 35, prepTime: 15, imageUrl: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=700&auto=format&fit=crop&q=80' },
    { name: 'Buffalo Hot Wings (8 pcs)', description: 'Crispy chicken wings tossed in tangy spicy buffalo sauce.', price: 490, category: 'Fried Chicken', stock: 40, prepTime: 12, imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=700&auto=format&fit=crop&q=80' },
    { name: 'Loaded Cheese & Jalapeño Fries', description: 'Crispy french fries drenched in warm cheddar cheese sauce & sliced jalapeños.', price: 400, category: 'Fries', stock: 50, prepTime: 10, imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=700&auto=format&fit=crop&q=80' },
    { name: 'Peri Peri Masala Fries', description: 'Golden potato fries generously tossed in spicy Peri Peri masala seasoning.', price: 220, category: 'Fries', stock: 60, prepTime: 8, imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=700&auto=format&fit=crop&q=80' },
    { name: 'Special Chicken Biryani', description: 'Fragrant aromatic basmati rice cooked with tender spiced chicken piece & herbs.', price: 350, category: 'Rice & Biryani', stock: 50, prepTime: 6, imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80' },
    { name: 'Royal Beef Yakhni Pulao', description: 'Traditional spiced beef pulao cooked in rich aromatic beef broth.', price: 420, category: 'Rice & Biryani', stock: 40, prepTime: 6, imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=700&auto=format&fit=crop&q=80' },
    { name: 'Charcoal Chicken Chatni Roll', description: 'Charcoal grilled chicken boti with spicy green mint sauce wrapped in crispy paratha.', price: 250, category: 'Wraps', stock: 50, prepTime: 10, imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=700&auto=format&fit=crop&q=80' },
    { name: 'Grilled Chicken Shawarma Wrap', description: 'Shaved seasoned chicken boti wrapped in soft tortilla with garlic tahini sauce.', price: 320, category: 'Wraps', stock: 45, prepTime: 9, imageUrl: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=700&auto=format&fit=crop&q=80' },
    { name: 'Fresh Grilled Chicken Caesar Salad', description: 'Crisp romaine lettuce, parmesan shavings, croutons & grilled chicken with Caesar dressing.', price: 390, category: 'Salads', stock: 30, prepTime: 8, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&auto=format&fit=crop&q=80' },
    { name: 'Rich Chocolate Lava Cake', description: 'Warm chocolate cake with a molten chocolate center.', price: 350, category: 'Desserts & Cakes', stock: 35, prepTime: 8, imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&auto=format&fit=crop&q=80' },
    { name: 'New York Baked Cheesecake', description: 'Smooth and creamy baked cheesecake slice with strawberry glaze.', price: 450, category: 'Desserts & Cakes', stock: 25, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=700&auto=format&fit=crop&q=80' },
    { name: 'Warm Fudgy Chocolate Brownie', description: 'Dense dark chocolate brownie served warm.', price: 280, category: 'Desserts & Cakes', stock: 40, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=700&auto=format&fit=crop&q=80' },
    { name: 'Fresh Mango Thick Shake', description: 'Made from fresh real mangoes blended with chilled milk and ice cream.', price: 300, category: 'Beverages & Shakes', stock: 50, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=700&auto=format&fit=crop&q=80' },
    { name: 'Chilled Iced Coffee with Ice Cream', description: 'Espresso blended with cold milk, cocoa & topped with vanilla ice cream.', price: 350, category: 'Beverages & Shakes', stock: 50, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=700&auto=format&fit=crop&q=80' },
    { name: 'Special Karak Doodh Chai', description: 'Traditional rich cardamom milk tea brewed slow.', price: 90, category: 'Beverages & Shakes', stock: 100, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=700&auto=format&fit=crop&q=80' },
    { name: 'Strawberry Cream Shake', description: 'Sweet fresh strawberry puree blended into thick ice cream milk.', price: 320, category: 'Beverages & Shakes', stock: 40, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=700&auto=format&fit=crop&q=80' },
    { name: 'Fresh Mint Lemonade Margaretta', description: 'Zesty lemon juice blended with crushed ice and fresh garden mint leaves.', price: 240, category: 'Beverages & Shakes', stock: 60, prepTime: 5, imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=700&auto=format&fit=crop&q=80' },
    { name: 'Peach Iced Tea', description: 'Refreshing cold brewed black tea infused with sweet peach flavor.', price: 220, category: 'Beverages & Shakes', stock: 50, prepTime: 4, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=700&auto=format&fit=crop&q=80' },
  ];

  const menuMap = {};
  for (const itemData of menuItemsData) {
    const menuItem = await prisma.menuItem.create({
      data: {
        branchId: branch.id,
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        type: 'food',
        category: itemData.category,
        stock: itemData.stock,
        prepTime: itemData.prepTime,
        imageUrl: itemData.imageUrl,
        isActive: true,
      },
    });
    menuMap[itemData.name] = menuItem;
  }
  console.log(`Created ${Object.keys(menuMap).length} menu items.`);

  // 8. Create RecipeItem mappings (MenuItem -> RecipeItem -> InventoryItem)
  console.log('Mapping recipes for menu items...');
  const recipesData = [
    {
      menuName: 'Zinger Burger',
      ingredients: [
        { invName: 'Chicken Fillet', qty: 0.15, unit: 'KG' },
        { invName: 'Burger Bun', qty: 1, unit: 'PCS' },
        { invName: 'Lettuce', qty: 0.03, unit: 'KG' },
        { invName: 'Mayonnaise', qty: 0.02, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.015, unit: 'L' },
        { invName: 'Takeaway Burger Box', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Classic Beef Cheeseburger',
      ingredients: [
        { invName: 'Beef Patty', qty: 1, unit: 'PCS' },
        { invName: 'Burger Bun', qty: 1, unit: 'PCS' },
        { invName: 'Cheddar Cheese Slice', qty: 1, unit: 'PACK' },
        { invName: 'Onions', qty: 0.02, unit: 'KG' },
        { invName: 'Ketchup', qty: 0.015, unit: 'KG' },
        { invName: 'Takeaway Burger Box', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Spicy Jalapeño Smash Burger',
      ingredients: [
        { invName: 'Beef Patty', qty: 2, unit: 'PCS' },
        { invName: 'Burger Bun', qty: 1, unit: 'PCS' },
        { invName: 'Jalapeño Slices', qty: 1, unit: 'BOTTLE' },
        { invName: 'Cheddar Cheese Slice', qty: 1, unit: 'PACK' },
        { invName: 'Mayonnaise', qty: 0.015, unit: 'KG' },
        { invName: 'Takeaway Burger Box', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Margherita Pizza',
      ingredients: [
        { invName: 'Pizza Dough Base', qty: 1, unit: 'PCS' },
        { invName: 'Mozzarella Cheese', qty: 0.15, unit: 'KG' },
        { invName: 'Pizza Tomato Sauce', qty: 0.08, unit: 'KG' },
        { invName: 'Tomatoes', qty: 0.04, unit: 'KG' },
        { invName: 'Pizza Box (12 inch)', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Chicken Tikka Supreme Pizza',
      ingredients: [
        { invName: 'Pizza Dough Base', qty: 1, unit: 'PCS' },
        { invName: 'Chicken Boti / Tikka', qty: 0.12, unit: 'KG' },
        { invName: 'Mozzarella Cheese', qty: 0.16, unit: 'KG' },
        { invName: 'Pizza Tomato Sauce', qty: 0.08, unit: 'KG' },
        { invName: 'Onions', qty: 0.03, unit: 'KG' },
        { invName: 'Bell Peppers', qty: 0.03, unit: 'KG' },
        { invName: 'Pizza Box (12 inch)', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Pepperoni Passion Pizza',
      ingredients: [
        { invName: 'Pizza Dough Base', qty: 1, unit: 'PCS' },
        { invName: 'Pepperoni Slices', qty: 1, unit: 'PACK' },
        { invName: 'Mozzarella Cheese', qty: 0.16, unit: 'KG' },
        { invName: 'Pizza Tomato Sauce', qty: 0.08, unit: 'KG' },
        { invName: 'Pizza Box (12 inch)', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Creamy Chicken Alfredo Pasta',
      ingredients: [
        { invName: 'Fettuccine Pasta', qty: 0.15, unit: 'KG' },
        { invName: 'Chicken Fillet', qty: 0.1, unit: 'KG' },
        { invName: 'Fresh Cream', qty: 0.08, unit: 'L' },
        { invName: 'Butter', qty: 0.02, unit: 'KG' },
        { invName: 'Mozzarella Cheese', qty: 0.03, unit: 'KG' },
      ],
    },
    {
      menuName: 'Spicy Penne Arrabbiata',
      ingredients: [
        { invName: 'Penne Pasta', qty: 0.15, unit: 'KG' },
        { invName: 'Pizza Tomato Sauce', qty: 0.1, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.015, unit: 'L' },
        { invName: 'Tomatoes', qty: 0.05, unit: 'KG' },
      ],
    },
    {
      menuName: 'Club Sandwich Supreme',
      ingredients: [
        { invName: 'Sourdough Bread Slices', qty: 1, unit: 'PACK' },
        { invName: 'Chicken Fillet', qty: 0.08, unit: 'KG' },
        { invName: 'Cheddar Cheese Slice', qty: 1, unit: 'PACK' },
        { invName: 'Lettuce', qty: 0.02, unit: 'KG' },
        { invName: 'Tomatoes', qty: 0.02, unit: 'KG' },
        { invName: 'Mayonnaise', qty: 0.015, unit: 'KG' },
      ],
    },
    {
      menuName: 'Grilled Cheese Toastie',
      ingredients: [
        { invName: 'Sourdough Bread Slices', qty: 1, unit: 'PACK' },
        { invName: 'Cheddar Cheese Slice', qty: 2, unit: 'PACK' },
        { invName: 'Butter', qty: 0.015, unit: 'KG' },
      ],
    },
    {
      menuName: 'Crispy Fried Chicken Bucket',
      ingredients: [
        { invName: 'Chicken Wings', qty: 4, unit: 'PCS' },
        { invName: 'All-Purpose Flour', qty: 0.1, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.1, unit: 'L' },
        { invName: 'Garlic Tahini Dip', qty: 0.03, unit: 'KG' },
      ],
    },
    {
      menuName: 'Buffalo Hot Wings (8 pcs)',
      ingredients: [
        { invName: 'Chicken Wings', qty: 8, unit: 'PCS' },
        { invName: 'Buffalo Hot Sauce', qty: 0.05, unit: 'L' },
        { invName: 'Cooking Oil', qty: 0.08, unit: 'L' },
      ],
    },
    {
      menuName: 'Loaded Cheese & Jalapeño Fries',
      ingredients: [
        { invName: 'Fresh Potatoes', qty: 0.25, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.06, unit: 'L' },
        { invName: 'Cheddar Cheese Slice', qty: 2, unit: 'PACK' },
        { invName: 'Jalapeño Slices', qty: 1, unit: 'BOTTLE' },
      ],
    },
    {
      menuName: 'Peri Peri Masala Fries',
      ingredients: [
        { invName: 'Fresh Potatoes', qty: 0.25, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.06, unit: 'L' },
        { invName: 'Peri Peri Masala', qty: 0.01, unit: 'KG' },
      ],
    },
    {
      menuName: 'Special Chicken Biryani',
      ingredients: [
        { invName: 'Basmati Rice', qty: 0.2, unit: 'KG' },
        { invName: 'Chicken Fillet', qty: 0.18, unit: 'KG' },
        { invName: 'Cooking Oil', qty: 0.03, unit: 'L' },
        { invName: 'Onions', qty: 0.04, unit: 'KG' },
        { invName: 'Biryani Spices Mix', qty: 0.015, unit: 'KG' },
      ],
    },
    {
      menuName: 'Royal Beef Yakhni Pulao',
      ingredients: [
        { invName: 'Basmati Rice', qty: 0.2, unit: 'KG' },
        { invName: 'Beef Patty', qty: 1, unit: 'PCS' },
        { invName: 'Cooking Oil', qty: 0.03, unit: 'L' },
        { invName: 'Onions', qty: 0.04, unit: 'KG' },
        { invName: 'Cardamom & Spices', qty: 10, unit: 'G' },
      ],
    },
    {
      menuName: 'Charcoal Chicken Chatni Roll',
      ingredients: [
        { invName: 'Chicken Boti / Tikka', qty: 0.1, unit: 'KG' },
        { invName: 'Tortilla / Paratha Bread', qty: 1, unit: 'PCS' },
        { invName: 'Fresh Mint Leaves', qty: 15, unit: 'G' },
        { invName: 'Onions', qty: 0.02, unit: 'KG' },
      ],
    },
    {
      menuName: 'Grilled Chicken Shawarma Wrap',
      ingredients: [
        { invName: 'Shredded Shawarma Chicken', qty: 0.12, unit: 'KG' },
        { invName: 'Tortilla / Paratha Bread', qty: 1, unit: 'PCS' },
        { invName: 'Garlic Tahini Dip', qty: 0.03, unit: 'KG' },
        { invName: 'Lettuce', qty: 0.02, unit: 'KG' },
      ],
    },
    {
      menuName: 'Fresh Grilled Chicken Caesar Salad',
      ingredients: [
        { invName: 'Chicken Fillet', qty: 0.12, unit: 'KG' },
        { invName: 'Lettuce', qty: 0.15, unit: 'KG' },
        { invName: 'Tomatoes', qty: 0.04, unit: 'KG' },
        { invName: 'Mayonnaise', qty: 0.025, unit: 'KG' },
      ],
    },
    {
      menuName: 'Special Karak Doodh Chai',
      ingredients: [
        { invName: 'Fresh Milk', qty: 0.15, unit: 'L' },
        { invName: 'Tea Leaves (Karak)', qty: 0.008, unit: 'KG' },
        { invName: 'Sugar', qty: 0.012, unit: 'KG' },
        { invName: 'Cardamom & Spices', qty: 2, unit: 'G' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Fresh Mango Thick Shake',
      ingredients: [
        { invName: 'Mango Pulp', qty: 0.1, unit: 'KG' },
        { invName: 'Fresh Milk', qty: 0.15, unit: 'L' },
        { invName: 'Vanilla Ice Cream', qty: 1, unit: 'PCS' },
        { invName: 'Sugar', qty: 0.01, unit: 'KG' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Chilled Iced Coffee with Ice Cream',
      ingredients: [
        { invName: 'Espresso Coffee Beans', qty: 0.018, unit: 'KG' },
        { invName: 'Fresh Milk', qty: 0.15, unit: 'L' },
        { invName: 'Vanilla Ice Cream', qty: 1, unit: 'PCS' },
        { invName: 'Sugar', qty: 0.01, unit: 'KG' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Strawberry Cream Shake',
      ingredients: [
        { invName: 'Strawberry Puree', qty: 0.08, unit: 'KG' },
        { invName: 'Fresh Milk', qty: 0.15, unit: 'L' },
        { invName: 'Fresh Cream', qty: 0.03, unit: 'L' },
        { invName: 'Sugar', qty: 0.01, unit: 'KG' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Fresh Mint Lemonade Margaretta',
      ingredients: [
        { invName: 'Fresh Mint Leaves', qty: 25, unit: 'G' },
        { invName: 'Sugar', qty: 0.02, unit: 'KG' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Peach Iced Tea',
      ingredients: [
        { invName: 'Peach Syrup', qty: 1, unit: 'BOTTLE' },
        { invName: 'Tea Leaves (Karak)', qty: 0.005, unit: 'KG' },
        { invName: 'Sugar', qty: 0.015, unit: 'KG' },
        { invName: 'Beverage Cups & Lids', qty: 1, unit: 'PCS' },
      ],
    },
    {
      menuName: 'Rich Chocolate Lava Cake',
      ingredients: [
        { invName: 'All-Purpose Flour', qty: 0.05, unit: 'KG' },
        { invName: 'Butter', qty: 0.03, unit: 'KG' },
        { invName: 'Sugar', qty: 0.03, unit: 'KG' },
      ],
    },
    {
      menuName: 'New York Baked Cheesecake',
      ingredients: [
        { invName: 'Fresh Cream', qty: 0.06, unit: 'L' },
        { invName: 'Mozzarella Cheese', qty: 0.08, unit: 'KG' },
        { invName: 'Sugar', qty: 0.025, unit: 'KG' },
      ],
    },
    {
      menuName: 'Warm Fudgy Chocolate Brownie',
      ingredients: [
        { invName: 'All-Purpose Flour', qty: 0.04, unit: 'KG' },
        { invName: 'Butter', qty: 0.025, unit: 'KG' },
        { invName: 'Sugar', qty: 0.025, unit: 'KG' },
      ],
    },
  ];

  let totalRecipesCreated = 0;
  for (const recipe of recipesData) {
    const menuItem = menuMap[recipe.menuName];
    if (!menuItem) continue;

    for (const ing of recipe.ingredients) {
      const invItem = inventoryMap[ing.invName];
      if (!invItem) continue;

      await prisma.recipeItem.create({
        data: {
          menuItemId: menuItem.id,
          inventoryItemId: invItem.id,
          quantity: ing.qty,
          unit: ing.unit,
        },
      });
      totalRecipesCreated++;
    }
  }
  console.log(`Created ${totalRecipesCreated} recipe ingredient mappings across ${recipesData.length} menu items.`);

  console.log(`✅ Seeding completed successfully. Seeded ${menuItemsData.length} menu items and ${Object.keys(inventoryMap).length} raw ingredient items.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
