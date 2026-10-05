const { prisma } = require('../config/db');
const { getInventoryForecast } = require('../services/aiService');
const { emitToAdmin, emitToVendor } = require('../sockets/socket');
const { convertUnit } = require('../utils/unitConverter');
const { parseAndMatchInvoice } = require('../services/aiOcrService');
const { logAudit } = require('../middleware/auditMiddleware');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for cached ML forecasts

/**
 * Get cached forecast from DB or invoke ML prediction and persist result
 */
const getOrCalculateForecast = async (item, historicalSales, features, forceRefresh = false) => {
  const now = new Date();

  if (!forceRefresh) {
    const existing = await prisma.demandForecast.findUnique({
      where: { menuItemName: item.name }
    }).catch(() => null);

    if (existing && (now.getTime() - new Date(existing.updatedAt).getTime()) < CACHE_TTL_MS) {
      let savedFeatures = {};
      try {
        savedFeatures = JSON.parse(existing.features || '{}');
      } catch {}

      return {
        forecast: existing.predictedQty,
        confidence: existing.confidence || 0.8,
        percentChange: savedFeatures.percentChange || 0.0,
        source: 'database-cache'
      };
    }
  }

  // Calculate fresh forecast from ML service or fallback
  const prediction = await getInventoryForecast(item.name, historicalSales, features);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.demandForecast.upsert({
    where: { menuItemName: item.name },
    update: {
      forecastDate: tomorrow,
      predictedQty: prediction.forecast,
      confidence: prediction.confidence || 0.8,
      features: JSON.stringify({
        ...features,
        percentChange: prediction.percentChange || 0.0,
        source: prediction.source
      })
    },
    create: {
      menuItemName: item.name,
      forecastDate: tomorrow,
      predictedQty: prediction.forecast,
      confidence: prediction.confidence || 0.8,
      features: JSON.stringify({
        ...features,
        percentChange: prediction.percentChange || 0.0,
        source: prediction.source
      })
    }
  }).catch((err) => console.warn(`DemandForecast upsert warning for ${item.name}:`, err.message));

  return prediction;
};

/**
 * Summary metrics cards for inventory overview
 */
const getInventorySummary = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { supplier: true }
    });

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let lowStockCount = 0;
    let criticalCount = 0;
    let totalValuation = 0.0;
    let expiringCount = 0;

    for (const item of items) {
      if (item.stockLevel <= item.minThreshold) {
        lowStockCount++;
      }
      if (item.stockLevel <= (item.minThreshold / 2)) {
        criticalCount++;
      }
      totalValuation += item.stockLevel * (item.costPrice || 0);

      if (item.expiryDate && new Date(item.expiryDate) <= sevenDaysFromNow) {
        expiringCount++;
      }
    }

    return res.json({
      totalItems: items.length,
      lowStockCount,
      criticalCount,
      totalValuation,
      expiringCount
    });
  } catch (error) {
    console.error('Fetch inventory summary error:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory summary.' });
  }
};

/**
 * Get all inventory items with filtering
 */
const getInventoryItems = async (req, res) => {
  const { search, category, branchId } = req.query;

  try {
    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.category = category;
    }
    if (branchId) {
      where.branchId = parseInt(branchId, 10);
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        supplier: true,
        branch: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });

    return res.json({ items });
  } catch (error) {
    console.error('Fetch inventory error:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory items.' });
  }
};

/**
 * Add a new inventory item
 */
