import express from 'express';
import {
  initBranch,
  getBranchStatus,
  resetBranch,
  executeQuery,
} from '../controllers/databaseBranchController.js';

const router = express.Router();

router.post('/workspaces/:id/database/init', initBranch);
router.get('/workspaces/:id/database/status', getBranchStatus);
router.post('/workspaces/:id/database/reset', resetBranch);
router.post('/workspaces/:id/database/query', executeQuery);

export default router;
