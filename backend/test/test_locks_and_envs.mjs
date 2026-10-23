import assert from 'assert';
import executionService from '../src/services/executionService.js';
import { WorkspaceLock, WorkspaceMember, User, syncDatabase } from '../src/models/index.js';
import { checkPathLocked } from '../src/controllers/lockController.js';

async function runTests() {
  console.log('\n─── Resource Locking & Execution Environment Verification ───────────');
  await syncDatabase();

  // Test 1: Supported environments metadata
  const supported = executionService.getSupportedEnvironments();
  assert(Array.isArray(supported), 'Supported environments should be an array');
  assert(supported.length >= 3, 'Should support at least Node, Python, and Java');
  assert(supported.find(e => e.id === 'node'), 'Node environment should be supported');
  assert(supported.find(e => e.id === 'python'), 'Python environment should be supported');
  assert(supported.find(e => e.id === 'java'), 'Java environment should be supported');
  console.log('  ✓ ExecutionService reports supported environments (Node, Python, Java)');

  // Test 2: ExecutionService environment listing and keying
  const workspaceId = 'test-lock-ws-1';
  const listEmpty = executionService.listEnvironments(workspaceId);
  assert(Array.isArray(listEmpty) && listEmpty.length === 0, 'No environments running initially');
  console.log('  ✓ ExecutionService lists empty active environments for workspace');

  // Test 3: Create WorkspaceLock for a file
  const testUser1 = await User.create({
    username: `lockuser1_${Date.now()}`,
    email: `lockuser1_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  });

  const testUser2 = await User.create({
    username: `lockuser2_${Date.now()}`,
    email: `lockuser2_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  });

  const fileLock = await WorkspaceLock.create({
    workspaceId,
    lockType: 'file',
    targetPath: 'src/main.js',
    lockedBy: testUser1.id,
    lockedByName: testUser1.username,
    reason: 'Refactoring core engine',
  });
  assert(fileLock.id, 'File lock should be created with an ID');
  console.log('  ✓ Successfully created file lock on src/main.js');

  // Test 4: checkPathLocked correctly blocks other users but allows locker
  const lockedForUser2 = await checkPathLocked(workspaceId, 'src/main.js', testUser2.id);
  assert(lockedForUser2.isLocked === true, 'src/main.js should be locked for user 2');
  assert.strictEqual(lockedForUser2.lock.lockedBy, testUser1.id, 'Lock should belong to user 1');

  const lockedForUser1 = await checkPathLocked(workspaceId, 'src/main.js', testUser1.id);
  assert(lockedForUser1.isLocked === false, 'src/main.js should NOT be locked for user 1 (the owner)');
  console.log('  ✓ checkPathLocked enforces locks for other users while allowing locker');

  // Test 5: Folder lock blocks all child files
  const folderLock = await WorkspaceLock.create({
    workspaceId,
    lockType: 'folder',
    targetPath: 'src/components',
    lockedBy: testUser1.id,
    lockedByName: testUser1.username,
  });
  assert(folderLock.id, 'Folder lock should be created');

  const childFileCheck = await checkPathLocked(workspaceId, 'src/components/Header.tsx', testUser2.id);
  assert(childFileCheck.isLocked === true, 'Child file inside locked folder should be locked');
  assert.strictEqual(childFileCheck.lock.targetPath, 'src/components', 'Lock target should be the parent folder');
  console.log('  ✓ Folder lock automatically protects all child files inside the folder');

  // Test 6: Release file lock
  await fileLock.destroy();
  const checkAfterRelease = await checkPathLocked(workspaceId, 'src/main.js', testUser2.id);
  assert(checkAfterRelease.isLocked === false, 'src/main.js should be free after releasing lock');
  console.log('  ✓ Releasing lock makes file editable again');

  // Clean up
  await folderLock.destroy();
  await testUser1.destroy();
  await testUser2.destroy();

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('  Lock & Environment Results: 6 passed, 0 failed');
  console.log('────────────────────────────────────────────────────────────\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