const addInventoryItem = async (req, res) => {
  const {
    name,
    stockLevel,
    unit,
    minThreshold,
    maxThreshold,
    category,
    sku,
    costPrice,
    expiryDate,
    supplierId,
    branchId
  } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ error: 'Name and unit are required.' });
  }

  try {
    const resolvedBranchId = branchId ? parseInt(branchId, 10) : 1;

    // Check branch uniqueness
    const existingSameBranch = await prisma.inventoryItem.findFirst({
      where: {
        name,
        branchId: resolvedBranchId
      }
    });

    if (existingSameBranch) {
      return res.status(400).json({ error: `An inventory item named "${name}" already exists for this branch.` });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        stockLevel: stockLevel ? parseFloat(stockLevel) : 0.0,
        unit,
        minThreshold: minThreshold ? parseFloat(minThreshold) : 10.0,
        maxThreshold: maxThreshold ? parseFloat(maxThreshold) : 100.0,
        category: category || 'General',
        sku: sku || null,
        costPrice: costPrice ? parseFloat(costPrice) : 0.0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        supplierId: supplierId ? parseInt(supplierId, 10) : null,
        branchId: resolvedBranchId
      },
      include: { supplier: true, branch: true }
    });

    if (stockLevel && parseFloat(stockLevel) > 0) {
      await prisma.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          quantityBefore: 0.0,
          quantityAfter: parseFloat(stockLevel),
          changeQty: parseFloat(stockLevel),
          type: 'RESTOCK',
          reason: 'Initial stock load',
          cost: (costPrice ? parseFloat(costPrice) : 0.0) * parseFloat(stockLevel),
          userId: req.user.id
        }
      });
    }

    emitToAdmin('inventory:update', item);
    emitToVendor('inventory:update', item);
    return res.status(201).json({ message: 'Inventory item added successfully.', item });
  } catch (error) {
    console.error('Add inventory item error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'An inventory item with this name already exists in this branch.' });
    }
    return res.status(500).json({ error: 'Failed to add inventory item.' });
  }
};

/**
 * Update an existing inventory item
 */
const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    unit,
    minThreshold,
    maxThreshold,
    category,
    sku,
    costPrice,
    expiryDate,
    supplierId,
    branchId
  } = req.body;

  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(name ? { name } : {}),
        ...(unit ? { unit } : {}),
        ...(minThreshold !== undefined ? { minThreshold: parseFloat(minThreshold) } : {}),
        ...(maxThreshold !== undefined ? { maxThreshold: parseFloat(maxThreshold) } : {}),
        ...(category ? { category } : {}),
        ...(sku !== undefined ? { sku } : {}),
        ...(costPrice !== undefined ? { costPrice: parseFloat(costPrice) } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(supplierId !== undefined ? { supplierId: supplierId ? parseInt(supplierId, 10) : null } : {}),
        ...(branchId !== undefined ? { branchId: parseInt(branchId, 10) } : {})
      },
      include: { supplier: true, branch: true }
    });

    emitToAdmin('inventory:update', updated);
    emitToVendor('inventory:update', updated);
    return res.json({ message: 'Inventory item updated successfully.', item: updated });
  } catch (error) {
    console.error('Update inventory item error:', error);
    return res.status(500).json({ error: 'Failed to update inventory item.' });
  }
};

/**
 * Perform Stock In (Purchase/Delivery receiving)
 */
const stockIn = async (req, res) => {
  const { inventoryItemId, quantity, batchNumber, expiryDate, supplierId, unitCost, notes } = req.body;

  if (!inventoryItemId || quantity === undefined || parseFloat(quantity) <= 0) {
    return res.status(400).json({ error: 'Valid item and positive quantity are required.' });
  }

  try {
    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: parseInt(inventoryItemId, 10) }
      });

      if (!item) {
        throw new Error('Inventory item not found.');
      }

      const addQty = parseFloat(quantity);
      const qtyBefore = item.stockLevel;
      const qtyAfter = qtyBefore + addQty;
      const newCost = unitCost !== undefined && parseFloat(unitCost) > 0 ? parseFloat(unitCost) : item.costPrice;

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          stockLevel: qtyAfter,
          costPrice: newCost,
          ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
          ...(supplierId ? { supplierId: parseInt(supplierId, 10) } : {})
        },
        include: { supplier: true }
      });

      await tx.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          changeQty: addQty,
          type: 'PURCHASE',
          reason: notes || `Stock In - Received ${addQty} ${item.unit}`,
          cost: newCost * addQty,
          batchNumber: batchNumber || null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          supplierId: supplierId ? parseInt(supplierId, 10) : item.supplierId,
          userId: req.user.id
        }
      });

      return updated;
    });

    emitToAdmin('inventory:update', updatedItem);
    emitToVendor('inventory:update', updatedItem);
    return res.json({ message: 'Stock received successfully.', item: updatedItem });
  } catch (error) {
    console.error('Stock In error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to process Stock In.' });
  }
};

/**
 * Stock Adjustment or Waste Recording
 */
