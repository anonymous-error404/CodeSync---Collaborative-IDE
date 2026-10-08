import { WorkspaceMember } from '../models/index.js';

const roleRanks = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function requireWorkspaceMember(minRole = 'viewer') {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.id;
      const userId = req.user.id;

      if (!workspaceId) {
        return res.status(400).json({ success: false, error: 'Workspace ID is required' });
      }

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId },
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Access denied: not a member of this workspace' });
      }

      if (roleRanks[membership.role] < roleRanks[minRole]) {
        return res.status(403).json({ success: false, error: `Access denied: requires ${minRole} role` });
      }

      req.membership = membership;
      next();
    } catch (error) {
      console.error('[RBAC Error]:', error);
      res.status(500).json({ success: false, error: 'Internal server error during authorization' });
    }
  };
}

export const requireWorkspaceOwner = requireWorkspaceMember('owner');
