import sequelize from '../src/config/database.js';
import {
  User,
  WorkspaceMember,
  WorkspaceInvite,
  LineComment,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
  WorkspaceLock,
  syncDatabase,
} from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import storageService from '../src/services/storageService.js';
import {
  createWorkspace,
  listWorkspaces,
  deleteWorkspace,
  bulkDeleteWorkspaces,
} from '../src/controllers/workspaceController.js';
import { requireWorkspaceOwner } from '../src/middleware/rbacMiddleware.js';
import fsSync from 'fs';
import { getWorkspacePath } from '../src/utils/pathSandbox.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function callHandler(handler, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, data });
      },
    };
    handler(req, res, (err) => {
      if (err) resolve({ status: 500, error: err });
    });
  });
}

async function callMiddleware(middleware, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, data, passed: false });
      },
    };
    middleware(req, res, () => {
      resolve({ status: 200, passed: true });
    });
  });
}

async function run() {
  console.log('\n─── Workspace Single & Bulk Deletion System Verification ───');
  await syncDatabase();

  const unique = Date.now();

  // Create test users
  const leadUser = await User.create({
    username: `lead_${unique}`,
    email: `lead_${unique}@test.com`,
    password: 'password123',
  });

  const memberUser = await User.create({
    username: `member_${unique}`,
    email: `member_${unique}@test.com`,
    password: 'password123',
  });

  // Test 1: Educational Workspace Single Deletion
  console.log('\n[Test 1] Educational Workspace Single Deletion (Teacher)');
  const eduCreateRes = await callHandler(createWorkspace, {
    body: { name: `Edu-Test-${unique}`, type: 'educational' },
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(eduCreateRes.status === 201 && eduCreateRes.data.success, 'Educational workspace created');
  const eduWsId = eduCreateRes.data.workspace.id;

  // Check RBAC delete permission for teacher
  const eduRbacRes = await callMiddleware(requireWorkspaceOwner, {
    params: { id: eduWsId },
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(eduRbacRes.passed === true, 'Teacher has delete authority via requireWorkspaceOwner');

  // Verify DB membership exists
  let mem = await WorkspaceMember.findOne({ where: { workspaceId: eduWsId, userId: leadUser.id } });
  assert(mem !== null && mem.role === 'teacher', 'Teacher membership exists in DB');

  // Perform deletion
  const eduDeleteRes = await callHandler(deleteWorkspace, {
    params: { id: eduWsId },
    user: { id: leadUser.id },
  });
  assert(eduDeleteRes.status === 200 && eduDeleteRes.data.success, 'Educational workspace deleted');

  // Verify DB cleanup
  mem = await WorkspaceMember.findOne({ where: { workspaceId: eduWsId } });
  assert(mem === null, 'All WorkspaceMember rows for workspace destroyed from DB');

  // Verify Disk cleanup
  const eduDirPath = getWorkspacePath(eduWsId);
  assert(!fsSync.existsSync(eduDirPath), 'Workspace directory deleted from disk');

  // Verify listWorkspaces does not return it on reload/re-fetch
  const listRes1 = await callHandler(listWorkspaces, {
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(!listRes1.data.workspaces.some(w => w.id === eduWsId), 'Workspace not returned in listWorkspaces after deletion');

  // Test 2: Competitive Workspace Deletion (Admin)
  console.log('\n[Test 2] Competitive Workspace Deletion (Admin)');
  const compCreateRes = await callHandler(createWorkspace, {
    body: { name: `Comp-Test-${unique}`, type: 'competitive', allowedEmails: [memberUser.email] },
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(compCreateRes.status === 201 && compCreateRes.data.success, 'Competitive workspace created');
  const compWsId = compCreateRes.data.workspace.id;

  // Check RBAC delete permission for competitive admin
  const compRbacRes = await callMiddleware(requireWorkspaceOwner, {
    params: { id: compWsId },
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(compRbacRes.passed === true, 'Competitive Admin has delete authority via requireWorkspaceOwner');

  // Add line comment and check cleanup
  await LineComment.create({
    workspaceId: compWsId,
    filePath: 'index.js',
    lineNumber: 1,
    content: 'Awesome code!',
    userId: leadUser.id,
  });

  // Delete competitive workspace
  const compDeleteRes = await callHandler(deleteWorkspace, {
    params: { id: compWsId },
    user: { id: leadUser.id },
  });
  assert(compDeleteRes.status === 200 && compDeleteRes.data.success, 'Competitive workspace deleted');

  // Verify comments destroyed
  const remainingComments = await LineComment.findAll({ where: { workspaceId: compWsId } });
  assert(remainingComments.length === 0, 'Associated LineComments destroyed on delete');

  // Verify listWorkspaces for admin and allowed member
  const listResAdmin = await callHandler(listWorkspaces, {
    user: { id: leadUser.id, email: leadUser.email },
  });
  assert(!listResAdmin.data.workspaces.some(w => w.id === compWsId), 'Deleted competitive workspace gone for admin');

  // Test 3: Unauthorized Member Cannot Delete (RBAC rejection)
  console.log('\n[Test 3] Non-lead Member Rejection');
  const profCreateRes = await callHandler(createWorkspace, {
    body: { name: `Prof-Test-${unique}`, type: 'professional' },
    user: { id: leadUser.id, email: leadUser.email },
  });
  const profWsId = profCreateRes.data.workspace.id;

  // Add developer member
  await WorkspaceMember.create({
    workspaceId: profWsId,
    userId: memberUser.id,
    role: 'developer',
    studentAccess: 'editor',
  });

  // Developer tries to delete
  const devRbacRes = await callMiddleware(requireWorkspaceOwner, {
    params: { id: profWsId },
    user: { id: memberUser.id, email: memberUser.email },
  });
  assert(devRbacRes.passed === false && devRbacRes.status === 403, 'Developer rejected with 403 Forbidden from delete');

  // Test 4: Bulk Workspace Deletion
  console.log('\n[Test 4] Bulk Workspace Deletion (Multiple Select)');
  const ws1 = await callHandler(createWorkspace, {
    body: { name: `Bulk-1-${unique}`, type: 'educational' },
    user: { id: leadUser.id, email: leadUser.email },
  });
  const ws2 = await callHandler(createWorkspace, {
    body: { name: `Bulk-2-${unique}`, type: 'professional' },
    user: { id: leadUser.id, email: leadUser.email },
  });
  const ws3 = await callHandler(createWorkspace, {
    body: { name: `Bulk-3-${unique}`, type: 'competitive', allowedEmails: [memberUser.email] },
    user: { id: leadUser.id, email: leadUser.email },
  });

  const idsToBulkDelete = [profWsId, ws1.data.workspace.id, ws2.data.workspace.id, ws3.data.workspace.id];

  const bulkDeleteRes = await callHandler(bulkDeleteWorkspaces, {
    body: { workspaceIds: idsToBulkDelete },
    user: { id: leadUser.id, email: leadUser.email },
  });

  assert(bulkDeleteRes.status === 200 && bulkDeleteRes.data.success, 'Bulk delete endpoint succeeded');
  assert(bulkDeleteRes.data.deletedIds.length === 4, `All 4 workspaces deleted in bulk (deleted: ${bulkDeleteRes.data.deletedIds.length})`);
  assert(bulkDeleteRes.data.failedIds.length === 0, 'No failed deletions for lead user');

  // Verify none remain in listWorkspaces
  const finalList = await callHandler(listWorkspaces, {
    user: { id: leadUser.id, email: leadUser.email },
  });
  const anyRemains = idsToBulkDelete.some(id => finalList.data.workspaces.some(w => w.id === id));
  assert(!anyRemains, 'None of the bulk-deleted workspaces appear in workspace list');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