const adjustStock = async (req, res) => {
  const { inventoryItemId, type = 'WASTE', changeQty, reason, notes } = req.body;

  if (!inventoryItemId || changeQty === undefined || parseFloat(changeQty) === 0) {
    return res.status(400).json({ error: 'Valid item and non-zero adjustment quantity are required.' });
  }

  const validTypes = ['WASTE', 'CORRECTION', 'RESTOCK', 'EXPIRATION', 'DAMAGE'];
  const logType = validTypes.includes(type.toUpperCase()) ? type.toUpperCase() : 'CORRECTION';

  try {
    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: parseInt(inventoryItemId, 10) }
      });

      if (!item) {
        throw new Error('Inventory item not found.');
      }

      const delta = parseFloat(changeQty);
      const qtyBefore = item.stockLevel;
      const qtyAfter = Math.max(0, qtyBefore + delta);

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { stockLevel: qtyAfter },
        include: { supplier: true }
      });

      await tx.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          changeQty: delta,
          type: logType,
          reason: reason || notes || `Manual adjustment (${logType})`,
          cost: Math.abs(delta) * item.costPrice,
          userId: req.user.id
        }
      });

      return updated;
    });

    emitToAdmin('inventory:update', updatedItem);
    emitToVendor('inventory:update', updatedItem);
    return res.json({ message: 'Stock adjusted successfully.', item: updatedItem });
  } catch (error) {
    console.error('Stock adjustment error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to adjust stock.' });
  }
};

/**
 * Legacy/Simple restock endpoint preserved for backward compatibility
 */
const restockItem = async (req, res) => {
  const { id } = req.params;
  const { quantity, reason } = req.body;

  if (quantity === undefined || parseFloat(quantity) <= 0) {
    return res.status(400).json({ error: 'Restock quantity must be greater than zero.' });
  }

  req.body.inventoryItemId = id;
  req.body.type = 'RESTOCK';
  req.body.changeQty = quantity;
  return adjustStock(req, res);
};

/**
 * Get Recipe for a specific MenuItem
 */
const getRecipeForMenuItem = async (req, res) => {
  const { menuItemId } = req.params;

  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(menuItemId, 10) },
      include: {
        recipeItems: {
          include: { inventoryItem: true }
        },
        branch: true
      }
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    return res.json({ menuItem });
  } catch (error) {
    console.error('Fetch recipe error:', error);
    return res.status(500).json({ error: 'Failed to retrieve recipe.' });
  }
};

/**
 * Save/Update Recipe ingredients for a MenuItem
 */
const saveRecipeForMenuItem = async (req, res) => {
  const { menuItemId } = req.params;
  const { ingredients } = req.body; // Array of { inventoryItemId, quantity, unit }

  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Ingredients array is required.' });
  }

  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(menuItemId, 10) }
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    // Branch consistency validation
    for (const ing of ingredients) {
      const invItem = await prisma.inventoryItem.findUnique({
        where: { id: parseInt(ing.inventoryItemId, 10) }
      });

      if (!invItem) {
        return res.status(404).json({ error: `Inventory item ID ${ing.inventoryItemId} not found.` });
      }

      if (menuItem.branchId && invItem.branchId && menuItem.branchId !== invItem.branchId) {
        return res.status(400).json({
          error: `Branch mismatch: MenuItem branch (${menuItem.branchId}) does not match InventoryItem "${invItem.name}" branch (${invItem.branchId}).`
        });
      }
    }

    // Replace existing recipe items atomically inside a transaction
    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({
        where: { menuItemId: menuItem.id }
      });

      for (const ing of ingredients) {
        await tx.recipeItem.create({
          data: {
            menuItemId: menuItem.id,
            inventoryItemId: parseInt(ing.inventoryItemId, 10),
            quantity: parseFloat(ing.quantity),
            unit: ing.unit || 'PCS'
          }
        });
      }
    });

    const updated = await prisma.menuItem.findUnique({
      where: { id: menuItem.id },
      include: {
        recipeItems: { include: { inventoryItem: true } }
      }
    });

    return res.json({ message: 'Recipe updated successfully.', menuItem: updated });
  } catch (error) {
    console.error('Save recipe error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save recipe.' });
  }
};

/**
 * Recipe Margins and Food Cost calculation endpoint
 */
