import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getWorkspacePath } from '../utils/pathSandbox.js';
import { broadcastFileTreeUpdate } from '../sockets/workspaceSocket.js';
import { STORAGE_ROOT } from '../config/workspaceConfig.js';

const META_FILENAME = '.codesync-meta.json';

/**
 * Mask any sensitive access token from logs, URLs, or error messages
 * e.g. https://ghp_xxxx@github.com/... -> https://***@github.com/...
 */
export function sanitizeGitOutput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/https:\/\/[^@\s]+@/g, 'https://***@')
    .replace(/ghp_[a-zA-Z0-9_-]+/g, 'ghp_***')
    .replace(/github_pat_[a-zA-Z0-9_-]+/g, 'github_pat_***');
}

/**
 * Executes a Git CLI command inside a specific workspace directory.
 * @param {string} cwd - Directory to execute in
 * @param {string[]} args - Git command arguments
 * @param {object} extraEnv - Additional environment variables
 * @param {number} timeoutMs - Timeout in milliseconds (default: 60s)
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function runGit(cwd, args, extraEnv = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(cwd)) {
      return reject(new Error(`Workspace directory does not exist: ${cwd}`));
    }

    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0', // Strictly prevent hanging on interactive password prompts
      GIT_ASKPASS: '',
      ...extraEnv,
    };

    const child = spawn('git', args, {
      cwd,
      env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch { /* ignore */ }
      reject(new Error(`Git command timed out after ${timeoutMs / 1000}s: git ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to invoke git: ${sanitizeGitOutput(err.message)}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: sanitizeGitOutput(stdout),
        stderr: sanitizeGitOutput(stderr),
        code: code ?? 0,
      });
    });
  });
}

/**
 * Builds an authenticated URL for a GitHub repository.
 * Formats: https://[username:]<token>@github.com/owner/repo.git
 */
export function buildAuthenticatedUrl(repoUrl, token, username) {
  if (!repoUrl) return '';
  const clean = repoUrl.trim();
  if (!token) return clean;

  try {
    const url = new URL(clean);
    if (username) {
      url.username = username;
      url.password = token;
    } else {
      url.username = token;
      url.password = '';
    }
    return url.toString();
  } catch {
    // If not a standard URL, inject token
    if (clean.startsWith('https://')) {
      const rest = clean.replace('https://', '').replace(/^[^@]+@/, '');
      return `https://${encodeURIComponent(token)}@${rest}`;
    }
    return clean;
  }
}

/**
 * Read workspace Git metadata from .codesync-meta.json
 */
export async function getWorkspaceGitMeta(workspaceId) {
  try {
    const metaPath = path.join(STORAGE_ROOT, workspaceId, META_FILENAME);
    if (!fs.existsSync(metaPath)) return {};
    const raw = await fs.promises.readFile(metaPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.git || {};
  } catch {
    return {};
  }
}

/**
 * Save workspace Git metadata to .codesync-meta.json
 */
export async function saveWorkspaceGitMeta(workspaceId, gitData) {
  try {
    const metaPath = path.join(STORAGE_ROOT, workspaceId, META_FILENAME);
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      } catch { /* ignore */ }
    }
    meta.git = { ...(meta.git || {}), ...gitData };
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    return meta.git;
  } catch (err) {
    console.warn('[GitService] Failed to save git meta:', err.message);
    return gitData;
  }
}

