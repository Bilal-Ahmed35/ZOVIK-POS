const express = require('express');
const {
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
} = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN', 'VENDOR', 'KITCHEN'])); // Accessible to staff roles

// Summary & Catalog
router.get('/summary', getInventorySummary);
router.get('/', getInventoryItems);
router.post('/', roleMiddleware(['ADMIN', 'VENDOR']), addInventoryItem);
router.put('/:id', roleMiddleware(['ADMIN', 'VENDOR']), updateInventoryItem);

// Stock In & Adjustments
router.post('/stock-in', roleMiddleware(['ADMIN', 'VENDOR']), stockIn);
router.post('/adjust', roleMiddleware(['ADMIN', 'VENDOR']), adjustStock);
router.post('/:id/restock', roleMiddleware(['ADMIN', 'VENDOR']), restockItem);

// Recipes & Margins
router.get('/recipes/margins', getRecipeMargins);
router.get('/recipes/:menuItemId', getRecipeForMenuItem);
router.post('/recipes/:menuItemId', roleMiddleware(['ADMIN', 'VENDOR']), saveRecipeForMenuItem);

// Expiry & Suppliers
router.get('/expiring', getExpiringItems);
router.get('/suppliers', getSuppliers);
router.post('/suppliers', roleMiddleware(['ADMIN', 'VENDOR']), createSupplier);

// Logs & AI Forecasting
router.get('/logs', getInventoryLogs);
router.get('/alerts', getInventoryAlerts);
router.post('/recalculate-forecasts', roleMiddleware(['ADMIN', 'VENDOR']), recalculateInventoryForecasts);
router.get('/:id/forecast', getForecast);

module.exports = router;
