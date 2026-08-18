const http = require('http');

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqOptions = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let resBody = '';
      res.on('data', (chunk) => (resBody += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(resBody);
        } catch {
          parsed = resBody;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));
    if (data) req.write(data);
    req.end();
  });
};

const runE2E = async () => {
  console.log('\n======================================================');
  console.log('  RUNNING LIVE FRONTEND-BACKEND AUTH INTEGRATION TEST  ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (cond, title) => {
    if (cond) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title}`);
      failed++;
    }
  };

  const testUser = {
    username: 'e2e_developer',
    email: 'e2e_dev@codesync.io',
    password: 'E2EPassword123!',
  };

  // 1. Health check
  const health = await request('GET', '/health');
  assert(health.status === 200 && health.body.status === 'ok', '1. Live Server Health Check is OK');

  // 2. Register valid data
  const regValid = await request('POST', '/api/auth/register', testUser);
  assert(
    regValid.status === 201 &&
    regValid.body.success === true &&
    Boolean(regValid.body.token) &&
    regValid.body.user.username === testUser.username &&
    regValid.body.user.password === undefined,
    '2. Register with valid data succeeds & returns JWT token + sanitized user'
  );
  const token = regValid.body.token;

  // 3. Register invalid data (Short password)
  const regShortPass = await request('POST', '/api/auth/register', {
    username: 'shortuser',
    email: 'short@codesync.io',
    password: '123',
  });
  assert(regShortPass.status === 400 && regShortPass.body.success === false, '3. Register with invalid password rejected (400 Bad Request)');

  // 4. Duplicate registration (Email)
  const regDup = await request('POST', '/api/auth/register', {
    username: 'another_name',
    email: testUser.email,
    password: 'SomePassword123',
  });
  assert(regDup.status === 409 && regDup.body.success === false, '4. Duplicate email registration rejected (409 Conflict)');

  // 5. Duplicate registration (Username)
  const regDupUser = await request('POST', '/api/auth/register', {
    username: testUser.username,
    email: 'unique_email@codesync.io',
    password: 'SomePassword123',
  });
  assert(regDupUser.status === 409 && regDupUser.body.success === false, '5. Duplicate username registration rejected (409 Conflict)');

  // 6. Login with valid credentials
  const loginValid = await request('POST', '/api/auth/login', {
    email: testUser.email,
    password: testUser.password,
  });
  assert(
    loginValid.status === 200 &&
    loginValid.body.success === true &&
    Boolean(loginValid.body.token) &&
    loginValid.body.user.email === testUser.email,
    '6. Login with valid credentials succeeds & returns session'
  );

  // 7. Login with incorrect password
  const loginBadPass = await request('POST', '/api/auth/login', {
    email: testUser.email,
    password: 'WrongPassword!',
  });
  assert(loginBadPass.status === 401 && loginBadPass.body.success === false, '7. Login with incorrect password rejected (401 Unauthorized)');

  // 8. Login with non-existing account
  const loginNonExist = await request('POST', '/api/auth/login', {
    email: 'ghost@nowhere.com',
    password: 'SomePassword123!',
  });
  assert(loginNonExist.status === 401 && loginNonExist.body.success === false, '8. Login with non-existing account rejected (401 Unauthorized)');

  // 9. Session Persistence / Re-hydration: GET /api/auth/me with Bearer token
  const me = await request('GET', '/api/auth/me', null, {
    Authorization: `Bearer ${token}`,
  });
  assert(
    me.status === 200 &&
    me.body.success === true &&
    me.body.user.username === testUser.username,
    '9. Authentication persistence verified (GET /api/auth/me returns active profile)'
  );

  // 10. Logout state: unauthenticated requests to protected endpoints fail
  const noToken = await request('GET', '/api/auth/me');
  assert(noToken.status === 401 && noToken.body.success === false, '10. Logged out state prevents access to protected resources (401)');

  console.log('\n======================================================');
  console.log(`  E2E RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runE2E();
