import express from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getReviews,
  createReview,
  updateReviewStatus,
  deleteReview,
} from '../controllers/professionalController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// ── Task Routes ──
router.get('/workspaces/:id/tasks', requireWorkspaceMember('viewer'), getTasks);
router.post('/workspaces/:id/tasks', requireWorkspaceMember('developer'), createTask);
router.patch('/workspaces/:id/tasks/:taskId', requireWorkspaceMember('developer'), updateTask);
router.delete('/workspaces/:id/tasks/:taskId', requireWorkspaceMember('developer'), deleteTask);

// ── Code Review Routes ──
router.get('/workspaces/:id/reviews', requireWorkspaceMember('viewer'), getReviews);
router.post('/workspaces/:id/reviews', requireWorkspaceMember('developer'), createReview);
router.patch('/workspaces/:id/reviews/:reviewId/status', requireWorkspaceMember('viewer'), updateReviewStatus);
router.delete('/workspaces/:id/reviews/:reviewId', requireWorkspaceMember('developer'), deleteReview);

export default router;
