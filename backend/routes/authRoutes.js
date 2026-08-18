const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public endpoints
router.post('/register', register);
router.post('/login', login);

// Protected session endpoint
router.get('/me', authenticateToken, getMe);

module.exports = router;
