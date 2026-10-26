/**
 * previewRoutes.js
 *
 * Provides two routes:
 *   GET /api/preview/:workspaceId/status   → returns detected port or null
 *   ALL /api/preview/:workspaceId          → HTTP reverse proxy to workspace app
 *   ALL /api/preview/:workspaceId/*        → HTTP reverse proxy to workspace app
 *
 * The proxy forwards HTTP requests to the workspace application,
 * removes framing restrictions (X-Frame-Options, CSP frame-ancestors),
 * and injects a <base> tag into HTML so relative assets resolve properly.
 */

import { Router } from 'express';
import http from 'http';
import { getPreviewPort, setPreviewPort } from '../services/previewService.js';

const router = Router();

/**
 * GET /api/preview/:workspaceId/status
 * Returns { port, detectedAt } or { port: null }
 */
router.get('/preview/:workspaceId/status', (req, res) => {
  const info = getPreviewPort(req.params.workspaceId);
  res.json({
    success: true,
    port: info?.port ?? null,
    detectedAt: info?.detectedAt ?? null,
  });
});

/**
 * POST /api/preview/:workspaceId/port
 * Allows manual setting of port if auto-detection missed it
 */
router.post('/preview/:workspaceId/port', (req, res) => {
  const { port } = req.body;
  if (!port || isNaN(Number(port))) {
    return res.status(400).json({ success: false, error: 'Valid port number required' });
  }
  setPreviewPort(req.params.workspaceId, Number(port));
  res.json({ success: true, port: Number(port) });
});

/**
 * Handle proxy request for both root /preview/:workspaceId and subpaths /preview/:workspaceId/*
 */
const proxyHandler = (req, res) => {
  const { workspaceId } = req.params;

  // Manual query port override if specified (?_port=3000)
  const queryPort = req.query._port ? parseInt(req.query._port, 10) : null;
  const info = getPreviewPort(workspaceId);
  const port = (queryPort && !isNaN(queryPort)) ? queryPort : info?.port;

  if (!port) {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CodeSync Web Preview</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                   display: flex; align-items: center; justify-content: center; height: 100vh;
                   margin: 0; background: #0d1117; color: #c9d1d9; }
            .box { text-align: center; max-width: 440px; padding: 32px; border: 1px solid #30363d; border-radius: 12px; background: #161b22; }
            h2 { color: #58a6ff; margin-top: 0; font-size: 1.3rem; }
            p { color: #8b949e; line-height: 1.6; font-size: 0.9rem; }
            code { background: #0d1117; border: 1px solid #30363d; padding: 2px 8px; border-radius: 4px; color: #7ee787; font-family: monospace; }
            .tip { margin-top: 16px; padding: 10px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 6px; font-size: 0.8rem; color: #38bdf8; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>No running server detected</h2>
            <p>Start your application in the terminal (e.g. <code>npm run dev</code> or <code>node index.js</code>).</p>
            <p>CodeSync will automatically detect the port and display your web app here.</p>
            <div class="tip">💡 Once your app starts, click the <strong>Refresh</strong> button in the top bar.</div>
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

    // Strip framing restrictions to allow embedded preview in iframe
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['content-security-policy-report-only'];
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    responseHeaders['access-control-allow-headers'] = '*';

    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    const isHtml = contentType.includes('text/html');

    if (isHtml) {
      // Buffer HTML and inject <base href="..."> so relative paths work seamlessly
      delete responseHeaders['content-length'];
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let html = Buffer.concat(chunks).toString('utf-8');
        const prefix = `/api/preview/${workspaceId}/`;
        const baseTag = `<base href="${prefix}">`;

        // Rewrite root-relative asset URLs (e.g. /src/main.jsx, /@vite/client)
        // so they route through the proxy subpath instead of the server root
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
      // Stream assets (JS, CSS, images, etc.) directly
      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      proxyRes.pipe(res, { end: true });
    }
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Connection Refused</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                     display: flex; align-items: center; justify-content: center; height: 100vh;
                     margin: 0; background: #0d1117; color: #c9d1d9; }
              .box { text-align: center; max-width: 440px; padding: 32px; border: 1px solid #30363d; border-radius: 12px; background: #161b22; }
              h2 { color: #f85149; margin-top: 0; }
              p { color: #8b949e; line-height: 1.6; }
              code { background: #0d1117; border: 1px solid #30363d; padding: 2px 8px; border-radius: 4px; color: #f85149; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>Connection Refused</h2>
              <p>Cannot reach server on port <code>${port}</code>.</p>
              <p>Your application might have stopped or crashed. Check the terminal for errors.</p>
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
