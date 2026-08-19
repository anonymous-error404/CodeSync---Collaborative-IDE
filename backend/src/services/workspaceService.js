import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import storageService from './storageService.js';
import { STORAGE_ROOT } from '../config/workspaceConfig.js';

const META_FILENAME = '.codesync-meta.json';

class WorkspaceService {
  constructor() {
    this.workspaces = new Map();
  }

  /** Write metadata JSON into the workspace directory for persistence across restarts. */
  async _writeMeta(meta) {
    try {
      const metaPath = path.join(STORAGE_ROOT, meta.id, META_FILENAME);
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch { /* ignore */ }
  }

  /** Read metadata from a workspace directory, returns null if missing/corrupt. */
  async _readMeta(workspaceId) {
    try {
      const metaPath = path.join(STORAGE_ROOT, workspaceId, META_FILENAME);
      const raw = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Creates a new workspace session and initializes its folder.
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
      activeUsers: 0,
    };

    // Create directory + default files on disk
    await storageService.createWorkspaceDirectory(workspaceId);

    // Persist metadata so it survives restarts
    await this._writeMeta(workspaceMeta);

    // Register in memory
    this.workspaces.set(workspaceId, workspaceMeta);

    return workspaceMeta;
  }

  /**
   * Lists all workspaces — scans disk to recover any not yet in memory.
   */
  async listWorkspaces() {
    try {
      if (!fsSync.existsSync(STORAGE_ROOT)) return Array.from(this.workspaces.values());

      const entries = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const wsId = entry.name;
        if (this.workspaces.has(wsId)) continue;

        // Try to recover from persisted meta file
        const meta = await this._readMeta(wsId);
        if (meta && meta.id) {
          this.workspaces.set(wsId, { activeUsers: 0, ...meta });
        } else {
          // Meta file missing — create a recovery entry
          const now = new Date().toISOString();
          const recovered = { id: wsId, name: wsId, description: '', createdAt: now, updatedAt: now, activeUsers: 0 };
          this.workspaces.set(wsId, recovered);
          await this._writeMeta(recovered);
        }
      }
    } catch { /* ignore scan errors */ }

    return Array.from(this.workspaces.values());
  }

  /**
   * Gets details and file tree for a specific workspace.
   */
  async getWorkspaceDetails(workspaceId) {
    if (!this.workspaces.has(workspaceId)) {
      // Try disk recovery for this specific workspace
      const meta = await this._readMeta(workspaceId);
      if (meta) {
        this.workspaces.set(workspaceId, { activeUsers: 0, ...meta });
      } else {
        const now = new Date().toISOString();
        const recovered = { id: workspaceId, name: `Workspace ${workspaceId}`, description: 'Recovered workspace', createdAt: now, updatedAt: now, activeUsers: 0 };
        this.workspaces.set(workspaceId, recovered);
        await this._writeMeta(recovered);
      }
    }

    const meta = this.workspaces.get(workspaceId);
    const fileTree = await storageService.getFileTree(workspaceId);
    return { workspace: meta, fileTree };
  }

  /**
   * Deletes a workspace metadata and its directory.
   */
  async deleteWorkspace(workspaceId) {
    await storageService.deleteWorkspaceDirectory(workspaceId);
    this.workspaces.delete(workspaceId);
    return { success: true, workspaceId };
  }

  incrementUserCount(workspaceId) {
    const meta = this.workspaces.get(workspaceId);
    if (meta) meta.activeUsers += 1;
  }

  decrementUserCount(workspaceId) {
    const meta = this.workspaces.get(workspaceId);
    if (meta && meta.activeUsers > 0) meta.activeUsers -= 1;
  }

  getActiveUsers(workspaceId) {
    return this.workspaces.get(workspaceId)?.activeUsers ?? 0;
  }
}

export default new WorkspaceService();
