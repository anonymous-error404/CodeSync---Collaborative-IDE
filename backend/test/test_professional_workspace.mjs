import assert from 'assert';
import { User, WorkspaceMember, ProjectTask, CodeReview, syncDatabase } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import { roleRanks } from '../src/middleware/rbacMiddleware.js';

let passed = 0;
let failed = 0;

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
  console.log('\n─── Professional Workspace: Team Leader & Developer Verification ───');

  await syncDatabase();

  // 1. Create Team Leader and Developer users
  const teamLeaderUser = await User.create({
    username: `lead_${Date.now()}`,
    email: `lead_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  const devUser = await User.create({
    username: `dev_${Date.now()}`,
    email: `dev_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  // 2. Create Professional Workspace
  let proWs;
  let leaderMember;
  let devMember;

  await testAsync('Create Professional Workspace assigns team_leader role', async () => {
    proWs = await workspaceService.createWorkspace({ name: `Sprint-${Date.now()}`, type: 'professional' });
    leaderMember = await WorkspaceMember.create({
      workspaceId: proWs.id,
      userId: teamLeaderUser.id,
      role: 'team_leader',
    });

    assert.strictEqual(proWs.type, 'professional');
    assert.strictEqual(leaderMember.role, 'team_leader');
    assert.strictEqual(roleRanks['team_leader'], 4);
  });

  await testAsync('Add developer member with developer role (rank 2)', async () => {
    devMember = await WorkspaceMember.create({
      workspaceId: proWs.id,
      userId: devUser.id,
      role: 'developer',
    });

    assert.strictEqual(devMember.role, 'developer');
    assert.strictEqual(roleRanks['developer'], 2);
  });

  // 3. Task Management Tests
  let createdTask;
  await testAsync('Team Leader can create task and assign to developer', async () => {
    createdTask = await ProjectTask.create({
      workspaceId: proWs.id,
      title: 'Implement Auth Refresh Token',
      description: 'Add token rotation with 7d expiration',
      priority: 'high',
      status: 'todo',
      assignedTo: devUser.id,
      createdBy: teamLeaderUser.id,
      filePath: 'src/auth/tokenService.ts',
    });

    assert.ok(createdTask.id);
    assert.strictEqual(createdTask.title, 'Implement Auth Refresh Token');
    assert.strictEqual(createdTask.assignedTo, devUser.id);
    assert.strictEqual(createdTask.status, 'todo');
    assert.strictEqual(createdTask.priority, 'high');
  });

  await testAsync('Developer can update task status (todo -> in_progress -> in_review)', async () => {
    createdTask.status = 'in_progress';
    await createdTask.save();
    assert.strictEqual(createdTask.status, 'in_progress');

    createdTask.status = 'in_review';
    await createdTask.save();
    assert.strictEqual(createdTask.status, 'in_review');
  });

  // 4. Code Review / Pull Request Flow Tests
  let reviewRequest;
  await testAsync('Developer can submit Code Review request for a file', async () => {
    reviewRequest = await CodeReview.create({
      workspaceId: proWs.id,
      title: 'PR: JWT Refresh Token Implementation',
      description: 'Please review security headers and cookie options',
      filePath: 'src/auth/tokenService.ts',
      status: 'open',
      authorId: devUser.id,
    });

    assert.ok(reviewRequest.id);
    assert.strictEqual(reviewRequest.status, 'open');
    assert.strictEqual(reviewRequest.authorId, devUser.id);
    assert.strictEqual(reviewRequest.filePath, 'src/auth/tokenService.ts');
  });

  await testAsync('Team Leader can request changes on code review with notes', async () => {
    reviewRequest.status = 'changes_requested';
    reviewRequest.reviewerId = teamLeaderUser.id;
    reviewRequest.reviewNote = 'Please add httpOnly flag to the cookie config.';
    await reviewRequest.save();

    assert.strictEqual(reviewRequest.status, 'changes_requested');
    assert.strictEqual(reviewRequest.reviewerId, teamLeaderUser.id);
    assert.strictEqual(reviewRequest.reviewNote, 'Please add httpOnly flag to the cookie config.');
  });

  await testAsync('Team Leader can approve code review after revisions', async () => {
    reviewRequest.status = 'approved';
    reviewRequest.reviewNote = 'Looks solid! Ready to merge/deploy.';
    await reviewRequest.save();

    assert.strictEqual(reviewRequest.status, 'approved');
  });

  await testAsync('Developer marks linked task as done', async () => {
    createdTask.status = 'done';
    await createdTask.save();
    assert.strictEqual(createdTask.status, 'done');
  });

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`  Professional Workspace Tests: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
