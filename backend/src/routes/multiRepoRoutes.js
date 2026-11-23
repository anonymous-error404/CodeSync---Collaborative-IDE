import express from 'express';
import {
  listMountedRepos,
  mountRepo,
  unmountRepo,
  detectTypeMesh,
  linkTypeMesh,
  verifyTypeSync,
} from '../controllers/multiRepoController.js';

const router = express.Router();

router.get('/workspaces/:id/repos', listMountedRepos);
router.post('/workspaces/:id/repos/mount', mountRepo);
router.delete('/workspaces/:id/repos/:repoId', unmountRepo);

router.get('/workspaces/:id/types/mesh', detectTypeMesh);
router.post('/workspaces/:id/types/link', linkTypeMesh);
router.get('/workspaces/:id/types/verify', verifyTypeSync);

export default router;
