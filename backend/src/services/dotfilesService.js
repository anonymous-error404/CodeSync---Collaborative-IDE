import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { getWorkspacePath } from '../utils/pathSandbox.js';

class DotfilesService {
  /**
   * Clones and synchronizes personal dotfiles repository into the workspace environment.
   *
   * @param {Object} params
   * @param {string} params.workspaceId
   * @param {string} params.dotfilesRepoUrl - e.g. "https://github.com/developer/dotfiles.git"
   * @param {string} [params.branch='main']
   */
  async syncDotfiles({ workspaceId, dotfilesRepoUrl, branch = 'main' }) {
    if (!dotfilesRepoUrl || !dotfilesRepoUrl.trim()) {
      throw new Error('Dotfiles repository URL is required.');
    }

    const cleanUrl = dotfilesRepoUrl.trim();
    const wsDir = getWorkspacePath(workspaceId);
    const dotfilesDir = path.join(wsDir, '.codesync-dotfiles');

    // Remove existing dotfiles directory if present to ensure clean sync
    if (fsSync.existsSync(dotfilesDir)) {
      try {
        await fs.rm(dotfilesDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn(`[Dotfiles] Could not remove existing directory: ${rmErr.message}`);
      }
    }

    // Git clone dotfiles
    await new Promise((resolve, reject) => {
      const gitArgs = ['clone', '--depth', '1'];
      if (branch) {
        gitArgs.push('--branch', branch);
      }
      gitArgs.push(cleanUrl, dotfilesDir);

      const proc = spawn('git', gitArgs, { stdio: 'pipe' });
      let stderr = '';

      proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      proc.on('close', code => {
        if (code === 0) {
          resolve(true);
        } else {
          // If branch was specified and failed, retry with default branch
          const fallbackProc = spawn('git', ['clone', '--depth', '1', cleanUrl, dotfilesDir], { stdio: 'pipe' });
          fallbackProc.on('close', fallbackCode => {
            if (fallbackCode === 0) resolve(true);
            else reject(new Error(`Git clone failed for dotfiles: ${stderr.trim()}`));
          });
        }
      });

      proc.on('error', err => reject(err));
    });

    // Detect common dotfiles and symlink / copy them to the workspace root or home
    const commonDotfiles = [
      '.zshrc',
      '.bashrc',
      '.vimrc',
      '.tmux.conf',
      '.gitconfig',
      '.aliases',
      '.profile',
    ];

    const detected = [];
    const linked = [];

    const entries = await fs.readdir(dotfilesDir);
    for (const file of entries) {
      if (commonDotfiles.includes(file) || file.startsWith('.')) {
        detected.push(file);
        const sourcePath = path.join(dotfilesDir, file);
        const targetPath = path.join(wsDir, file);

        try {
          // If a file already exists in workspace root, back it up or replace
          if (fsSync.existsSync(targetPath)) {
            await fs.copyFile(sourcePath, targetPath);
          } else {
            await fs.copyFile(sourcePath, targetPath);
          }
          linked.push(file);
        } catch (linkErr) {
          console.warn(`[Dotfiles] Could not link ${file}: ${linkErr.message}`);
        }
      }
    }

    // Check if an install script exists (e.g. install.sh, setup.sh)
    let hasInstallScript = false;
    for (const scriptName of ['install.sh', 'setup.sh', 'bootstrap.sh']) {
      if (fsSync.existsSync(path.join(dotfilesDir, scriptName))) {
        hasInstallScript = true;
        break;
      }
    }

    return {
      success: true,
      repoUrl: cleanUrl,
      dotfilesDir,
      detectedFiles: detected,
      linkedFiles: linked,
      hasInstallScript,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves dotfiles status for a workspace.
   */
  async getDotfilesStatus(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const dotfilesDir = path.join(wsDir, '.codesync-dotfiles');
    const isPresent = fsSync.existsSync(dotfilesDir);

    if (!isPresent) {
      return { installed: false, detectedFiles: [] };
    }

    try {
      const entries = await fs.readdir(dotfilesDir);
      const dotfiles = entries.filter(e => e.startsWith('.'));
      return {
        installed: true,
        detectedFiles: dotfiles,
      };
    } catch {
      return { installed: false, detectedFiles: [] };
    }
  }
}

export default new DotfilesService();