const getRecipeMargins = async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: {
        recipeItems: {
          include: { inventoryItem: true }
        }
      }
    });

    const margins = menuItems.map((item) => {
      let foodCost = 0.0;
      let hasRecipe = item.recipeItems && item.recipeItems.length > 0;

      if (hasRecipe) {
        for (const r of item.recipeItems) {
          const inv = r.inventoryItem;
          if (inv && inv.costPrice) {
            try {
              const convertedQty = convertUnit(r.quantity, r.unit, inv.unit);
              foodCost += convertedQty * inv.costPrice;
            } catch (err) {
              foodCost += r.quantity * inv.costPrice;
            }
          }
        }
      }

      const grossMargin = item.price > 0 ? ((item.price - foodCost) / item.price) * 100 : 0;

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        foodCost,
        grossMarginPercent: parseFloat(grossMargin.toFixed(1)),
        hasRecipe,
        recipeCount: item.recipeItems.length,
        category: item.category || 'Uncategorized'
      };
    });

    return res.json({ margins });
  } catch (error) {
    console.error('Get recipe margins error:', error);
    return res.status(500).json({ error: 'Failed to calculate recipe margins.' });
  }
};

/**
 * Get items nearing expiry date
 */
const getExpiringItems = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: {
        expiryDate: { not: null }
      },
      include: { supplier: true, branch: true },
      orderBy: { expiryDate: 'asc' }
    });

    const now = new Date();
    const enriched = items.map((item) => {
      const daysUntilExpiry = Math.ceil((new Date(item.expiryDate) - now) / (1000 * 60 * 60 * 24));
      return {
        ...item,
        daysUntilExpiry
      };
    });

    return res.json({ items: enriched });
  } catch (error) {
    console.error('Fetch expiring items error:', error);
    return res.status(500).json({ error: 'Failed to retrieve expiring inventory items.' });
  }
};

/**
 * Get Suppliers
 */
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { items: true } }
      },
      orderBy: { name: 'asc' }
    });
    return res.json({ suppliers });
  } catch (error) {
    console.error('Fetch suppliers error:', error);
    return res.status(500).json({ error: 'Failed to retrieve suppliers.' });
  }
};

/**
 * Create Supplier
 */
const createSupplier = async (req, res) => {
  const { name, contactPerson, email, phone, address, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null
      }
    });
    return res.status(201).json({ message: 'Supplier created successfully.', supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({ error: 'Failed to create supplier.' });
  }
};

/**
 * Get inventory transaction history logs with filters
 */
