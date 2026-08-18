const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { getWorkspacePath, resolveSafePath } = require('../utils/pathSandbox');
const { STORAGE_ROOT, DEFAULT_FILES, MAX_FILE_SIZE_BYTES } = require('../config/workspaceConfig');

class StorageService {
  /**
   * Initializes a new workspace directory in storage root with starter files.
   * @param {string} workspaceId 
   * @returns {Promise<string>} workspace directory path
   */
  async createWorkspaceDirectory(workspaceId) {
    const workspaceDir = getWorkspacePath(workspaceId);

    if (!fsSync.existsSync(workspaceDir)) {
      await fs.mkdir(workspaceDir, { recursive: true });

      // Create default files
      for (const [filename, content] of Object.entries(DEFAULT_FILES)) {
        const filePath = path.join(workspaceDir, filename);
        await fs.writeFile(filePath, content, 'utf-8');
      }
    }

    return workspaceDir;
  }

  /**
   * Gets file tree structure of a workspace.
   * @param {string} workspaceId 
   * @param {string} relativeDir 
   * @returns {Promise<Array>} Tree node array
   */
  async getFileTree(workspaceId, relativeDir = '') {
    const targetDir = resolveSafePath(workspaceId, relativeDir);

    if (!fsSync.existsSync(targetDir)) {
      throw new Error(`Directory not found for workspace ${workspaceId}`);
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      // Ignore hidden files 
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const entryRelativePath = path.join(relativeDir, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await this.getFileTree(workspaceId, entryRelativePath);
        items.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'directory',
          children
        });
      } else {
        const fullPath = resolveSafePath(workspaceId, entryRelativePath);
        const stats = await fs.stat(fullPath);
        items.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'file',
          sizeBytes: stats.size,
          updatedAt: stats.mtime
        });
      }
    }

    // sort directories first, then files 
    return items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  }

  /**
   * Reads file content from a workspace file.
   * @param {string} workspaceId 
   * @param {string} relativePath 
   * @returns {Promise<{ content: string, path: string }>}
   */
  async readFile(workspaceId, relativePath) {
    const targetPath = resolveSafePath(workspaceId, relativePath);

    if (!fsSync.existsSync(targetPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${relativePath}`);
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File exceeds max size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    const content = await fs.readFile(targetPath, 'utf-8');
    return {
      path: relativePath.replace(/\\/g, '/'),
      content
    };
  }

  /**
   * Writes content to a workspace file.
   * @param {string} workspaceId 
   * @param {string} relativePath 
   * @param {string} content 
   */
  async writeFile(workspaceId, relativePath, content = '') {
    const targetPath = resolveSafePath(workspaceId, relativePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fsSync.existsSync(parentDir)) {
      await fs.mkdir(parentDir, { recursive: true });
    }

    await fs.writeFile(targetPath, content, 'utf-8');
    return { path: relativePath.replace(/\\/g, '/'), size: Buffer.byteLength(content, 'utf-8') };
  }

  /**
   * Creates a new file or directory inside a workspace.
   * @param {string} workspaceId 
   * @param {string} relativePath 
   * @param {boolean} isDirectory 
   */
  async createItem(workspaceId, relativePath, isDirectory = false) {
    const targetPath = resolveSafePath(workspaceId, relativePath);

    if (fsSync.existsSync(targetPath)) {
      throw new Error(`Item already exists at path: ${relativePath}`);
    }

    if (isDirectory) {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      const parentDir = path.dirname(targetPath);
      if (!fsSync.existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }
      await fs.writeFile(targetPath, '', 'utf-8');
    }

    return {
      path: relativePath.replace(/\\/g, '/'),
      type: isDirectory ? 'directory' : 'file'
    };
  }

  /**
   * Deletes a file or folder from a workspace.
   * @param {string} workspaceId 
   * @param {string} relativePath 
   */
  async deleteItem(workspaceId, relativePath) {
    const targetPath = resolveSafePath(workspaceId, relativePath);

    if (!fsSync.existsSync(targetPath)) {
      throw new Error(`Item does not exist: ${relativePath}`);
    }

    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.unlink(targetPath);
    }

    return { path: relativePath.replace(/\\/g, '/') };
  }

  /**
   * Renames a file or folder inside a workspace.
   * @param {string} workspaceId 
   * @param {string} oldRelativePath 
   * @param {string} newRelativePath 
   */
  async renameItem(workspaceId, oldRelativePath, newRelativePath) {
    const oldPath = resolveSafePath(workspaceId, oldRelativePath);
    const newPath = resolveSafePath(workspaceId, newRelativePath);

    if (!fsSync.existsSync(oldPath)) {
      throw new Error(`Source item not found: ${oldRelativePath}`);
    }

    if (fsSync.existsSync(newPath)) {
      throw new Error(`Destination item already exists: ${newRelativePath}`);
    }

    const parentDir = path.dirname(newPath);
    if (!fsSync.existsSync(parentDir)) {
      await fs.mkdir(parentDir, { recursive: true });
    }

    await fs.rename(oldPath, newPath);
    return {
      oldPath: oldRelativePath.replace(/\\/g, '/'),
      newPath: newRelativePath.replace(/\\/g, '/')
    };
  }

  /**
   * Completely removes a workspace folder from storage root.
   * @param {string} workspaceId 
   */
  async deleteWorkspaceDirectory(workspaceId) {
    const workspaceDir = getWorkspacePath(workspaceId);
    if (fsSync.existsSync(workspaceDir)) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  }
}

module.exports = new StorageService();
