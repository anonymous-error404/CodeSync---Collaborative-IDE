import express from 'express';
import {
  listWhiteboards,
  getWhiteboard,
  createWhiteboard,
  updateWhiteboard,
  deleteWhiteboard,
  recognizeStroke,
  cleanLayout,
  generateTaskProposals,
  generateFromPrompt,
  aiTextToDiagram,
  aiDiagramToCode,
} from '../controllers/whiteboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// Workspace whiteboard routes - protected by workspace RBAC
router.get('/workspaces/:workspaceId/whiteboards', authenticateToken, requireWorkspaceMember('viewer'), listWhiteboards);
router.post('/workspaces/:workspaceId/whiteboards', authenticateToken, requireWorkspaceMember('editor'), createWhiteboard);

// Individual whiteboard routes - verified against workspace membership
router.get('/whiteboards/:id', authenticateToken, getWhiteboard);
router.put('/whiteboards/:id', authenticateToken, updateWhiteboard);
router.delete('/whiteboards/:id', authenticateToken, deleteWhiteboard);

// Smart diagram utilities
router.post('/whiteboards/recognize-stroke', authenticateToken, recognizeStroke);
router.post('/whiteboards/clean-layout', authenticateToken, cleanLayout);
router.post('/whiteboards/generate-tasks', authenticateToken, generateTaskProposals);
router.post('/whiteboards/generate-from-prompt', authenticateToken, generateFromPrompt);

// AI Diagram & Code Hub routes
router.post('/whiteboards/ai/text-to-diagram', authenticateToken, aiTextToDiagram);
router.post('/whiteboards/ai/diagram-to-code', authenticateToken, aiDiagramToCode);

export default router;
