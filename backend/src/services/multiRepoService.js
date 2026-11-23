import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import { getWorkspacePath } from '../utils/pathSandbox.js';
import gitService from './gitService.js';

const REPOS_META_FILE = '.codesync-repos.json';

class MultiRepoService {
  async _readReposMeta(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const metaPath = path.join(wsDir, REPOS_META_FILE);
    if (!fsSync.existsSync(metaPath)) {
      return { repositories: [] };
    }
    try {
      const raw = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { repositories: [] };
    }
  }

  async _writeReposMeta(workspaceId, meta) {
    const wsDir = getWorkspacePath(workspaceId);
    const metaPath = path.join(wsDir, REPOS_META_FILE);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Mounts an additional git repository inside the workspace as a microservice root.
   */
  async mountRepo({ workspaceId, repoUrl, targetFolder, branch = 'main', token = null, username = null }) {
    if (!repoUrl) throw new Error('Repository URL is required');
    const wsDir = getWorkspacePath(workspaceId);

    // Derive target folder name if not provided
    const folderName = targetFolder
      ? targetFolder.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      : path.basename(repoUrl.trim().replace(/\.git$/, ''));

    const targetPath = path.join(wsDir, folderName);
    if (fsSync.existsSync(targetPath)) {
      throw new Error(`Directory "${folderName}" already exists in workspace.`);
    }

    const repoId = `repo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Clone into the subfolder
    console.log(`[MultiRepo] Mounting ${repoUrl} into ${targetPath}...`);
    await new Promise((resolve, reject) => {
      let authUrl = repoUrl.trim();
      if (token && (authUrl.startsWith('https://') || authUrl.startsWith('http://'))) {
        const urlObj = new URL(authUrl);
        urlObj.username = username || 'oauth2';
        urlObj.password = token;
        authUrl = urlObj.toString();
      }

      const gitArgs = ['clone', '--depth', '1', '--branch', branch, authUrl, targetPath];
      const proc = spawn('git', gitArgs, { stdio: 'pipe' });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Git clone failed for ${folderName}: ${stderr}`));
      });
      proc.on('error', reject);
    });

    const meta = await this._readReposMeta(workspaceId);
    const repoEntry = {
      id: repoId,
      name: folderName,
      folder: folderName,
      repoUrl: repoUrl.trim(),
      branch,
      mountedAt: new Date().toISOString(),
    };

    meta.repositories.push(repoEntry);
    await this._writeReposMeta(workspaceId, meta);

    return {
      success: true,
      repository: repoEntry,
    };
  }

  /**
   * Lists all mounted repositories with current branch and git status.
   */
  async listRepos(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const meta = await this._readReposMeta(workspaceId);

    // Also check root workspace itself as the primary repo
    const isRootGit = fsSync.existsSync(path.join(wsDir, '.git'));
    const rootRepo = isRootGit ? {
      id: 'root-primary',
      name: 'root (primary)',
      folder: '.',
      branch: 'main',
      isPrimary: true,
    } : null;

    const list = rootRepo ? [rootRepo, ...meta.repositories] : meta.repositories;

    // Enhance with status
    const enhanced = await Promise.all(list.map(async (repo) => {
      const repoDir = repo.folder === '.' ? wsDir : path.join(wsDir, repo.folder);
      let status = 'ready';
      let branch = repo.branch || 'main';

      if (fsSync.existsSync(path.join(repoDir, '.git'))) {
        try {
          const statusResult = await gitService.getStatus({ workspaceId });
          branch = statusResult.currentBranch || branch;
        } catch { /* ignore */ }
      }

      return {
        ...repo,
        branch,
        status,
        exists: fsSync.existsSync(repoDir),
      };
    }));

    return enhanced;
  }

  /**
   * Unmounts a secondary repository from the workspace.
   */
  async unmountRepo(workspaceId, repoId) {
    const wsDir = getWorkspacePath(workspaceId);
    const meta = await this._readReposMeta(workspaceId);
    const target = meta.repositories.find(r => r.id === repoId);

    if (!target) {
      throw new Error(`Repository "${repoId}" not found in workspace.`);
    }

    const folderPath = path.join(wsDir, target.folder);
    if (fsSync.existsSync(folderPath)) {
      await fs.rm(folderPath, { recursive: true, force: true });
    }

    meta.repositories = meta.repositories.filter(r => r.id !== repoId);
    await this._writeReposMeta(workspaceId, meta);

    return { success: true, unmounted: target.folder };
  }
}

export default new MultiRepoService();