const getInventoryLogs = async (req, res) => {
  const { type, inventoryItemId } = req.query;

  try {
    const where = {};
    if (type) {
      where.type = type.toUpperCase();
    }
    if (inventoryItemId) {
      where.inventoryItemId = parseInt(inventoryItemId, 10);
    }

    const logs = await prisma.inventoryLog.findMany({
      where,
      include: {
        inventoryItem: true,
        user: { select: { id: true, name: true, email: true } },
        supplier: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Fetch inventory logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory logs.' });
  }
};

/**
 * Single Item demand forecast
 */
const getForecast = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const past7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    const menuItem = await prisma.menuItem.findFirst({
      where: { name: item.name }
    });

    const historicalSales = [];
    let totalHistoricalOrders = 0;

    if (menuItem) {
      const orderItems = await prisma.orderItem.findMany({
        where: {
          menuItemId: menuItem.id,
          order: {
            status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
            createdAt: { gte: past7Days[0] }
          }
        },
        include: { order: true }
      });

      totalHistoricalOrders = orderItems.length;

      for (const day of past7Days) {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const dailyQty = orderItems
          .filter(oi => oi.order.createdAt >= day && oi.order.createdAt < nextDay)
          .reduce((sum, oi) => sum + oi.quantity, 0);

        historicalSales.push(dailyQty);
      }
    } else {
      historicalSales.push(12, 15, 8, 14, 20, 18, 22);
    }

    const prediction = await getOrCalculateForecast(item, historicalSales, {}, false);

    const confidenceBadge = totalHistoricalOrders >= 30 ? 'HIGH' : (totalHistoricalOrders >= 10 ? 'MEDIUM' : 'LOW_HISTORY');

    return res.json({
      itemName: item.name,
      currentStock: item.stockLevel,
      minThreshold: item.minThreshold,
      historicalSales,
      forecast: prediction.forecast,
      confidence: prediction.confidence || 0.8,
      confidenceBadge,
      source: prediction.source
    });
  } catch (error) {
    console.error('Forecasting calculation error:', error);
    return res.status(500).json({ error: 'Failed to calculate inventory demand forecast.' });
  }
};

/**
 * AI Stockout Risk and Reorder Advice Alerts
 */
const getInventoryAlerts = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekday = tomorrow.getDay();
    const month = tomorrow.getMonth() + 1;

    let season = 0;
    if (month >= 3 && month <= 5) season = 1;
    else if (month >= 6 && month <= 8) season = 2;
    else if (month >= 9 && month <= 11) season = 3;

    const weatherList = ['Clear', 'Rain', 'Hot/Sunny', 'Cold'];
    const weatherString = weatherList[weekday % weatherList.length];
    const weatherMapping = { 'Clear': 0, 'Rain': 1, 'Hot/Sunny': 2, 'Cold': 3 };
    const weather = weatherMapping[weatherString];

    const exams_season = (month === 6 || month === 12) ? 1 : 0;
    const promotions = (weekday === 5 || weekday === 6) ? 1 : 0;

    const features = { weekday, month, season, weather, weatherString, exams_season, promotions };

    const alerts = [];

    for (const item of items) {
      const past7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        return d;
      }).reverse();

      const menuItem = await prisma.menuItem.findFirst({
        where: { name: item.name }
      });

      const historicalSales = [];
      let orderCount = 0;

      if (menuItem) {
        const orderItems = await prisma.orderItem.findMany({
          where: {
            menuItemId: menuItem.id,
            order: {
              status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
              createdAt: { gte: past7Days[0] }
            }
          },
          include: { order: true }
        });

        orderCount = orderItems.length;

        for (const day of past7Days) {
          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);
          const dailyQty = orderItems
            .filter(oi => oi.order.createdAt >= day && oi.order.createdAt < nextDay)
            .reduce((sum, oi) => sum + oi.quantity, 0);
          historicalSales.push(dailyQty);
        }
      } else {
        historicalSales.push(10, 12, 14, 11, 15, 13, 16);
      }

      const prediction = await getOrCalculateForecast(item, historicalSales, features, false);
      const forecast = prediction.forecast;
      const percentChange = prediction.percentChange || 0.0;

      const confidenceBadge = orderCount >= 30 ? 'HIGH' : (orderCount >= 10 ? 'MEDIUM' : 'LOW_HISTORY');

      const isLow = item.stockLevel <= item.minThreshold;
      const isStockoutPredicted = item.stockLevel < forecast;

      let alertType = null;
      let alertMessage = '';
      let suggestedRestock = 0;
      let stockoutDate = null;

      if (isStockoutPredicted) {
        alertType = 'STOCKOUT_RISK';
        stockoutDate = 'Tomorrow';
        suggestedRestock = Math.ceil(forecast * 1.5 - item.stockLevel);

        const reasonText = percentChange > 10
          ? `demand is projected to rise by ${percentChange.toFixed(0)}% based on POS order trends`
          : `daily demand is projected at ${forecast.toFixed(0)} ${item.unit}`;

        alertMessage = `${item.name} ${reasonText}. Restock immediately to prevent operational delay.`;
      } else if (isLow) {
        alertType = 'LOW_STOCK';
        suggestedRestock = Math.ceil(item.minThreshold * 2.5 - item.stockLevel);
        alertMessage = `${item.name} stock level (${item.stockLevel.toFixed(1)} ${item.unit}) is below threshold (${item.minThreshold} ${item.unit}).`;
      }

      if (alertType) {
        alerts.push({
          id: item.id,
          name: item.name,
          unit: item.unit,
          currentStock: item.stockLevel,
          minThreshold: item.minThreshold,
          forecast,
          percentChange,
          alertType,
          message: alertMessage,
          suggestedRestock,
          stockoutDate,
          confidenceBadge,
          source: prediction.source
        });
      }
    }

    return res.json({ alerts, context: features });
  } catch (error) {
    console.error('Fetch inventory alerts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve AI insights.' });
  }
};

/**
 * Force recalculation of AI forecasts
 */