class GitService {
  /**
   * Clone a remote GitHub repository into the workspace folder.
   */
  async cloneRepo({
    workspaceId,
    repoUrl,
    branch = null,
    token = null,
    username = null,
    authorName = null,
    authorEmail = null,
  }) {
    if (!repoUrl || !repoUrl.trim()) {
      throw new Error('Repository URL is required');
    }

    const cleanUrl = repoUrl.trim();
    const workspaceDir = getWorkspacePath(workspaceId);

    if (!fs.existsSync(workspaceDir)) {
      await fs.promises.mkdir(workspaceDir, { recursive: true });
    }

    // Clean up empty starter files (e.g. single default README) so clone succeeds into '.'
    const existing = await fs.promises.readdir(workspaceDir);
    const nonMeta = existing.filter((f) => f !== META_FILENAME && f !== '.git');
    if (nonMeta.length === 1 && nonMeta[0].toLowerCase() === 'readme.md') {
      try {
        await fs.promises.unlink(path.join(workspaceDir, nonMeta[0]));
      } catch { /* ignore */ }
    }

    const authUrl = buildAuthenticatedUrl(cleanUrl, token, username);

    const cloneArgs = ['clone'];
    if (branch && branch.trim()) {
      cloneArgs.push('--branch', branch.trim());
    }
    cloneArgs.push(authUrl, '.');

    const res = await runGit(workspaceDir, cloneArgs, {}, 120000);
    if (res.code !== 0) {
      throw new Error(res.stderr || res.stdout || 'Git clone failed');
    }

    // Save author info locally if provided
    if (authorName && authorName.trim()) {
      await runGit(workspaceDir, ['config', 'user.name', authorName.trim()]);
    }
    if (authorEmail && authorEmail.trim()) {
      await runGit(workspaceDir, ['config', 'user.email', authorEmail.trim()]);
    }

    // Store git metadata for easy future pull / push
    await saveWorkspaceGitMeta(workspaceId, {
      repoUrl: cleanUrl,
      branch: branch || 'main',
      username: username || null,
      authorName: authorName || null,
      authorEmail: authorEmail || null,
      token: token || null,
      clonedAt: new Date().toISOString(),
    });

    // Notify connected clients to refresh the file explorer immediately
    broadcastFileTreeUpdate(workspaceId);

    return {
      success: true,
      message: 'Repository cloned successfully',
      repoUrl: cleanUrl,
      branch: branch || 'main',
    };
  }

  /**
   * Get detailed Git status for a workspace.
   */
  async getStatus(workspaceId) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const gitDir = path.join(workspaceDir, '.git');

    if (!fs.existsSync(gitDir)) {
      return {
        isGitRepo: false,
        canInitialize: true,
      };
    }

    // 1. Get branch and tracking status
    const statusRes = await runGit(workspaceDir, ['status', '--porcelain=v1', '-b', '-uall']);
    if (statusRes.code !== 0) {
      return {
        isGitRepo: false,
        error: statusRes.stderr || 'Failed to read git status',
      };
    }

    const lines = statusRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    let branch = 'main';
    let tracking = null;
    let ahead = 0;
    let behind = 0;

    const staged = [];
    const unstaged = [];
    const untracked = [];

    if (lines.length > 0 && lines[0].startsWith('##')) {
      const branchLine = lines[0].substring(2).trim();
      // Example: main...origin/main [ahead 1, behind 2]
      const match = branchLine.match(/^([^\s.]+)(?:\.\.\.([^\s[]+))?(?:\s+\[(?:ahead\s+(\d+))?(?:,\s*)?(?:behind\s+(\d+))?\])?/);
      if (match) {
        branch = match[1] || 'main';
        tracking = match[2] || null;
        ahead = parseInt(match[3] || '0', 10);
        behind = parseInt(match[4] || '0', 10);
      } else {
        branch = branchLine.replace('No commits yet on ', '').split('...')[0].trim();
      }
    }

    // Parse file status lines (starting from index 1)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 3) continue;

      const x = line[0];
      const y = line[1];
      const filePath = line.substring(3).trim().replace(/^"|"$/g, '');

      if (x === '?' && y === '?') {
        untracked.push({ path: filePath, status: 'U' });
      } else {
        // Staged changes (X is not space)
        if (x !== ' ') {
          staged.push({
            path: filePath,
            status: x === 'A' ? 'A' : x === 'D' ? 'D' : x === 'R' ? 'R' : 'M',
          });
        }
        // Unstaged changes (Y is not space)
        if (y !== ' ') {
          unstaged.push({
            path: filePath,
            status: y === 'D' ? 'D' : 'M',
          });
        }
      }
    }

    // 2. Get last commit info
    let lastCommit = null;
    const logRes = await runGit(workspaceDir, ['log', '-1', '--pretty=format:%h|%an|%ar|%s']);
    if (logRes.code === 0 && logRes.stdout.trim()) {
      const [hash, author, date, message] = logRes.stdout.split('|');
      lastCommit = { hash, author, date, message };
    }

    // 3. Get remote URL
    let remoteUrl = null;
    const remoteRes = await runGit(workspaceDir, ['remote', 'get-url', 'origin']);
    if (remoteRes.code === 0 && remoteRes.stdout.trim()) {
      remoteUrl = remoteRes.stdout.trim();
    }

    const meta = await getWorkspaceGitMeta(workspaceId);

