import express from 'express';
import {
  getConnectionInfo,
  createConnectToken,
  syncDotfiles,
  getDotfilesStatus,
} from '../controllers/gatewayController.js';

const router = express.Router();

router.get('/gateway/workspace/:id/connection-info', getConnectionInfo);
router.post('/gateway/workspace/:id/connect-token', createConnectToken);
router.post('/gateway/workspace/:id/dotfiles', syncDotfiles);
router.get('/gateway/workspace/:id/dotfiles/status', getDotfilesStatus);

export default router;
