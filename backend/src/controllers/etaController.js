const { calculateETA } = require('../services/etaService');

const getETAPrediction = async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required to calculate ETA.' });
  }

  try {
    const result = await calculateETA(items);
    return res.json(result);
  } catch (error) {
    console.error('ETA Controller error:', error);
    return res.status(500).json({ error: 'Failed to predict ETA.' });
  }
};

module.exports = {
  getETAPrediction
};
