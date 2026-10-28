import express from 'express';
import {
  cloneRepo,
  getStatus,
  initRepo,
  commit,
  push,
  pull,
  getBranches,
  checkoutBranch,
  getDiff,
  stageFile,
  discardChanges,
  getCredentials,
  saveCredentials,
  saveUserGithubToken,
} from '../controllers/gitController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// User-level GitHub token management
router.post('/git/user-credentials', saveUserGithubToken);

// Workspace Git operations
router.get('/workspaces/:id/git/status', requireWorkspaceMember('viewer'), getStatus);
router.post('/workspaces/:id/git/clone', requireWorkspaceMember('editor'), cloneRepo);
router.post('/workspaces/:id/git/init', requireWorkspaceMember('editor'), initRepo);
router.post('/workspaces/:id/git/commit', requireWorkspaceMember('editor'), commit);
router.post('/workspaces/:id/git/push', requireWorkspaceMember('editor'), push);
router.post('/workspaces/:id/git/pull', requireWorkspaceMember('editor'), pull);
router.get('/workspaces/:id/git/branches', requireWorkspaceMember('viewer'), getBranches);
router.post('/workspaces/:id/git/branch', requireWorkspaceMember('editor'), checkoutBranch);
router.get('/workspaces/:id/git/diff', requireWorkspaceMember('viewer'), getDiff);
router.post('/workspaces/:id/git/stage', requireWorkspaceMember('editor'), stageFile);
router.post('/workspaces/:id/git/discard', requireWorkspaceMember('editor'), discardChanges);
router.get('/workspaces/:id/git/credentials', requireWorkspaceMember('viewer'), getCredentials);
router.post('/workspaces/:id/git/credentials', requireWorkspaceMember('editor'), saveCredentials);

export default router;
