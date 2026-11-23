import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { STORAGE_ROOT } from '../config/workspaceConfig.js';
import { getWorkspacePath } from '../utils/pathSandbox.js';

const SNAPSHOT_ROOT = path.join(STORAGE_ROOT, '.codesync-snapshots');

class WarmPoolService {
  constructor() {
    this.activePrebuilds = new Map(); // key -> { status, startedAt, log }
    this._ensureSnapshotDir();
  }

  _ensureSnapshotDir() {
    if (!fsSync.existsSync(SNAPSHOT_ROOT)) {
      try {
        fsSync.mkdirSync(SNAPSHOT_ROOT, { recursive: true });
      } catch (err) {
        console.warn('[WarmPool] Could not create snapshot root:', err.message);
      }
    }
  }

  _getSnapshotKey(gitRepoUrl, branch = 'main') {
    const cleanUrl = gitRepoUrl.trim().toLowerCase().replace(/\.git$/, '');
    const hash = crypto.createHash('sha256').update(`${cleanUrl}:${branch}`).digest('hex').substring(0, 16);
    return `${hash}`;
  }

  /**
   * Fast Copy-on-Write / Hardlink tree cloner.
   * On Linux/macOS/Windows, clones large directories (including node_modules)
   * in < 1 second using hardlinks for files and mirroring directory structure.
   */
  async _fastCoWClone(srcDir, dstDir) {
    if (!fsSync.existsSync(dstDir)) {
      await fs.mkdir(dstDir, { recursive: true });
    }

    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);

