const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { logAudit } = require('../middleware/auditMiddleware');
const supabaseAdmin = require('../config/supabaseAdmin');
const { broadcastEvent } = require('../sockets/socket');
const { clearUserCache } = require('../middleware/authMiddleware');

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

const dashboardStatsCache = new Map();
const DASHBOARD_CACHE_TTL_MS = 15 * 1000; // 15s fast cache

/**
 * Executive Dashboard Analytics with AI ETA accuracy, demand forecasts, and trends
 */
const getDashboardStats = async (req, res) => {
  const { period = 'day', branchId, refresh } = req.query;
  const cacheKey = `${period}_${branchId || 'all'}`;

  if (refresh !== 'true' && dashboardStatsCache.has(cacheKey)) {
    const cached = dashboardStatsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }
  }

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

    const branchFilter = (branchId && branchId !== 'all') ? { branchId: parseInt(branchId, 10) } : {};

    // Execute all dashboard queries concurrently for max performance
    const [
      paidOrders,
      activeOrdersCount,
      users,
      allInventoryItems,
      recentOrders,
      menuItems,
      paidOrderItems,
      etaRecords,
      totalOrdersCountAllTime,
      oldestOrder,
    ] = await Promise.all([
      // 1. Total Revenue for period
      prisma.order.findMany({
        where: {
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
          createdAt: { gte: startDate },
          ...branchFilter,
        },
        select: { id: true, total: true, paymentMethod: true, status: true, createdAt: true },
      }),
      // 2. Active Queue Count
      prisma.order.count({
        where: {
          status: { in: ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY'] },
          ...branchFilter,
        },
      }),
      // 3. User & Staff Statistics
      prisma.user.findMany({
        select: { role: true, isActive: true },
      }),
      // 4. Inventory Items
      prisma.inventoryItem.findMany({
        where: branchFilter,
      }),
      // 5. Recent Orders
      prisma.order.findMany({
        take: 10,
        where: branchFilter,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          orderItems: { include: { menuItem: true } },
        },
      }),
      // 6. Menu Items
      prisma.menuItem.findMany({
        where: branchFilter,
        include: { recipeItems: { include: { inventoryItem: true } } },
      }),
      // 7. Paid Order Items for top selling analysis
      prisma.orderItem.findMany({
        where: {
          order: {
            status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
            createdAt: { gte: startDate },
            ...branchFilter,
          },
        },
        include: { menuItem: true },
      }),
      // 8. AI ETA Records
      prisma.eTAPrediction.findMany({
        where: { actualTime: { not: null } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      // 9. All time order count for confidence calculation
      prisma.order.count({ where: branchFilter }),
      // 10. Oldest order date
      prisma.order.findFirst({
        where: branchFilter,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    // Calculate financial metrics
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.total || 0), 0.0);
    const completedOrdersCount = paidOrders.length;
    const averageOrderValue = completedOrdersCount > 0 ? parseFloat((totalRevenue / completedOrdersCount).toFixed(2)) : 0.0;

    // Payment Method Breakdown
    const paymentMethodsMap = { CASH: 0, CARD: 0, JAZZCASH: 0, EASYPAISA: 0, NAYAPAY: 0 };
    const paymentMethodTotalsMap = { CASH: 0, CARD: 0, JAZZCASH: 0, EASYPAISA: 0, NAYAPAY: 0 };

    paidOrders.forEach(o => {
      const pm = (o.paymentMethod || 'CASH').toUpperCase();
      if (!paymentMethodsMap[pm] && paymentMethodsMap[pm] !== 0) {
        paymentMethodsMap[pm] = 0;
        paymentMethodTotalsMap[pm] = 0;
      }
      paymentMethodsMap[pm] += 1;
      paymentMethodTotalsMap[pm] += (o.total || 0);
    });

    const paymentBreakdown = Object.keys(paymentMethodsMap).map(method => ({
      method,
      count: paymentMethodsMap[method],
      totalAmount: parseFloat(paymentMethodTotalsMap[method].toFixed(2)),
    }));

    const userStats = {
      customer: users.filter(u => u.role === 'CUSTOMER').length,
      vendor: users.filter(u => u.role === 'VENDOR').length,
      kitchen: users.filter(u => u.role === 'KITCHEN').length,
      admin: users.filter(u => u.role === 'ADMIN').length,
      activeStaff: users.filter(u => u.role !== 'CUSTOMER' && u.isActive !== false).length,
    };

    const lowStockAlerts = [];
    const stockRecommendations = [];
    allInventoryItems.forEach((item) => {
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

    const categories = [...new Set(menuItems.map(item => item.category))];
    const categoryStats = categories.map(cat => ({
      category: cat,
      count: menuItems.filter(item => item.category === cat).length,
    }));

    const itemAgg = {};
    paidOrderItems.forEach((item) => {
      const name = item.nameSnapshot || item.menuItem?.name || `Item #${item.menuItemId}`;
      if (!itemAgg[name]) {
        itemAgg[name] = { name, quantity: 0, revenue: 0, category: item.menuItem?.category || 'General' };
      }
      itemAgg[name].quantity += item.quantity;
      itemAgg[name].revenue += (item.priceSnapshot || 0) * item.quantity;
    });

    const topItems = Object.values(itemAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Kitchen Prep Time Calculation (Req 6)
    let avgPrepTime = null;
    let avgPrepTimeLabel = "Not Enough Data";
    let isActualPrepTime = false;

    if (etaRecords.length > 0) {
      const totalActual = etaRecords.reduce((s, r) => s + (r.actualTime || 0), 0);
      avgPrepTime = parseFloat((totalActual / etaRecords.length).toFixed(1));
      avgPrepTimeLabel = `${avgPrepTime} mins`;
      isActualPrepTime = true;
    } else if (menuItems.length > 0) {
      const totalConfigured = menuItems.reduce((s, m) => s + (m.prepTime || 5), 0);
      avgPrepTime = parseFloat((totalConfigured / menuItems.length).toFixed(1));
      avgPrepTimeLabel = `${avgPrepTime} mins (configured)`;
      isActualPrepTime = false;
    }

    // Prediction Accuracy Calculation (Req 5)
    let predictionAccuracy = null;
    let accuracyLabel = "Not Enough Data";
    let accuracyHelper = "Accuracy will appear after enough forecast history is available.";

    if (etaRecords.length >= 10) {
      const varianceList = etaRecords.map(r => Math.abs(r.adjustedEta - (r.actualTime || r.adjustedEta)));
      const avgVariance = varianceList.reduce((s, v) => s + v, 0) / etaRecords.length;
      const basePrep = avgPrepTime || 8;
      predictionAccuracy = parseFloat(Math.max(60, Math.min(99, 100 - (avgVariance / basePrep) * 100)).toFixed(1));
      accuracyLabel = `${predictionAccuracy}%`;
      accuracyHelper = "Evaluated against actual POS kitchen prep trends";
    }

    // POS Data Confidence Calculation (Req 8)
    const oldestDate = oldestOrder?.createdAt ? new Date(oldestOrder.createdAt) : now;
    const dateSpanDays = Math.max(1, Math.ceil((now - oldestDate) / (1000 * 60 * 60 * 24)));

    let posConfidenceScore = 'LOW';
    if (totalOrdersCountAllTime >= 50 && dateSpanDays >= 14) {
      posConfidenceScore = 'HIGH';
    } else if (totalOrdersCountAllTime >= 10 && dateSpanDays >= 3) {
      posConfidenceScore = 'MEDIUM';
    }

    const posConfidenceExplanation = `Based on ${totalOrdersCountAllTime} recorded order(s) over ${dateSpanDays} day(s)`;

    const payload = {
      period,
      branchId: branchId || 'all',
      metrics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrdersCount: completedOrdersCount,
        averageOrderValue,
        activeOrdersCount,
        usersCount: users.length,
        userStats,
        lowStockCount: lowStockAlerts.length,
        avgPrepTime,
        avgPrepTimeLabel,
        isActualPrepTime,
        predictionAccuracy,
        accuracyLabel,
        accuracyHelper,
        posConfidenceScore,
        posConfidenceExplanation,
      },
      paymentBreakdown,
      lowStockAlerts,
      stockRecommendations,
      recentOrders,
      categoryStats,
      topItems,
    };

    dashboardStatsCache.set(cacheKey, { timestamp: Date.now(), payload });
    return res.json(payload);
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
        isDemo: true,
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
  const { name, email, password, role, branchId, isDemo = false } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const validRoles = ['ADMIN', 'VENDOR', 'KITCHEN'];
  if (!validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid staff role. Must be ADMIN, VENDOR (Cashier), or KITCHEN.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Fix: Resolve default branchId dynamically from the database
    let resolvedBranchId = branchId ? parseInt(branchId, 10) : null;
    if (!resolvedBranchId) {
      const defaultBranch = await prisma.branch.findFirst({
        orderBy: { id: 'asc' }
      });
      if (defaultBranch) {
        resolvedBranchId = defaultBranch.id;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStaff = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: role.toUpperCase(),
        branchId: resolvedBranchId,
        isActive: true,
        isDemo: Boolean(isDemo),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        branchId: true,
        createdAt: true,
      },
    });

    // Sync to Supabase Auth so real account appears in Supabase dashboard
    const authUser = await syncToSupabaseAuth('create', {
      email: normalizedEmail,
      password,
      name: name.trim(),
      role: role.toUpperCase(),
    });
    if (authUser?.user?.id) {
      console.log(`✅ Supabase Auth synced: ${normalizedEmail} (${authUser.user.id})`);
    } else {
      console.warn(`⚠️  Supabase Auth sync skipped for: ${normalizedEmail}`);
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
  const { name, email, role, branchId, isDemo } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role && ['ADMIN', 'VENDOR', 'KITCHEN'].includes(role.toUpperCase())) {
      updateData.role = role.toUpperCase();
    }
    if (branchId !== undefined) updateData.branchId = parseInt(branchId, 10);
    if (isDemo !== undefined) updateData.isDemo = Boolean(isDemo);

    const updated = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
      },
    });

    // Clear in-memory auth cache and broadcast real-time socket event
    clearUserCache(updated.id);
    broadcastEvent('staff:account-updated', {
      userId: updated.id,
      email: updated.email,
      newRole: updated.role,
      isActive: updated.isActive,
      isDemo: updated.isDemo,
      action: 'ACCOUNT_UPDATED',
      message: `Your account details were updated by the System Administrator.`,
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
      select: { id: true, name: true, email: true, role: true, isActive: true, isDemo: true, createdAt: true },
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

    // Clear in-memory auth cache and broadcast real-time account role change event
    clearUserCache(targetId);
    broadcastEvent('staff:account-updated', {
      userId: targetId,
      email: updated.email,
      newRole: updated.role,
      oldRole: current.role,
      isActive: updated.isActive,
      isDemo: updated.isDemo,
      action: 'ROLE_CHANGED',
      message: `Your account role has been updated from ${current.role} to ${updated.role} by Administrator.`,
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
      select: { id: true, name: true, email: true, role: true, isActive: true, isDemo: true },
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

    // Clear in-memory auth cache and broadcast status toggle event
    clearUserCache(targetId);
    broadcastEvent('staff:account-updated', {
      userId: targetId,
      email: updated.email,
      newRole: updated.role,
      isActive: updated.isActive,
      isDemo: updated.isDemo,
      action: updated.isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      message: updated.isActive
        ? 'Your account has been activated by Administrator.'
        : 'Your account has been deactivated by Administrator.',
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
