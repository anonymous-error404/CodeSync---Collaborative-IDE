import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';
import { requireTeacher } from '../middleware/sessionMiddleware.js';
import {
  startSession,
  endSession,
  getSession,
  assignSessionRole,
  toggleStudentLock,
  lockAllStudents,
  unlockAllStudents,
  setFocusMode,
  getMySessionRole,
} from '../controllers/sessionController.js';

const router = express.Router();

/**
 * Session Lifecycle
 * ─────────────────────────────────────────────────────────────────
 * POST   /workspaces/:id/session/start      editor+ → starts session, becomes teacher
 * POST   /workspaces/:id/session/end        teacher  → ends session, resets all roles
 * GET    /workspaces/:id/session            viewer+  → get current session state
 * GET    /workspaces/:id/session/my-role    viewer+  → get own session role
 */
router.post(
  '/workspaces/:id/session/start',
  authenticateToken,
  requireWorkspaceMember('editor'),   // workspace RBAC: at least editor to start a session
  startSession
);

router.post(
  '/workspaces/:id/session/end',
  authenticateToken,
  requireTeacher,                     // session RBAC: must be the teacher
  endSession
);

router.get(
  '/workspaces/:id/session',
  authenticateToken,
  requireWorkspaceMember('viewer'),
  getSession
);

router.get(
  '/workspaces/:id/session/my-role',
  authenticateToken,
  requireWorkspaceMember('viewer'),
  getMySessionRole
);

/**
 * Teacher controls
 * ─────────────────────────────────────────────────────────────────
 * PATCH  /workspaces/:id/session/members/:userId/role   teacher → reassign session role
 * PATCH  /workspaces/:id/session/members/:userId/lock   teacher → lock/unlock individual student
 * POST   /workspaces/:id/session/lock-all               teacher → lock all students
 * POST   /workspaces/:id/session/unlock-all             teacher → unlock all students
 * PATCH  /workspaces/:id/session/focus                  teacher → toggle focus mode / pin file
 */
router.patch(
  '/workspaces/:id/session/members/:userId/role',
  authenticateToken,
  requireTeacher,
  assignSessionRole
);

router.patch(
  '/workspaces/:id/session/members/:userId/lock',
  authenticateToken,
  requireTeacher,
  toggleStudentLock
);

router.post(
  '/workspaces/:id/session/lock-all',
  authenticateToken,
  requireTeacher,
  lockAllStudents
);

router.post(
  '/workspaces/:id/session/unlock-all',
  authenticateToken,
  requireTeacher,
  unlockAllStudents
);

router.patch(
  '/workspaces/:id/session/focus',
  authenticateToken,
  requireTeacher,
  setFocusMode
);

export default router;
