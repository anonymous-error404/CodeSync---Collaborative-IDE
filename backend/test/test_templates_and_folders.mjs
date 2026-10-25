import assert from 'assert';
import jwt from 'jsonwebtoken';
import { syncDatabase, User, WorkspaceMember } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import storageService from '../src/services/storageService.js';
import { JWT_SECRET } from '../src/config/authConfig.js';

async function run() {
  console.log('--- Starting Test: Project Templates & Directories ---');
  await syncDatabase();

  // 1. Ensure test user exists
  let user = await User.findOne({ where: { email: 'template_tester@example.com' } });
  if (!user) {
    user = await User.create({
      username: 'template_tester',
      email: 'template_tester@example.com',
      password: 'hashed_password_123'
    });
  }

  // 2. Test create workspace with React + Vite template
  console.log('\n[1] Creating workspace with "react-vite" template...');
  const reactTemplateFiles = {
    'package.json': JSON.stringify({ name: 'my-react-app', dependencies: { react: '^19.0.0' } }),
    'src/App.jsx': 'export default function App() { return <h1>Hello</h1>; }',
    'README.md': '# React + Vite',
  };

  const ws = await workspaceService.createWorkspace({
    name: 'React Template Workspace',
    description: 'Testing templates',
    type: 'educational',
    createdBy: user.id,
    creatorEmail: user.email,
    templateFiles: reactTemplateFiles,
  });

  assert(ws.id, 'Workspace should have an ID');
  console.log(`✓ Workspace created: ${ws.id}`);

  // Verify file tree contains expected files
  const tree = await storageService.getFileTree(ws.id);
  const filePaths = [];
  function collectPaths(nodes) {
    for (const node of nodes) {
      filePaths.push(node.path);
      if (node.children) collectPaths(node.children);
    }
  }
  collectPaths(tree);
  console.log('Files created:', filePaths);

  assert(filePaths.includes('package.json'), 'package.json should be created');
  assert(filePaths.includes('src/App.jsx') || filePaths.includes('src'), 'src directory or src/App.jsx should exist');
  console.log('✓ Project template files verified!');

  // 3. Test creating a new folder
  console.log('\n[2] Creating an empty directory "components"...');
  const dirItem = await storageService.createItem(ws.id, 'components', true);
  assert.strictEqual(dirItem.type, 'directory', 'Item type should be directory');
  assert.strictEqual(dirItem.path, 'components', 'Item path should be components');

  const treeAfterDir = await storageService.getFileTree(ws.id);
  const hasComponents = treeAfterDir.some(n => n.name === 'components' && n.type === 'directory');
  assert(hasComponents, 'components folder should be in file tree');
  console.log('✓ Folder creation verified!');

  // 4. Test creating a file inside that directory
  console.log('\n[3] Creating a file inside "components/Button.jsx"...');
  const fileItem = await storageService.createItem(ws.id, 'components/Button.jsx', false);
  assert.strictEqual(fileItem.type, 'file', 'Item type should be file');
  assert.strictEqual(fileItem.path, 'components/Button.jsx', 'Item path should match');
  console.log('✓ File inside subdirectory verified!');

  // 5. Test deleting the folder recursively
  console.log('\n[4] Deleting "components" directory recursively...');
  await storageService.deleteItem(ws.id, 'components');
  const treeAfterDelete = await storageService.getFileTree(ws.id);
  const stillHasComponents = treeAfterDelete.some(n => n.name === 'components');
  assert(!stillHasComponents, 'components folder should no longer exist');
  console.log('✓ Recursive folder deletion verified!');

  // 6. Cleanup workspace
  console.log('\n[5] Cleaning up test workspace directory...');
  await storageService.deleteWorkspaceDirectory(ws.id);
  console.log('✓ Cleaned up test workspace directory');

  console.log('\n=============================================');
  console.log('ALL TESTS PASSED: Templates & Folders work perfectly!');
  console.log('=============================================\n');
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
