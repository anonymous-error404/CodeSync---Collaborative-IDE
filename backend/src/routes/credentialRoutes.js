import { Router } from 'express';
import {
  getProviders,
  createProvider,
  toggleProvider,
  getWorkspaceCredentials,
  requestCredential,
  revokeCredential,
  scanSecrets,
  remediateSecret,
  getPolicies,
  createPolicy,
  togglePolicy,
  getAnalyticsAndAudit,
  triggerEmergencyLockdown,
} from '../controllers/credentialController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticateToken);

// Providers
router.get('/credentials/providers', getProviders);
router.post('/credentials/providers', createProvider);
router.patch('/credentials/providers/:providerId/toggle', toggleProvider);

// Workspace Ephemeral Credentials (scoped to workspace members)
router.get('/workspaces/:id/credentials', requireWorkspaceMember('viewer'), getWorkspaceCredentials);
router.post('/workspaces/:id/credentials/request', requireWorkspaceMember('editor'), requestCredential);
router.delete('/credentials/:credentialId', revokeCredential);

// Secret Scanning & Remediation (scoped to workspace members)
router.get('/workspaces/:id/credentials/scan-secrets', requireWorkspaceMember('viewer'), scanSecrets);
router.post('/workspaces/:id/credentials/remediate-secret', requireWorkspaceMember('editor'), remediateSecret);

// ABAC / RBAC Policies
router.get('/credentials/policies', getPolicies);
router.post('/credentials/policies', createPolicy);
router.patch('/credentials/policies/:policyId/toggle', togglePolicy);

// Analytics & Audit
router.get('/credentials/analytics', getAnalyticsAndAudit);

// Emergency Lockdown
router.post('/credentials/emergency-lockdown', triggerEmergencyLockdown);

export default router;
