import sequelize from '../src/config/database.js';
import { User, WorkspaceMember, WorkspaceInvite, syncDatabase } from '../src/models/index.js';
import { updateStudentAccess } from '../src/controllers/memberController.js';

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

async function run() {
  console.log('\n─── Professional Workspace: Developer & Tester Access Level Verification ───');
  await syncDatabase();

  const unique = Date.now();
  const adminUser = await User.create({
    username: `admin_${unique}`,
    email: `admin_${unique}@test.com`,
    password: 'password123',
  });

  const devUser = await User.create({
    username: `dev_${unique}`,
    email: `dev_${unique}@test.com`,
    password: 'password123',
  });

  const testerUser = await User.create({
    username: `tester_${unique}`,
    email: `tester_${unique}@test.com`,
    password: 'password123',
  });

  const wsId = `ws-prof-${unique}`;

  // 1. Admin member
  const adminMember = await WorkspaceMember.create({
    workspaceId: wsId,
    userId: adminUser.id,
    role: 'owner',
    studentAccess: 'editor',
  });
  assert(adminMember.role === 'owner', 'Admin created with full owner privileges');

  // 2. Developer member: initially developer has edit access
  const devMember = await WorkspaceMember.create({
    workspaceId: wsId,
    userId: devUser.id,
    role: 'developer',
    studentAccess: 'editor',
  });
  assert(devMember.role === 'developer' && devMember.studentAccess === 'editor', 'Developer initially has edit access');

  // 3. Tester member: initially tester has view access
  const testerMember = await WorkspaceMember.create({
    workspaceId: wsId,
    userId: testerUser.id,
    role: 'tester',
    studentAccess: 'viewer',
  });
  assert(testerMember.role === 'tester' && testerMember.studentAccess === 'viewer', 'Tester initially has view access');

  // Mock response helper
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
    return res;
  };

  const callHandler = (fn, req, res) =>
    new Promise((resolve) => {
      const origJson = res.json.bind(res);
      res.json = (data) => {
        const out = origJson(data);
        resolve(out);
        return out;
      };
      fn(req, res, (err) => {
        if (err) res.err = err;
        resolve();
      });
    });

  // 4. Admin toggles developer access to view ('view')
  const req1 = {
    params: { id: wsId, userId: devUser.id },
    body: { access: 'view' },
    membership: { role: 'owner' },
    user: { id: adminUser.id },
  };
  const res1 = createMockRes();
  await callHandler(updateStudentAccess, req1, res1);
  assert(res1.statusCode === 200 && res1.jsonData?.member?.studentAccess === 'viewer', 'Admin switched Developer access level to View');

  // 5. Admin toggles tester access to edit ('edit')
  const req2 = {
    params: { id: wsId, userId: testerUser.id },
    body: { access: 'edit' },
    membership: { role: 'owner' },
    user: { id: adminUser.id },
  };
  const res2 = createMockRes();
  await callHandler(updateStudentAccess, req2, res2);
  assert(res2.statusCode === 200 && res2.jsonData?.member?.studentAccess === 'editor', 'Admin switched Tester access level to Edit');

  // 6. Admin cannot modify own access level
  const req3 = {
    params: { id: wsId, userId: adminUser.id },
    body: { access: 'view' },
    membership: { role: 'owner' },
    user: { id: adminUser.id },
  };
  const res3 = createMockRes();
  await callHandler(updateStudentAccess, req3, res3);
  assert(res3.statusCode === 400, 'Admin cannot change their own access level');

  // 7. Non-admin cannot modify developer's access level
  const req4 = {
    params: { id: wsId, userId: devUser.id },
    body: { access: 'edit' },
    membership: { role: 'developer' },
    user: { id: devUser.id },
  };
  const res4 = createMockRes();
  await callHandler(updateStudentAccess, req4, res4);
  assert(res4.statusCode === 403, 'Developer/non-admin cannot change member access levels');

  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  Professional Developer & Tester Tests: ${passed} passed, ${failed} failed`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  await sequelize.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
