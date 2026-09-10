const express = require('express');
const {
  getInventoryItems,
  getInventoryLogs,
  addInventoryItem,
  restockItem,
  getForecast,
  getInventoryAlerts,
  recalculateInventoryForecasts,
} = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN', 'VENDOR', 'KITCHEN'])); // Inventory is accessible to all staff roles

router.get('/', getInventoryItems);
router.get('/logs', getInventoryLogs);
router.get('/alerts', getInventoryAlerts);
router.post('/', roleMiddleware(['ADMIN', 'VENDOR']), addInventoryItem);
router.post('/recalculate-forecasts', roleMiddleware(['ADMIN', 'VENDOR']), recalculateInventoryForecasts);
router.post('/:id/restock', roleMiddleware(['ADMIN', 'VENDOR']), restockItem);
router.get('/:id/forecast', getForecast);

module.exports = router;
