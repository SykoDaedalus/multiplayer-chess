const express = require('express');
const router = express.Router();
const { getGameHistory, getGameById } = require('../controllers/gameController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/history', authenticateToken, getGameHistory);
router.get('/:roomId', getGameById);

module.exports = router;