const recalculateInventoryForecasts = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekday = tomorrow.getDay();
    const month = tomorrow.getMonth() + 1;

    let season = 0;
    if (month >= 3 && month <= 5) season = 1;
    else if (month >= 6 && month <= 8) season = 2;
    else if (month >= 9 && month <= 11) season = 3;

    const weatherList = ['Clear', 'Rain', 'Hot/Sunny', 'Cold'];
    const weatherString = weatherList[weekday % weatherList.length];
    const weatherMapping = { 'Clear': 0, 'Rain': 1, 'Hot/Sunny': 2, 'Cold': 3 };
    const weather = weatherMapping[weatherString];
    const exams_season = (month === 6 || month === 12) ? 1 : 0;
    const promotions = (weekday === 5 || weekday === 6) ? 1 : 0;

    const features = { weekday, month, season, weather, weatherString, exams_season, promotions };

    for (const item of items) {
      const past7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        return d;
      }).reverse();

      const menuItem = await prisma.menuItem.findFirst({
        where: { name: item.name }
      });

      const historicalSales = [];
      if (menuItem) {
        const orderItems = await prisma.orderItem.findMany({
          where: {
            menuItemId: menuItem.id,
            order: {
              status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
              createdAt: { gte: past7Days[0] }
            }
          },
          include: { order: true }
        });

        for (const day of past7Days) {
          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);
          const dailyQty = orderItems
            .filter(oi => oi.order.createdAt >= day && oi.order.createdAt < nextDay)
            .reduce((sum, oi) => sum + oi.quantity, 0);
          historicalSales.push(dailyQty);
        }
      } else {
        historicalSales.push(10, 12, 14, 11, 15, 13, 16);
      }

      await getOrCalculateForecast(item, historicalSales, features, true);
    }

    return res.json({ message: 'AI demand forecasts recalculated successfully.' });
  } catch (error) {
    console.error('Recalculate inventory forecasts error:', error);
    return res.status(500).json({ error: 'Failed to recalculate AI demand forecasts.' });
  }
};

/**
 * Get list of stock receiving transactions with optional filters
 */
const getReceivings = async (req, res) => {
  const { status, supplierId, branchId, search } = req.query;
  try {
    const where = {};
    if (status && status !== 'ALL') where.status = status.toUpperCase();
    if (supplierId) where.supplierId = parseInt(supplierId, 10);
    if (branchId) where.branchId = parseInt(branchId, 10);
    if (search) {
      where.OR = [
        { receivingNumber: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const receivings = await prisma.inventoryReceiving.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        receivedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: { inventoryItem: true }
        },
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ receivings });
  } catch (error) {
    console.error('Fetch receivings error:', error);
    return res.status(500).json({ error: 'Failed to retrieve stock receiving records.' });
  }
};

/**
 * Get single stock receiving transaction details by ID
 */
const getReceivingById = async (req, res) => {
  const { id } = req.params;
  try {
    const receiving = await prisma.inventoryReceiving.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        supplier: true,
        branch: true,
        receivedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: { inventoryItem: true }
        },
        logs: {
          include: { inventoryItem: true }
        }
      }
    });

    if (!receiving) {
      return res.status(404).json({ error: 'Stock receiving record not found.' });
    }

    return res.json({ receiving });
  } catch (error) {
    console.error('Fetch receiving by ID error:', error);
    return res.status(500).json({ error: 'Failed to retrieve receiving details.' });
  }
};

/**
 * Create new stock receiving transaction (DRAFT or CONFIRMED RECEIVED)
 */
