import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { googleRedirect, googleCallback } from '../controllers/oauthController.js';

const router = express.Router();

// Public endpoints
router.post('/register', register);
router.post('/login', login);

// Google OAuth
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

// Protected session endpoint
router.get('/me', authenticateToken, getMe);

export default router;
