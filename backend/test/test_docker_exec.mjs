import { io } from 'socket.io-client';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const API = 'http://localhost:5000';
const WS  = 'http://localhost:5000/workspace';

const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runFile = (socket, workspaceId, filePath) =>
  new Promise((resolve) => {
    let stdout = '', stderr = '';
    const onOut  = ({ chunk }) => { stdout += chunk; };
    const onErr  = ({ chunk }) => { stderr += chunk; };
    const onDone = ({ exitCode }) => {
      socket.off('execution-stdout',   onOut);
      socket.off('execution-stderr',   onErr);
      socket.off('execution-finished', onDone);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode });
    };
    socket.on('execution-stdout',   onOut);
    socket.on('execution-stderr',   onErr);
    socket.on('execution-finished', onDone);
    socket.emit('execute-code', { workspaceId, filePath });
  });

(async () => {
  let passed = 0, failed = 0;
  const check = (label, ok, detail = '') => {
    if (ok) { console.log('  PASS --', label); passed++; }
    else     { console.log('  FAIL --', label, detail ? `(${detail})` : ''); failed++; }
  };

  console.log('\n--- Setup ---');
  const { workspace } = await api('POST', '/api/workspaces', { name: 'Docker Test' });
  const wsId = workspace.id;
  console.log('  Workspace:', wsId);

  await api('PUT', `/api/workspaces/${wsId}/files/content`, { filePath: 'hello.js',   content: "console.log('Hello from Node!');" });
  await api('PUT', `/api/workspaces/${wsId}/files/content`, { filePath: 'hello.py',   content: "print('Hello from Python!')" });
  await api('PUT', `/api/workspaces/${wsId}/files/content`, { filePath: 'Hello.java', content: 'public class Hello { public static void main(String[] a) { System.out.println("Hello from Java!"); } }' });
  await api('PUT', `/api/workspaces/${wsId}/files/content`, { filePath: 'loop.js',    content: 'setInterval(() => {}, 500);' });
  console.log('  Test files written.');

  const socket = io(WS, { transports: ['websocket'] });
  await new Promise((r) => socket.on('connect', r));
  socket.emit('join-workspace', { workspaceId: wsId, username: 'tester' });
  await sleep(400);

  console.log('\n--- JavaScript (node:22-alpine) ---');
  const js = await runFile(socket, wsId, 'hello.js');
  console.log('  stdout:', js.stdout, '| exit:', js.exitCode);
  check('stdout correct', js.stdout === 'Hello from Node!', js.stdout);
  check('exit 0', js.exitCode === 0);

  console.log('\n--- Python (python:3.12-alpine) ---');
  const py = await runFile(socket, wsId, 'hello.py');
  console.log('  stdout:', py.stdout, '| exit:', py.exitCode);
  check('stdout correct', py.stdout === 'Hello from Python!', py.stdout);
  check('exit 0', py.exitCode === 0);

  console.log('\n--- Java (eclipse-temurin:21-jdk-alpine) ---');
  const java = await runFile(socket, wsId, 'Hello.java');
  console.log('  stdout:', java.stdout, '| exit:', java.exitCode);
  console.log('  stderr:', java.stderr);
  check('stdout correct', java.stdout === 'Hello from Java!', java.stdout);
  check('exit 0', java.exitCode === 0);

  console.log('\n--- Stop execution ---');
  socket.emit('execute-code', { workspaceId: wsId, filePath: 'loop.js' });
  await sleep(1000);
  socket.emit('stop-execution', { workspaceId: wsId });
  await sleep(1500);
  const { stdout: ps } = await execAsync(`docker ps --filter "name=codesync-exec-${wsId}" --format "{{.Names}}"`).catch(() => ({ stdout: '' }));
  check('Container removed after stop', ps.trim() === '', ps.trim());

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  socket.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})();
