const { spawn } = require('child_process');
const path = require('path');
const { getWorkspacePath, resolveSafePath } = require('../utils/pathSandbox');
const { EXECUTION_TIMEOUT_MS } = require('../config/workspaceConfig');

class ExecutionService {
  constructor() {
    this.runningProcesses = new Map();
  }

  /**
   * Executes a code file inside the isolated workspace 
   * @param {Object} params
   * @param {string} params.workspaceId
   * @param {string} params.filePath
   * @param {Function} params.onStdout - Callback for streaming stdout 
   * @param {Function} params.onStderr - Callback for streaming stderr 
   * @param {Function} params.onExit   - Callback when execution finishes
   */
  executeFile({ workspaceId, filePath, onStdout, onStderr, onExit }) {
    const workspaceDir = getWorkspacePath(workspaceId);
    const targetFile = resolveSafePath(workspaceId, filePath);

    // stops  running process 
    this.stopExecution(workspaceId);

    const ext = path.extname(targetFile).toLowerCase();
    let command = '';
    let args = [];

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      command = 'node';
      args = [targetFile];
    } else if (ext === '.py') {
      command = 'python';
      args = ['-u', targetFile]; // -u for unbuffered stdout
    } else {
      throw new Error(`Unsupported file extension for execution: ${ext}`);
    }

    console.log(`[Execution Engine] Spawning ${command} ${args.join(' ')} in ${workspaceDir}`);

    const child = spawn(command, args, {
      cwd: workspaceDir,
      env: { ...process.env, FORCE_COLOR: 'true' },
      shell: false
    });

    this.runningProcesses.set(workspaceId, child);

    // timeout to force kill process if it runs too long 
    const timeoutHandle = setTimeout(() => {
      if (this.runningProcesses.has(workspaceId)) {
        onStderr('[Server] Execution timed out (30s max limit reached).\n');
        this.stopExecution(workspaceId);
      }
    }, EXECUTION_TIMEOUT_MS);

    child.stdout.on('data', (data) => {
      onStdout(data.toString());
    });

    child.stderr.on('data', (data) => {
      onStderr(data.toString());
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      this.runningProcesses.delete(workspaceId);
      onStderr(`[Server Execution Error]: ${err.message}\n`);
      onExit(-1);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      this.runningProcesses.delete(workspaceId);
      onExit(code !== null ? code : 0);
    });

    return child;
  }

  /**
   * stops  running process for a workspace.
   * @param {string} workspaceId 
   */
  stopExecution(workspaceId) {
    const child = this.runningProcesses.get(workspaceId);
    if (child) {
      console.log(`[Execution Engine] Killing process for workspace ${workspaceId}`);
      try {
        child.kill('SIGKILL');
      } catch (err) {
        console.error(`Failed to kill process: ${err.message}`);
      }
      this.runningProcesses.delete(workspaceId);
      return true;
    }
    return false;
  }
}

module.exports = new ExecutionService();