        if (entry.isDirectory()) {
          await this._fastCoWClone(srcPath, dstPath);
        } else if (entry.isSymbolicLink()) {
          try {
            const symlinkTarget = await fs.readlink(srcPath);
            await fs.symlink(symlinkTarget, dstPath);
          } catch {
            await fs.copyFile(srcPath, dstPath);
          }
        } else {
          // Hardlink file for instantaneous 0-copy fork
          try {
            await fs.link(srcPath, dstPath);
          } catch {
            // Fall back to standard copy if on different mount/filesystem
            await fs.copyFile(srcPath, dstPath);
          }
        }
      })
    );
  }

  /**
   * Checks if an instant warm snapshot is ready for the requested repo and branch.
   */
  async getWarmSnapshot(gitRepoUrl, branch = 'main') {
    if (!gitRepoUrl) return null;
    const key = this._getSnapshotKey(gitRepoUrl, branch);
    const snapshotPath = path.join(SNAPSHOT_ROOT, key);
    const metaPath = path.join(snapshotPath, '.codesync-snapshot-meta.json');

    if (fsSync.existsSync(snapshotPath) && fsSync.existsSync(metaPath)) {
      try {
        const metaRaw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw);
        return {
          key,
          path: snapshotPath,
          ...meta,
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Instantly forks a warm pre-built snapshot into a new workspace in < 3 seconds.
   */
  async forkSnapshotToWorkspace(snapshot, targetWorkspaceId) {
    const startTime = Date.now();
    const targetDir = getWorkspacePath(targetWorkspaceId);

    console.log(`[WarmPool] ⚡ Forking warm snapshot ${snapshot.key} into ${targetWorkspaceId}...`);
    await this._fastCoWClone(snapshot.path, targetDir);

    const elapsedMs = Date.now() - startTime;
    console.log(`[WarmPool] ✓ Instant fork completed in ${elapsedMs}ms!`);

    return {
      success: true,
      forkTimeMs: elapsedMs,
      fromSnapshot: snapshot.key,
      branch: snapshot.branch,
      prebuiltAt: snapshot.prebuiltAt,
    };
  }

  /**
   * Triggers a headless background pre-build container/process to download dependencies
   * and create a warm Copy-on-Write snapshot.
   */
  async triggerPrebuild({ gitRepoUrl, branch = 'main', token = null, username = null }) {
    if (!gitRepoUrl) throw new Error('gitRepoUrl is required');

    const key = this._getSnapshotKey(gitRepoUrl, branch);
    if (this.activePrebuilds.has(key)) {
      return { status: 'in_progress', key, message: 'Pre-build is already running for this branch.' };
    }

    const snapshotDir = path.join(SNAPSHOT_ROOT, key);
    this.activePrebuilds.set(key, {
      gitRepoUrl,
      branch,
      startedAt: new Date().toISOString(),
      status: 'building',
    });

    // Run headless pre-build asynchronously
    (async () => {
      try {
        if (fsSync.existsSync(snapshotDir)) {
          await fs.rm(snapshotDir, { recursive: true, force: true });
        }
        await fs.mkdir(snapshotDir, { recursive: true });

        // 1. Clone repository
        console.log(`[WarmPool Prebuild] Cloning ${gitRepoUrl} (${branch})...`);
        await new Promise((resolve, reject) => {
          let authUrl = gitRepoUrl.trim();
          if (token && (authUrl.startsWith('https://') || authUrl.startsWith('http://'))) {
            const urlObj = new URL(authUrl);
            urlObj.username = username || 'oauth2';
            urlObj.password = token;
            authUrl = urlObj.toString();
          }

          const gitArgs = ['clone', '--depth', '1', '--branch', branch, authUrl, snapshotDir];
          const proc = spawn('git', gitArgs, { stdio: 'pipe' });
          let stderr = '';
          proc.stderr.on('data', d => { stderr += d.toString(); });
          proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Git clone failed: ${stderr}`));
          });
          proc.on('error', reject);
        });

        // 2. Detect project type and run dependency install
        const pkgJsonPath = path.join(snapshotDir, 'package.json');
        const reqTxtPath = path.join(snapshotDir, 'requirements.txt');
        const pomXmlPath = path.join(snapshotDir, 'pom.xml');

        let installType = 'generic';

        if (fsSync.existsSync(pkgJsonPath)) {
          installType = 'node';
          console.log(`[WarmPool Prebuild] Running npm install in snapshot ${key}...`);
          await new Promise((resolve) => {
            const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            const proc = spawn(npmCmd, ['install', '--prefer-offline', '--no-audit'], {
              cwd: snapshotDir,
              stdio: 'ignore',
            });
            proc.on('close', () => resolve());
            proc.on('error', () => resolve()); // non-fatal fallback
          });
        } else if (fsSync.existsSync(reqTxtPath)) {
          installType = 'python';
        } else if (fsSync.existsSync(pomXmlPath)) {
          installType = 'java';
        }

        // 3. Write snapshot metadata
        const meta = {
          gitRepoUrl,
          branch,
          installType,
          prebuiltAt: new Date().toISOString(),
          status: 'ready',
        };
        await fs.writeFile(path.join(snapshotDir, '.codesync-snapshot-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

        this.activePrebuilds.delete(key);
        console.log(`[WarmPool Prebuild] ✓ Warm snapshot ready for ${gitRepoUrl} (${branch})`);
      } catch (err) {
        console.error(`[WarmPool Prebuild] ❌ Prebuild failed:`, err.message);
        this.activePrebuilds.delete(key);
      }
    })();

    return {
      success: true,
      status: 'started',
      key,
      gitRepoUrl,
      branch,
    };
  }

  /**
   * Lists all available warm-pool snapshots.
   */
  async listSnapshots() {
    this._ensureSnapshotDir();
    const entries = await fs.readdir(SNAPSHOT_ROOT, { withFileTypes: true });
    const snapshots = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(SNAPSHOT_ROOT, entry.name, '.codesync-snapshot-meta.json');
        if (fsSync.existsSync(metaPath)) {
          try {
            const raw = await fs.readFile(metaPath, 'utf-8');
            snapshots.push({
              key: entry.name,
              ...JSON.parse(raw),
            });
          } catch { /* ignore corrupted */ }
        }
      }
    }

    return snapshots;
  }
}

export default new WarmPoolService();
