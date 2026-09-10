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
  await prisma.table.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  // 1. Create Default Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'SwipeBite Main Campus Canteen',
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
  const passwordHash = await bcrypt.hash('password123', 10);
  const usersData = [
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

  // 4. Create Categories
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

  // 5. Create Menu Items (28 Unique Items with dedicated images)
  const menuItemsData = [
    // Burgers
    {
      name: 'Zinger Burger',
      description: 'Crispy deep-fried spicy chicken fillet with lettuce & mayo in a sesame bun.',
      price: 450,
      category: 'Burgers',
      stock: 50,
      prepTime: 12,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Classic Beef Cheeseburger',
      description: 'Juicy smashed beef patty topped with melted cheddar, pickles & house sauce.',
      price: 550,
      category: 'Burgers',
      stock: 40,
      prepTime: 14,
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Spicy Jalapeño Smash Burger',
      description: 'Double beef patty with charred jalapeños, spicy mayo, and pepper jack cheese.',
      price: 520,
      category: 'Burgers',
      stock: 35,
      prepTime: 15,
      imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=700&auto=format&fit=crop&q=80',
    },

    // Pizza
    {
      name: 'Margherita Pizza',
      description: 'Classic Italian stone-baked pizza with rich tomato sauce, fresh mozzarella & basil.',
      price: 750,
      category: 'Pizza',
      stock: 30,
      prepTime: 18,
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Chicken Tikka Supreme Pizza',
      description: 'Loaded with smoky chicken tikka boti, onions, bell peppers & mozzarella cheese.',
      price: 950,
      category: 'Pizza',
      stock: 25,
      prepTime: 20,
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Pepperoni Passion Pizza',
      description: 'Savory Italian beef pepperoni slices over melted mozzarella cheese.',
      price: 890,
      category: 'Pizza',
      stock: 25,
      prepTime: 18,
      imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=700&auto=format&fit=crop&q=80',
    },

    // Pasta
    {
      name: 'Creamy Chicken Alfredo Pasta',
      description: 'Fettuccine pasta tossed in rich parmesan garlic white cream sauce with grilled chicken.',
      price: 650,
      category: 'Pasta',
      stock: 30,
      prepTime: 16,
      imageUrl: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Spicy Penne Arrabbiata',
      description: 'Penne pasta in a fiery garlic chili tomato red sauce with fresh herbs.',
      price: 580,
      category: 'Pasta',
      stock: 30,
      prepTime: 15,
      imageUrl: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=700&auto=format&fit=crop&q=80',
    },

    // Sandwiches
    {
      name: 'Club Sandwich Supreme',
      description: 'Triple decker toast with grilled chicken, egg omelette, cheese, lettuce & tomatoes.',
      price: 480,
      category: 'Sandwiches',
      stock: 40,
      prepTime: 10,
      imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Grilled Cheese Toastie',
      description: 'Golden buttery toasted sourdough stuffed with melted cheddar & mozzarella.',
      price: 320,
      category: 'Sandwiches',
      stock: 45,
      prepTime: 8,
      imageUrl: 'https://images.unsplash.com/photo-1528736235302-52922df5c122?w=700&auto=format&fit=crop&q=80',
    },

    // Fried Chicken
    {
      name: 'Crispy Fried Chicken Bucket',
      description: '4 pieces of golden crunchy fried chicken served with garlic dip & spicy dip.',
      price: 680,
      category: 'Fried Chicken',
      stock: 35,
      prepTime: 15,
      imageUrl: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Buffalo Hot Wings (8 pcs)',
      description: 'Crispy chicken wings tossed in tangy spicy buffalo sauce.',
      price: 490,
      category: 'Fried Chicken',
      stock: 40,
      prepTime: 12,
      imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=700&auto=format&fit=crop&q=80',
    },

    // Fries
    {
      name: 'Loaded Cheese & Jalapeño Fries',
      description: 'Crispy french fries drenched in warm cheddar cheese sauce & sliced jalapeños.',
      price: 400,
      category: 'Fries',
      stock: 50,
      prepTime: 10,
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Peri Peri Masala Fries',
      description: 'Golden potato fries generously tossed in spicy Peri Peri masala seasoning.',
      price: 220,
      category: 'Fries',
      stock: 60,
      prepTime: 8,
      imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=700&auto=format&fit=crop&q=80',
    },

    // Rice & Biryani
    {
      name: 'Special Chicken Biryani',
      description: 'Fragrant aromatic basmati rice cooked with tender spiced chicken piece & herbs.',
      price: 350,
      category: 'Rice & Biryani',
      stock: 50,
      prepTime: 6,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Royal Beef Yakhni Pulao',
      description: 'Traditional spiced beef pulao cooked in rich aromatic beef broth.',
      price: 420,
      category: 'Rice & Biryani',
      stock: 40,
      prepTime: 6,
      imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=700&auto=format&fit=crop&q=80',
    },

    // Wraps
    {
      name: 'Charcoal Chicken Chatni Roll',
      description: 'Charcoal grilled chicken boti with spicy green mint sauce wrapped in crispy paratha.',
      price: 250,
      category: 'Wraps',
      stock: 50,
      prepTime: 10,
      imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Grilled Chicken Shawarma Wrap',
      description: 'Shaved seasoned chicken boti wrapped in soft tortilla with garlic tahini sauce.',
      price: 320,
      category: 'Wraps',
      stock: 45,
      prepTime: 9,
      imageUrl: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=700&auto=format&fit=crop&q=80',
    },

    // Salads
    {
      name: 'Fresh Grilled Chicken Caesar Salad',
      description: 'Crisp romaine lettuce, parmesan shavings, croutons & grilled chicken with Caesar dressing.',
      price: 390,
      category: 'Salads',
      stock: 30,
      prepTime: 8,
      imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&auto=format&fit=crop&q=80',
    },

    // Desserts & Cakes
    {
      name: 'Rich Chocolate Lava Cake',
      description: 'Warm chocolate cake with a molten chocolate center.',
      price: 350,
      category: 'Desserts & Cakes',
      stock: 35,
      prepTime: 8,
      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'New York Baked Cheesecake',
      description: 'Smooth and creamy baked cheesecake slice with strawberry glaze.',
      price: 450,
      category: 'Desserts & Cakes',
      stock: 25,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Warm Fudgy Chocolate Brownie',
      description: 'Dense dark chocolate brownie served warm.',
      price: 280,
      category: 'Desserts & Cakes',
      stock: 40,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=700&auto=format&fit=crop&q=80',
    },

    // Beverages & Shakes
    {
      name: 'Fresh Mango Thick Shake',
      description: 'Made from fresh real mangoes blended with chilled milk and ice cream.',
      price: 300,
      category: 'Beverages & Shakes',
      stock: 50,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Chilled Iced Coffee with Ice Cream',
      description: 'Espresso blended with cold milk, cocoa & topped with vanilla ice cream.',
      price: 350,
      category: 'Beverages & Shakes',
      stock: 50,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Special Karak Doodh Chai',
      description: 'Traditional rich cardamom milk tea brewed slow.',
      price: 90,
      category: 'Beverages & Shakes',
      stock: 100,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Strawberry Cream Shake',
      description: 'Sweet fresh strawberry puree blended into thick ice cream milk.',
      price: 320,
      category: 'Beverages & Shakes',
      stock: 40,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Fresh Mint Lemonade Margaretta',
      description: 'Zesty lemon juice blended with crushed ice and fresh garden mint leaves.',
      price: 240,
      category: 'Beverages & Shakes',
      stock: 60,
      prepTime: 5,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=700&auto=format&fit=crop&q=80',
    },
    {
      name: 'Peach Iced Tea',
      description: 'Refreshing cold brewed black tea infused with sweet peach flavor.',
      price: 220,
      category: 'Beverages & Shakes',
      stock: 50,
      prepTime: 4,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=700&auto=format&fit=crop&q=80',
    },
  ];

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

    // Create corresponding inventory item
    const unit =
      menuItem.category.includes('Beverages') || menuItem.name.toLowerCase().includes('chai')
        ? 'cups'
        : 'portions';
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        branchId: branch.id,
        name: menuItem.name,
        stockLevel: menuItem.stock,
        unit: unit,
        minThreshold: Math.max(5, Math.round(menuItem.stock * 0.2)),
      },
    });

    await prisma.inventoryLog.create({
      data: {
        inventoryItemId: inventoryItem.id,
        quantityBefore: 0,
        quantityAfter: menuItem.stock,
        changeQty: menuItem.stock,
        type: 'RESTOCK',
        reason: 'Initial seed inventory provisioning',
      },
    });
  }

  console.log(`✅ Seeding completed successfully. Seeded ${menuItemsData.length} items across ${categoriesData.length} categories.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
