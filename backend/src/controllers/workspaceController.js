import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import asyncWrapper from '../utils/asyncWrapper.js';
import { WorkspaceMember } from '../models/index.js';
import { checkPathLocked } from './lockController.js';

/**
 * POST /api/workspaces
 * Creates a new workspace.
 * Supports types: 'educational', 'professional', 'competitive'
 */
const createWorkspace = asyncWrapper(async (req, res) => {
  const { name, description, type } = req.body;
  const validTypes = ['educational', 'professional', 'competitive'];
  const workspaceType = validTypes.includes(type) ? type : 'educational';

  const workspace = await workspaceService.createWorkspace({
    name,
    description,
    type: workspaceType,
  });

  const initialRole =
    workspaceType === 'educational'
      ? 'teacher'
      : workspaceType === 'professional'
        ? 'team_leader'
        : 'owner';

  await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId: req.user.id,
    role: initialRole,
    studentAccess: workspaceType === 'educational' ? 'editor' : null,
  });

  res.status(201).json({
    success: true,
    workspace: {
      ...workspace,
      myRole: initialRole,
      studentAccess: workspaceType === 'educational' ? 'editor' : null,
    },
  });
});

/**
 * GET /api/workspaces
 * Lists all active workspaces for the current user
 */
const listWorkspaces = asyncWrapper(async (req, res) => {
  const memberships = await WorkspaceMember.findAll({
    where: { userId: req.user.id },
  });

  const allWorkspaces = await workspaceService.listWorkspaces();
  const memberMap = new Map(memberships.map(m => [m.workspaceId, m]));

  const workspaces = allWorkspaces
    .filter(w => memberMap.has(w.id))
    .map(w => {
      const m = memberMap.get(w.id);
      return {
        ...w,
        type: w.type || 'educational',
        myRole: m.role,
        studentAccess: m.studentAccess,
      };
    });

  res.status(200).json({ success: true, workspaces });
});

/**
 * GET /api/workspaces/:id
 * Fetches details and file tree for a workspace.
 */
const getWorkspaceDetails = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const details = await workspaceService.getWorkspaceDetails(id);
  const membership =
    req.membership ||
    (await WorkspaceMember.findOne({
      where: { workspaceId: id, userId: req.user?.id },
    }));

  res.status(200).json({
    success: true,
    ...details,
    workspace: {
      ...(details.workspace || {}),
      type: details.workspace?.type || 'educational',
      myRole: membership?.role || 'viewer',
      studentAccess: membership?.studentAccess || null,
    },
    myRole: membership?.role || 'viewer',
    studentAccess: membership?.studentAccess || null,
  });
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

  // In educational workspaces, no-view students cannot see file tree
  if (req.membership?.role === 'student' && req.membership?.studentAccess === 'no-view') {
    return res.status(200).json({ success: true, fileTree: [], restricted: true });
  }

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

  // In educational workspaces, no-view students cannot read file content
  if (req.membership?.role === 'student' && req.membership?.studentAccess === 'no-view') {
    return res.status(403).json({ success: false, error: 'Access restricted: Teacher has set your access to No-View' });
  }

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

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'Editing access restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Body parameter filePath is required' });
  }

  const lockCheck = await checkPathLocked(id, filePath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `File is locked by ${lockCheck.lock.lockedByName}` });
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

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File creation restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

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

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File deletion restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Query param filePath is required' });
  }

  const lockCheck = await checkPathLocked(id, filePath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `Cannot delete: locked by ${lockCheck.lock.lockedByName}` });
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

  if (req.membership?.role === 'student' && req.membership?.studentAccess !== 'editor') {
    return res.status(403).json({ success: false, error: 'File rename restricted by teacher' });
  }

  if (req.membership?.sessionRole === 'student' && req.membership?.editorLocked) {
    return res.status(403).json({ success: false, error: 'Your editor is locked by the teacher' });
  }

  if (!oldPath || !newPath) {
    return res.status(400).json({ success: false, error: 'Parameters oldPath and newPath are required' });
  }

  const lockCheck = await checkPathLocked(id, oldPath, req.user?.id);
  if (lockCheck.isLocked) {
    return res.status(423).json({ success: false, error: `Cannot rename: locked by ${lockCheck.lock.lockedByName}` });
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
