import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import asyncWrapper from '../utils/asyncWrapper.js';

/**
 * POST /api/workspaces
 * Creates a new workspace.
 */
const createWorkspace = asyncWrapper(async (req, res) => {
  const { name, description } = req.body;
  const workspace = await workspaceService.createWorkspace({ name, description });
  res.status(201).json({ success: true, workspace });
});

/**
 * GET /api/workspaces
 * Lists all active workspaces (scans disk to recover persisted ones).
 */
const listWorkspaces = asyncWrapper(async (req, res) => {
  const workspaces = await workspaceService.listWorkspaces();
  res.status(200).json({ success: true, workspaces });
});

/**
 * GET /api/workspaces/:id
 * Fetches details and file tree for a workspace.
 */
const getWorkspaceDetails = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const details = await workspaceService.getWorkspaceDetails(id);
  res.status(200).json({ success: true, ...details });
});

/**
 * DELETE /api/workspaces/:id
 * Deletes a workspace and its files.
 */
const deleteWorkspace = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  await workspaceService.deleteWorkspace(id);
  res.status(200).json({ success: true, message: `Workspace ${id} deleted successfully` });
});

/**
 * GET /api/workspaces/:id/files/tree
 * Fetches the file tree of a workspace.
 */
const getFileTree = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const fileTree = await storageService.getFileTree(id);
  res.status(200).json({ success: true, fileTree });
});

/**
 * GET /api/workspaces/:id/files/content
 * Reads a specific file content.
 */
const readFileContent = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Query param filePath is required' });
  }

  const fileData = await storageService.readFile(id, filePath);
  res.status(200).json({ success: true, ...fileData });
});

/**
 * PUT /api/workspaces/:id/files/content
 * Saves/writes content to a file.
 */
const saveFileContent = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath, content } = req.body;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Body parameter filePath is required' });
  }

  const result = await storageService.writeFile(id, filePath, content);
  res.status(200).json({ success: true, ...result });
});

/**
 * POST /api/workspaces/:id/files
 * Creates a new file or directory.
 */
const createItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath, isDirectory } = req.body;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Body parameter filePath is required' });
  }

  const item = await storageService.createItem(id, filePath, !!isDirectory);
  res.status(201).json({ success: true, item });
});

/**
 * DELETE /api/workspaces/:id/files
 * Deletes a file or directory.
 */
const deleteItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Query param filePath is required' });
  }

  const result = await storageService.deleteItem(id, filePath);
  res.status(200).json({ success: true, ...result });
});

/**
 * POST /api/workspaces/:id/files/rename
 * Renames a file or directory.
 */
const renameItem = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { oldPath, newPath } = req.body;

  if (!oldPath || !newPath) {
    return res.status(400).json({ success: false, error: 'Parameters oldPath and newPath are required' });
  }

  const result = await storageService.renameItem(id, oldPath, newPath);
  res.status(200).json({ success: true, ...result });
});

export {
  createWorkspace,
  listWorkspaces,
  getWorkspaceDetails,
  deleteWorkspace,
  getFileTree,
  readFileContent,
  saveFileContent,
  createItem,
  deleteItem,
  renameItem
};
