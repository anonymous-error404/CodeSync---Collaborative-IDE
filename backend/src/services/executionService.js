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
    // Map<workspaceId, { process: ChildProcess, containerName: string }>
    this.runningContainers = new Map();
  }

  /**
   * Executes a code file inside an isolated Docker container.
   * Streams stdout/stderr in real-time via callbacks, then auto-removes the container.
   *
   * @param {Object}   params
   * @param {string}   params.workspaceId
   * @param {string}   params.filePath   - Relative path within the workspace
   * @param {Function} params.onStdout   - Called with each stdout chunk
   * @param {Function} params.onStderr   - Called with each stderr chunk
   * @param {Function} params.onExit     - Called with exit code when done
   */
  executeFile({ workspaceId, filePath, onStdout, onStderr, onExit }) {
    // Validate path — throws on traversal attempts
    resolveSafePath(workspaceId, filePath);
    const workspaceDir = getWorkspacePath(workspaceId);

    // Kill any currently running container for this workspace
    this.stopExecution(workspaceId);

    const ext           = path.extname(filePath).toLowerCase();
    const fileName      = path.basename(filePath);
    const fileSubDir    = path.dirname(filePath);
    const containerName = `${CONTAINER_NAME_PREFIX}-${workspaceId}`;

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

    console.log(`[Docker Engine] Launching container: ${containerName}`);
    console.log(`[Docker Engine] docker ${dockerArgs.join(' ')}`);

    const child = spawn('docker', dockerArgs, { shell: false });
    this.runningContainers.set(workspaceId, { process: child, containerName });

    // Hard timeout — kill the container if it runs too long
    const timeoutHandle = setTimeout(() => {
      if (this.runningContainers.has(workspaceId)) {
        onStderr(
          `\n[Server] Execution timed out (${EXECUTION_TIMEOUT_MS / 1000}s limit reached).\n`
        );
        this.stopExecution(workspaceId);
      }
    }, EXECUTION_TIMEOUT_MS);

    // Stream stdout/stderr in real-time to the caller
    child.stdout.on('data', (data) => onStdout(data.toString()));
    child.stderr.on('data', (data) => onStderr(data.toString()));

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      this.runningContainers.delete(workspaceId);
      // Friendly hint when Docker daemon is not running
      const hint = err.code === 'ENOENT'
        ? ' — Is Docker installed and running?'
        : '';
      onStderr(`[Server] Execution error: ${err.message}${hint}\n`);
      onExit(-1);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      this.runningContainers.delete(workspaceId);
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
      const className = path.basename(fileName, '.java');
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace`,
        DOCKER_IMAGES.java,
        'sh', '-c', `javac ${fileName} && java ${className}`,
      ];
    }

    throw new Error(`Unsupported file extension for execution: ${ext}`);
  }

  /**
   * Stops the running Docker container for a workspace (if any).
   * @param {string} workspaceId
   * @returns {boolean} true if a container was killed, false if nothing was running
   */
  stopExecution(workspaceId) {
    const entry = this.runningContainers.get(workspaceId);
    if (!entry) return false;

    const { process: child, containerName } = entry;
    console.log(`[Docker Engine] Killing container: ${containerName}`);

    // Send SIGKILL to the container via Docker (immediate, no graceful shutdown)
    spawn('docker', ['kill', containerName], { shell: false })
      .on('error', () => { /* container may already be stopped — ignore */ });

    // Also terminate the `docker run` child process on the host side
    try { child.kill('SIGKILL'); } catch { /* already exited */ }

    this.runningContainers.delete(workspaceId);
    return true;
  }
}

export default new ExecutionService();
