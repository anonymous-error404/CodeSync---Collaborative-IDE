/**
 * previewService.js
 * 
 * Tracks which local port each workspace's running process has bound to,
 * so the proxy route can forward preview HTTP requests to it.
 * 
 * Port detection works by scanning stdout/stderr from terminal commands for
 * common server-start messages like:
 *   "listening on port 3000"
 *   "Server running at http://localhost:8080"
 *   "Local: http://localhost:5173/"  (Vite)
 *   ":3000"  etc.
 */

const PORT_PATTERNS = [
  /(?:listening|running|started|server).*?(?:port|:)\s*(\d{4,5})/i,
  /localhost:(\d{4,5})/i,
  /127\.0\.0\.1:(\d{4,5})/i,
  /0\.0\.0\.0:(\d{4,5})/i,
  /:\s*(\d{4,5})\s*(?:\n|$)/,
];

/** @type {Map<string, { port: number, detectedAt: number }>} workspaceId → port info */
const previewPorts = new Map();

/** Callback to notify real-time sockets: (workspaceId, port | null) => void */
let portNotifier = null;

export function setPortNotifier(fn) {
  portNotifier = fn;
}

/**
 * Called from workspaceSocket.js / executionService.js when stdout/stderr is
 * received from a running terminal process.
 *
 * @param {string} workspaceId
 * @param {string} text - stdout/stderr chunk
 */
export function detectPortFromOutput(workspaceId, text) {
  if (!text || !workspaceId) return;
  for (const pattern of PORT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      // Ignore backend's own port (5000) and system reserved ports
      if (port > 1023 && port !== 5000 && port < 65536) {
        const existing = previewPorts.get(workspaceId);
        if (!existing || existing.port !== port) {
          previewPorts.set(workspaceId, { port, detectedAt: Date.now() });
          console.log(`[PreviewService] Workspace ${workspaceId} app detected on port ${port}`);
          if (portNotifier) {
            try { portNotifier(workspaceId, port); } catch (e) { /* ignore */ }
          }
        }
        return;
      }
    }
  }
}

/**
 * Returns the detected preview port for a workspace, or null if not known.
 * @param {string} workspaceId
 * @returns {{ port: number, detectedAt: number } | null}
 */
export function getPreviewPort(workspaceId) {
  return previewPorts.get(workspaceId) ?? null;
}

/**
 * Clears the tracked port for a workspace (called when the process exits).
 * @param {string} workspaceId
 */
export function clearPreviewPort(workspaceId) {
  previewPorts.delete(workspaceId);
  if (portNotifier) {
    try { portNotifier(workspaceId, null); } catch (e) { /* ignore */ }
  }
}

/**
 * Manually set a port for a workspace (used when user runs from a known port).
 * @param {string} workspaceId
 * @param {number} port
 */
export function setPreviewPort(workspaceId, port) {
  previewPorts.set(workspaceId, { port, detectedAt: Date.now() });
  if (portNotifier) {
    try { portNotifier(workspaceId, port); } catch (e) { /* ignore */ }
  }
}

export default {
  detectPortFromOutput,
  getPreviewPort,
  clearPreviewPort,
  setPreviewPort,
  setPortNotifier,
};
