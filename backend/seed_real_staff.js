/**
 * seed_real_staff.js
 * ─────────────────────────────────────────────────────────────
 * 1. Deletes dummy staff (kitchen@pos.com, vendor@pos.com, admin@pos.com)
 * 2. Creates real staff accounts in Prisma DB + Supabase Auth
 * ─────────────────────────────────────────────────────────────
 * Run: node seed_real_staff.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Real staff to create ────────────────────────────────────────────────────
const REAL_STAFF = [
  {
    name: 'System Administrator',
    email: 'admin@zovikpos.com',
    password: 'Admin@2026!',
    role: 'ADMIN',
  },
  {
    name: 'Cashier / Vendor',
    email: 'cashier@zovikpos.com',
    password: 'Cashier@2026!',
    role: 'VENDOR',
  },
  {
    name: 'Kitchen Staff',
    email: 'kitchen@zovikpos.com',
    password: 'Kitchen@2026!',
    role: 'KITCHEN',
  },
];

// ─── Dummy emails to remove ──────────────────────────────────────────────────
const DUMMY_EMAILS = [
  'kitchen@pos.com',
  'vendor@pos.com',
  'admin@pos.com',
];

async function deleteSupabaseAuthUser(email) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) { console.warn('  ⚠️  Could not list Supabase users:', error.message); return; }
    const found = data?.users?.find(u => u.email === email);
    if (found) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(found.id);
      if (delErr) console.warn(`  ⚠️  Supabase Auth delete failed for ${email}:`, delErr.message);
      else console.log(`  🗑️  Supabase Auth user deleted: ${email}`);
    } else {
      console.log(`  ℹ️  No Supabase Auth user found for: ${email}`);
    }
  } catch (err) {
    console.warn('  ⚠️  Supabase Auth delete error:', err.message);
  }
}

async function createSupabaseAuthUser(email, password, name, role) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) {
      console.warn(`  ⚠️  Supabase Auth create failed for ${email}:`, error.message);
      return null;
    }
    console.log(`  ✅  Supabase Auth user created: ${email} (${data.user.id})`);
    return data.user;
  } catch (err) {
    console.warn('  ⚠️  Supabase Auth create error:', err.message);
    return null;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ZovikPOS — Staff Seed Script');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── STEP 1: Remove dummy staff from Prisma + Supabase Auth ────────────────
  console.log('📌 Step 1: Removing dummy staff accounts...\n');
  for (const email of DUMMY_EMAILS) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.user.delete({ where: { email } });
        console.log(`  🗑️  Prisma DB: deleted ${email}`);
      } else {
        console.log(`  ℹ️  Prisma DB: not found ${email}`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Prisma delete skipped for ${email} (may have order refs):`, err.message);
      // Soft delete fallback
      try {
        await prisma.user.update({ where: { email }, data: { isActive: false } });
        console.log(`  🔕  Prisma DB: soft-deactivated ${email} (has order history)`);
      } catch (_) {}
    }
    await deleteSupabaseAuthUser(email);
    console.log('');
  }

  // ── STEP 2: Create real staff in Prisma + Supabase Auth ───────────────────
  console.log('📌 Step 2: Creating real staff accounts...\n');

  // Ensure branch 1 exists
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({ data: { name: 'Main Branch', isActive: true } });
    console.log('  🏢  Created default branch: Main Branch\n');
  }

  for (const staff of REAL_STAFF) {
    try {
      // Check if already exists
      const existing = await prisma.user.findUnique({ where: { email: staff.email } });
      if (existing) {
        console.log(`  ℹ️  Already exists in Prisma: ${staff.email} — skipping DB create`);
      } else {
        const hashedPassword = await bcrypt.hash(staff.password, 10);
        await prisma.user.create({
          data: {
            name: staff.name,
            email: staff.email,
            password: hashedPassword,
            role: staff.role,
            branchId: branch.id,
            isActive: true,
          },
        });
        console.log(`  ✅  Prisma DB: created ${staff.email} [${staff.role}]`);
      }

      // Create in Supabase Auth
      await createSupabaseAuthUser(staff.email, staff.password, staff.name, staff.role);
      console.log('');
    } catch (err) {
      console.error(`  ❌  Failed to create ${staff.email}:`, err.message, '\n');
    }
  }

  // ── STEP 3: Print summary ─────────────────────────────────────────────────
  const staffList = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'VENDOR', 'KITCHEN'] } },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅  Done! Current staff in Prisma DB:\n');
  staffList.forEach(s => {
    const status = s.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE';
    console.log(`  ${status}  ${s.name.padEnd(25)} ${s.email.padEnd(30)} [${s.role}]`);
  });
  console.log('\n  📋  Login credentials for new accounts:');
  REAL_STAFF.forEach(s => {
    console.log(`  • ${s.email.padEnd(30)} Password: ${s.password}`);
  });
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