    return {
      isGitRepo: true,
      branch,
      tracking,
      ahead,
      behind,
      remoteUrl,
      lastCommit,
      staged,
      unstaged,
      untracked,
      hasCredentials: Boolean(meta.token),
      authorName: meta.authorName || null,
      authorEmail: meta.authorEmail || null,
    };
  }

  /**
   * Initialize a new Git repository in the workspace.
   */
  async initRepo({ workspaceId, authorName = null, authorEmail = null, initialBranch = 'main' }) {
    const workspaceDir = getWorkspacePath(workspaceId);
    if (!fs.existsSync(workspaceDir)) {
      await fs.promises.mkdir(workspaceDir, { recursive: true });
    }

    const initRes = await runGit(workspaceDir, ['init', '-b', initialBranch || 'main']);
    if (initRes.code !== 0) {
      throw new Error(initRes.stderr || 'Git init failed');
    }

    if (authorName && authorName.trim()) {
      await runGit(workspaceDir, ['config', 'user.name', authorName.trim()]);
    }
    if (authorEmail && authorEmail.trim()) {
      await runGit(workspaceDir, ['config', 'user.email', authorEmail.trim()]);
    }

    return { success: true, message: 'Initialized empty Git repository' };
  }

  /**
   * Stage files and commit with a message.
   */
  async commit({ workspaceId, message, files = [], authorName = null, authorEmail = null }) {
    if (!message || !message.trim()) {
      throw new Error('Commit message is required');
    }

    const workspaceDir = getWorkspacePath(workspaceId);
    const meta = await getWorkspaceGitMeta(workspaceId);

    const name = authorName || meta.authorName || 'CodeSync Collaborator';
    const email = authorEmail || meta.authorEmail || 'collaborator@codesync.dev';

    // Stage files
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        await runGit(workspaceDir, ['add', f]);
      }
    } else {
      await runGit(workspaceDir, ['add', '-A']);
    }

    const commitRes = await runGit(workspaceDir, [
      '-c', `user.name=${name}`,
      '-c', `user.email=${email}`,
      'commit',
      '-m', message.trim(),
    ]);

    if (commitRes.code !== 0) {
      throw new Error(commitRes.stderr || commitRes.stdout || 'Git commit failed');
    }

    // Get new commit hash
    const hashRes = await runGit(workspaceDir, ['rev-parse', '--short', 'HEAD']);
    const commitHash = hashRes.stdout.trim();

    return {
      success: true,
      commitHash,
      message: `Committed changes [${commitHash}]`,
    };
  }

  /**
   * Push commits to remote GitHub repository.
   */
  async push({
    workspaceId,
    remote = 'origin',
    branch = null,
    token = null,
    username = null,
    force = false,
  }) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const meta = await getWorkspaceGitMeta(workspaceId);

    const resolvedToken = token || meta.token || null;
    const resolvedUsername = username || meta.username || null;

    // Get current branch if not provided
    let targetBranch = branch;
    if (!targetBranch) {
      const bRes = await runGit(workspaceDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      targetBranch = bRes.stdout.trim() || 'main';
    }

    // Resolve remote URL
    const remoteRes = await runGit(workspaceDir, ['remote', 'get-url', remote]);
    let targetRemote = remote;

    if (remoteRes.code === 0 && resolvedToken) {
      const originalUrl = remoteRes.stdout.trim();
      targetRemote = buildAuthenticatedUrl(originalUrl, resolvedToken, resolvedUsername);
    }

    const pushArgs = ['push'];
    if (force) pushArgs.push('--force');
    pushArgs.push(targetRemote, targetBranch);

    const pushRes = await runGit(workspaceDir, pushArgs, {}, 90000);
    if (pushRes.code !== 0) {
      throw new Error(pushRes.stderr || pushRes.stdout || 'Git push failed');
    }

    // If new token was provided, save it
    if (token) {
      await saveWorkspaceGitMeta(workspaceId, { token, username });
    }

    return {
      success: true,
      message: `Successfully pushed branch '${targetBranch}' to remote`,
    };
  }

  /**
   * Pull latest changes from remote repository.
   */
  async pull({
    workspaceId,
    remote = 'origin',
    branch = null,
    token = null,
    username = null,
  }) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const meta = await getWorkspaceGitMeta(workspaceId);

    const resolvedToken = token || meta.token || null;
    const resolvedUsername = username || meta.username || null;

    let targetBranch = branch;
    if (!targetBranch) {
      const bRes = await runGit(workspaceDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      targetBranch = bRes.stdout.trim() || 'main';
    }

    const remoteRes = await runGit(workspaceDir, ['remote', 'get-url', remote]);
    let targetRemote = remote;

    if (remoteRes.code === 0 && resolvedToken) {
      const originalUrl = remoteRes.stdout.trim();
      targetRemote = buildAuthenticatedUrl(originalUrl, resolvedToken, resolvedUsername);
    }

    const pullRes = await runGit(workspaceDir, ['pull', targetRemote, targetBranch], {}, 90000);
    if (pullRes.code !== 0) {
      throw new Error(pullRes.stderr || pullRes.stdout || 'Git pull failed');
    }

    // Broadcast file tree update so new/modified files appear in the editor immediately
    broadcastFileTreeUpdate(workspaceId);

    return {
      success: true,
      message: `Successfully pulled latest changes for '${targetBranch}'`,
      output: pullRes.stdout,
    };
  }

  /**
   * List all branches (local and remote).
   */
  async getBranches(workspaceId) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const branchRes = await runGit(workspaceDir, ['branch', '-a']);
    if (branchRes.code !== 0) {
      throw new Error(branchRes.stderr || 'Failed to list branches');
    }

    const lines = branchRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    let current = 'main';
    const branches = [];

    for (const l of lines) {
      const isCurrent = l.startsWith('*');
      const name = l.replace('*', '').trim();
      if (isCurrent) current = name;
      if (!name.includes('->')) {
        branches.push({ name, isCurrent, isRemote: name.startsWith('remotes/') });
      }
    }

    return { current, branches };
  }

  /**
   * Switch to an existing branch or create and checkout a new branch.
   */
  async checkoutBranch({ workspaceId, branchName, createNew = false }) {
    if (!branchName || !branchName.trim()) {
      throw new Error('Branch name is required');
    }

    const workspaceDir = getWorkspacePath(workspaceId);
    const cleanBranch = branchName.trim();

    const args = createNew ? ['checkout', '-b', cleanBranch] : ['checkout', cleanBranch];
    const res = await runGit(workspaceDir, args);
    if (res.code !== 0) {
      throw new Error(res.stderr || res.stdout || 'Failed to switch branch');
    }

    broadcastFileTreeUpdate(workspaceId);

    return {
      success: true,
      branch: cleanBranch,
      message: createNew ? `Created and checked out branch '${cleanBranch}'` : `Switched to branch '${cleanBranch}'`,
    };
  }

  /**
   * Get git diff of working directory against HEAD or staged index.
   */
  async getDiff({ workspaceId, filePath = null, staged = false }) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const args = ['diff'];
    if (staged) args.push('--cached');
    args.push('HEAD');
    if (filePath && filePath.trim()) {
      args.push('--', filePath.trim());
    }

    const res = await runGit(workspaceDir, args);
    return {
      success: true,
      diff: res.stdout || '',
    };
  }

  /**
   * Stage or unstage a specific file.
   */
  async stageFile({ workspaceId, filePath, unstage = false }) {
    if (!filePath || !filePath.trim()) {
      throw new Error('File path is required');
    }
    const workspaceDir = getWorkspacePath(workspaceId);
    const cleanPath = filePath.trim();

    const args = unstage ? ['restore', '--staged', cleanPath] : ['add', cleanPath];
    const res = await runGit(workspaceDir, args);
    if (res.code !== 0) {
      throw new Error(res.stderr || 'Failed to stage/unstage file');
    }

    return { success: true, filePath: cleanPath, staged: !unstage };
  }

  /**
   * Discard changes to a file in working directory.
   */
  async discardChanges({ workspaceId, filePath }) {
    if (!filePath || !filePath.trim()) {
      throw new Error('File path is required');
    }
    const workspaceDir = getWorkspacePath(workspaceId);
    const cleanPath = filePath.trim();

    // Check if untracked
    const statusRes = await runGit(workspaceDir, ['status', '--porcelain', cleanPath]);
    if (statusRes.stdout.startsWith('??')) {
      const full = path.join(workspaceDir, cleanPath);
      if (fs.existsSync(full)) {
        await fs.promises.unlink(full);
      }
    } else {
      await runGit(workspaceDir, ['checkout', 'HEAD', '--', cleanPath]);
    }

    broadcastFileTreeUpdate(workspaceId);
    return { success: true, message: `Discarded changes for ${cleanPath}` };
  }
}

export default new GitService();
