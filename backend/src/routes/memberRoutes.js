import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  requireWorkspaceMember,
  requireWorkspaceAdmin,
} from '../middleware/rbacMiddleware.js';
import {
  getMembers,
  updateMemberRole,
  removeMember,
  leaveWorkspace,
} from '../controllers/memberController.js';

const router = express.Router();

router.get('/workspaces/:id/members', authenticateToken, requireWorkspaceMember('viewer'), getMembers);
router.patch('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceAdmin, updateMemberRole);
router.delete('/workspaces/:id/members/me', authenticateToken, requireWorkspaceMember('viewer'), leaveWorkspace);
router.delete('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceAdmin, removeMember);

export default router;
