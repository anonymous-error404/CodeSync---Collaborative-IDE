import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember, requireWorkspaceOwner } from '../middleware/rbacMiddleware.js';
import { createInvite, getInvites, revokeInvite, joinViaInvite } from '../controllers/inviteController.js';

const router = express.Router();

router.post('/workspaces/:id/invites', authenticateToken, requireWorkspaceMember('editor'), createInvite);
router.get('/workspaces/:id/invites', authenticateToken, requireWorkspaceMember('viewer'), getInvites);
router.delete('/workspaces/:id/invites/:inviteId', authenticateToken, requireWorkspaceOwner, revokeInvite);
router.post('/invites/:inviteId/join', authenticateToken, joinViaInvite);

export default router;
