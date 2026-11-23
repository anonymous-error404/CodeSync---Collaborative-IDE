import databaseBranchService from '../services/databaseBranchService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

export const initBranch = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { provider } = req.body;
  const result = await databaseBranchService.initDatabaseBranch(workspaceId, provider);
  res.status(200).json(result);
});

export const getBranchStatus = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const status = await databaseBranchService.getBranchStatus(workspaceId);
  res.status(200).json(status);
});

export const resetBranch = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const result = await databaseBranchService.resetBranch(workspaceId);
  res.status(200).json(result);
});

export const executeQuery = asyncWrapper(async (req, res) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const { sql } = req.body;
  const result = await databaseBranchService.executeQuery(workspaceId, sql);
  res.status(200).json(result);
});
