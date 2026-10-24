import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
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
    // Map<envKey, { process: ChildProcess, containerName: string|null, workspaceId: string, userId: string|number, username: string, isGlobal: boolean, filePath: string, isDocker: boolean, timeoutHandle: NodeJS.Timeout, safeExit: Function, startedAt: number }>
    this.runningContainers = new Map();
    this._dockerCheckCache = null;
  }

  /**
   * Fast check if Docker daemon is running, with a 5-second TTL cache.
   * On Windows / Linux, checks the named pipe or socket file existence first (takes < 1ms),
   * completely avoiding hanging or slow CLI calls when Docker Desktop is closed.
   * @returns {Promise<boolean>}
   */
  async isDockerRunning() {
    const now = Date.now();
    if (this._dockerCheckCache && (now - this._dockerCheckCache.time < 5000)) {
      return this._dockerCheckCache.available;
    }

    // 1. Instant check: Named Pipe (Windows) or Unix Socket (Linux/macOS)
    if (process.platform === 'win32') {
      const pipeExists = fs.existsSync('//./pipe/dockerDesktopLinuxEngine') || fs.existsSync('//./pipe/docker_engine');
      if (!pipeExists) {
        this._dockerCheckCache = { available: false, time: now };
        return false;
      }
    } else {
      const sockExists = fs.existsSync('/var/run/docker.sock') ||
        (process.env.HOME && fs.existsSync(path.join(process.env.HOME, '.docker/run/docker.sock')));
      if (!sockExists) {
        this._dockerCheckCache = { available: false, time: now };
        return false;
      }
    }

    // 2. Pipe exists, verify Docker server response with a tight 1.5s timeout
    return new Promise((resolve) => {
      let resolved = false;
      const child = spawn('docker', ['version', '--format', '{{.Server.Version}}'], { shell: false });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            if (process.platform === 'win32' && child.pid) {
              spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false });
            } else {
              child.kill('SIGKILL');
            }
          } catch { /* ignore */ }
          this._dockerCheckCache = { available: false, time: Date.now() };
          resolve(false);
        }
      }, 1500);

      child.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          const available = code === 0;
          this._dockerCheckCache = { available, time: Date.now() };
          resolve(available);
        }
      });

      child.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this._dockerCheckCache = { available: false, time: Date.now() };
          resolve(false);
        }
      });
    });
  }

  /**
   * Executes a code file. Uses isolated Docker container when Docker daemon is available;
   * automatically and gracefully falls back to the host runtime when Docker is offline.
   *
   * @param {Object}   params
   * @param {string}   params.workspaceId
   * @param {string|number} [params.userId='global']
   * @param {string}   [params.username='User']
   * @param {boolean}  [params.isGlobal=false]
   * @param {string}   params.filePath
   * @param {Function} params.onStdout
   * @param {Function} params.onStderr
   * @param {Function} params.onExit
   */
  async executeFile({ workspaceId, userId = 'global', username = 'User', isGlobal = false, filePath, onStdout, onStderr, onExit }) {
    // Validate path — throws on traversal attempts
    resolveSafePath(workspaceId, filePath);
    const workspaceDir = getWorkspacePath(workspaceId);

    const envKey = isGlobal ? `${workspaceId}:global` : `${workspaceId}:${userId}`;

    // Kill any currently running container or process for this environment
    this.stopExecution(envKey);

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const fileSubDir = path.dirname(filePath);
    const fullSubDir = fileSubDir === '.' || fileSubDir === ''
      ? workspaceDir
      : path.join(workspaceDir, fileSubDir);

    let exited = false;
    const safeExit = (code) => {
      if (exited) return;
      exited = true;
      this.runningContainers.delete(envKey);
      onExit(code);
    };

    const isDocker = await this.isDockerRunning();

    if (!isDocker) {
      onStderr('[Error] Runtime environment not available. Docker engine is not running.\nPlease start Docker Desktop to execute code.\n');
      safeExit(-1);
      return;
    }

    // ── Docker Containerized Execution ──────────────────────────────────────
    const containerName = isGlobal
      ? `${CONTAINER_NAME_PREFIX}-${workspaceId}-global`
      : `${CONTAINER_NAME_PREFIX}-${workspaceId}-u${userId}`;

    const containerWorkDir = fileSubDir === '.' || fileSubDir === ''
      ? '/workspace'
      : `/workspace/${fileSubDir}`;

    const dockerArgs = this._buildDockerArgs({
      containerName,
      workspaceDir,
      containerWorkDir,
      fileName,
      ext,
    });

    console.log(`[Docker Engine] Launching container for ${envKey}: ${containerName}`);
    const child = spawn('docker', dockerArgs, { shell: false });

    const timeoutHandle = setTimeout(() => {
      if (this.runningContainers.has(envKey)) {
        onStderr(`\n[Server] Execution timed out (${EXECUTION_TIMEOUT_MS / 1000}s limit reached).\n`);
        this.stopExecution(envKey);
      }
    }, EXECUTION_TIMEOUT_MS);

    this.runningContainers.set(envKey, {
      process: child,
      containerName,
      workspaceId,
      userId,
      username,
      isGlobal,
      filePath,
      isDocker: true,
      timeoutHandle,
      safeExit,
      startedAt: Date.now(),
    });

    child.stdout.on('data', (data) => onStdout(data.toString()));
    child.stderr.on('data', (data) => onStderr(data.toString()));

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      onStderr(`[Docker Engine] Error: ${err.message}\n`);
      safeExit(-1);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      safeExit(code ?? 0);
    });
  }

  /**
   * Builds the `docker run` argument array for the given language/file.
   * @private
   */
  _buildDockerArgs({ containerName, workspaceDir, containerWorkDir, fileName, ext }) {
    const baseArgs = [
      'run', '--rm',
      '--name',    containerName,
      '--network', 'none',
      '--memory',  DOCKER_MEMORY_LIMIT,
      '--cpus',    DOCKER_CPU_LIMIT,
      '--workdir', containerWorkDir,
    ];

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace:ro`,
        DOCKER_IMAGES.node,
        'node', fileName,
      ];
    }

    if (ext === '.py') {
      return [
        ...baseArgs,
        '--volume', `${workspaceDir}:/workspace:ro`,
        DOCKER_IMAGES.python,
        'python', '-u', fileName,
      ];
    }

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
   * Stops a running Docker container or local process by environment key.
   * Forcefully kills process trees on Windows via taskkill to guarantee instant termination.
   *
   * @param {string} envKey
   * @returns {boolean}
   */
  stopExecution(envKey) {
    let targetKey = envKey;
    let entry = this.runningContainers.get(targetKey);

    if (!entry) {
      for (const [k, v] of this.runningContainers.entries()) {
        if (k === envKey || v.workspaceId === envKey || (envKey && envKey.includes(v.workspaceId))) {
          targetKey = k;
          entry = v;
          break;
        }
      }
    }

    if (!entry) return false;

    const { process: child, containerName, timeoutHandle, safeExit, isDocker } = entry;
    console.log(`[Execution Engine] Stopping execution for ${targetKey}: ${containerName || 'Local Host Process'}`);

    if (timeoutHandle) clearTimeout(timeoutHandle);

    // 1. If it's a Docker container, stop it via docker kill
    if (isDocker && containerName) {
      spawn('docker', ['kill', containerName], { shell: false })
        .on('error', () => { /* container may already be stopped */ });
    }

    // 2. Kill the host child process and all descendants
    if (child && child.pid) {
      if (process.platform === 'win32') {
        try {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false })
            .on('error', () => {
              try { child.kill('SIGKILL'); } catch { /* ignore */ }
            });
        } catch {
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }
      } else {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }

    this.runningContainers.delete(targetKey);
    if (safeExit) safeExit(-1);
    return true;
  }

  /**
   * Context-aware stop execution: searches for running executions by workspaceId,
   * userId, and/or isGlobal flag.
   */
  stopExecutionByContext({ workspaceId, userId = null, isGlobal = false }) {
    // 1. Check global execution if requested
    if (isGlobal) {
      const globalKey = `${workspaceId}:global`;
      if (this.runningContainers.has(globalKey)) {
        const entry = this.runningContainers.get(globalKey);
        this.stopExecution(globalKey);
        return { isGlobal: true, entry };
      }
    }

    // 2. Check user's specific execution
    if (userId !== null && userId !== undefined) {
      const userKey = `${workspaceId}:${userId}`;
      if (this.runningContainers.has(userKey)) {
        const entry = this.runningContainers.get(userKey);
        this.stopExecution(userKey);
        return { isGlobal: false, entry };
      }

      // Check string vs number match
      for (const [k, v] of this.runningContainers.entries()) {
        if (v.workspaceId === workspaceId && String(v.userId) === String(userId)) {
          this.stopExecution(k);
          return { isGlobal: v.isGlobal, entry: v };
        }
      }
    }

    // 3. Fallback: Stop ANY execution in this workspace
    for (const [k, v] of this.runningContainers.entries()) {
      if (v.workspaceId === workspaceId) {
        this.stopExecution(k);
        return { isGlobal: v.isGlobal, entry: v };
      }
    }

    return null;
  }

  /**
   * Stops execution for a specific user within a workspace.
   */
  stopUserExecution(workspaceId, userId) {
    return Boolean(this.stopExecutionByContext({ workspaceId, userId }));
  }

  /**
   * Stops all running containers or processes associated with a workspace.
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
          containerName: entry.containerName || `local-host-${entry.userId}`,
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
  async getSupportedEnvironments() {
    const isDocker = await this.isDockerRunning();
    const statusText = isDocker ? 'Docker Sandbox Ready' : 'Runtime env not available';

    return [
      {
        id: 'node',
        name: 'Node.js',
        runtime: 'Node.js 20.x (Alpine Linux)',
        image: DOCKER_IMAGES.node,
        extensions: ['.js', '.mjs', '.cjs'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: statusText,
        description: isDocker
          ? 'V8 JavaScript runtime with sandboxed execution.'
          : 'Runtime env not available (Docker engine is offline).',
      },
      {
        id: 'python',
        name: 'Python',
        runtime: 'Python 3.11 (Alpine Linux)',
        image: DOCKER_IMAGES.python,
        extensions: ['.py'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: statusText,
        description: isDocker
          ? 'CPython 3.11 interpreter with unbuffered I/O.'
          : 'Runtime env not available (Docker engine is offline).',
      },
      {
        id: 'java',
        name: 'Java',
        runtime: 'OpenJDK 17 (Alpine Linux)',
        image: DOCKER_IMAGES.java,
        extensions: ['.java'],
        memoryLimit: DOCKER_MEMORY_LIMIT,
        cpuLimit: DOCKER_CPU_LIMIT,
        status: statusText,
        description: isDocker
          ? 'Full JDK containerized compilation and runtime.'
          : 'Runtime env not available (Docker engine is offline).',
      },
    ];
  }
}

export default new ExecutionService();
