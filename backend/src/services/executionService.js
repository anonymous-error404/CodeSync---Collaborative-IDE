import { spawn } from 'child_process';
import path from 'path';
import { getWorkspacePath, resolveSafePath } from '../utils/pathSandbox.js';
import { EXECUTION_TIMEOUT_MS } from '../config/workspaceConfig.js';
import {
  DOCKER_IMAGES,
  DOCKER_MEMORY_LIMIT,
  DOCKER_CPU_LIMIT,
  CONTAINER_NAME_PREFIX,
} from '../config/dockerConfig.js';

class ExecutionService {
  constructor() {
    // Map<envKey, { process: ChildProcess, containerName: string, workspaceId: string, userId: string|number, username: string, isGlobal: boolean, filePath: string, startedAt: number }>
    this.runningContainers = new Map();
  }

  /**
   * Executes a code file inside an isolated Docker container for a specific member or globally.
   * Streams stdout/stderr in real-time via callbacks, then auto-removes the container.
   *
   * @param {Object}   params
   * @param {string}   params.workspaceId
   * @param {string|number} [params.userId='global']
   * @param {string}   [params.username='User']
   * @param {boolean}  [params.isGlobal=false]
   * @param {string}   params.filePath   - Relative path within the workspace
   * @param {Function} params.onStdout   - Called with each stdout chunk
   * @param {Function} params.onStderr   - Called with each stderr chunk
   * @param {Function} params.onExit     - Called with exit code when done
   */
  executeFile({ workspaceId, userId = 'global', username = 'User', isGlobal = false, filePath, onStdout, onStderr, onExit }) {
    // Validate path — throws on traversal attempts
    resolveSafePath(workspaceId, filePath);
    const workspaceDir = getWorkspacePath(workspaceId);

    const envKey = isGlobal ? `${workspaceId}:global` : `${workspaceId}:${userId}`;

    // Kill any currently running container for this member's environment
    this.stopExecution(envKey);

    const ext           = path.extname(filePath).toLowerCase();
    const fileName      = path.basename(filePath);
    const fileSubDir    = path.dirname(filePath);
    const containerName = isGlobal
      ? `${CONTAINER_NAME_PREFIX}-${workspaceId}-global`
      : `${CONTAINER_NAME_PREFIX}-${workspaceId}-u${userId}`;

    // Working directory inside the container (where the file lives)
    const containerWorkDir =
      fileSubDir === '.' || fileSubDir === ''
        ? '/workspace'
        : `/workspace/${fileSubDir}`;

    // Build the full `docker run` argument list
    const dockerArgs = this._buildDockerArgs({
      containerName,
      workspaceDir,
      containerWorkDir,
      fileName,
      ext,
    });

    console.log(`[Docker Engine] Launching container for ${envKey}: ${containerName}`);
    console.log(`[Docker Engine] docker ${dockerArgs.join(' ')}`);

    const child = spawn('docker', dockerArgs, { shell: false });
    this.runningContainers.set(envKey, {
      process: child,
      containerName,
      workspaceId,
      userId,
      username,
      isGlobal,
      filePath,
      startedAt: Date.now(),
    });

    // Hard timeout — kill the container if it runs too long
    const timeoutHandle = setTimeout(() => {
      if (this.runningContainers.has(envKey)) {
        onStderr(
          `\n[Server] Execution timed out (${EXECUTION_TIMEOUT_MS / 1000}s limit reached).\n`
        );
        this.stopExecution(envKey);
      }
    }, EXECUTION_TIMEOUT_MS);

    // Stream stdout/stderr in real-time to the caller
    child.stdout.on('data', (data) => onStdout(data.toString()));
    child.stderr.on('data', (data) => onStderr(data.toString()));

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      this.runningContainers.delete(envKey);
      // Friendly hint when Docker daemon is not running
      const hint = err.code === 'ENOENT'
        ? ' — Is Docker installed and running?'
        : '';
      onStderr(`[Server] Execution error: ${err.message}${hint}\n`);
      onExit(-1);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      this.runningContainers.delete(envKey);
      onExit(code ?? 0);
    });
  }

  /**
   * Builds the `docker run` argument array for the given language/file.
   * @private
   */
  _buildDockerArgs({ containerName, workspaceDir, containerWorkDir, fileName, ext }) {
    // Common security + resource flags shared by all languages
    const baseArgs = [
      'run', '--rm',
      '--name',    containerName,
      '--network', 'none',
      '--memory',  DOCKER_MEMORY_LIMIT,
      '--cpus',    DOCKER_CPU_LIMIT,
      '--workdir', containerWorkDir,
    ];

    // JavaScript / Node.js — read-only volume, run directly
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace:ro`,
        DOCKER_IMAGES.node,
        'node', fileName,
      ];
    }

    // Python — read-only volume, unbuffered output (-u)
    if (ext === '.py') {
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace:ro`,
        DOCKER_IMAGES.python,
        'python', '-u', fileName,
      ];
    }

    // Java — needs RW volume so javac can write .class files next to the source
    if (ext === '.java') {
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace`,
        DOCKER_IMAGES.java,
        'sh', '-c', `javac *.java 2>/dev/null; java "${fileName}"`,
      ];
    }

    throw new Error(`Unsupported file extension for execution: ${ext}`);
  }

  /**
   * Stops a running Docker container by environment key.
   * @param {string} envKey - either "workspaceId:userId", "workspaceId:global", or "workspaceId" (for backward compat)
   * @returns {boolean} true if a container was killed, false if nothing was running
   */
  stopExecution(envKey) {
    let targetKey = envKey;
    if (!this.runningContainers.has(targetKey)) {
      // Check if it was passed just workspaceId
      for (const [k, v] of this.runningContainers.entries()) {
        if (k === envKey || v.workspaceId === envKey) {
          targetKey = k;
          break;
        }
      }
    }

    const entry = this.runningContainers.get(targetKey);
    if (!entry) return false;

    const { process: child, containerName } = entry;
    console.log(`[Docker Engine] Killing container for ${targetKey}: ${containerName}`);

    // Send SIGKILL to the container via Docker (immediate, no graceful shutdown)
    spawn('docker', ['kill', containerName], { shell: false })
      .on('error', () => { /* container may already be stopped — ignore */ });

    // Also terminate the `docker run` child process on the host side
    try { child.kill('SIGKILL'); } catch { /* already exited */ }

    this.runningContainers.delete(targetKey);
    return true;
  }

  /**
   * Stops execution for a specific user within a workspace.
   */
  stopUserExecution(workspaceId, userId) {
    return this.stopExecution(`${workspaceId}:${userId}`);
  }

  /**
   * Stops all running containers associated with a workspace.
   */
  stopWorkspaceExecutions(workspaceId) {
    let stoppedAny = false;
    for (const [key, entry] of this.runningContainers.entries()) {
      if (entry.workspaceId === workspaceId) {
        this.stopExecution(key);
        stoppedAny = true;
      }
    }
    return stoppedAny;
  }

  /**
   * Lists all running execution environments for a workspace.
   */
  listEnvironments(workspaceId) {
    const list = [];
    for (const [envKey, entry] of this.runningContainers.entries()) {
      if (entry.workspaceId === workspaceId) {
        list.push({
          envKey,
          userId: entry.userId,
          username: entry.username,
          isGlobal: entry.isGlobal,
          containerName: entry.containerName,
          filePath: entry.filePath,
          startedAt: entry.startedAt,
          uptimeSec: Math.round((Date.now() - entry.startedAt) / 1000),
          status: 'running',
        });
      }
    }
    return list;
  }

  /**
   * Returns metadata about all supported and depended execution environments.
   */
  getSupportedEnvironments() {
    return [
      {
        id: 'node',
        name: 'Node.js',
        runtime: 'Node.js 20.x (Alpine Linux)',
        image: DOCKER_IMAGES.node,
        extensions: ['.js', '.mjs', '.cjs'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: 'ready',
        description: 'V8 JavaScript runtime with sandboxed execution.',
      },
      {
        id: 'python',
        name: 'Python',
        runtime: 'Python 3.11 (Alpine Linux)',
        image: DOCKER_IMAGES.python,
        extensions: ['.py'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: 'ready',
        description: 'CPython 3.11 interpreter with unbuffered I/O.',
      },
      {
        id: 'java',
        name: 'Java',
        runtime: 'OpenJDK 17 (Alpine Linux)',
        image: DOCKER_IMAGES.java,
        extensions: ['.java'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: 'ready',
        description: 'Full JDK compilation and runtime environment.',
      },
    ];
  }
}

export default new ExecutionService();
