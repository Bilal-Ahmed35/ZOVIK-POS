const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const branches = await prisma.branch.findMany();
  const tables = await prisma.table.findMany();
  const users = await prisma.user.findMany();
  const menuItems = await prisma.menuItem.findMany();
  console.log('Branches:', branches.length);
  console.log('Tables:', tables.length);
  console.log('Users:', users.length);
  console.log('MenuItems:', menuItems.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
