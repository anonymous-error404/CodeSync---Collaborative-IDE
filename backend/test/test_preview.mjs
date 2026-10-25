import assert from 'assert';
import http from 'http';
import { detectPortFromOutput, getPreviewPort, clearPreviewPort, setPreviewPort } from '../src/services/previewService.js';
import { startServer } from '../server.js';

async function runTests() {
  console.log('--- Testing Web Preview & Port Detection ---');

  const testWsId = 'test-ws-' + Date.now();

  // Test 1: detectPortFromOutput with different terminal outputs
  console.log('1. Testing port detection from stdout patterns...');
  clearPreviewPort(testWsId);
  assert.strictEqual(getPreviewPort(testWsId), null, 'Initial port should be null');

  // Express pattern
  detectPortFromOutput(testWsId, 'Express server listening on port 3000\n');
  assert.strictEqual(getPreviewPort(testWsId)?.port, 3000, 'Should detect port 3000 from Express output');

  // Vite pattern
  detectPortFromOutput(testWsId, '  ➜  Local:   http://localhost:5173/\n');
  assert.strictEqual(getPreviewPort(testWsId)?.port, 5173, 'Should detect port 5173 from Vite output');

  // Flask pattern
  detectPortFromOutput(testWsId, ' * Running on http://127.0.0.1:8000 (Press CTRL+C to quit)\n');
  assert.strictEqual(getPreviewPort(testWsId)?.port, 8000, 'Should detect port 8000 from Flask output');

  // Backend self-port ignore (5000)
  detectPortFromOutput(testWsId, 'CodeSync backend listening on port 5000\n');
  assert.strictEqual(getPreviewPort(testWsId)?.port, 8000, 'Should NOT overwrite with port 5000');

  // Clear port
  clearPreviewPort(testWsId);
  assert.strictEqual(getPreviewPort(testWsId), null, 'Should be null after clearPreviewPort');
  console.log('   ✓ Port pattern detection passed.');

  // Test 2: Start a dummy HTTP server on a test port (e.g. 3999) to verify reverse proxy
  console.log('2. Starting test target web server on port 3999...');
  const targetServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>My App</title></head><body><h1>Hello from Workspace App</h1></body></html>');
    } else if (req.url === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'live web output' }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise(resolve => targetServer.listen(3999, '127.0.0.1', resolve));
  console.log('   ✓ Dummy target server listening on 127.0.0.1:3999');

  // Register dummy port in previewService
  setPreviewPort(testWsId, 3999);

  // Test 3: Start backend server on test port 5099
  console.log('3. Starting CodeSync backend on port 5099...');
  const backendServer = await startServer(5099);

  try {
    // Test 4: Query preview status endpoint
    console.log('4. Testing GET /api/preview/:wsId/status...');
    const statusRes = await fetch(`http://localhost:5099/api/preview/${testWsId}/status`);
    const statusJson = await statusRes.json();
    assert.strictEqual(statusJson.success, true);
    assert.strictEqual(statusJson.port, 3999);
    console.log('   ✓ Status endpoint returned port 3999 correctly');

    // Test 5: Query reverse proxy HTML endpoint
    console.log('5. Testing GET /api/preview/:wsId/ HTML proxy with <base> injection...');
    const proxyRes = await fetch(`http://localhost:5099/api/preview/${testWsId}/`);
    assert.strictEqual(proxyRes.status, 200);
    const html = await proxyRes.text();
    assert.ok(html.includes('Hello from Workspace App'), 'HTML should contain target content');
    assert.ok(html.includes(`<base href="/api/preview/${testWsId}/">`), 'HTML should have injected <base> tag');
    console.log('   ✓ Reverse proxy returned HTML with injected base tag');

    // Test 6: Query reverse proxy JSON API endpoint
    console.log('6. Testing GET /api/preview/:wsId/api/data API proxy...');
    const apiRes = await fetch(`http://localhost:5099/api/preview/${testWsId}/api/data`);
    assert.strictEqual(apiRes.status, 200);
    const apiJson = await apiRes.json();
    assert.strictEqual(apiJson.message, 'live web output');
    console.log('   ✓ API endpoint proxy passed');

    console.log('\nAll Web Preview tests PASSED successfully! 🎉');
  } finally {
    targetServer.close();
    backendServer.close();
    clearPreviewPort(testWsId);
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
