import assert from 'assert';
import { syncDatabase, User } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import storageService from '../src/services/storageService.js';
import executionService from '../src/services/executionService.js';

async function run() {
  console.log('--- Starting Test: Interactive Terminal Execution Engine ---');
  await syncDatabase();

  let user = await User.findOne({ where: { email: 'terminal_tester@example.com' } });
  if (!user) {
    user = await User.create({
      username: 'terminal_tester',
      email: 'terminal_tester@example.com',
      password: 'hashed_password_123'
    });
  }

  // 1. Create a test workspace
  const ws = await workspaceService.createWorkspace({
    name: 'Terminal Test Workspace',
    description: 'Testing interactive terminal execution',
    type: 'educational',
    createdBy: user.id,
    creatorEmail: user.email,
  });

  assert(ws.id, 'Workspace should exist');
  console.log(`✓ Workspace created: ${ws.id}`);

  // 2. Test simple shell command execution (e.g. echo or node -e)
  console.log('\n[1] Testing basic command execution (node -e "console.log(...)")...');
  let stdoutData = '';
  let exitCodeReceived = null;

  await new Promise((resolve, reject) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'node -e "console.log(\'Hello from CodeSync Terminal!\')"',
      onStdout: (chunk) => {
        stdoutData += chunk;
      },
      onStderr: (chunk) => {
        console.error('stderr:', chunk);
      },
      onExit: (code) => {
        exitCodeReceived = code;
        resolve();
      },
    }).catch(reject);
  });

  assert.strictEqual(exitCodeReceived, 0, 'Exit code should be 0');
  assert(stdoutData.includes('Hello from CodeSync Terminal!'), 'Stdout should contain greeting');
  console.log(`✓ Command output received: ${stdoutData.trim()}`);

  // 3. Test interactive process with standard input (stdin)
  console.log('\n[2] Testing interactive process with stdin...');
  let stdinStdout = '';
  let interactiveExited = false;

  const interactivePromise = new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'node -e "process.stdin.on(\'data\', d => { console.log(\'ECHO:\' + d.toString().trim()); process.exit(0); });"',
      onStdout: (chunk) => {
        stdinStdout += chunk;
      },
      onStderr: () => {},
      onExit: (code) => {
        interactiveExited = true;
        resolve(code);
      },
    });
  });

  // Give process 200ms to spin up and listen on stdin
  await new Promise(r => setTimeout(r, 200));

  console.log('Sending input into stdin...');
  const sent = executionService.sendTerminalStdin({
    workspaceId: ws.id,
    userId: user.id,
    input: 'codesync_rocks',
  });
  assert(sent, 'sendTerminalStdin should return true');

  await interactivePromise;
  assert(stdinStdout.includes('ECHO:codesync_rocks'), 'Process should echo the stdin input');
  assert(interactiveExited, 'Interactive process should exit after receiving input');
  console.log(`✓ Interactive stdin received and processed: ${stdinStdout.trim()}`);

  // 4. Test killing a long-running process (like npm run dev / server)
  console.log('\n[3] Testing process kill / SIGINT (long-running process)...');
  let killedExit = false;

  const longRunningPromise = new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'node -e "setInterval(() => console.log(\'tick\'), 500);"',
      onStdout: () => {},
      onStderr: () => {},
      onExit: () => {
        killedExit = true;
        resolve();
      },
    });
  });

  await new Promise(r => setTimeout(r, 300));
  console.log('Stopping execution by context...');
  const stopped = executionService.stopExecutionByContext({
    workspaceId: ws.id,
    userId: user.id,
  });
  assert(stopped, 'stopExecutionByContext should return stopped process');

  await longRunningPromise;
  assert(killedExit, 'Process should be cleanly killed');
  console.log('✓ Long-running process successfully stopped!');

  // 5. Test cd directory navigation and pwd
  console.log('\n[4] Testing cd directory navigation and pwd...');
  await storageService.createItem(ws.id, 'src', true);

  // Change directory into src
  let cdOutput = '';
  await new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'cd src',
      onStdout: (chunk) => { cdOutput += chunk; },
      onStderr: () => {},
      onExit: () => resolve(),
    });
  });
  assert.strictEqual(cdOutput, '', 'cd should be completely silent on success');

  // Verify getCwd returns ~/src
  const currentCwd = executionService.getCwd(`${ws.id}:${user.id}`, ws.id);
  assert.strictEqual(currentCwd, '~/src', 'Current cwd should be ~/src');
  console.log('✓ cd into subdirectory verified: ~/src');

  // Test pwd in that directory
  let pwdOutput = '';
  await new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'pwd',
      onStdout: (chunk) => { pwdOutput += chunk; },
      onStderr: () => {},
      onExit: () => resolve(),
    });
  });
  assert(pwdOutput.includes('~/src'), 'pwd should print ~/src');
  console.log('✓ pwd command verified');

  // Test cd .. back to root
  await new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'cd ..',
      onStdout: () => {},
      onStderr: () => {},
      onExit: () => resolve(),
    });
  });
  const rootCwd = executionService.getCwd(`${ws.id}:${user.id}`, ws.id);
  assert.strictEqual(rootCwd, '~', 'Current cwd should be ~ after cd ..');
  console.log('✓ cd .. back to workspace root verified');

  // 6. Test node_modules visibility in file tree
  console.log('\n[5] Testing node_modules visibility in file tree...');
  await storageService.createItem(ws.id, 'node_modules', true);
  const tree = await storageService.getFileTree(ws.id);
  const nodeModulesNode = tree.find(n => n.name === 'node_modules');
  assert(nodeModulesNode, 'node_modules must appear as directory in file tree');
  assert.strictEqual(nodeModulesNode.type, 'directory');
  console.log('✓ node_modules is visible as a directory in the file tree');

  // 7. Test PORT environment variable isolation (prevents EADDRINUSE on port 5000)
  console.log('\n[6] Testing PORT isolation in terminal child processes...');
  let portCheckOutput = '';
  await new Promise((resolve) => {
    executionService.executeTerminalCommand({
      workspaceId: ws.id,
      userId: user.id,
      username: user.username,
      command: 'node -e "console.log(\'CHILD_PORT:\' + (process.env.PORT || \'DEFAULT_3000\'))"',
      onStdout: (chunk) => { portCheckOutput += chunk; },
      onStderr: () => {},
      onExit: () => resolve(),
    });
  });
  assert(portCheckOutput.includes('CHILD_PORT:DEFAULT_3000'), `Child process should not inherit PORT=5000, got: ${portCheckOutput}`);
  console.log(`✓ PORT successfully isolated from child terminal (evaluated to DEFAULT_3000)`);

  // Cleanup
  await storageService.deleteWorkspaceDirectory(ws.id);
  console.log('\n✓ Cleaned up test workspace');

  console.log('\n=============================================');
  console.log('ALL TESTS PASSED: Interactive Terminal is 100% operational!');
  console.log('=============================================\n');
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
