const path = require('path');
const { STORAGE_ROOT } = require('../config/workspaceConfig');

/**
 * Resolves the absolute directory path of a workspace.
 * @param {string} workspaceId 
 * @returns {string} Absolute path to the workspace directory.
 */
function getWorkspacePath(workspaceId) {
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Invalid workspace ID');
  }
  // Sanitize workspaceId 
  const sanitizedId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
  const workspacePath = path.resolve(STORAGE_ROOT, sanitizedId);

  // Security check
  if (!workspacePath.startsWith(STORAGE_ROOT)) {
    throw new Error('Access denied: Invalid workspace path');
  }

  return workspacePath;
}

/**
 * Resolves and validates a relative file path within a specific workspace.
 * Prevents directory traversal security exploits (e.g., ../ attempts).
 * @param {string} workspaceId 
 * @param {string} relativePath 
 * @returns {string} Absolute path to the target file/folder inside the workspace.
 */
function resolveSafePath(workspaceId, relativePath = '') {
  const workspaceDir = getWorkspacePath(workspaceId);

  // Normalize and resolve path
  const normalizedRelative = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const targetPath = path.resolve(workspaceDir, normalizedRelative);

  // Enforce boundary check
  if (!targetPath.startsWith(workspaceDir)) {
    throw new Error('Security Violation: Path traversal outside workspace boundary is forbidden');
  }

  return targetPath;
}

module.exports = {
  getWorkspacePath,
  resolveSafePath
};
