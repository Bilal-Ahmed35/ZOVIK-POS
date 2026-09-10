const { prisma } = require('../config/db');
const { getInventoryForecast } = require('../services/aiService');
const { emitToAdmin, emitToVendor } = require('../sockets/socket');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for cached ML forecasts

/**
 * Get cached forecast from DB or invoke ML prediction and persist result
 */
const getOrCalculateForecast = async (item, historicalSales, features, forceRefresh = false) => {
  const now = new Date();

  if (!forceRefresh) {
    const existing = await prisma.demandForecast.findUnique({
      where: { menuItemName: item.name }
    });

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

  // Upsert into DemandForecast table for persistent DB caching
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

const getInventoryItems = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ items });
  } catch (error) {
    console.error('Fetch inventory error:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory items.' });
  }
};

const getInventoryLogs = async (req, res) => {
  try {
    const logs = await prisma.inventoryLog.findMany({
      include: {
        inventoryItem: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return res.json({ logs });
  } catch (error) {
    console.error('Fetch inventory logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve inventory logs.' });
  }
};

const addInventoryItem = async (req, res) => {
  const { name, stockLevel, unit, minThreshold } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: 'Name and unit are required.' });
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        name,
        stockLevel: stockLevel ? parseFloat(stockLevel) : 0.0,
        unit,
        minThreshold: minThreshold ? parseFloat(minThreshold) : 10.0
      }
    });

    if (stockLevel && parseFloat(stockLevel) > 0) {
      await prisma.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          changeQty: parseFloat(stockLevel),
          type: 'RESTOCK',
          reason: 'Initial stock load'
        }
      });
    }

    emitToAdmin('inventory:update', item);
    emitToVendor('inventory:update', item);
    return res.status(201).json({ message: 'Inventory item added successfully.', item });
  } catch (error) {
    console.error('Add inventory item error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'An inventory item with this name already exists.' });
    }
    return res.status(500).json({ error: 'Failed to add inventory item.' });
  }
};

const restockItem = async (req, res) => {
  const { id } = req.params;
  const { quantity, reason } = req.body;

  if (quantity === undefined || parseFloat(quantity) <= 0) {
    return res.status(400).json({ error: 'Restock quantity must be greater than zero.' });
  }

  try {
    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: parseInt(id) }
      });

      if (!item) {
        throw new Error('Inventory item not found.');
      }

      const updated = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          stockLevel: item.stockLevel + parseFloat(quantity)
        }
      });

      await tx.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          changeQty: parseFloat(quantity),
          type: 'RESTOCK',
          reason: reason || 'Manual Restock'
        }
      });

      // Synchronize back to the MenuItem stock if names match
      const menuItem = await tx.menuItem.findFirst({
        where: { name: item.name }
      });
      if (menuItem) {
        await tx.menuItem.update({
          where: { id: menuItem.id },
          data: { stock: menuItem.stock + parseInt(quantity) }
        });
      }

      return updated;
    });

    emitToAdmin('inventory:update', updatedItem);
    emitToVendor('inventory:update', updatedItem);
    return res.json({ message: 'Item restocked successfully.', item: updatedItem });
  } catch (error) {
    console.error('Restock item error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to restock item.' });
  }
};

const getForecast = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    // Compile historical order item volumes for the past 7 days
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
      historicalSales.push(12, 15, 8, 14, 20, 18, 22);
    }

    const prediction = await getOrCalculateForecast(item, historicalSales, {}, false);

    return res.json({
      itemName: item.name,
      currentStock: item.stockLevel,
      minThreshold: item.minThreshold,
      historicalSales,
      forecast: prediction.forecast,
      confidence: prediction.confidence || 0.8,
      source: prediction.source
    });
  } catch (error) {
    console.error('Forecasting calculation error:', error);
    return res.status(500).json({ error: 'Failed to calculate inventory demand forecast.' });
  }
};

const getInventoryAlerts = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' }
    });

    // Compute contextual features for tomorrow
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

      // Check DB cache first
      const prediction = await getOrCalculateForecast(item, historicalSales, features, false);
      const forecast = prediction.forecast;
      const percentChange = prediction.percentChange || 0.0;

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

        const nameClean = item.name.toLowerCase();
        let ingredientsText = 'ingredients';
        if (nameClean.includes('burger')) {
          ingredientsText = 'burger buns and chicken patties';
        } else if (nameClean.includes('tea')) {
          ingredientsText = 'milk, tea leaves, and sugar';
        } else if (nameClean.includes('shawarma')) {
          ingredientsText = 'pita bread and chicken filling';
        } else if (nameClean.includes('fries')) {
          ingredientsText = 'fresh potatoes, oil, and seasonings';
        } else if (nameClean.includes('biryani')) {
          ingredientsText = 'basmati rice and meat';
        } else if (nameClean.includes('paratha')) {
          ingredientsText = 'flour dough and stuffing';
        }

        const reasonText = percentChange > 10
          ? `demand may increase by ${percentChange.toFixed(0)}% tomorrow due to ${exams_season ? 'exam season' : promotions ? 'promotional weekend' : weatherString === 'Rain' ? 'rainy weather' : 'dining trends'}`
          : `daily demand is projected at ${forecast.toFixed(0)} units`;

        alertMessage = `${item.name} ${reasonText}. Restock ${ingredientsText} immediately to avoid running out.`;
      } else if (isLow) {
        alertType = 'LOW_STOCK';
        suggestedRestock = Math.ceil(item.minThreshold * 2.5 - item.stockLevel);
        alertMessage = `${item.name} stock level (${item.stockLevel.toFixed(0)} ${item.unit}) is below safety threshold (${item.minThreshold} ${item.unit}). Suggest restocking soon.`;
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
 * Force recalculate all ML demand forecasts (bypassing DB cache)
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

module.exports = {
  getInventoryItems,
  getInventoryLogs,
  addInventoryItem,
  restockItem,
  getForecast,
  getInventoryAlerts,
  recalculateInventoryForecasts,
};
