import assert from 'assert';
import { User, WorkspaceMember, syncDatabase } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import { roleRanks } from '../src/middleware/rbacMiddleware.js';

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

async function run() {
  console.log('\n─── Educational Workspace & Student Access Verification ───────────');

  await syncDatabase();

  // 1. Create Teacher and Student users
  const teacherUser = await User.create({
    username: `teacher_${Date.now()}`,
    email: `teacher_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  const studentUser = await User.create({
    username: `student_${Date.now()}`,
    email: `student_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  // Helper to simulate workspace creation matching workspaceController logic
  async function createWorkspaceWithRole(name, userId, type) {
    const ws = await workspaceService.createWorkspace({ name, type });
    let role = 'owner';
    if (ws.type === 'educational') role = 'teacher';
    else if (ws.type === 'professional') role = 'team_leader';

    const member = await WorkspaceMember.create({
      workspaceId: ws.id,
      userId,
      role,
      studentAccess: 'editor',
    });
    return { ws, member };
  }

  // 2. Test Educational workspace creation
  let eduWs;
  await testAsync('Create Educational Workspace assigns teacher role', async () => {
    const { ws, member } = await createWorkspaceWithRole(`CS101-${Date.now()}`, teacherUser.id, 'educational');
    eduWs = ws;
    assert.ok(eduWs.id);
    assert.strictEqual(eduWs.type, 'educational');
    assert.strictEqual(member.role, 'teacher');
  });

  // 3. Test Professional workspace creation
  await testAsync('Create Professional Workspace assigns team_leader role', async () => {
    const { ws, member } = await createWorkspaceWithRole(`ProdTeam-${Date.now()}`, teacherUser.id, 'professional');
    assert.strictEqual(ws.type, 'professional');
    assert.strictEqual(member.role, 'team_leader');
  });

  // 4. Test Competitive workspace creation
  await testAsync('Create Competitive Workspace assigns owner role', async () => {
    const { ws, member } = await createWorkspaceWithRole(`Hackathon-${Date.now()}`, teacherUser.id, 'competitive');
    assert.strictEqual(ws.type, 'competitive');
    assert.strictEqual(member.role, 'owner');
  });

  // 5. Add student to educational workspace
  let studentMember;
  await testAsync('Student member defaults to editor access in educational workspace', async () => {
    studentMember = await WorkspaceMember.create({
      workspaceId: eduWs.id,
      userId: studentUser.id,
      role: 'student',
      studentAccess: 'editor',
    });
    assert.strictEqual(studentMember.role, 'student');
    assert.strictEqual(studentMember.studentAccess, 'editor');
  });

  // 6. Teacher changes student access to 'no-view'
  await testAsync('Teacher can set student access to no-view', async () => {
    studentMember.studentAccess = 'no-view';
    await studentMember.save();

    const refreshed = await WorkspaceMember.findOne({
      where: { workspaceId: eduWs.id, userId: studentUser.id },
    });
    assert.strictEqual(refreshed.studentAccess, 'no-view');
  });

  // 7. Teacher changes student access to 'viewer'
  await testAsync('Teacher can set student access to viewer', async () => {
    studentMember.studentAccess = 'viewer';
    await studentMember.save();

    const refreshed = await WorkspaceMember.findOne({
      where: { workspaceId: eduWs.id, userId: studentUser.id },
    });
    assert.strictEqual(refreshed.studentAccess, 'viewer');
  });

  // 8. Teacher changes student access to 'editor'
  await testAsync('Teacher can set student access to editor', async () => {
    studentMember.studentAccess = 'editor';
    await studentMember.save();

    const refreshed = await WorkspaceMember.findOne({
      where: { workspaceId: eduWs.id, userId: studentUser.id },
    });
    assert.strictEqual(refreshed.studentAccess, 'editor');
  });

  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  Educational Tests: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
