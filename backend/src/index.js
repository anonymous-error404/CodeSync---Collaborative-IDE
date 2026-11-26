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
import credentialRoutes from './routes/credentialRoutes.js';
import goldenPathRoutes from './routes/goldenPathRoutes.js';

import initWorkspaceSockets from './sockets/workspaceSocket.js';
import workspaceService from './services/workspaceService.js';
import storageService from './services/storageService.js';
import executionService from './services/executionService.js';
import universalPreviewService from './services/universalPreviewService.js';
import credentialBrokerService from './services/credentialBrokerService.js';
import goldenPathOrchestratorService from './services/goldenPathOrchestratorService.js';

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
  credentialRoutes,
  goldenPathRoutes,
  initWorkspaceSockets,
  workspaceService,
  storageService,
  executionService,
  universalPreviewService,
  credentialBrokerService,
  goldenPathOrchestratorService,
  authenticateToken,
  googleRedirect,
  googleCallback,
};
