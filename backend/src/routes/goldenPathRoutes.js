import { Router } from 'express';
import {
  getBlueprints,
  getBlueprintById,
  createBlueprint,
  initiateProvisioning,
  getWorkspaceExecutions,
  getExecutionById,
  checkDrift,
  applyUpstreamUpdate,
  getIDPPolicies,
  createIDPPolicy,
  getPlatformAnalytics,
} from '../controllers/goldenPathController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticateToken);

// Blueprint Catalog
router.get('/goldenpath/blueprints', getBlueprints);
router.get('/goldenpath/blueprints/:blueprintId', getBlueprintById);
router.post('/goldenpath/blueprints', createBlueprint);

// Provisioning & Lifecycle
router.post('/goldenpath/provision', initiateProvisioning);
router.get('/workspaces/:id/goldenpath/executions', requireWorkspaceMember('viewer'), getWorkspaceExecutions);
router.get('/goldenpath/executions/:executionId', getExecutionById);
router.post('/goldenpath/executions/:executionId/check-drift', checkDrift);
router.post('/goldenpath/executions/:executionId/apply-update', applyUpstreamUpdate);

// Governance Policies & Platform Analytics
router.get('/goldenpath/policies', getIDPPolicies);
router.post('/goldenpath/policies', createIDPPolicy);
router.get('/goldenpath/analytics', getPlatformAnalytics);

export default router;
