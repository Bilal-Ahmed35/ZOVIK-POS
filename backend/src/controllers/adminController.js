const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { logAudit } = require('../middleware/auditMiddleware');
const supabaseAdmin = require('../config/supabaseAdmin');

/**
 * Helper: sync a user action to Supabase Auth (silent fail if admin client not ready)
 */
async function syncToSupabaseAuth(action, payload) {
  if (!supabaseAdmin) return null;
  try {
    let result;
    if (action === 'create') {
      result = await supabaseAdmin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { name: payload.name, role: payload.role },
      });
    } else if (action === 'updatePassword') {
      result = await supabaseAdmin.auth.admin.updateUserById(payload.supabaseId, {
        password: payload.password,
      });
    } else if (action === 'ban') {
      result = await supabaseAdmin.auth.admin.updateUserById(payload.supabaseId, {
        ban_duration: payload.banned ? '876000h' : 'none',
      });
    } else if (action === 'updateRole') {
      result = await supabaseAdmin.auth.admin.updateUserById(payload.supabaseId, {
        user_metadata: { role: payload.role },
      });
    }
    if (result?.error) console.warn('⚠️  Supabase Auth sync warning:', result.error.message);
    return result?.data || null;
  } catch (err) {
    console.warn('⚠️  Supabase Auth sync error:', err.message);
    return null;
  }
}

/**
 * Executive Dashboard Analytics with AI ETA accuracy, demand forecasts, and trends
 */
const getDashboardStats = async (req, res) => {
  const { period = 'day' } = req.query;

  try {
    const now = new Date();
    let startDate = new Date();

    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // 1. Total Revenue for verified orders
    const paidOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
        createdAt: { gte: startDate },
      },
      select: { total: true },
    });
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0.0);

    // 2. Active Queue Count
    const activeOrdersCount = await prisma.order.count({
      where: {
        status: { in: ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY'] },
      },
    });

    // 3. User & Staff Statistics
    const users = await prisma.user.findMany({
      select: { role: true, isActive: true },
    });
    const userStats = {
      customer: users.filter(u => u.role === 'CUSTOMER').length,
      vendor: users.filter(u => u.role === 'VENDOR').length,
      kitchen: users.filter(u => u.role === 'KITCHEN').length,
      admin: users.filter(u => u.role === 'ADMIN').length,
      activeStaff: users.filter(u => u.role !== 'CUSTOMER' && u.isActive !== false).length,
    };

    // 4. Inventory Stock Categorization (CRITICAL, LOW STOCK, OK, OVERSTOCK)
    const allInventoryItems = await prisma.inventoryItem.findMany();
    const lowStockAlerts = [];
    const stockRecommendations = [];

    allInventoryItems.forEach((item) => {
      const ratio = item.minThreshold > 0 ? item.stockLevel / item.minThreshold : 1;
      let statusLevel = 'OK';
      let recommendedReorder = 0;

      if (item.stockLevel <= 0) {
        statusLevel = 'CRITICAL STOCK';
        recommendedReorder = item.minThreshold * 2;
      } else if (item.stockLevel <= item.minThreshold) {
        statusLevel = 'LOW STOCK';
        recommendedReorder = Math.ceil(item.minThreshold * 1.5 - item.stockLevel);
      } else if (item.stockLevel >= item.minThreshold * 5) {
        statusLevel = 'OVERSTOCK';
      }

      if (statusLevel !== 'OK') {
        lowStockAlerts.push({
          ...item,
          statusLevel,
          recommendedReorder,
        });
      }

      if (recommendedReorder > 0) {
        stockRecommendations.push({
          name: item.name,
          currentStock: item.stockLevel,
          threshold: item.minThreshold,
          recommendedReorder,
          urgency: statusLevel === 'CRITICAL STOCK' ? 'HIGH' : 'MEDIUM',
        });
      }
    });

    // 5. Recent Orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        orderItems: { include: { menuItem: true } },
      },
    });

    // 6. Category Breakdown
    const menuItems = await prisma.menuItem.findMany();
    const categories = [...new Set(menuItems.map(item => item.category))];
    const categoryStats = categories.map(cat => ({
      category: cat,
      count: menuItems.filter(item => item.category === cat).length,
    }));

    // 7. Top Selling Items
    const paidOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
          createdAt: { gte: startDate },
        },
      },
      include: { menuItem: true },
    });

    const itemAgg = {};
    paidOrderItems.forEach((item) => {
      const name = item.nameSnapshot || item.menuItem?.name || `Item #${item.menuItemId}`;
      if (!itemAgg[name]) {
        itemAgg[name] = { name, quantity: 0, revenue: 0, category: item.menuItem?.category || 'General' };
      }
      itemAgg[name].quantity += item.quantity;
      itemAgg[name].revenue += item.priceSnapshot * item.quantity;
    });

    const topItems = Object.values(itemAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    // 8. AI ETA Accuracy & Prep Metrics
    const etaRecords = await prisma.eTAPrediction.findMany({
      where: { actualTime: { not: null } },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    let avgPrepTime = 8.5; // default fallback
    let etaAccuracy = 94.2; // default fallback
    if (etaRecords.length > 0) {
      const totalActual = etaRecords.reduce((s, r) => s + (r.actualTime || 0), 0);
      avgPrepTime = parseFloat((totalActual / etaRecords.length).toFixed(1));

      const varianceList = etaRecords.map(r => Math.abs(r.adjustedEta - (r.actualTime || r.adjustedEta)));
      const avgVariance = varianceList.reduce((s, v) => s + v, 0) / etaRecords.length;
      etaAccuracy = parseFloat(Math.max(75, 100 - (avgVariance / (avgPrepTime || 1)) * 100).toFixed(1));
    }

    return res.json({
      period,
      metrics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        activeOrdersCount,
        usersCount: users.length,
        userStats,
        lowStockCount: lowStockAlerts.length,
        avgPrepTime,
        etaAccuracy,
      },
      lowStockAlerts,
      stockRecommendations,
      recentOrders,
      categoryStats,
      topItems,
    });
  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to retrieve admin dashboard stats.' });
  }
};

