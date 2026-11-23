import gatewayService from '../services/gatewayService.js';
import dotfilesService from '../services/dotfilesService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const getConnectionInfo = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.protocol || 'http';
  const queryToken = req.query.token;

  const info = gatewayService.getConnectionInfo(workspaceId, host, protocol, queryToken);
  res.status(200).json(info);
});

export const createConnectToken = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const userId = req.user?.id || 'developer';

  const tokenData = gatewayService.generateConnectToken(workspaceId, userId);
  res.status(200).json({ success: true, ...tokenData });
});

export const syncDotfiles = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { dotfilesRepoUrl, branch } = req.body;

  if (!dotfilesRepoUrl) {
    return res.status(400).json({ success: false, error: 'dotfilesRepoUrl is required' });
  }

  const result = await dotfilesService.syncDotfiles({
    workspaceId,
    dotfilesRepoUrl,
    branch,
  });

  res.status(200).json(result);
});

export const getDotfilesStatus = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const status = await dotfilesService.getDotfilesStatus(workspaceId);
  res.status(200).json({ success: true, ...status });
});
