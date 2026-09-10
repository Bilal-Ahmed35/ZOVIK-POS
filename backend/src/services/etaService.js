const axios = require('axios');
const { prisma } = require('../config/db');

/**
 * Calculates the Estimated Time of Arrival (ETA) for a set of menu items.
 * Uses a hybrid approach:
 * Step 1: Restaurant base prep time using parallel cooking logic + quantity handling overhead.
 * Step 2: AI model adjusts ETA using queue length, peak hour, kitchen load, and closed-loop historical delays.
 * @param {Array<{menuItemId: number, quantity: number}>} items 
 * @returns {Promise<{estimatedTime: number, estimatedBill: number, kitchenLoad: string, explanation: string, baseEta: number, adjustedEta: number, queueLength: number, isPeakHour: boolean, historicalDelay: number}>}
 */
const calculateETA = async (items) => {
  try {
    if (!items || items.length === 0) {
      return {
        estimatedTime: 0,
        estimatedBill: 0,
        kitchenLoad: 'Low',
        explanation: 'No items in the order.',
        baseEta: 0,
        adjustedEta: 0,
        queueLength: 0,
        isPeakHour: false,
        historicalDelay: 0
      };
    }

    // 1. Fetch items from DB to get their prepTime and price
    const menuItemIds = items.map(i => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } }
    });

    const menuMap = {};
    dbMenuItems.forEach(item => {
      menuMap[item.id] = item;
    });

    let totalQuantity = 0;
    let maxPrepTime = 0;
    let totalBill = 0;

    items.forEach(item => {
      const dbItem = menuMap[item.menuItemId];
      if (dbItem) {
        totalQuantity += item.quantity;
        totalBill += dbItem.price * item.quantity;
        
        // Find max prep time for parallel cooking logic
        const itemPrepTime = dbItem.prepTime || 5;
        if (itemPrepTime > maxPrepTime) {
          maxPrepTime = itemPrepTime;
        }
      }
    });

    // Step 1: Base ETA Formula (Parallel cooking logic with overhead for extra quantity)
    // Base ETA = max(prepTime) + (totalQuantity - 1) * 1.5 minutes
    const baseEta = maxPrepTime + Math.max(0, totalQuantity - 1) * 1.5;

    // 2. Fetch live queue length from DB (active orders in queue)
    const queueLength = await prisma.order.count({
      where: {
        status: { in: ['PENDING', 'PAID', 'PREPARING'] }
      }
    });

    // 3. Determine peak hour factor
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const isPeakHour = (hour === 12 || hour === 13 || hour === 18 || hour === 19) ? 1 : 0;

    // 4. Determine Kitchen Load Status
    let kitchenLoad = 'Low';
    if (queueLength <= 3) {
      kitchenLoad = 'Low';
    } else if (queueLength <= 7) {
      kitchenLoad = 'Medium';
    } else {
      kitchenLoad = 'High';
    }

    // 5. Fetch closed-loop historical delay from eTAPrediction
    // (Average error between actualTime and adjustedEta for the last 10 completed orders)
    const recentPredictions = await prisma.eTAPrediction.findMany({
      where: {
        actualTime: { not: null }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    let historicalDelay = 0;
    if (recentPredictions.length > 0) {
      const totalDelay = recentPredictions.reduce((sum, pred) => sum + (pred.actualTime - pred.adjustedEta), 0);
      historicalDelay = totalDelay / recentPredictions.length;
    }

    // 6. Predict ETA using AI (FastAPI RandomForestRegressor)
    let estimatedTime = Math.round(baseEta);
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    try {
      const response = await axios.post(`${aiServiceUrl}/predict-eta`, {
        base_eta: baseEta,
        queue_length: queueLength,
        hour: hour,
        day_of_week: dayOfWeek,
        is_peak_hour: isPeakHour,
        kitchen_load: kitchenLoad === 'Low' ? 0 : kitchenLoad === 'Medium' ? 1 : 2,
        historical_delay: historicalDelay
      }, { timeout: 2000 });

      estimatedTime = Math.round(response.data.estimated_time);
      console.log(`AI Prediction success. Base ETA: ${baseEta.toFixed(1)}, Predicted ETA: ${estimatedTime} mins.`);
    } catch (aiError) {
      // AI Service fails -> Fallback ETA Formula
      const fallbackTime = baseEta + (queueLength * 1.2) + (isPeakHour * 3.5) + historicalDelay;
      estimatedTime = Math.round(fallbackTime);
      console.warn(`AI prediction failed (${aiError.message}). Using fallback ETA: ${estimatedTime} mins.`);
    }

    // Clean description/explanation
    const queueText = queueLength === 0 
      ? 'no active orders' 
      : `${queueLength} active order${queueLength > 1 ? 's' : ''}`;
    
    const peakText = isPeakHour 
      ? 'during peak dining hours' 
      : 'during standard hours';
      
    const loadText = `Kitchen load is ${kitchenLoad}`;
    const explanation = `${loadText} with ${queueText} ${peakText}. Base preparation time is ${Math.round(baseEta)} minutes adjusted by AI for active queue delays.`;

    return {
      estimatedTime: Math.max(2, estimatedTime),
      estimatedBill: Math.round(totalBill),
      kitchenLoad,
      explanation,
      baseEta,
      adjustedEta: estimatedTime,
      queueLength,
      isPeakHour: isPeakHour === 1,
      historicalDelay
    };
  } catch (error) {
    console.error('Error in etaService:', error);
    throw error;
  }
};

module.exports = {
  calculateETA
};
