import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';
import {
  getIndexSummary,
  getCompletions,
  getInlineSuggestion,
  getDefinition,
  getDiagnostics,
  queryLspRag,
} from '../controllers/lspRagController.js';

const router = Router();

router.get('/workspaces/:workspaceId/lsprag/index', authenticateToken, requireWorkspaceMember('viewer'), getIndexSummary);
router.post('/workspaces/:workspaceId/lsprag/completions', authenticateToken, requireWorkspaceMember('viewer'), getCompletions);
router.post('/workspaces/:workspaceId/lsprag/inline', authenticateToken, requireWorkspaceMember('viewer'), getInlineSuggestion);
router.post('/workspaces/:workspaceId/lsprag/definition', authenticateToken, requireWorkspaceMember('viewer'), getDefinition);
router.post('/workspaces/:workspaceId/lsprag/diagnostics', authenticateToken, requireWorkspaceMember('viewer'), getDiagnostics);
router.post('/workspaces/:workspaceId/lsprag/query', authenticateToken, requireWorkspaceMember('viewer'), queryLspRag);

export default router;
