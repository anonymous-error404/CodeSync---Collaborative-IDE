import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  requireWorkspaceMember,
  requireWorkspaceAdmin,
} from '../middleware/rbacMiddleware.js';
import {
  getMembers,
  updateMemberRole,
  updateStudentAccess,
  updateBulkStudentAccess,
  removeMember,
  leaveWorkspace,
} from '../controllers/memberController.js';

const router = express.Router();

router.get('/workspaces/:id/members', authenticateToken, requireWorkspaceMember('viewer'), getMembers);
router.patch('/workspaces/:id/members/access/bulk', authenticateToken, requireWorkspaceAdmin, updateBulkStudentAccess);
router.patch('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceAdmin, updateMemberRole);
router.patch('/workspaces/:id/members/:userId/access', authenticateToken, requireWorkspaceAdmin, updateStudentAccess);
router.delete('/workspaces/:id/members/me', authenticateToken, requireWorkspaceMember('viewer'), leaveWorkspace);
router.delete('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceAdmin, removeMember);

export default router;
