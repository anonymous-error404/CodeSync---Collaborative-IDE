import warmPoolService from '../services/warmPoolService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const listSnapshots = asyncWrapper(async (req, res) => {
  const snapshots = await warmPoolService.listSnapshots();
  res.status(200).json({ success: true, snapshots });
});

export const triggerPrebuild = asyncWrapper(async (req, res) => {
  const { gitRepoUrl, branch, token, username } = req.body;
  if (!gitRepoUrl) {
    return res.status(400).json({ success: false, error: 'gitRepoUrl is required' });
  }

  const result = await warmPoolService.triggerPrebuild({
    gitRepoUrl,
    branch: branch || 'main',
    token,
    username,
  });

  res.status(200).json(result);
});

export const checkSnapshot = asyncWrapper(async (req, res) => {
  const { gitRepoUrl, branch } = req.query;
  const snapshot = await warmPoolService.getWarmSnapshot(gitRepoUrl, branch || 'main');
  res.status(200).json({ success: true, available: Boolean(snapshot), snapshot });
});
