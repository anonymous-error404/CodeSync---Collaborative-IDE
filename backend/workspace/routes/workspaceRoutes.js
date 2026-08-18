const express = require('express');
const router = express.Router();
const controller = require('../controllers/workspaceController');

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

module.exports = router;
