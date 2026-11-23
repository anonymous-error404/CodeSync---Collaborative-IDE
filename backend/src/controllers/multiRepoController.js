import multiRepoService from '../services/multiRepoService.js';
import crossRepoTypeService from '../services/crossRepoTypeService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const listMountedRepos = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const repos = await multiRepoService.listRepos(workspaceId);
  res.status(200).json({ success: true, repositories: repos });
});

export const mountRepo = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { repoUrl, targetFolder, branch, token, username } = req.body;

  const result = await multiRepoService.mountRepo({
    workspaceId,
    repoUrl,
    targetFolder,
    branch,
    token,
    username,
  });

  res.status(200).json(result);
});

export const unmountRepo = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const repoId = req.params.repoId;

  const result = await multiRepoService.unmountRepo(workspaceId, repoId);
  res.status(200).json(result);
});

export const detectTypeMesh = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const mesh = await crossRepoTypeService.detectTypeMesh(workspaceId);
  res.status(200).json({ success: true, mesh });
});

export const linkTypeMesh = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const result = await crossRepoTypeService.linkTypeMesh(workspaceId);
  res.status(200).json(result);
});

export const verifyTypeSync = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const verification = await crossRepoTypeService.verifyTypeSync(workspaceId);
  res.status(200).json({ success: true, verification });
});
