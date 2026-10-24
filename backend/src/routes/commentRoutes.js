import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController.js';

const router = express.Router();

router.get('/workspaces/:id/comments', authenticateToken, requireWorkspaceMember('viewer'), getComments);
router.post('/workspaces/:id/comments', authenticateToken, requireWorkspaceMember('viewer'), createComment);
router.patch('/workspaces/:id/comments/:commentId', authenticateToken, requireWorkspaceMember('viewer'), updateComment);
router.delete('/workspaces/:id/comments/:commentId', authenticateToken, requireWorkspaceMember('viewer'), deleteComment);

export default router;
