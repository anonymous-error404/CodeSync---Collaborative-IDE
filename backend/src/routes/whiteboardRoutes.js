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
} from '../controllers/whiteboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Workspace whiteboard routes
router.get('/workspaces/:workspaceId/whiteboards', authenticateToken, listWhiteboards);
router.post('/workspaces/:workspaceId/whiteboards', authenticateToken, createWhiteboard);

// Individual whiteboard routes
router.get('/whiteboards/:id', authenticateToken, getWhiteboard);
router.put('/whiteboards/:id', authenticateToken, updateWhiteboard);
router.delete('/whiteboards/:id', authenticateToken, deleteWhiteboard);

// Smart AI features endpoints
router.post('/whiteboards/recognize-stroke', authenticateToken, recognizeStroke);
router.post('/whiteboards/clean-layout', authenticateToken, cleanLayout);
router.post('/whiteboards/generate-tasks', authenticateToken, generateTaskProposals);
router.post('/whiteboards/generate-from-prompt', authenticateToken, generateFromPrompt);

export default router;
