const { v4: uuidv4 } = require('uuid');
const storageService = require('./storageService');

class WorkspaceService {
  constructor() {
    this.workspaces = new Map();
  }

  /**
   * Creates a new workspace session and initializes its folder.
   * @param {Object} options 
   * @param {string} options.name 
   * @param {string} [options.description] 
   * @returns {Promise<Object>} Workspace metadata 
   */
  async createWorkspace({ name, description = '' }) {
    const workspaceId = `ws-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const workspaceMeta = {
      id: workspaceId,
      name: name || `Workspace ${workspaceId}`,
      description,
      createdAt: now,
      updatedAt: now,
      activeUsers: 0
    };

    // Create external directory & default starter files
    await storageService.createWorkspaceDirectory(workspaceId);

    // Register in memory
    this.workspaces.set(workspaceId, workspaceMeta);

    return workspaceMeta;
  }

  /**
   * Retrieves a list of all active workspaces.
   * @returns {Array<Object>} List of workspace metadata
   */
  listWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  /**
   * Gets details and file tree for a specific workspace.
   * @param {string} workspaceId 
   * @returns {Promise<Object>} Workspace metadata & file tree
   */
  async getWorkspaceDetails(workspaceId) {
    const meta = this.workspaces.get(workspaceId);

    // If meta isn't in memory (e.g., server restarted), re-verify filesystem existence
    const fileTree = await storageService.getFileTree(workspaceId);

    if (!meta) {
      const recoveredMeta = {
        id: workspaceId,
        name: `Workspace ${workspaceId}`,
        description: 'Recovered workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeUsers: 0
      };
      this.workspaces.set(workspaceId, recoveredMeta);
      return { workspace: recoveredMeta, fileTree };
    }

    return { workspace: meta, fileTree };
  }

  /**
   * Deletes a workspace metadata and external directory.
   * @param {string} workspaceId 
   */
  async deleteWorkspace(workspaceId) {
    await storageService.deleteWorkspaceDirectory(workspaceId);
    this.workspaces.delete(workspaceId);
    return { success: true, workspaceId };
  }

  /**
   * Increments connected user count for a workspace room.
   * @param {string} workspaceId 
   */
  incrementUserCount(workspaceId) {
    const meta = this.workspaces.get(workspaceId);
    if (meta) {
      meta.activeUsers += 1;
    }
  }

  /**
   * Decrements connected user count for a workspace room.
   * @param {string} workspaceId 
   */
  decrementUserCount(workspaceId) {
    const meta = this.workspaces.get(workspaceId);
    if (meta && meta.activeUsers > 0) {
      meta.activeUsers -= 1;
    }
  }
}

module.exports = new WorkspaceService();
