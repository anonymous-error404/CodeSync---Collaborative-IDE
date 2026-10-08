import { WorkspaceInvite, WorkspaceMember, User } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import { FRONTEND_URL } from '../config/oauthConfig.js';
import workspaceService from '../services/workspaceService.js';
import { Op } from 'sequelize';

export const createInvite = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { role, expiresInHours, maxUses } = req.body;

  if (!['editor', 'viewer'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  let expiresAt = null;
  if (expiresInHours) {
    expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  }

  const invite = await WorkspaceInvite.create({
    workspaceId: id,
    createdBy: req.user.id,
    role,
    expiresAt,
    maxUses: maxUses || null,
  });

  res.status(201).json({
    success: true,
    invite: {
      ...invite.toJSON(),
      inviteUrl: `${FRONTEND_URL}/?join=${invite.id}`
    }
  });
});

export const getInvites = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  
  const invites = await WorkspaceInvite.findAll({
    where: { workspaceId: id, active: true },
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'email'] }]
  });

  res.status(200).json({ success: true, invites });
});

export const revokeInvite = asyncWrapper(async (req, res) => {
  const { id, inviteId } = req.params;

  const invite = await WorkspaceInvite.findOne({
    where: { id: inviteId, workspaceId: id },
  });

  if (!invite) {
    return res.status(404).json({ success: false, error: 'Invite not found' });
  }

  invite.active = false;
  await invite.save();

  res.status(200).json({ success: true, message: 'Invite revoked successfully' });
});

export const joinViaInvite = asyncWrapper(async (req, res) => {
  const { inviteId } = req.params;
  const userId = req.user.id;

  const invite = await WorkspaceInvite.findOne({
    where: { id: inviteId },
  });

  if (!invite) {
    return res.status(404).json({ success: false, error: 'Invite not found' });
  }

  if (!invite.active) {
    return res.status(400).json({ success: false, error: 'Invite is no longer active' });
  }

  if (invite.expiresAt && new Date() > invite.expiresAt) {
    return res.status(400).json({ success: false, error: 'Invite has expired' });
  }

  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return res.status(400).json({ success: false, error: 'Invite use limit reached' });
  }

  // Ensure workspace exists on disk or memory
  try {
    await workspaceService.getWorkspaceDetails(invite.workspaceId);
  } catch (err) {
    return res.status(404).json({ success: false, error: 'Workspace not found' });
  }

  const existingMember = await WorkspaceMember.findOne({
    where: { workspaceId: invite.workspaceId, userId },
  });

  if (!existingMember) {
    await WorkspaceMember.create({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
    });

    invite.usedCount += 1;
    await invite.save();
  }

  res.status(200).json({
    success: true,
    workspaceId: invite.workspaceId,
    role: existingMember ? existingMember.role : invite.role,
  });
});
