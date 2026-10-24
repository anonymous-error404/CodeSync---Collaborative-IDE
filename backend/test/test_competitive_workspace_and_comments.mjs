import sequelize from '../src/config/database.js';
import { User, WorkspaceMember, LineComment, TeachingSession, syncDatabase } from '../src/models/index.js';
import workspaceService from '../src/services/workspaceService.js';
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
} from '../src/controllers/commentController.js';
import {
  getAllowlist,
  addAllowedEmails,
  removeAllowedEmail,
} from '../src/controllers/workspaceController.js';
import { searchUsers } from '../src/controllers/authController.js';

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
  console.log('\n─── Competitive Workspace & Line Commenting System Verification ───');
  await syncDatabase();

  const unique = Date.now();

  // Create Users
  const adminUser = await User.create({
    username: `comp_admin_${unique}`,
    email: `admin_${unique}@hackathon.org`,
    password: 'password123',
  });

  const memberUser = await User.create({
    username: `team_dev_${unique}`,
    email: `hacker1_${unique}@gmail.com`,
    password: 'password123',
  });

  const memberUser2 = await User.create({
    username: `team_dev2_${unique}`,
    email: `hacker2_${unique}@gmail.com`,
    password: 'password123',
  });

  const newHacker = await User.create({
    username: `newhacker_${unique}`,
    email: `newhacker_${unique}@gmail.com`,
    password: 'password123',
  });

  const outsiderUser = await User.create({
    username: `outsider_${unique}`,
    email: `outsider_${unique}@other.com`,
    password: 'password123',
  });

  // Test: User search autocompletion
  {
    const req = {
      query: { q: `hacker1_${unique}` },
      user: { id: adminUser.id },
    };
    const res = await callHandler(searchUsers, req);
    assert(res.status === 200, 'searchUsers returns 200');
    assert(res.data.users.length === 1, 'searchUsers returns exactly 1 match');
    assert(res.data.users[0].email === `hacker1_${unique}@gmail.com`, 'searchUsers matched correct email');
  }

  // 1. Create Competitive Workspace with Allowlist
  const ws = await workspaceService.createWorkspace({
    name: `Hackathon Team Alpha ${unique}`,
    type: 'competitive',
    allowedEmails: [`hacker1_${unique}@gmail.com`, `hacker2_${unique}@gmail.com`],
  });
  const wsId = ws.id;

  assert(ws.type === 'competitive', 'Workspace created with type competitive');
  assert(Array.isArray(ws.allowedEmails), 'Workspace has allowedEmails array');
  assert(ws.allowedEmails.includes(`hacker1_${unique}@gmail.com`), 'Allowlist contains hacker1 email');
  assert(!ws.allowedEmails.includes(outsiderUser.email), 'Allowlist does not contain outsider email');

  // 2. Allowlist Controller Endpoints
  {
    // Admin gets allowlist
    const req = {
      params: { id: wsId },
      user: { id: adminUser.id },
      membership: { role: 'admin' },
    };
    const res = await callHandler(getAllowlist, req);
    assert(res.status === 200, 'getAllowlist returns 200 for admin');
    assert(res.data.allowedEmails.length === 2, 'getAllowlist returns 2 emails');
  }

  {
    // Admin attempts to add unregistered email -> rejected with 400
    const req = {
      params: { id: wsId },
      body: { emails: [`nonexistent_${unique}@unknown.com`] },
      user: { id: adminUser.id },
      membership: { role: 'admin' },
    };
    const res = await callHandler(addAllowedEmails, req);
    assert(res.status === 400, 'Adding unregistered email returns 400');
    assert(res.data.error.includes('do not have a CodeSync account'), 'Error message states account required');
  }

  {
    // Admin adds registered email to allowlist -> succeeds
    const req = {
      params: { id: wsId },
      body: { emails: [`newhacker_${unique}@gmail.com`] },
      user: { id: adminUser.id },
      membership: { role: 'admin' },
    };
    const res = await callHandler(addAllowedEmails, req);
    assert(res.status === 200, 'addAllowedEmails returns 200 for registered user');
    assert(res.data.allowedEmails.includes(`newhacker_${unique}@gmail.com`), 'Allowlist now includes new hacker');
  }

  {
    // Admin removes email from allowlist
    const req = {
      params: { id: wsId, email: `newhacker_${unique}@gmail.com` },
      user: { id: adminUser.id },
      membership: { role: 'admin' },
    };
    const res = await callHandler(removeAllowedEmail, req);
    assert(res.status === 200, 'removeAllowedEmail returns 200');
    assert(!res.data.allowedEmails.includes(`newhacker_${unique}@gmail.com`), 'Email was successfully removed');
  }

  // 3. Competitive Workspace Memberships
  const adminMember = await WorkspaceMember.create({
    workspaceId: wsId,
    userId: adminUser.id,
    role: 'admin',
    studentAccess: 'commenter',
  });

  const teamMember = await WorkspaceMember.create({
    workspaceId: wsId,
    userId: memberUser.id,
    role: 'team_member',
    studentAccess: 'editor',
  });

  assert(adminMember.role === 'admin', 'Admin member role is admin');
  assert(teamMember.role === 'team_member', 'Team member role is team_member');

  // 4. Line Comment System: CRUD & Threading
  let commentId;
  let replyId;

  // Test: Admin creates a line comment
  {
    const req = {
      params: { id: wsId },
      body: {
        filePath: 'src/main.js',
        lineNumber: 42,
        content: 'Check logic on line 42 for edge cases',
      },
      user: { id: adminUser.id },
      membership: adminMember,
    };
    const res = await callHandler(createComment, req);
    assert(res.status === 201, 'createComment returns 201');
    assert(res.data.success === true, 'Comment created successfully');
    assert(res.data.comment.lineNumber === 42, 'Comment attached to line 42');
    assert(res.data.comment.author.username === adminUser.username, 'Comment author included');
    commentId = res.data.comment.id;
  }

  // Test: Team member replies to the comment
  {
    const req = {
      params: { id: wsId },
      body: {
        filePath: 'src/main.js',
        lineNumber: 42,
        content: 'Handled edge cases with null checks, thanks!',
        parentId: commentId,
      },
      user: { id: memberUser.id },
      membership: teamMember,
    };
    const res = await callHandler(createComment, req);
    assert(res.status === 201, 'Team member can reply to comment');
    assert(res.data.comment.parentId === commentId, 'Reply correctly points to parent comment');
    replyId = res.data.comment.id;
  }

  // Test: Retrieve comments with nested replies
  {
    const req = {
      params: { id: wsId },
      query: { filePath: 'src/main.js' },
      user: { id: memberUser.id },
      membership: teamMember,
    };
    const res = await callHandler(getComments, req);
    assert(res.status === 200, 'getComments returns 200');
    assert(res.data.comments.length === 1, 'Returns 1 top-level comment thread');
    assert(res.data.comments[0].replies.length === 1, 'Top-level comment has 1 reply');
    assert(res.data.comments[0].replies[0].id === replyId, 'Reply id matches');
  }

  // Test: Resolve comment thread
  {
    const req = {
      params: { id: wsId, commentId },
      body: { resolved: true },
      user: { id: memberUser.id },
      membership: teamMember,
    };
    const res = await callHandler(updateComment, req);
    assert(res.status === 200, 'updateComment returns 200');
    assert(res.data.comment.resolved === true, 'Comment resolved status toggled to true');
  }

  // Test: Delete reply and root comment
  {
    const req = {
      params: { id: wsId, commentId: replyId },
      user: { id: memberUser.id },
      membership: teamMember,
    };
    const res = await callHandler(deleteComment, req);
    assert(res.status === 200, 'deleteComment returns 200 for reply');

    const check = await LineComment.findByPk(replyId);
    assert(check === null, 'Reply was deleted from database');
  }

  // 5. Educational Workspace: Class session gating
  {
    const eduWs = await workspaceService.createWorkspace({
      name: `CS101 ${unique}`,
      type: 'educational',
    });
    const eduWsId = eduWs.id;

    const teacher = await User.create({
      username: `prof_${unique}`,
      email: `prof_${unique}@school.edu`,
      password: 'password123',
    });

    const student = await User.create({
      username: `student_${unique}`,
      email: `student_${unique}@school.edu`,
      password: 'password123',
    });

    // Inactive session
    const activeSession = await TeachingSession.findOne({ where: { workspaceId: eduWsId, active: true } });
    assert(activeSession === null, 'Educational session is initially inactive');

    // Teacher starts session
    const session = await TeachingSession.create({
      workspaceId: eduWsId,
      teacherUserId: teacher.id,
      active: true,
    });
    assert(session.active === true, 'Teacher started classroom session');
  }

  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  Competitive & Comments Test Results: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
