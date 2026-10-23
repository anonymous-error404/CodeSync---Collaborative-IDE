import express from 'express';
import * as controller from '../controllers/workspaceController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
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

// File management routes - RBAC protected
router.get('/workspaces/:id/files/tree', authenticateToken, requireWorkspaceMember('viewer'), controller.getFileTree);
router.get('/workspaces/:id/files/content', authenticateToken, requireWorkspaceMember('viewer'), controller.readFileContent);
router.put('/workspaces/:id/files/content', authenticateToken, requireWorkspaceMember('editor'), controller.saveFileContent);
router.post('/workspaces/:id/files', authenticateToken, requireWorkspaceMember('editor'), controller.createItem);
router.delete('/workspaces/:id/files', authenticateToken, requireWorkspaceMember('editor'), controller.deleteItem);
router.post('/workspaces/:id/files/rename', authenticateToken, requireWorkspaceMember('editor'), controller.renameItem);

export default router;
