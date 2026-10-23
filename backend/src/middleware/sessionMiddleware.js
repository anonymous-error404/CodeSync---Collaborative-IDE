import { WorkspaceMember } from '../models/index.js';

/**
 * Session role middleware for education features.
 *
 * These checks are ADDITIVE to the existing workspace RBAC.
 * A user must already be a workspace member (verified via authenticateToken + requireWorkspaceMember)
 * before these checks apply.
 *
 * Session roles:
 *   teacher  — Full control over the session: start/end, focus mode, lock/unlock students, assign roles
 *   student  — Passive participant; can raise hand, be locked/unlocked by teacher
 *   none     — Not participating in any active session
 */

/**
 * Require that the requesting user has a specific sessionRole in the workspace.
 * Falls back gracefully if no session role is set.
 *
 * @param {'teacher'|'student'} requiredRole
 */
export function requireSessionRole(requiredRole) {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.id ?? req.params.workspaceId;
      const userId = req.user.id;

      if (!workspaceId) {
        return res.status(400).json({ success: false, error: 'Workspace ID is required' });
      }

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId },
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Not a member of this workspace' });
      }

      const isLeader = ['owner', 'admin', 'teacher'].includes(membership.role);
      if (membership.sessionRole !== requiredRole && !(requiredRole === 'teacher' && isLeader)) {
        return res.status(403).json({
          success: false,
          error: `Access denied: requires session role '${requiredRole}'. Your current session role is '${membership.sessionRole}'.`,
        });
      }

      req.membership = membership;
      next();
    } catch (err) {
      console.error('[Session RBAC Error]:', err);
      res.status(500).json({ success: false, error: 'Internal server error during session authorization' });
    }
  };
}

export const requireTeacher = requireSessionRole('teacher');
export const requireStudent  = requireSessionRole('student');
