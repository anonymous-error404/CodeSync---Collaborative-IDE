import { WorkspaceMember } from '../models/index.js';

export const roleRanks = {
  'no-view': 0,
  viewer: 1,
  student: 1, // base student rank (dynamic in middleware based on studentAccess)
  editor: 2,
  developer: 2,
  admin: 3,
  teacher: 4,
  team_leader: 4,
  owner: 4,
};

/**
 * Validates whether an actor with actorRole can assign newRole to a member with currentRole.
 * - owner, teacher, team_leader: full authority to assign roles within their workspace type
 * - admin: can assign editor, viewer, student, or developer; cannot alter or create owners/teachers/team_leaders
 * - editor/viewer/student: cannot change any roles
 */
export function canManageMemberRole(actorRole, currentRole, newRole) {
  if (['owner', 'teacher', 'team_leader'].includes(actorRole)) return true;
  if (actorRole === 'admin') {
    // Cannot touch owners, admins, teachers, or team leaders
    if (['owner', 'admin', 'teacher', 'team_leader'].includes(currentRole)) return false;
    // Cannot promote to admin, owner, teacher, or team leader
    if (['owner', 'admin', 'teacher', 'team_leader'].includes(newRole)) return false;
    // Can only manage between regular member roles
    return ['editor', 'viewer', 'student', 'developer'].includes(newRole);
  }
  return false;
}

/**
 * Validates whether an actor with actorRole can remove a member with targetRole.
 * - owner, teacher, team_leader: can remove subordinate roles
 * - admin: can remove editor, viewer, student, developer
 * - editor/viewer/student: cannot remove anyone
 */
export function canRemoveMember(actorRole, targetRole) {
  if (['owner', 'teacher', 'team_leader'].includes(actorRole)) {
    // Cannot remove owner unless self-transfer
    return targetRole !== 'owner';
  }
  if (actorRole === 'admin') {
    return !['owner', 'admin', 'teacher', 'team_leader'].includes(targetRole);
  }
  return false;
}

/**
 * Validates whether an actor with actorRole can create an invite with inviteRole.
 */
export function canCreateInviteRole(actorRole, inviteRole) {
  if (['owner', 'teacher', 'team_leader'].includes(inviteRole)) return false; // Leadership roles cannot be claimed via invite link
  if (['owner', 'admin', 'teacher', 'team_leader'].includes(actorRole)) {
    return ['admin', 'editor', 'viewer', 'student', 'developer'].includes(inviteRole);
  }
  if (['editor', 'developer'].includes(actorRole)) {
    return ['editor', 'viewer', 'developer'].includes(inviteRole);
  }
  return false;
}

export function requireWorkspaceMember(minRole = 'viewer') {
  return async (req, res, next) => {
    try {
      const workspaceId =
        req.params.id ||
        req.params.workspaceId ||
        req.body?.workspaceId ||
        req.query?.workspaceId;
      const userId = req.user?.id;

      if (!workspaceId) {
        return res.status(400).json({ success: false, error: 'Workspace ID is required' });
      }

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId },
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }

      let userRank = roleRanks[membership.role] ?? 0;

      // In Educational workspaces, resolve student rank from studentAccess
      if (membership.role === 'student') {
        const access = membership.studentAccess || 'viewer';
        if (access === 'no-view') {
          userRank = 0;
        } else if (access === 'editor') {
          userRank = 2;
        } else {
          userRank = 1;
        }
      }

      const requiredRank = roleRanks[minRole] ?? 1;

      if (userRank < requiredRank) {
        const msg = membership.role === 'student' && membership.studentAccess === 'no-view'
          ? 'Access restricted: Teacher has set your access to No-View'
          : `Access denied: requires at least '${minRole}' role (current: '${membership.role}')`;
        return res.status(403).json({
          success: false,
          error: msg,
        });
      }

      // Check editorLock for students when editor permission is required
      if (requiredRank >= 2 && membership.role === 'student' && membership.editorLocked) {
        return res.status(403).json({
          success: false,
          error: 'Your editor is locked by the teacher',
        });
      }

      req.membership = membership;
      req.workspaceRole = membership.role;
      next();
    } catch (error) {
      console.error('[RBAC Error]:', error);
      res.status(500).json({ success: false, error: 'Internal server error during authorization' });
    }
  };
}

export const requireWorkspaceViewer = requireWorkspaceMember('viewer');
export const requireWorkspaceEditor = requireWorkspaceMember('editor');
export const requireWorkspaceAdmin  = requireWorkspaceMember('admin');
export const requireWorkspaceOwner  = requireWorkspaceMember('owner');
