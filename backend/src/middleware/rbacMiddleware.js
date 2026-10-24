import { WorkspaceMember } from '../models/index.js';
import workspaceService from '../services/workspaceService.js';

export const roleRanks = {
  'no-view': 0,
  viewer: 1,
  student: 1, // base student rank (dynamic in middleware based on studentAccess)
  tester: 1,  // base tester rank (view access, dynamic in middleware)
  commenter: 1.5,
  editor: 2,
  developer: 2, // base developer rank (edit access, dynamic in middleware)
  team_member: 2, // competitive workspace team member has full edit access
  admin: 3,
  teacher: 4,
  team_leader: 4,
  owner: 4,
};

/**
 * Validates whether an actor with actorRole can assign newRole to a member with currentRole.
 * - owner, teacher, team_leader: full authority to assign roles within their workspace type
 * - admin: can assign editor, viewer, student, developer, or tester; cannot alter or create owners/teachers/team_leaders
 * - editor/viewer/student: cannot change any roles
 */
export function canManageMemberRole(actorRole, currentRole, newRole) {
  if (['owner', 'teacher', 'team_leader'].includes(actorRole)) return true;
  if (actorRole === 'admin') {
    // In competitive workspaces, admin can manage team_member
    if (newRole === 'team_member') return true;
    // Cannot touch owners, admins, teachers, or team leaders
    if (['owner', 'admin', 'teacher', 'team_leader'].includes(currentRole)) return false;
    // Cannot promote to admin, owner, teacher, or team leader
    if (['owner', 'admin', 'teacher', 'team_leader'].includes(newRole)) return false;
    // Can only manage between regular member roles
    return ['editor', 'viewer', 'student', 'developer', 'tester', 'team_member'].includes(newRole);
  }
  return false;
}

/**
 * Validates whether an actor with actorRole can remove a member with targetRole.
 * - owner, teacher, team_leader: can remove subordinate roles
 * - admin: can remove editor, viewer, student, developer, tester, team_member
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
  // Only workspace owner/admin can invite a co-teacher
  if (inviteRole === 'teacher') {
    return ['owner', 'admin'].includes(actorRole);
  }
  // No one can claim owner or team_leader via invite
  if (['owner', 'team_leader'].includes(inviteRole)) return false;

  if (['owner', 'admin', 'teacher', 'team_leader'].includes(actorRole)) {
    return ['admin', 'editor', 'viewer', 'student', 'developer', 'tester', 'team_member'].includes(inviteRole);
  }
  if (['editor', 'developer'].includes(actorRole)) {
    return ['editor', 'viewer', 'developer', 'tester'].includes(inviteRole);
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

      let membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId },
      });

      const ws = await workspaceService.getWorkspace(workspaceId);
      const isCompetitive = ws?.type === 'competitive';

      // Auto-membership for competitive workspaces with allowed emails or global admin
      if (!membership && isCompetitive) {
        const userEmail = (req.user?.email || '').toLowerCase().trim();
        const allowed = (ws?.allowedEmails || []).map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''));
        const isCreator =
          (userId && ws?.createdBy === userId) ||
          (userEmail && (ws?.creatorEmail === userEmail || ws?.adminEmail === userEmail));

        if (isCreator) {
          membership = await WorkspaceMember.create({
            workspaceId,
            userId,
            role: 'admin',
            studentAccess: 'commenter',
          });
        } else if (userEmail && allowed.includes(userEmail)) {
          membership = await WorkspaceMember.create({
            workspaceId,
            userId,
            role: 'team_member',
            studentAccess: 'editor',
          });
        } else {
          // If user is admin in any competitive workspace, grant admin view+comment access
          const isAdminSomewhere = await WorkspaceMember.findOne({
            where: { userId, role: 'admin' },
          });
          if (isAdminSomewhere) {
            membership = await WorkspaceMember.create({
              workspaceId,
              userId,
              role: 'admin',
              studentAccess: 'commenter',
            });
          }
        }
      }

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }

      let userRank = roleRanks[membership.role] ?? 0;

      // In Competitive workspaces:
      // admin can view and comment only on code/files (editor level), but retains administrative authority for admin/management routes.
      // team_member has full edit access (userRank 2).
      if (isCompetitive) {
        if (membership.role === 'admin') {
          if (['editor', 'developer'].includes(minRole)) {
            userRank = 1.5; // view and comment only for editing
          } else {
            userRank = 3; // administrative rank
          }
        } else if (membership.role === 'team_member') {
          userRank = 2; // full edit access
        }
      }

      // In Educational workspaces, resolve student rank from studentAccess
      if (membership.role === 'student') {
        const access = membership.studentAccess || 'viewer';
        if (access === 'editor' || access === 'edit') {
          userRank = 2;
        } else if (access === 'comment' || access === 'commenter') {
          userRank = 1.5;
        } else {
          userRank = 1;
        }
      }

      // In Professional workspaces, resolve developer / tester rank from studentAccess
      if (membership.role === 'developer' || membership.role === 'tester') {
        const defaultAccess = membership.role === 'developer' ? 'editor' : 'viewer';
        const access = membership.studentAccess || defaultAccess;
        if (access === 'editor' || access === 'edit') {
          userRank = 2; // edit access
        } else if (access === 'comment' || access === 'commenter') {
          userRank = 1.5; // comment access
        } else {
          userRank = 1; // view access
        }
      }

      const requiredRank = roleRanks[minRole] ?? 1;

      if (userRank < requiredRank) {
        const msg = isCompetitive && membership.role === 'admin'
          ? 'Access restricted: Admin has View & Comment only access in competitive workspaces.'
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

/**
 * Middleware ensuring the user has owner or workspace-lead authority.
 * Across CodeSync:
 * - educational: teacher
 * - professional: team_leader
 * - competitive: admin
 * - default/collaborative: owner
 */
export const requireWorkspaceOwner = async (req, res, next) => {
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

    let membership = await WorkspaceMember.findOne({
      where: { workspaceId, userId },
    });

    const ws = await workspaceService.getWorkspace(workspaceId);
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const isCreator =
      (userId && ws?.createdBy === userId) ||
      (userEmail && (ws?.creatorEmail === userEmail || ws?.adminEmail === userEmail));

    if (isCreator) {
      if (!membership) {
        const leadRole = ws?.type === 'educational' ? 'teacher' : ws?.type === 'professional' ? 'team_leader' : 'admin';
        membership = { workspaceId, userId, role: leadRole };
      }
      req.membership = membership;
      req.workspaceRole = membership.role || 'admin';
      return next();
    }

    if (!membership && ws?.type === 'competitive') {
      const isAdminSomewhere = await WorkspaceMember.findOne({
        where: { userId, role: 'admin' },
      });
      if (isAdminSomewhere) {
        membership = { workspaceId, userId, role: 'admin' };
      }
    }

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
    }

    const ownerRoles = ['owner', 'teacher', 'team_leader', 'admin'];
    if (!ownerRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: requires owner or lead role (current: '${membership.role}')`,
      });
    }

    req.membership = membership;
    req.workspaceRole = membership.role;
    next();
  } catch (error) {
    console.error('[RBAC Error in requireWorkspaceOwner]:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authorization' });
  }
};

