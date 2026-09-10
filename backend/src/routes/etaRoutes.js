const express = require('express');
const { getETAPrediction } = require('../controllers/etaController');

const router = express.Router();

router.post('/', getETAPrediction);

module.exports = router;
