const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test environment before requiring anything
process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = './test_database.sqlite';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

const { syncDatabase, sequelize, User } = require('./models');
const { app, startServer } = require('../server');

// Helper to make HTTP requests
const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqOptions = {
      hostname: '127.0.0.1',
      port: 5001,
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

const runTests = async () => {
  console.log('\n=============================================');
  console.log('  STARTING CODESYNC AUTHENTICATION TEST SUITE ');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;
  let runningServer = null;

  const assert = (condition, testName, extraInfo = '') => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${extraInfo ? '- ' + extraInfo : ''}`);
      failed++;
    }
  };

  try {
    // Start test server on port 5001
    runningServer = await startServer(5001);

    // 1. Health check
    const healthRes = await request('GET', '/health');
    assert(healthRes.status === 200 && healthRes.body.status === 'ok', '1. Health check endpoint responds with 200 OK');

    // 2. Test Registration with Valid Data
    const validUser = {
      username: 'testdeveloper',
      email: 'dev@codesync.io',
      password: 'StrongPassword123!',
    };
    const regRes = await request('POST', '/api/auth/register', validUser);
    assert(
      regRes.status === 201 &&
      regRes.body.success === true &&
      Boolean(regRes.body.token) &&
      regRes.body.user.username === 'testdeveloper' &&
      regRes.body.user.email === 'dev@codesync.io' &&
      regRes.body.user.password === undefined,
      '2. User registration with valid data succeeds and does not expose password'
    );
    const authToken = regRes.body.token;

    // 3. Test Duplicate Email Registration
    const dupEmailUser = {
      username: 'anotherdev',
      email: 'dev@codesync.io',
      password: 'AnotherPassword123',
    };
    const dupEmailRes = await request('POST', '/api/auth/register', dupEmailUser);
    assert(
      dupEmailRes.status === 409 && dupEmailRes.body.success === false,
      '3. Duplicate email registration rejected with 409 Conflict'
    );

    // 4. Test Duplicate Username Registration
    const dupUser = {
      username: 'testdeveloper',
      email: 'different@codesync.io',
      password: 'AnotherPassword123',
    };
    const dupUserRes = await request('POST', '/api/auth/register', dupUser);
    assert(
      dupUserRes.status === 409 && dupUserRes.body.success === false,
      '4. Duplicate username registration rejected with 409 Conflict'
    );

    // 5. Test Registration Input Validation (Short password)
    const shortPassUser = {
      username: 'validuser',
      email: 'valid@codesync.io',
      password: '123',
    };
    const shortPassRes = await request('POST', '/api/auth/register', shortPassUser);
    assert(
      shortPassRes.status === 400 && shortPassRes.body.success === false,
      '5. Password under 6 characters rejected with 400 Bad Request'
    );

    // 6. Test Registration Input Validation (Invalid email format)
    const badEmailUser = {
      username: 'validuser',
      email: 'invalid-email-format',
      password: 'ValidPassword123',
    };
    const badEmailRes = await request('POST', '/api/auth/register', badEmailUser);
    assert(
      badEmailRes.status === 400 && badEmailRes.body.success === false,
      '6. Invalid email format rejected with 400 Bad Request'
    );

    // 7. Test Registration Input Validation (Missing fields)
    const missingFieldUser = {
      username: 'validuser',
    };
    const missingFieldRes = await request('POST', '/api/auth/register', missingFieldUser);
    assert(
      missingFieldRes.status === 400 && missingFieldRes.body.success === false,
      '7. Missing required fields rejected with 400 Bad Request'
    );

    // 8. Test Login with Valid Credentials (Email)
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'dev@codesync.io',
      password: 'StrongPassword123!',
    });
    assert(
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      Boolean(loginRes.body.token) &&
      loginRes.body.user.email === 'dev@codesync.io' &&
      loginRes.body.user.password === undefined,
      '8. Login with valid email & password succeeds and returns JWT without password'
    );

    // 9. Test Login with Valid Credentials (Username)
    const loginUserRes = await request('POST', '/api/auth/login', {
      username: 'testdeveloper',
      password: 'StrongPassword123!',
    });
    assert(
      loginUserRes.status === 200 &&
      loginUserRes.body.success === true &&
      Boolean(loginUserRes.body.token),
      '9. Login with username & password succeeds'
    );

    // 10. Test Login with Incorrect Password
    const badPassRes = await request('POST', '/api/auth/login', {
      email: 'dev@codesync.io',
      password: 'WrongPassword999',
    });
    assert(
      badPassRes.status === 401 && badPassRes.body.success === false,
      '10. Login with incorrect password rejected with 401 Unauthorized'
    );

    // 11. Test Login with Non-Existent User
    const nonExistRes = await request('POST', '/api/auth/login', {
      email: 'ghost@codesync.io',
      password: 'SomePassword123',
    });
    assert(
      nonExistRes.status === 401 && nonExistRes.body.success === false,
      '11. Login with non-existent user rejected with 401 Unauthorized'
    );

    // 12. Test Protected Endpoint GET /api/auth/me with Valid Token
    const meRes = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${authToken}`,
    });
    assert(
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.user.username === 'testdeveloper' &&
      meRes.body.user.password === undefined,
      '12. GET /api/auth/me with valid Bearer token returns current user profile'
    );

    // 13. Test Protected Endpoint GET /api/auth/me without Token
    const noTokenRes = await request('GET', '/api/auth/me');
    assert(
      noTokenRes.status === 401 && noTokenRes.body.success === false,
      '13. GET /api/auth/me without token rejected with 401 Unauthorized'
    );

    // 14. Test Protected Endpoint GET /api/auth/me with Invalid Token
    const badTokenRes = await request('GET', '/api/auth/me', null, {
      Authorization: 'Bearer invalid.token.string',
    });
    assert(
      badTokenRes.status === 401 && badTokenRes.body.success === false,
      '14. GET /api/auth/me with invalid token rejected with 401 Unauthorized'
    );

    // 15. Verify Database Record has Hashed Password and Not Plaintext
    const dbRecord = await User.findOne({ where: { email: 'dev@codesync.io' } });
    assert(
      dbRecord.password !== 'StrongPassword123!' && dbRecord.password.startsWith('$2'),
      '15. Database confirms password is saved as bcrypt hash and never plaintext'
    );

  } catch (error) {
    console.error('Test execution exception:', error);
    failed++;
  } finally {
    if (runningServer) {
      runningServer.close();
    }
    await sequelize.close();
    const testDbPath = path.resolve(__dirname, './test_database.sqlite');
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // file lock on windows may delay unlink
      }
    }
  }

  console.log('\n=============================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runTests();
