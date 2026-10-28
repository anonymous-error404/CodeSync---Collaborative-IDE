import gitService, { getWorkspaceGitMeta, saveWorkspaceGitMeta } from '../services/gitService.js';
import { User } from '../models/index.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const cloneRepo = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { repoUrl, branch, token, username, authorName, authorEmail } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ success: false, error: 'Repository URL is required' });
  }

  // Resolve token: provided token -> user's saved githubToken
  const resolvedToken = token || req.user?.githubToken || null;
  const resolvedUser = username || req.user?.githubUsername || req.user?.username || null;
  const resolvedAuthor = authorName || req.user?.username || null;
  const resolvedEmail = authorEmail || req.user?.email || null;

  const result = await gitService.cloneRepo({
    workspaceId,
    repoUrl,
    branch,
    token: resolvedToken,
    username: resolvedUser,
    authorName: resolvedAuthor,
    authorEmail: resolvedEmail,
  });

  res.status(200).json(result);
});

export const getStatus = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const status = await gitService.getStatus(workspaceId);
  res.status(200).json({ success: true, ...status });
});

export const initRepo = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { authorName, authorEmail, initialBranch } = req.body;

  const result = await gitService.initRepo({
    workspaceId,
    authorName: authorName || req.user?.username,
    authorEmail: authorEmail || req.user?.email,
    initialBranch,
  });

  res.status(200).json(result);
});

export const commit = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { message, files, authorName, authorEmail } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Commit message is required' });
  }

  const result = await gitService.commit({
    workspaceId,
    message,
    files,
    authorName: authorName || req.user?.username,
    authorEmail: authorEmail || req.user?.email,
  });

  res.status(200).json(result);
});

export const push = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { remote, branch, token, username, force } = req.body;

  const resolvedToken = token || req.user?.githubToken || null;
  const resolvedUser = username || req.user?.githubUsername || req.user?.username || null;

  const result = await gitService.push({
    workspaceId,
    remote: remote || 'origin',
    branch,
    token: resolvedToken,
    username: resolvedUser,
    force: Boolean(force),
  });

  res.status(200).json(result);
});

export const pull = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { remote, branch, token, username } = req.body;

  const resolvedToken = token || req.user?.githubToken || null;
  const resolvedUser = username || req.user?.githubUsername || req.user?.username || null;

  const result = await gitService.pull({
    workspaceId,
    remote: remote || 'origin',
    branch,
    token: resolvedToken,
    username: resolvedUser,
  });

  res.status(200).json(result);
});

export const getBranches = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const result = await gitService.getBranches(workspaceId);
  res.status(200).json({ success: true, ...result });
});

export const checkoutBranch = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { branchName, createNew } = req.body;

  if (!branchName) {
    return res.status(400).json({ success: false, error: 'Branch name is required' });
  }

  const result = await gitService.checkoutBranch({
    workspaceId,
    branchName,
    createNew: Boolean(createNew),
  });

  res.status(200).json(result);
});

export const getDiff = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const filePath = req.query.filePath || null;
  const staged = req.query.staged === 'true';

  const result = await gitService.getDiff({
    workspaceId,
    filePath,
    staged,
  });

  res.status(200).json(result);
});

export const stageFile = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { filePath, unstage } = req.body;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'filePath is required' });
  }

  const result = await gitService.stageFile({
    workspaceId,
    filePath,
    unstage: Boolean(unstage),
  });

  res.status(200).json(result);
});

export const discardChanges = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'filePath is required' });
  }

  const result = await gitService.discardChanges({
    workspaceId,
    filePath,
  });

  res.status(200).json(result);
});

export const getCredentials = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const meta = await getWorkspaceGitMeta(workspaceId);

  const hasToken = Boolean(meta.token || req.user?.githubToken);
  res.status(200).json({
    success: true,
    hasToken,
    username: meta.username || req.user?.githubUsername || '',
    authorName: meta.authorName || req.user?.username || '',
    authorEmail: meta.authorEmail || req.user?.email || '',
    repoUrl: meta.repoUrl || '',
  });
});

export const saveCredentials = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { token, username, authorName, authorEmail, saveToUser } = req.body;

  const dataToSave = {};
  if (token !== undefined) dataToSave.token = token;
  if (username !== undefined) dataToSave.username = username;
  if (authorName !== undefined) dataToSave.authorName = authorName;
  if (authorEmail !== undefined) dataToSave.authorEmail = authorEmail;

  await saveWorkspaceGitMeta(workspaceId, dataToSave);

  if (saveToUser && req.user?.id) {
    const user = await User.findByPk(req.user.id);
    if (user) {
      if (token) user.githubToken = token;
      if (username) user.githubUsername = username;
      await user.save();
    }
  }

  res.status(200).json({ success: true, message: 'Git credentials saved' });
});

export const saveUserGithubToken = asyncWrapper(async (req, res) => {
  const { token, username } = req.body;
  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const user = await User.findByPk(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  user.githubToken = token ? token.trim() : null;
  if (username) user.githubUsername = username.trim();
  await user.save();

  res.status(200).json({
    success: true,
    message: token ? 'GitHub token saved successfully' : 'GitHub token cleared',
    hasGithubToken: Boolean(user.githubToken),
  });
});
