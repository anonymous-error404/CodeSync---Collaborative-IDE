import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember, requireWorkspaceOwner } from '../middleware/rbacMiddleware.js';
import { getMembers, updateMemberRole, removeMember, leaveWorkspace } from '../controllers/memberController.js';

const router = express.Router();

router.get('/workspaces/:id/members', authenticateToken, requireWorkspaceMember('viewer'), getMembers);
router.patch('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceOwner, updateMemberRole);
router.delete('/workspaces/:id/members/me', authenticateToken, requireWorkspaceMember('viewer'), leaveWorkspace);
router.delete('/workspaces/:id/members/:userId', authenticateToken, requireWorkspaceOwner, removeMember);

export default router;
