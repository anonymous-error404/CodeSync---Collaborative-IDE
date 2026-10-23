import assert from 'assert';
import {
  roleRanks,
  canManageMemberRole,
  canRemoveMember,
  canCreateInviteRole,
  requireWorkspaceMember,
} from '../src/middleware/rbacMiddleware.js';
import {
  requireSessionRole,
  requireTeacher,
  requireStudent,
} from '../src/middleware/sessionMiddleware.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n─── Professional RBAC: Role Hierarchy & Rank Verification ─────────');

test('role hierarchy order: viewer < editor < admin < owner', () => {
  assert(roleRanks.viewer < roleRanks.editor);
  assert(roleRanks.editor < roleRanks.admin);
  assert(roleRanks.admin < roleRanks.owner);
});

console.log('\n─── Professional RBAC: Role Management Permissions ────────────────');

test('Owner can promote/demote to any role', () => {
  assert(canManageMemberRole('owner', 'viewer', 'editor') === true);
  assert(canManageMemberRole('owner', 'editor', 'admin') === true);
  assert(canManageMemberRole('owner', 'admin', 'viewer') === true);
  assert(canManageMemberRole('owner', 'admin', 'owner') === true);
});

test('Admin can change editor <-> viewer', () => {
  assert(canManageMemberRole('admin', 'viewer', 'editor') === true);
  assert(canManageMemberRole('admin', 'editor', 'viewer') === true);
});

test('Admin CANNOT alter owner or other admin', () => {
  assert(canManageMemberRole('admin', 'owner', 'editor') === false);
  assert(canManageMemberRole('admin', 'admin', 'viewer') === false);
});

test('Admin CANNOT promote to admin or owner', () => {
  assert(canManageMemberRole('admin', 'viewer', 'admin') === false);
  assert(canManageMemberRole('admin', 'editor', 'admin') === false);
  assert(canManageMemberRole('admin', 'editor', 'owner') === false);
});

test('Editor and Viewer CANNOT manage any roles', () => {
  assert(canManageMemberRole('editor', 'viewer', 'editor') === false);
  assert(canManageMemberRole('viewer', 'viewer', 'editor') === false);
});

console.log('\n─── Professional RBAC: Member Removal Permissions ─────────────────');

test('Owner can remove admin, editor, or viewer', () => {
  assert(canRemoveMember('owner', 'admin') === true);
  assert(canRemoveMember('owner', 'editor') === true);
  assert(canRemoveMember('owner', 'viewer') === true);
});

test('Admin can only remove editor or viewer', () => {
  assert(canRemoveMember('admin', 'editor') === true);
  assert(canRemoveMember('admin', 'viewer') === true);
  assert(canRemoveMember('admin', 'admin') === false);
  assert(canRemoveMember('admin', 'owner') === false);
});

test('Editor and Viewer CANNOT remove any members', () => {
  assert(canRemoveMember('editor', 'viewer') === false);
  assert(canRemoveMember('viewer', 'viewer') === false);
});

console.log('\n─── Professional RBAC: Invite Creation Permissions ────────────────');

test('Owner and Admin can invite admin, editor, or viewer', () => {
  assert(canCreateInviteRole('owner', 'admin') === true);
  assert(canCreateInviteRole('owner', 'editor') === true);
  assert(canCreateInviteRole('owner', 'viewer') === true);
  assert(canCreateInviteRole('admin', 'admin') === true);
  assert(canCreateInviteRole('admin', 'editor') === true);
  assert(canCreateInviteRole('admin', 'viewer') === true);
});

test('Editor can ONLY invite editor or viewer', () => {
  assert(canCreateInviteRole('editor', 'editor') === true);
  assert(canCreateInviteRole('editor', 'viewer') === true);
  assert(canCreateInviteRole('editor', 'admin') === false);
});

test('NO ONE can create an owner invite via link', () => {
  assert(canCreateInviteRole('owner', 'owner') === false);
  assert(canCreateInviteRole('admin', 'owner') === false);
  assert(canCreateInviteRole('editor', 'owner') === false);
});

test('Viewer cannot create any invites', () => {
  assert(canCreateInviteRole('viewer', 'viewer') === false);
  assert(canCreateInviteRole('viewer', 'editor') === false);
});

console.log('\n─── Professional RBAC: Middleware Enforcement ──────────────────────');

testAsync('requireWorkspaceMember blocks unauthenticated request', async () => {
  const middleware = requireWorkspaceMember('viewer');
  let status = 0;
  let json = {};
  const req = { params: { id: 'ws-123' }, user: null };
  const res = {
    status: (s) => { status = s; return { json: (j) => { json = j; } }; }
  };
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(status, 401);
  assert.strictEqual(json.success, false);
  assert.strictEqual(nextCalled, false);
});

testAsync('requireWorkspaceMember blocks missing workspace ID', async () => {
  const middleware = requireWorkspaceMember('viewer');
  let status = 0;
  let json = {};
  const req = { params: {}, user: { id: 1 } };
  const res = {
    status: (s) => { status = s; return { json: (j) => { json = j; } }; }
  };
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(status, 400);
  assert.strictEqual(json.success, false);
  assert.strictEqual(nextCalled, false);
});

console.log('\n─── Education RBAC: Roles & Student Access Permissions ─────────────');

test('Teacher has administrative leadership rank (rank 4)', () => {
  assert.strictEqual(roleRanks.teacher, 4);
  assert(roleRanks.teacher >= roleRanks.admin);
  assert(roleRanks.teacher >= roleRanks.editor);
});

test('Teacher can assign student role and manage members', () => {
  assert(canManageMemberRole('teacher', 'student', 'viewer') === true);
  assert(canManageMemberRole('teacher', 'viewer', 'student') === true);
  assert(canRemoveMember('teacher', 'student') === true);
});

test('Students cannot manage roles or remove members', () => {
  assert(canManageMemberRole('student', 'student', 'teacher') === false);
  assert(canRemoveMember('student', 'student') === false);
});

test('Teacher can create student, editor, or viewer invites', () => {
  assert(canCreateInviteRole('teacher', 'student') === true);
  assert(canCreateInviteRole('teacher', 'editor') === true);
  assert(canCreateInviteRole('teacher', 'viewer') === true);
  assert(canCreateInviteRole('teacher', 'teacher') === false); // Teacher cannot be claimed via invite link
});

test('Professional Team Leader and Developer role ranks', () => {
  assert.strictEqual(roleRanks.team_leader, 4);
  assert.strictEqual(roleRanks.developer, 2);
  assert(canManageMemberRole('team_leader', 'developer', 'viewer') === true);
  assert(canRemoveMember('team_leader', 'developer') === true);
  assert(canCreateInviteRole('team_leader', 'developer') === true);
});

console.log('\n─── Education RBAC: Session Role Middleware ────────────────────────');

test('requireTeacher and requireStudent middleware are defined', () => {
  assert.strictEqual(typeof requireTeacher, 'function');
  assert.strictEqual(typeof requireStudent, 'function');
  assert.strictEqual(typeof requireSessionRole('teacher'), 'function');
});

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`  RBAC Results: ${passed} passed, ${failed} failed`);
console.log(`────────────────────────────────────────────────────────────\n`);

if (failed > 0) process.exit(1);
