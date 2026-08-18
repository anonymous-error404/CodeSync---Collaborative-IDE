import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public endpoints
router.post('/register', register);
router.post('/login', login);

// Protected session endpoint
router.get('/me', authenticateToken, getMe);

export default router;