/**
 * Get Audit Logs
 */
const getAuditLogs = async (req, res) => {
  const { action, entity, limit = 50 } = req.query;

  try {
    const where = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 50,
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
};

/**
 * Staff Management Controllers
 */
const getStaffList = async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'VENDOR', 'KITCHEN'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ staff });
  } catch (error) {
    console.error('Get staff list error:', error);
    return res.status(500).json({ error: 'Failed to retrieve staff list.' });
  }
};

const createStaff = async (req, res) => {
  const { name, email, password, role, branchId = 1 } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const validRoles = ['ADMIN', 'VENDOR', 'KITCHEN'];
  if (!validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid staff role. Must be ADMIN, VENDOR (Cashier), or KITCHEN.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role.toUpperCase(),
        branchId: parseInt(branchId, 10) || 1,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
      },
    });

    // Sync to Supabase Auth (non-blocking)
    const authUser = await syncToSupabaseAuth('create', {
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      role: role.toUpperCase(),
    });
    if (authUser?.user?.id) {
      console.log(`✅ Supabase Auth user created: ${authUser.user.id}`);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'STAFF_ACCOUNT_CREATED',
      entity: 'User',
      entityId: newStaff.id,
      newValue: { email: newStaff.email, role: newStaff.role },
      req,
    });

    return res.status(201).json({ message: 'Staff account created successfully.', staff: newStaff });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ error: 'Failed to create staff account.' });
  }
};

const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, branchId } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role && ['ADMIN', 'VENDOR', 'KITCHEN'].includes(role.toUpperCase())) {
      updateData.role = role.toUpperCase();
    }
    if (branchId !== undefined) updateData.branchId = parseInt(branchId, 10);

    const updated = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return res.json({ message: 'Staff information updated successfully.', staff: updated });
  } catch (error) {
    console.error('Update staff error:', error);
    return res.status(500).json({ error: 'Failed to update staff account.' });
  }
};

/**
 * Change Staff Role (Admin Only) — updates Prisma + Supabase Auth metadata
 */
const updateStaffRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['ADMIN', 'VENDOR', 'KITCHEN'];
  if (!role || !validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({ error: 'Valid role required: ADMIN, VENDOR, or KITCHEN.' });
  }

  const targetId = parseInt(id, 10);
  if (req.user && req.user.id === targetId && role.toUpperCase() !== 'ADMIN') {
    return res.status(400).json({ error: 'You cannot demote your own Admin account.' });
  }

  try {
    // Get current user to find Supabase Auth ID by email
    const current = await prisma.user.findUnique({ where: { id: targetId } });
    if (!current) return res.status(404).json({ error: 'Staff member not found.' });

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { role: role.toUpperCase() },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    // Sync role to Supabase Auth metadata if admin client is available
    if (supabaseAdmin) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === current.email);
      if (authUser) {
        await syncToSupabaseAuth('updateRole', { supabaseId: authUser.id, role: role.toUpperCase() });
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'STAFF_ROLE_CHANGED',
      entity: 'User',
      entityId: targetId,
      newValue: { role: role.toUpperCase() },
      req,
    });

    return res.json({ message: `Role updated to ${role.toUpperCase()} successfully.`, staff: updated });
  } catch (error) {
    console.error('Update staff role error:', error);
    return res.status(500).json({ error: 'Failed to update staff role.' });
  }
};

const toggleStaffStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ error: 'isActive status flag is required.' });
  }

  const targetId = parseInt(id, 10);
  if (req.user && req.user.id === targetId && isActive === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own active Admin account.' });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { isActive: Boolean(isActive) },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Sync ban status to Supabase Auth
    if (supabaseAdmin && target) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === target.email);
      if (authUser) {
        await syncToSupabaseAuth('ban', { supabaseId: authUser.id, banned: !Boolean(isActive) });
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: updated.isActive ? 'STAFF_ACCOUNT_ACTIVATED' : 'STAFF_ACCOUNT_DEACTIVATED',
      entity: 'User',
      entityId: targetId,
      req,
    });

    return res.json({
      message: `Staff account ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
      staff: updated,
    });
  } catch (error) {
    console.error('Toggle staff status error:', error);
    return res.status(500).json({ error: 'Failed to update staff account status.' });
  }
};

/**
 * Branch Management
 */
const getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        _count: {
          select: { tables: true, menuItems: true, orders: true, users: true },
        },
      },
    });
    return res.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    return res.status(500).json({ error: 'Failed to retrieve branches.' });
  }
};

const createBranch = async (req, res) => {
  const { name, address, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Branch name is required.' });
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        name: name.trim(),
        address: address ? address.trim() : null,
        phone: phone ? phone.trim() : null,
        isActive: true,
      },
    });

    await logAudit({
      userId: req.user?.id,
      action: 'BRANCH_CREATED',
      entity: 'Branch',
      entityId: branch.id,
      newValue: branch,
      req,
    });

    return res.status(201).json({ message: 'Branch created successfully.', branch });
  } catch (error) {
    console.error('Create branch error:', error);
    return res.status(500).json({ error: 'Failed to create branch.' });
  }
};

/**
 * Reset Staff Password (Admin Only)
 */
const resetStaffPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { password: hashedPassword },
      select: { id: true, name: true, email: true, role: true },
    });

    // Sync new password to Supabase Auth
    if (supabaseAdmin) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === updated.email);
      if (authUser) {
        await syncToSupabaseAuth('updatePassword', { supabaseId: authUser.id, password });
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'STAFF_PASSWORD_RESET',
      entity: 'User',
      entityId: updated.id,
      req,
    });

    return res.json({ message: `Password reset successfully for ${updated.name}.` });
  } catch (error) {
    console.error('Reset staff password error:', error);
    return res.status(500).json({ error: 'Failed to reset staff password.' });
  }
};

/**
 * Customer Roster & Analytics List
 */
const getCustomerList = async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        sessions: {
          select: {
            id: true,
            tableId: true,
            status: true,
            createdAt: true,
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedCustomers = customers.map((c) => {
      const paidOrders = c.orders.filter(o => ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(o.status));
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0.0);
      const lastOrder = c.orders.length > 0 ? c.orders[0].createdAt : null;

      return {
        id: c.id,
        name: c.name || 'Guest Customer',
        email: c.email || 'N/A',
        totalOrders: c.orders.length,
        paidOrdersCount: paidOrders.length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        lastOrderDate: lastOrder,
        createdAt: c.createdAt,
        isActive: c.isActive !== false,
        recentOrders: c.orders.slice(0, 5),
        recentSessions: c.sessions,
      };
    });

    return res.json({ customers: formattedCustomers });
  } catch (error) {
    console.error('Get customer list error:', error);
    return res.status(500).json({ error: 'Failed to retrieve customer roster.' });
  }
};

/**
 * Get System-Wide Order Status History Timeline Records
 */
const getOrderStatusHistoryList = async (req, res) => {
  const { orderId, limit = 50 } = req.query;

  try {
    const where = {};
    if (orderId) {
      where.orderId = parseInt(orderId, 10);
    }

    const history = await prisma.orderStatusHistory.findMany({
      where,
      include: {
        order: {
          select: { id: true, orderNumber: true, tableId: true, total: true, status: true, paymentMethod: true },
        },
        changedByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 50,
    });

    return res.json({ history });
  } catch (error) {
    console.error('Get order status history list error:', error);
    return res.status(500).json({ error: 'Failed to retrieve order status history.' });
  }
};

module.exports = {
  getDashboardStats,
  getAuditLogs,
  getStaffList,
  createStaff,
  updateStaff,
  updateStaffRole,
  toggleStaffStatus,
  resetStaffPassword,
  getCustomerList,
  getOrderStatusHistoryList,
  getBranches,
  createBranch,
};
