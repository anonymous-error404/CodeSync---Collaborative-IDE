import { WorkspaceMember, User } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import { canManageMemberRole, canRemoveMember } from '../middleware/rbacMiddleware.js';

export const getMembers = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const members = await WorkspaceMember.findAll({
    where: { workspaceId: id },
    include: [{ model: User, attributes: ['id', 'username', 'email'] }],
  });
  res.status(200).json({ success: true, members });
});

export const updateMemberRole = asyncWrapper(async (req, res) => {
  const { id, userId } = req.params;
  const { role, studentAccess } = req.body;

  if (req.user.id.toString() === userId) {
    return res.status(400).json({ success: false, error: 'Cannot change your own role' });
  }

  const validRoles = ['owner', 'admin', 'editor', 'viewer', 'teacher', 'student', 'team_leader', 'developer', 'tester', 'team_member'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  const member = await WorkspaceMember.findOne({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  const actorRole = req.membership?.role || 'viewer';

  if (role) {
    if (!canManageMemberRole(actorRole, member.role, role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: role '${actorRole}' cannot change a '${member.role}' to '${role}'`,
      });
    }
    member.role = role;
    if (role === 'viewer' || role === 'tester') {
      member.studentAccess = 'viewer';
    } else if (role === 'editor' || role === 'developer' || role === 'team_member') {
      member.studentAccess = 'editor';
    }
  }

  if (studentAccess && ['viewer', 'editor', 'view', 'edit', 'comment', 'commenter'].includes(studentAccess)) {
    if (!['teacher', 'owner', 'admin', 'team_leader'].includes(actorRole)) {
      return res.status(403).json({ success: false, error: 'Only teachers or workspace admins can assign access levels' });
    }
    member.studentAccess =
      (studentAccess === 'comment' || studentAccess === 'commenter') ? 'commenter' :
      (studentAccess === 'edit' || studentAccess === 'editor') ? 'editor' : 'viewer';
  }

  await member.save();

  res.status(200).json({ success: true, member });
});

export const updateStudentAccess = asyncWrapper(async (req, res) => {
  const { id, userId } = req.params;
  const { access } = req.body; // 'viewer' | 'commenter' | 'editor' | 'view' | 'comment' | 'edit'

  const validAccess = ['viewer', 'editor', 'view', 'edit', 'comment', 'commenter'];
  if (!validAccess.includes(access)) {
    return res.status(400).json({ success: false, error: 'Invalid access level. Must be view, comment, or edit' });
  }

  const normalizedAccess =
    (access === 'comment' || access === 'commenter') ? 'commenter' :
    (access === 'edit' || access === 'editor') ? 'editor' : 'viewer';

  const actorRole = req.membership?.role;
  if (!['teacher', 'owner', 'admin', 'team_leader'].includes(actorRole)) {
    return res.status(403).json({ success: false, error: 'Only teachers or workspace admins can assign access levels' });
  }

  // Admin/teacher cannot change their own access level
  if (req.user.id.toString() === userId.toString()) {
    return res.status(400).json({ success: false, error: 'Admins cannot change their own access levels' });
  }

  const member = await WorkspaceMember.findOne({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  // Nobody can change the workspace owner/admin's access control
  if (['owner', 'admin', 'team_leader'].includes(member.role)) {
    return res.status(400).json({ success: false, error: 'Cannot modify access level of workspace admin/owner' });
  }

  // Teachers (other than owner) can only modify students; only owner/admin can modify teacher access
  const isActorOwner = actorRole === 'owner' || actorRole === 'admin';
  if (member.role === 'teacher' && !isActorOwner) {
    return res.status(403).json({ success: false, error: 'Only workspace admin can modify teacher access control' });
  }

  member.studentAccess = normalizedAccess;
  await member.save();

  res.status(200).json({ success: true, member });
});

export const updateBulkStudentAccess = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { userIds, access } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, error: 'userIds array is required' });
  }

  const validAccess = ['viewer', 'editor', 'view', 'edit', 'comment', 'commenter'];
  if (!validAccess.includes(access)) {
    return res.status(400).json({ success: false, error: 'Invalid access level. Must be view, comment, or edit' });
  }

  const normalizedAccess =
    (access === 'comment' || access === 'commenter') ? 'commenter' :
    (access === 'edit' || access === 'editor') ? 'editor' : 'viewer';

  const actorRole = req.membership?.role;
  if (!['teacher', 'owner', 'admin', 'team_leader'].includes(actorRole)) {
    return res.status(403).json({ success: false, error: 'Only teachers or workspace admins can assign access levels' });
  }

  const isActorOwner = actorRole === 'owner' || actorRole === 'admin';

  const members = await WorkspaceMember.findAll({
    where: {
      workspaceId: id,
      userId: userIds,
    },
  });

  const validMembers = members.filter(m => {
    if (m.userId.toString() === req.user.id.toString()) return false;
    if (['owner', 'admin', 'team_leader'].includes(m.role)) return false;
    if (m.role === 'teacher' && !isActorOwner) return false;
    return true;
  });

  if (validMembers.length === 0) {
    return res.status(400).json({ success: false, error: 'No eligible members found to update' });
  }

  const validIds = validMembers.map(m => m.userId);
  await WorkspaceMember.update(
    { studentAccess: normalizedAccess },
    { where: { workspaceId: id, userId: validIds } }
  );

  res.status(200).json({
    success: true,
    updatedCount: validIds.length,
    updatedUserIds: validIds,
    studentAccess: normalizedAccess,
  });
});

export const removeMember = asyncWrapper(async (req, res) => {
  const { id, userId } = req.params;

  if (req.user.id.toString() === userId) {
    return res.status(400).json({ success: false, error: 'Cannot remove yourself' });
  }

  const member = await WorkspaceMember.findOne({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  const actorRole = req.membership?.role || 'viewer';
  if (!canRemoveMember(actorRole, member.role)) {
    return res.status(403).json({
      success: false,
      error: `Access denied: role '${actorRole}' cannot remove a '${member.role}'`,
    });
  }

  await member.destroy();

  res.status(200).json({ success: true, message: 'Member removed successfully' });
});

export const leaveWorkspace = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const membership = req.membership;

  if (['owner', 'teacher'].includes(membership.role)) {
    const leaderCount = await WorkspaceMember.count({
      where: { workspaceId: id, role: membership.role },
    });

    if (leaderCount <= 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot leave: you are the sole ${membership.role}. Transfer ownership or delete the workspace.`,
      });
    }
  }

  await membership.destroy();

  res.status(200).json({ success: true, message: 'You have left the workspace' });
});
