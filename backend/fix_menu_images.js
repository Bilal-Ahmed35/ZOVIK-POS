const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IMAGE_MAP = {
  'Chicken Biryani / Pulao': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&auto=format&fit=crop&q=80',
  'Beef Biryani / Pulao': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=700&auto=format&fit=crop&q=80',
  'Chicken / Beef Qeema / Achari': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=700&auto=format&fit=crop&q=80',
  'Aloo Qeema': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=700&auto=format&fit=crop&q=80',
  'Daal & Chawal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=700&auto=format&fit=crop&q=80',
  'Daal Fry / Mixed Vegetable': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=700&auto=format&fit=crop&q=80',
  'Chapati': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=700&auto=format&fit=crop&q=80',
  'Paratha Ordinary': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=700&auto=format&fit=crop&q=80',
  'Egg Omelette / Half Fry': 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=700&auto=format&fit=crop&q=80',
  'Paratha Aloo': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700&auto=format&fit=crop&q=80',
  'Paratha Cheese': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=700&auto=format&fit=crop&q=80',
  'Paratha Chicken': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=700&auto=format&fit=crop&q=80',
  'Paratha Chicken Cheese': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=700&auto=format&fit=crop&q=80',
  'Paratha Qeema': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=700&auto=format&fit=crop&q=80',
  'Chicken Chatni / Boti Roll': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=700&auto=format&fit=crop&q=80',
  'Chicken Malai / Mayo Roll': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=700&auto=format&fit=crop&q=80',
  'Chicken Cheese / Crispy Roll': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=700&auto=format&fit=crop&q=80',
  'Chicken Twister / Zinger Burger / Club Sandwich': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80',
  'Chicken / Zinger Burger with Cheese': 'https://images.unsplash.com/photo-1550317138-10000687a72b?w=700&auto=format&fit=crop&q=80',
  'Bun Shami Kabab / Sandwich / Burger': 'https://images.unsplash.com/photo-1461009683693-342af2f2d6ce?w=700&auto=format&fit=crop&q=80',
  'Chicken Shawarma': 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=700&auto=format&fit=crop&q=80',
  'Aloo Samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700&auto=format&fit=crop&q=80',
  'Spring Roll': 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=700&auto=format&fit=crop&q=80',
  'Tea': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&auto=format&fit=crop&q=80',
  'Fries Plain': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=700&auto=format&fit=crop&q=80',
  'Fries Masala': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Mayo Garlic': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries BBQ': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries BBQ Cheese': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Pizza': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Chicken Steak': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Mexican': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Veggie': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=700&auto=format&fit=crop&q=80',
  'Fries Smiley': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=700&auto=format&fit=crop&q=80',
};

async function fixMenuImages() {
  console.log('Fixing menu item image URLs...');
  for (const [name, imageUrl] of Object.entries(IMAGE_MAP)) {
    const res = await prisma.menuItem.updateMany({
      where: { name },
      data: { imageUrl }
    });
    console.log(`Updated ${res.count} item(s) for "${name}" -> ${imageUrl}`);
  }
  console.log('Done!');
  await prisma.$disconnect();
}

fixMenuImages().catch(err => {
  console.error(err);
  prisma.$disconnect();
});