const createReceiving = async (req, res) => {
  const { supplierId, invoiceNumber, branchId, receivingDate, notes, items, status } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one inventory item is required for stock receiving.' });
  }

  const isConfirmed = status && status.toUpperCase() === 'RECEIVED';
  const targetStatus = isConfirmed ? 'RECEIVED' : 'DRAFT';

  try {
    const year = new Date().getFullYear();
    const count = await prisma.inventoryReceiving.count();
    const receivingNumber = `REC-${year}-${String(count + 1).padStart(4, '0')}`;

    const resolvedBranchId = branchId ? parseInt(branchId, 10) : (req.user?.branchId || 1);
    const resolvedSupplierId = supplierId ? parseInt(supplierId, 10) : null;
    const resolvedDate = receivingDate ? new Date(receivingDate) : new Date();

    const preparedItems = [];
    let calculatedTotalCost = 0.0;

    for (const item of items) {
      const invId = parseInt(item.inventoryItemId, 10);
      const qty = parseFloat(item.quantity);
      const cost = item.unitCost !== undefined && item.unitCost !== '' ? parseFloat(item.unitCost) : 0.0;

      if (isNaN(invId) || isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'All receiving items must specify a valid inventory item and positive quantity.' });
      }

      const itemTotal = qty * cost;
      calculatedTotalCost += itemTotal;

      preparedItems.push({
        inventoryItemId: invId,
        quantity: qty,
        unit: item.unit || 'PCS',
        unitCost: cost,
        totalCost: itemTotal,
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        notes: item.notes ? String(item.notes).trim() : null,
      });
    }

    const receiving = await prisma.$transaction(async (tx) => {
      const newReceiving = await tx.inventoryReceiving.create({
        data: {
          receivingNumber,
          supplierId: resolvedSupplierId,
          invoiceNumber: invoiceNumber ? String(invoiceNumber).trim() : null,
          branchId: resolvedBranchId,
          receivingDate: resolvedDate,
          receivedById: req.user.id,
          notes: notes ? String(notes).trim() : null,
          status: targetStatus,
          totalCost: calculatedTotalCost,
          items: {
            create: preparedItems,
          },
        },
        include: {
          supplier: true,
          branch: true,
          receivedBy: { select: { id: true, name: true, email: true } },
          items: { include: { inventoryItem: true } },
        },
      });

      if (targetStatus === 'RECEIVED') {
        for (const item of newReceiving.items) {
          const existingItem = await tx.inventoryItem.findUnique({
            where: { id: item.inventoryItemId }
          });

          if (!existingItem) {
            throw new Error(`Inventory item ID ${item.inventoryItemId} not found.`);
          }

          const qtyBefore = existingItem.stockLevel;
          const qtyAfter = qtyBefore + item.quantity;
          const newCost = item.unitCost > 0 ? item.unitCost : existingItem.costPrice;
          const newExpiry = item.expiryDate || existingItem.expiryDate;

          await tx.inventoryItem.update({
            where: { id: existingItem.id },
            data: {
              stockLevel: qtyAfter,
              costPrice: newCost,
              expiryDate: newExpiry,
            }
          });

          await tx.inventoryLog.create({
            data: {
              inventoryItemId: existingItem.id,
              type: 'STOCK_IN',
              quantity: item.quantity,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              changeQty: item.quantity,
              cost: item.totalCost,
              reason: `Stock receiving #${newReceiving.receivingNumber} (Inv: ${newReceiving.invoiceNumber || 'N/A'})`,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              supplierId: resolvedSupplierId,
              receivingId: newReceiving.id,
              userId: req.user.id,
            }
          });
        }
      }

      return newReceiving;
    });

    await logAudit({
      userId: req.user.id,
      action: isConfirmed ? 'STOCK_RECEIVING_CONFIRMED' : 'STOCK_RECEIVING_DRAFT_CREATED',
      entity: 'InventoryReceiving',
      entityId: receiving.id,
      newValue: { receivingNumber: receiving.receivingNumber, totalCost: receiving.totalCost, status: receiving.status },
      req
    });

    if (isConfirmed) {
      emitToAdmin('inventory:update', { receiving });
      emitToVendor('inventory:update', { receiving });
    }

    return res.status(201).json({
      message: isConfirmed ? 'Stock received successfully and inventory updated.' : 'Draft stock receiving saved successfully.',
      receiving
    });
  } catch (error) {
    console.error('Create receiving error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to create stock receiving record.' });
  }
};

/**
 * Confirm a draft receiving transaction and update inventory atomically
 */
