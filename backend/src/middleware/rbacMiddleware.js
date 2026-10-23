import { WorkspaceMember } from '../models/index.js';

export const roleRanks = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

/**
 * Validates whether an actor with actorRole can assign newRole to a member with currentRole.
 * - owner: can assign any role (owner, admin, editor, viewer)
 * - admin: can assign editor or viewer, but cannot alter owners or other admins, and cannot promote to admin/owner
 * - editor/viewer: cannot change any roles
 */
export function canManageMemberRole(actorRole, currentRole, newRole) {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    // Cannot touch owners or admins
    if (currentRole === 'owner' || currentRole === 'admin') return false;
    // Cannot promote to admin or owner
    if (newRole === 'owner' || newRole === 'admin') return false;
    // Can only manage between editor and viewer
    return newRole === 'editor' || newRole === 'viewer';
  }
  return false;
}

/**
 * Validates whether an actor with actorRole can remove a member with targetRole.
 * - owner: can remove admin, editor, viewer
 * - admin: can remove editor, viewer
 * - editor/viewer: cannot remove anyone
 */
export function canRemoveMember(actorRole, targetRole) {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') {
    return targetRole === 'editor' || targetRole === 'viewer';
  }
  return false;
}

/**
 * Validates whether an actor with actorRole can create an invite with inviteRole.
 * - owner/admin: can create admin, editor, viewer invites
 * - editor: can create editor, viewer invites
 * - viewer: cannot create invites
 */
export function canCreateInviteRole(actorRole, inviteRole) {
  if (inviteRole === 'owner') return false; // Ownership cannot be claimed via invite link
  if (actorRole === 'owner' || actorRole === 'admin') {
    return ['admin', 'editor', 'viewer'].includes(inviteRole);
  }
  if (actorRole === 'editor') {
    return ['editor', 'viewer'].includes(inviteRole);
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

      const userRank = roleRanks[membership.role] ?? 0;
      const requiredRank = roleRanks[minRole] ?? 1;

      if (userRank < requiredRank) {
        return res.status(403).json({
          success: false,
          error: `Access denied: requires at least '${minRole}' role (current: '${membership.role}')`,
        });
      }

      req.membership = membership;
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
