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
  async createWorkspace({ name, description = '', type = 'educational', allowedEmails = [], createdBy = null, creatorEmail = null, templateFiles = null }) {
    const workspaceId = `ws-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const normalizedAllowed = Array.isArray(allowedEmails)
      ? allowedEmails.map(e => (typeof e === 'string' ? e.toLowerCase().trim() : '')).filter(Boolean)
      : [];

    const workspaceMeta = {
      id: workspaceId,
      name: name || `Workspace ${workspaceId}`,
      description,
      type: type || 'educational', // 'educational' | 'professional' | 'competitive'
      allowedEmails: normalizedAllowed,
      createdBy: createdBy || null,
      creatorEmail: creatorEmail ? creatorEmail.toLowerCase().trim() : null,
      createdAt: now,
      updatedAt: now,
      activeUsers: 0,
    };

    // Create directory + template or default files on disk
    await storageService.createWorkspaceDirectory(workspaceId, templateFiles);

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
          this.workspaces.set(wsId, { activeUsers: 0, type: meta.type || 'educational', ...meta });
        } else {
          // Meta file missing — create a recovery entry
          const now = new Date().toISOString();
          const recovered = { id: wsId, name: wsId, description: '', type: 'educational', createdAt: now, updatedAt: now, activeUsers: 0 };
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
        this.workspaces.set(workspaceId, { activeUsers: 0, type: meta.type || 'educational', ...meta });
      } else {
        const now = new Date().toISOString();
        const recovered = { id: workspaceId, name: `Workspace ${workspaceId}`, description: 'Recovered workspace', type: 'educational', createdAt: now, updatedAt: now, activeUsers: 0 };
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

  async getWorkspace(workspaceId) {
    if (!this.workspaces.has(workspaceId)) {
      const meta = await this._readMeta(workspaceId);
      if (meta) {
        this.workspaces.set(workspaceId, {
          activeUsers: 0,
          type: meta.type || 'educational',
          allowedEmails: meta.allowedEmails || [],
          createdBy: meta.createdBy || null,
          creatorEmail: meta.creatorEmail || null,
          ...meta,
        });
      }
    }
    return this.workspaces.get(workspaceId) || null;
  }

  async updateWorkspaceMeta(workspaceId, updates = {}) {
    const ws = await this.getWorkspace(workspaceId);
    if (!ws) return null;
    Object.assign(ws, updates, { updatedAt: new Date().toISOString() });
    await this._writeMeta(ws);
    return ws;
  }

  async getAllowedEmails(workspaceId) {
    const ws = await this.getWorkspace(workspaceId);
    return ws?.allowedEmails || [];
  }

  async addAllowedEmails(workspaceId, emails = []) {
    const ws = await this.getWorkspace(workspaceId);
    if (!ws) return null;
    const current = new Set((ws.allowedEmails || []).map(e => e.toLowerCase().trim()));
    const toAdd = Array.isArray(emails) ? emails : [emails];
    toAdd.forEach(e => {
      if (typeof e === 'string' && e.trim()) {
        current.add(e.toLowerCase().trim());
      }
    });
    ws.allowedEmails = Array.from(current);
    ws.updatedAt = new Date().toISOString();
    await this._writeMeta(ws);
    return ws.allowedEmails;
  }

  async removeAllowedEmail(workspaceId, email) {
    const ws = await this.getWorkspace(workspaceId);
    if (!ws) return null;
    const target = (email || '').toLowerCase().trim();
    // Protect creator / admin email from removal
    if (ws.creatorEmail && ws.creatorEmail.toLowerCase() === target) {
      return ws.allowedEmails;
    }
    ws.allowedEmails = (ws.allowedEmails || []).filter(e => e.toLowerCase().trim() !== target);
    ws.updatedAt = new Date().toISOString();
    await this._writeMeta(ws);
    return ws.allowedEmails;
  }
}

export default new WorkspaceService();
