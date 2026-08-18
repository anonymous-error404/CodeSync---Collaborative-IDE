import express from 'express';
import * as controller from '../controllers/workspaceController.js';

const router = express.Router();

// Workspace routes
router.post('/workspaces', controller.createWorkspace);
router.get('/workspaces', controller.listWorkspaces);
router.get('/workspaces/:id', controller.getWorkspaceDetails);
router.delete('/workspaces/:id', controller.deleteWorkspace);

// File management routes 
router.get('/workspaces/:id/files/tree', controller.getFileTree);
router.get('/workspaces/:id/files/content', controller.readFileContent);
router.put('/workspaces/:id/files/content', controller.saveFileContent);
router.post('/workspaces/:id/files', controller.createItem);
router.delete('/workspaces/:id/files', controller.deleteItem);
router.post('/workspaces/:id/files/rename', controller.renameItem);

export default router;
