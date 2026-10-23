import assert from 'assert';
import { User, WorkspaceMember, syncDatabase } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getReviews,
  createReview,
  updateReviewStatus,
  deleteReview,
} from '../src/controllers/professionalController.js';

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

function callHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        resolve(this);
      },
    };
    handler(req, res, (err) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

async function run() {
  console.log('\n─── Professional Controller & REST Routes Verification ─────────────');

  await syncDatabase();

  const leaderUser = await User.create({
    username: `lead_ctrl_${Date.now()}`,
    email: `lead_ctrl_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  const devUser = await User.create({
    username: `dev_ctrl_${Date.now()}`,
    email: `dev_ctrl_${Date.now()}@test.com`,
    password: 'Password123!',
  });

  const ws = await workspaceService.createWorkspace({ name: `CtrlTest-${Date.now()}`, type: 'professional' });
  await WorkspaceMember.create({ workspaceId: ws.id, userId: leaderUser.id, role: 'team_leader' });
  await WorkspaceMember.create({ workspaceId: ws.id, userId: devUser.id, role: 'developer' });

  let createdTaskId;
  await testAsync('createTask controller successfully creates a task', async () => {
    const req = {
      params: { id: ws.id },
      body: {
        title: 'API Rate Limiting',
        description: 'Configure express-rate-limit middleware',
        priority: 'high',
        assignedTo: devUser.id,
        filePath: 'src/middleware/rateLimit.js',
      },
      user: { id: leaderUser.id },
      membership: { role: 'team_leader' },
    };
    const res = await callHandler(createTask, req);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.task.title, 'API Rate Limiting');
    assert.strictEqual(res.body.task.assignedTo, devUser.id);
    createdTaskId = res.body.task.id;
  });

  await testAsync('getTasks returns task with assignee information', async () => {
    const req = { params: { id: ws.id } };
    const res = await callHandler(getTasks, req);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.tasks));
    assert.strictEqual(res.body.tasks.length, 1);
    assert.strictEqual(res.body.tasks[0].assignee.username, devUser.username);
  });

  await testAsync('updateTask updates task status', async () => {
    const req = {
      params: { taskId: createdTaskId },
      body: { status: 'in_progress' },
      user: { id: devUser.id },
      membership: { role: 'developer' },
    };
    const res = await callHandler(updateTask, req);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.task.status, 'in_progress');
  });

  let createdReviewId;
  await testAsync('createReview submits code review request', async () => {
    const req = {
      params: { id: ws.id },
      body: {
        title: 'Rate limiter setup review',
        description: 'Ready for leader review',
        filePath: 'src/middleware/rateLimit.js',
      },
      user: { id: devUser.id },
      membership: { role: 'developer' },
    };
    const res = await callHandler(createReview, req);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.review.status, 'open');
    createdReviewId = res.body.review.id;
  });

  await testAsync('updateReviewStatus lets Team Leader approve review with notes', async () => {
    const req = {
      params: { reviewId: createdReviewId },
      body: {
        status: 'approved',
        reviewNote: 'Looks great! Merged.',
      },
      user: { id: leaderUser.id },
      membership: { role: 'team_leader' },
    };
    const res = await callHandler(updateReviewStatus, req);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.review.status, 'approved');
    assert.strictEqual(res.body.review.reviewNote, 'Looks great! Merged.');
  });

  await testAsync('deleteTask removes task', async () => {
    const req = {
      params: { taskId: createdTaskId },
      user: { id: leaderUser.id },
      membership: { role: 'team_leader' },
    };
    const res = await callHandler(deleteTask, req);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
  });

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`  Professional Controller Tests: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
