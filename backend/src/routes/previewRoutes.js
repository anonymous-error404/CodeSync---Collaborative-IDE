/**
 * previewRoutes.js
 *
 * Provides:
 *   - Universal preview environments CRUD and comparison
 *   - Figma-style contextual pin & technical annotations
 *   - Structured engineering review memos & export
 *   - Automated test suite report
 *   - Live reverse proxy to running workspace applications
 */

import { Router } from 'express';
import http from 'http';
import { getPreviewPort, setPreviewPort } from '../services/previewService.js';
import {
  getPreviews,
  createPreview,
  getPreviewById,
  terminatePreview,
  compareRevisions,
  getTestReport,
  createTestFile,
  runTests,
  getTestFiles,
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  addAnnotationReply,
  getReviewMemo,
  updateReviewMemo,
  exportMemo,
} from '../controllers/previewController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireWorkspaceMember } from '../middleware/rbacMiddleware.js';

const router = Router();

// ── REST API Endpoints (Universal Review Hub) ──

router.get('/workspaces/:id/previews', authenticateToken, requireWorkspaceMember('viewer'), getPreviews);
router.post('/workspaces/:id/previews', authenticateToken, requireWorkspaceMember('editor'), createPreview);
router.get('/workspaces/:id/previews/compare', authenticateToken, requireWorkspaceMember('viewer'), compareRevisions);

router.get('/previews/:previewId', authenticateToken, getPreviewById);
router.delete('/previews/:previewId', authenticateToken, terminatePreview);
router.get('/previews/:previewId/tests', authenticateToken, getTestReport);
router.get('/previews/:previewId/tests/files', authenticateToken, getTestFiles);
router.post('/previews/:previewId/tests/create-file', authenticateToken, createTestFile);
router.post('/previews/:previewId/tests/run', authenticateToken, runTests);

router.get('/previews/:previewId/annotations', authenticateToken, getAnnotations);
router.post('/previews/:previewId/annotations', authenticateToken, createAnnotation);
router.patch('/previews/annotations/:annotationId', authenticateToken, updateAnnotation);
router.post('/previews/annotations/:annotationId/replies', authenticateToken, addAnnotationReply);

router.get('/previews/:previewId/memo', authenticateToken, getReviewMemo);
router.put('/previews/:previewId/memo', authenticateToken, updateReviewMemo);
router.get('/memos/:memoId/export', authenticateToken, exportMemo);

// ── Existing Port & Reverse Proxy Endpoints ──

const BLOCKED_PREVIEW_PORTS = new Set([
  Number(process.env.PORT || 5000),
  5432, // PostgreSQL
  3306, // MySQL
  27017, // MongoDB
  6379, // Redis
  9200, // Elasticsearch
]);

function isSafePreviewPort(port) {
  return Number.isInteger(port) && port >= 1024 && port <= 65535 && !BLOCKED_PREVIEW_PORTS.has(port);
}

router.get('/preview/:workspaceId/status', authenticateToken, (req, res) => {
  const info = getPreviewPort(req.params.workspaceId);
  res.json({
    success: true,
    port: info?.port ?? null,
    detectedAt: info?.detectedAt ?? null,
  });
});

router.post('/preview/:workspaceId/port', authenticateToken, (req, res) => {
  const parsed = Number(req.body?.port);
  if (!isSafePreviewPort(parsed)) {
    return res.status(400).json({
      success: false,
      error: 'Valid unprivileged port (1024-65535, excluding internal service ports) is required',
    });
  }
  setPreviewPort(req.params.workspaceId, parsed);
  res.json({ success: true, port: parsed });
});

