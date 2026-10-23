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

  const validRoles = ['owner', 'admin', 'editor', 'viewer', 'teacher', 'student', 'team_leader', 'developer'];
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
  }

  if (studentAccess && ['no-view', 'viewer', 'editor'].includes(studentAccess)) {
    if (!['teacher', 'owner', 'admin'].includes(actorRole)) {
      return res.status(403).json({ success: false, error: 'Only teachers or workspace admins can assign student access' });
    }
    member.studentAccess = studentAccess;
  }

  await member.save();

  res.status(200).json({ success: true, member });
});

export const updateStudentAccess = asyncWrapper(async (req, res) => {
  const { id, userId } = req.params;
  const { access } = req.body; // 'no-view' | 'viewer' | 'editor'

  const validAccess = ['no-view', 'viewer', 'editor'];
  if (!validAccess.includes(access)) {
    return res.status(400).json({ success: false, error: 'Invalid access level. Must be no-view, viewer, or editor' });
  }

  const actorRole = req.membership?.role;
  if (!['teacher', 'owner', 'admin'].includes(actorRole)) {
    return res.status(403).json({ success: false, error: 'Only teachers or workspace admins can assign student access' });
  }

  const member = await WorkspaceMember.findOne({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  member.studentAccess = access;
  await member.save();

  res.status(200).json({ success: true, member });
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
