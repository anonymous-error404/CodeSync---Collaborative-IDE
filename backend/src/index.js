import workspaceRoutes from './routes/workspaceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import whiteboardRoutes from './routes/whiteboardRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import professionalRoutes from './routes/professionalRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import previewRoutes from './routes/previewRoutes.js';
import gitRoutes from './routes/gitRoutes.js';
import gatewayRoutes from './routes/gatewayRoutes.js';
import warmPoolRoutes from './routes/warmPoolRoutes.js';
import databaseBranchRoutes from './routes/databaseBranchRoutes.js';
import multiRepoRoutes from './routes/multiRepoRoutes.js';
import initWorkspaceSockets from './sockets/workspaceSocket.js';
import workspaceService from './services/workspaceService.js';
import storageService from './services/storageService.js';
import executionService from './services/executionService.js';
import gatewayService from './services/gatewayService.js';
import dotfilesService from './services/dotfilesService.js';
import warmPoolService from './services/warmPoolService.js';
import databaseBranchService from './services/databaseBranchService.js';
import multiRepoService from './services/multiRepoService.js';
import crossRepoTypeService from './services/crossRepoTypeService.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { googleRedirect, googleCallback } from './controllers/oauthController.js';

export {
  workspaceRoutes,
  authRoutes,
  memberRoutes,
  inviteRoutes,
  whiteboardRoutes,
  sessionRoutes,
  professionalRoutes,
  commentRoutes,
  previewRoutes,
  gitRoutes,
  gatewayRoutes,
  warmPoolRoutes,
  databaseBranchRoutes,
  multiRepoRoutes,
  initWorkspaceSockets,
  workspaceService,
  storageService,
  executionService,
  gatewayService,
  dotfilesService,
  warmPoolService,
  databaseBranchService,
  multiRepoService,
  crossRepoTypeService,
  authenticateToken,
  googleRedirect,
  googleCallback
};

