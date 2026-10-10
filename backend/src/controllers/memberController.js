import { WorkspaceMember, User } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';

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
  const { role } = req.body;

  if (req.user.id.toString() === userId) {
    return res.status(400).json({ success: false, error: 'Cannot change your own role' });
  }

  const member = await WorkspaceMember.findOne({
    where: { workspaceId: id, userId },
  });

  if (!member) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  if (!['owner', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  member.role = role;
  await member.save();

  res.status(200).json({ success: true, member });
});

export const removeMember = asyncWrapper(async (req, res) => {
  const { id, userId } = req.params;

  if (req.user.id.toString() === userId) {
    return res.status(400).json({ success: false, error: 'Cannot remove yourself' });
  }

  const deleted = await WorkspaceMember.destroy({
    where: { workspaceId: id, userId },
  });

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Member not found' });
  }

  res.status(200).json({ success: true, message: 'Member removed successfully' });
});

export const leaveWorkspace = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const membership = req.membership;

  if (membership.role === 'owner') {
    const ownerCount = await WorkspaceMember.count({
      where: { workspaceId: id, role: 'owner' },
    });

    if (ownerCount <= 1) {
      return res.status(400).json({ success: false, error: 'Cannot leave as the only owner' });
    }
  }

  await WorkspaceMember.destroy({
    where: { workspaceId: id, userId },
  });

  res.status(200).json({ success: true, message: 'Successfully left the workspace' });
});
