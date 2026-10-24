import express from 'express';
import * as controller from '../controllers/workspaceController.js';
import * as lockController from '../controllers/lockController.js';
import executionService from '../services/executionService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { searchUsers } from '../controllers/authController.js';
import {
  requireWorkspaceMember,
  requireWorkspaceOwner,
} from '../middleware/rbacMiddleware.js';

const router = express.Router();

// Workspace routes
router.post('/workspaces', authenticateToken, controller.createWorkspace);
router.get('/workspaces', authenticateToken, controller.listWorkspaces);
router.get('/workspaces/:id', authenticateToken, requireWorkspaceMember('viewer'), controller.getWorkspaceDetails);
router.delete('/workspaces/:id', authenticateToken, requireWorkspaceOwner, controller.deleteWorkspace);
router.post('/workspaces/bulk-delete', authenticateToken, controller.bulkDeleteWorkspaces);
router.get('/users/search', authenticateToken, searchUsers);

// Competitive Workspace Allowlist routes
router.get('/workspaces/:id/allowlist', authenticateToken, requireWorkspaceMember('viewer'), controller.getAllowlist);
router.post('/workspaces/:id/allowlist', authenticateToken, requireWorkspaceMember('admin'), controller.addAllowedEmails);
router.delete('/workspaces/:id/allowlist/:email', authenticateToken, requireWorkspaceMember('admin'), controller.removeAllowedEmail);

// File management routes - RBAC protected
router.get('/workspaces/:id/files/tree', authenticateToken, requireWorkspaceMember('viewer'), controller.getFileTree);
router.get('/workspaces/:id/files/content', authenticateToken, requireWorkspaceMember('viewer'), controller.readFileContent);
router.put('/workspaces/:id/files/content', authenticateToken, requireWorkspaceMember('editor'), controller.saveFileContent);
router.post('/workspaces/:id/files', authenticateToken, requireWorkspaceMember('editor'), controller.createItem);
router.delete('/workspaces/:id/files', authenticateToken, requireWorkspaceMember('editor'), controller.deleteItem);
router.post('/workspaces/:id/files/rename', authenticateToken, requireWorkspaceMember('editor'), controller.renameItem);

// Resource Locking routes (file, folder, code_block)
router.get('/workspaces/:id/locks', authenticateToken, requireWorkspaceMember('viewer'), lockController.getWorkspaceLocks);
router.post('/workspaces/:id/locks', authenticateToken, requireWorkspaceMember('editor'), lockController.createLock);
router.delete('/workspaces/:id/locks/:lockId', authenticateToken, requireWorkspaceMember('viewer'), lockController.deleteLock);

// Environment routes
router.get('/workspaces/:id/environments', authenticateToken, requireWorkspaceMember('viewer'), async (req, res) => {
  const supported = await executionService.getSupportedEnvironments();
  const active = executionService.listEnvironments(req.params.id);
  res.json({ success: true, supported, active });
});

export default router;
