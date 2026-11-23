import express from 'express';
import {
  listSnapshots,
  triggerPrebuild,
  checkSnapshot,
} from '../controllers/warmPoolController.js';

const router = express.Router();

router.get('/warmpool/snapshots', listSnapshots);
router.post('/warmpool/prebuild', triggerPrebuild);
router.get('/warmpool/check', checkSnapshot);

export default router;