const confirmReceiving = async (req, res) => {
  const { id } = req.params;

  try {
    const existingReceiving = await prisma.inventoryReceiving.findUnique({
      where: { id: parseInt(id, 10) },
      include: { items: { include: { inventoryItem: true } } }
    });

    if (!existingReceiving) {
      return res.status(404).json({ error: 'Stock receiving record not found.' });
    }

    if (existingReceiving.status === 'RECEIVED') {
      return res.status(400).json({ error: 'This receiving record has already been confirmed and processed.' });
    }

    if (existingReceiving.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cancelled receiving records cannot be confirmed.' });
    }

    const updatedReceiving = await prisma.$transaction(async (tx) => {
      for (const item of existingReceiving.items) {
        const existingItem = await tx.inventoryItem.findUnique({
          where: { id: item.inventoryItemId }
        });

        if (!existingItem) {
          throw new Error(`Inventory item ID ${item.inventoryItemId} not found.`);
        }

        const qtyBefore = existingItem.stockLevel;
        const qtyAfter = qtyBefore + item.quantity;
        const newCost = item.unitCost > 0 ? item.unitCost : existingItem.costPrice;
        const newExpiry = item.expiryDate || existingItem.expiryDate;

        await tx.inventoryItem.update({
          where: { id: existingItem.id },
          data: {
            stockLevel: qtyAfter,
            costPrice: newCost,
            expiryDate: newExpiry,
          }
        });

        await tx.inventoryLog.create({
          data: {
            inventoryItemId: existingItem.id,
            type: 'STOCK_IN',
            quantity: item.quantity,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            changeQty: item.quantity,
            cost: item.totalCost,
            reason: `Stock receiving #${existingReceiving.receivingNumber} (Inv: ${existingReceiving.invoiceNumber || 'N/A'})`,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            supplierId: existingReceiving.supplierId,
            receivingId: existingReceiving.id,
            userId: req.user.id,
          }
        });
      }

      const updated = await tx.inventoryReceiving.update({
        where: { id: existingReceiving.id },
        data: {
          status: 'RECEIVED',
          receivedById: req.user.id,
        },
        include: {
          supplier: true,
          branch: true,
          receivedBy: { select: { id: true, name: true, email: true } },
          items: { include: { inventoryItem: true } }
        }
      });

      return updated;
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_RECEIVING_CONFIRMED',
      entity: 'InventoryReceiving',
      entityId: updatedReceiving.id,
      newValue: { receivingNumber: updatedReceiving.receivingNumber, status: 'RECEIVED' },
      req
    });

    emitToAdmin('inventory:update', { receiving: updatedReceiving });
    emitToVendor('inventory:update', { receiving: updatedReceiving });

    return res.json({
      message: 'Stock receiving confirmed successfully. Inventory quantities updated.',
      receiving: updatedReceiving
    });
  } catch (error) {
    console.error('Confirm receiving error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to confirm stock receiving.' });
  }
};

/**
 * Cancel a draft stock receiving transaction
 */
const cancelReceiving = async (req, res) => {
  const { id } = req.params;

  try {
    const receiving = await prisma.inventoryReceiving.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!receiving) {
      return res.status(404).json({ error: 'Stock receiving record not found.' });
    }

    if (receiving.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Completed receivings cannot be cancelled.' });
    }

    const updated = await prisma.inventoryReceiving.update({
      where: { id: receiving.id },
      data: { status: 'CANCELLED' }
    });

    await logAudit({
      userId: req.user.id,
      action: 'STOCK_RECEIVING_CANCELLED',
      entity: 'InventoryReceiving',
      entityId: updated.id,
      newValue: { receivingNumber: updated.receivingNumber, status: 'CANCELLED' },
      req
    });

    return res.json({ message: 'Stock receiving draft cancelled.', receiving: updated });
  } catch (error) {
    console.error('Cancel receiving error:', error);
    return res.status(500).json({ error: 'Failed to cancel stock receiving.' });
  }
};

/**
 * Parse CSV/Excel upload and match items against inventory catalog
 */
const previewImportCSV = async (req, res) => {
  const { rows, rawText, fileBase64, fileName } = req.body;
  try {
    const result = await parseAndMatchInvoice({
      rawText: rawText || (Array.isArray(rows) ? JSON.stringify(rows) : ''),
      fileBase64,
      fileName,
    });
    return res.json(result);
  } catch (error) {
    console.error('Preview import error:', error);
    return res.status(500).json({ error: 'Failed to parse import data.' });
  }
};

/**
 * AI / OCR Invoice extraction & item matching preview
 */
const previewAiOcrInvoice = async (req, res) => {
  const { rawText, imageBase64, fileBase64, fileName, supplierName } = req.body;
  try {
    const result = await parseAndMatchInvoice({
      rawText,
      fileBase64: fileBase64 || imageBase64,
      fileName,
      supplierNameHint: supplierName,
    });
    return res.json(result);
  } catch (error) {
    console.error('AI OCR preview error:', error);
    return res.status(500).json({ error: 'Failed to extract invoice data.' });
  }
};

module.exports = {
  getInventorySummary,
  getInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  stockIn,
  adjustStock,
  restockItem,
  getRecipeForMenuItem,
  saveRecipeForMenuItem,
  getRecipeMargins,
  getExpiringItems,
  getSuppliers,
  createSupplier,
  getInventoryLogs,
  getForecast,
  getInventoryAlerts,
  recalculateInventoryForecasts,
  getReceivings,
  getReceivingById,
  createReceiving,
  confirmReceiving,
  cancelReceiving,
  previewImportCSV,
  previewAiOcrInvoice,
};
