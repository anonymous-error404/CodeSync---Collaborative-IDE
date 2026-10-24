import sequelize from '../src/config/database.js';
import { User, WorkspaceMember, syncDatabase } from '../src/models/index.js';
import { updateBulkStudentAccess } from '../src/controllers/memberController.js';

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

async function run() {
  console.log('\n─── Bulk Member Access Controller Verification ───');
  await syncDatabase();

  const unique = Date.now();
  const teacherUser = await User.create({
    username: `teacher_${unique}`,
    email: `teacher_${unique}@test.com`,
    password: 'password123',
  });

  const student1 = await User.create({
    username: `student1_${unique}`,
    email: `student1_${unique}@test.com`,
    password: 'password123',
  });

  const student2 = await User.create({
    username: `student2_${unique}`,
    email: `student2_${unique}@test.com`,
    password: 'password123',
  });

  const student3 = await User.create({
    username: `student3_${unique}`,
    email: `student3_${unique}@test.com`,
    password: 'password123',
  });

  const wsId = `ws-bulk-${unique}`;

  await WorkspaceMember.create({
    workspaceId: wsId,
    userId: teacherUser.id,
    role: 'teacher',
    studentAccess: 'editor',
  });

  await WorkspaceMember.create({
    workspaceId: wsId,
    userId: student1.id,
    role: 'student',
    studentAccess: 'viewer',
  });

  await WorkspaceMember.create({
    workspaceId: wsId,
    userId: student2.id,
    role: 'student',
    studentAccess: 'viewer',
  });

  await WorkspaceMember.create({
    workspaceId: wsId,
    userId: student3.id,
    role: 'student',
    studentAccess: 'viewer',
  });

  // Test 1: Bulk update student1 and student2 to 'edit'
  {
    const req = {
      params: { id: wsId },
      body: {
        userIds: [student1.id, student2.id],
        access: 'edit',
      },
      user: { id: teacherUser.id },
      membership: { role: 'teacher' },
    };

    const res = await callHandler(updateBulkStudentAccess, req);
    assert(res.status === 200, 'Bulk update returned status 200');
    assert(res.data.success === true, 'Bulk update reported success');
    assert(res.data.updatedCount === 2, 'Updated exactly 2 members');
    assert(res.data.studentAccess === 'editor', 'Normalized access set to editor');

    const m1 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student1.id } });
    const m2 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student2.id } });
    const m3 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student3.id } });
    assert(m1.studentAccess === 'editor', 'student1 updated to editor in DB');
    assert(m2.studentAccess === 'editor', 'student2 updated to editor in DB');
    assert(m3.studentAccess === 'viewer', 'student3 remained viewer');
  }

  // Test 2: Bulk update all three to 'comment'
  {
    const req = {
      params: { id: wsId },
      body: {
        userIds: [student1.id, student2.id, student3.id],
        access: 'comment',
      },
      user: { id: teacherUser.id },
      membership: { role: 'teacher' },
    };

    const res = await callHandler(updateBulkStudentAccess, req);
    assert(res.status === 200, 'Bulk update to comment returned status 200');
    assert(res.data.updatedCount === 3, 'Updated 3 members to comment');

    const m1 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student1.id } });
    const m2 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student2.id } });
    const m3 = await WorkspaceMember.findOne({ where: { workspaceId: wsId, userId: student3.id } });
    assert(m1.studentAccess === 'commenter', 'student1 is commenter');
    assert(m2.studentAccess === 'commenter', 'student2 is commenter');
    assert(m3.studentAccess === 'commenter', 'student3 is commenter');
  }

  // Test 3: Attempting to update self is filtered out
  {
    const req = {
      params: { id: wsId },
      body: {
        userIds: [teacherUser.id],
        access: 'view',
      },
      user: { id: teacherUser.id },
      membership: { role: 'teacher' },
    };

    const res = await callHandler(updateBulkStudentAccess, req);
    assert(res.status === 400, 'Cannot bulk update self (returns 400 no eligible members)');
  }

  // Test 4: Invalid access level rejected
  {
    const req = {
      params: { id: wsId },
      body: {
        userIds: [student1.id],
        access: 'invalid-access',
      },
      user: { id: teacherUser.id },
      membership: { role: 'teacher' },
    };

    const res = await callHandler(updateBulkStudentAccess, req);
    assert(res.status === 400, 'Invalid access level returns 400');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
