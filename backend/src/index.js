import workspaceRoutes from './routes/workspaceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import initWorkspaceSockets from './sockets/workspaceSocket.js';
import workspaceService from './services/workspaceService.js';
import storageService from './services/storageService.js';
import executionService from './services/executionService.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { googleRedirect, googleCallback } from './controllers/oauthController.js';

export {
  workspaceRoutes,
  authRoutes,
  memberRoutes,
  inviteRoutes,
  initWorkspaceSockets,
  workspaceService,
  storageService,
  executionService,
  authenticateToken,
  googleRedirect,
  googleCallback
};
