import { WorkspaceLock, WorkspaceMember, User } from '../models/index.js';
import workspaceService from '../services/workspaceService.js';

/**
 * Check if a user has permission to lock/unlock resources.
 * Only Admins/Owners and Editors have locking access.
 */
function canUserLock(member, workspaceType) {
  if (!member) return false;
  const role = member.role;
  const studentAccess = member.studentAccess;

  // Global admin roles across workspace types
  if (['owner', 'admin', 'teacher', 'team_leader'].includes(role)) {
    return true;
  }

  // Any member with an editor role or editor student access
  if (role === 'editor' || studentAccess === 'editor') {
    return true;
  }

  // In professional workspaces, developer roles with editor privileges
  if (workspaceType === 'professional' && (role === 'editor' || role === 'admin' || role === 'developer')) {
    return true;
  }

  return false;
}

/**
 * List all locks in a workspace.
 */
export async function getWorkspaceLocks(req, res) {
  try {
    const { id: workspaceId } = req.params;
    const locks = await WorkspaceLock.findAll({
      where: { workspaceId },
      include: [
        {
          model: User,
          as: 'locker',
          attributes: ['id', 'username', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, locks });
  } catch (err) {
    console.error('[Lock Error] getWorkspaceLocks:', err);
    return res.status(500).json({ error: 'Failed to retrieve workspace locks' });
  }
}

/**
 * Create a new lock (file, folder, or code_block).
 */
export async function createLock(req, res) {
  try {
    const { id: workspaceId } = req.params;
    const { lockType, targetPath, startLine, endLine, reason } = req.body;

    if (!lockType || !targetPath) {
      return res.status(400).json({ error: 'lockType and targetPath are required' });
    }

    if (!['file', 'folder', 'code_block'].includes(lockType)) {
      return res.status(400).json({ error: 'Invalid lockType. Must be file, folder, or code_block' });
    }

    const member = await WorkspaceMember.findOne({
      where: { workspaceId, userId: req.user.id },
    });

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    const config = await workspaceService.getWorkspace(workspaceId);
    const workspaceType = config?.type || 'professional';

    if (!canUserLock(member, workspaceType)) {
      return res.status(403).json({
        error: 'Only Admins and Editors can lock files, folders, or code blocks',
      });
    }

    // Check for existing overlapping locks on the exact same target
    const existing = await WorkspaceLock.findOne({
      where: { workspaceId, targetPath, lockType },
    });

    if (existing) {
      if (existing.lockedBy === req.user.id) {
        return res.json({ success: true, lock: existing, message: 'You already have this locked' });
      }
      return res.status(409).json({
        error: `Already locked by ${existing.lockedByName}`,
        lockedBy: existing.lockedByName,
      });
    }

    const lock = await WorkspaceLock.create({
      workspaceId,
      lockType,
      targetPath: targetPath.replace(/\\/g, '/'),
      startLine: startLine ? Number(startLine) : null,
      endLine: endLine ? Number(endLine) : null,
      lockedBy: req.user.id,
      lockedByName: req.user.username || 'User',
      reason: reason || null,
    });

    return res.status(201).json({ success: true, lock });
  } catch (err) {
    console.error('[Lock Error] createLock:', err);
    return res.status(500).json({ error: 'Failed to create lock' });
  }
}

/**
 * Remove an existing lock.
 */
export async function deleteLock(req, res) {
  try {
    const { id: workspaceId, lockId } = req.params;

    const lock = await WorkspaceLock.findOne({
      where: { id: lockId, workspaceId },
    });

    if (!lock) {
      return res.status(404).json({ error: 'Lock not found' });
    }

    const member = await WorkspaceMember.findOne({
      where: { workspaceId, userId: req.user.id },
    });

    const isAdmin = member && ['owner', 'admin', 'teacher', 'team_leader'].includes(member.role);
    const isLocker = lock.lockedBy === req.user.id;

    if (!isLocker && !isAdmin) {
      return res.status(403).json({
        error: 'Only the member who created the lock or an Admin can remove it',
      });
    }

    await lock.destroy();
    return res.json({ success: true, message: 'Lock released successfully' });
  } catch (err) {
    console.error('[Lock Error] deleteLock:', err);
    return res.status(500).json({ error: 'Failed to release lock' });
  }
}

/**
 * Helper to check if a file path or folder is locked for a specific user.
 */
export async function checkPathLocked(workspaceId, filePath, userId) {
  const normPath = filePath.replace(/\\/g, '/');
  const locks = await WorkspaceLock.findAll({ where: { workspaceId } });

  for (const lock of locks) {
    // If the lock belongs to the user, it is not locked for them
    if (lock.lockedBy === userId) continue;

    // Direct file lock match
    if (lock.lockType === 'file' && lock.targetPath === normPath) {
      return { isLocked: true, lock };
    }

    // Folder lock match (targetPath is a directory ancestor)
    if (lock.lockType === 'folder') {
      const folderPrefix = lock.targetPath.endsWith('/') ? lock.targetPath : `${lock.targetPath}/`;
      if (normPath.startsWith(folderPrefix) || normPath === lock.targetPath) {
        return { isLocked: true, lock };
      }
    }
  }

  return { isLocked: false, lock: null };
}