const proxyHandler = (req, res) => {
  const { workspaceId } = req.params;

  const queryPort = req.query._port ? parseInt(req.query._port, 10) : null;
  const info = getPreviewPort(workspaceId);
  const port = queryPort && !isNaN(queryPort) ? queryPort : info?.port;

  if (port && !isSafePreviewPort(port)) {
    return res.status(403).send('Forbidden: Target port is restricted by preview security policy.');
  }

  if (!port) {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CodeSync Web Preview</title>
          <style>
            :root {
              --bg: #090d16;
              --surface: #0f172a;
              --surface-2: #1e293b;
              --border: rgba(255, 255, 255, 0.08);
              --text: #f8fafc;
              --muted: #94a3b8;
              --accent: #ff6b35;
              --accent-subtle: rgba(255, 107, 53, 0.12);
              --accent-border: rgba(255, 107, 53, 0.25);
            }
            * { box-sizing: border-box; }
            body {
              font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex; align-items: center; justify-content: center; min-height: 100vh;
              margin: 0; background: var(--bg); color: var(--text); padding: 16px;
              background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
              background-size: 24px 24px;
            }
            .skeuo-card {
              text-align: center; max-width: 440px; width: 100%; padding: 28px;
              border: 1px solid var(--border); border-radius: 16px; background: var(--surface);
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
            }
            .icon-badge {
              width: 52px; height: 52px; border-radius: 12px; margin: 0 auto 16px;
              display: flex; align-items: center; justify-content: center;
              background: var(--accent-subtle); border: 1px solid var(--accent-border); color: var(--accent);
            }
            h2 {
              color: var(--text); margin: 0 0 10px 0; font-size: 1.15rem; font-weight: 800;
              letter-spacing: -0.02em;
            }
            p {
              color: var(--muted); line-height: 1.6; font-size: 0.85rem; margin: 0 0 12px 0;
            }
            code {
              background: var(--accent-subtle); border: 1px solid var(--accent-border);
              padding: 2px 7px; border-radius: 5px; color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.82rem; font-weight: 700;
            }
            .tip {
              margin-top: 18px; padding: 12px 14px; background: var(--surface-2);
              border: 1px solid var(--border); border-radius: 8px; font-size: 0.8rem;
              color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 8px; text-align: left;
            }
            .tip strong { color: var(--text); }
            .tip svg { color: var(--accent); flex-shrink: 0; }
            .actions {
              margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .btn-primary {
              cursor: pointer; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: 700;
              background: linear-gradient(135deg, #ff6b35, #ea580c); color: #ffffff; border: none;
              box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
            }
            .btn-surface {
              cursor: pointer; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: 700;
              background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
            }
          </style>
        </head>
        <body>
          <div class="skeuo-card">
            <div class="icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <h2>No running server detected</h2>
            <p>Start your application in the terminal (e.g. <code>npm run dev</code> or <code>node index.js</code>).</p>
            <p>CodeSync will automatically detect the port and display your web app here.</p>
            <div class="tip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                <path d="M9 18h6"></path>
                <path d="M10 22h4"></path>
              </svg>
              <span>Once your app starts, click the <strong>Refresh</strong> button in the top bar.</span>
            </div>
            <div class="actions">
              <button class="btn-primary" onclick="window.location.search='?_port=3000'">Use Port 3000</button>
              <button class="btn-surface" onclick="window.location.search='?_port=5173'">Use Port 5173</button>
              <button class="btn-surface" onclick="window.location.reload()">Refresh</button>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  const subpath = req.params[0] ?? '';
  const rawPath = subpath ? `/${subpath}` : '/';
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetPath = rawPath + queryString;

  const headers = { ...req.headers };
  headers.host = `127.0.0.1:${port}`;
  delete headers['content-encoding'];
  delete headers['content-length'];
  headers['x-forwarded-for'] = req.ip;
  headers['x-forwarded-host'] = req.hostname;
  headers['x-forwarded-proto'] = req.protocol;

  const options = {
    hostname: '127.0.0.1',
    port,
    path: targetPath,
    method: req.method,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const responseHeaders = { ...proxyRes.headers };

    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['content-security-policy-report-only'];
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    responseHeaders['access-control-allow-headers'] = '*';

    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    const isHtml = contentType.includes('text/html');

    if (isHtml) {
      delete responseHeaders['content-length'];
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let html = Buffer.concat(chunks).toString('utf-8');
        const prefix = `/api/preview/${workspaceId}/`;
        const baseTag = `<base href="${prefix}">`;

        html = html.replace(/(src|href)=["']\/(?!\/)([^"']*)["']/g, `$1="${prefix}$2"`);

        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>\n  ${baseTag}`);
        } else if (html.includes('<HEAD>')) {
          html = html.replace('<HEAD>', `<HEAD>\n  ${baseTag}`);
        } else {
          html = `${baseTag}\n${html}`;
        }

        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        res.end(html);
      });
    } else {
      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      proxyRes.pipe(res, { end: true });
    }
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.status(502).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Connection Refused</title>
            <style>
              :root {
                --bg: #090d16;
                --surface: #0f172a;
                --surface-2: #1e293b;
                --border: rgba(255, 255, 255, 0.08);
                --text: #f8fafc;
                --muted: #94a3b8;
                --error: #ef4444;
                --error-subtle: rgba(239, 68, 68, 0.12);
                --error-border: rgba(239, 68, 68, 0.25);
              }
              * { box-sizing: border-box; }
              body {
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex; align-items: center; justify-content: center; min-height: 100vh;
                margin: 0; background: var(--bg); color: var(--text); padding: 16px;
                background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
                background-size: 24px 24px;
              }
              .skeuo-card {
                text-align: center; max-width: 440px; width: 100%; padding: 24px;
                border: 1px solid var(--border); border-radius: 16px; background: var(--surface);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
              }
              .icon-badge {
                width: 56px; height: 56px; border-radius: 12px; margin: 0 auto 16px;
                display: flex; align-items: center; justify-content: center;
                background: var(--error-subtle); border: 1px solid var(--error-border); color: var(--error);
              }
              h3 {
                color: var(--text); margin: 0 0 8px 0; font-size: 16px; font-weight: 800;
                letter-spacing: -0.02em;
              }
              p {
                color: var(--muted); line-height: 1.6; font-size: 12px; margin: 0 0 16px 0;
              }
              code {
                background: var(--error-subtle); border: 1px solid var(--error-border);
                padding: 2px 6px; border-radius: 4px; color: var(--error); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 600;
              }
              .btn-surface {
                cursor: pointer; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700;
                background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
              }
            </style>
          </head>
          <body>
            <div class="skeuo-card">
              <div class="icon-badge">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3>Connection Refused</h3>
              <p>Cannot reach server on port <code>${port}</code>.</p>
              <p>Your application might have stopped or crashed. Check the terminal for errors.</p>
              <button class="btn-surface" onclick="window.location.reload()">Retry Connection</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  if (req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    proxyReq.setHeader('content-length', Buffer.byteLength(bodyStr));
    proxyReq.write(bodyStr);
  } else if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq, { end: true });
    return;
  }

  proxyReq.end();
};

router.all('/preview/:workspaceId', proxyHandler);
router.all('/preview/:workspaceId/*', proxyHandler);

export default router;
