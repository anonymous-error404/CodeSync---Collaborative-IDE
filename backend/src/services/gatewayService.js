import crypto from 'crypto';
import path from 'path';
import { getWorkspacePath } from '../utils/pathSandbox.js';
import dotfilesService from './dotfilesService.js';

class GatewayService {
  constructor() {
    // Map<token, { workspaceId: string, userId: string|number, createdAt: number, expiresAt: number }>
    this.tokens = new Map();
    // Clean expired tokens every 10 minutes
    setInterval(() => this._cleanExpiredTokens(), 10 * 60 * 1000).unref();
  }

  _cleanExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Generates a temporary secure connect token for CLI / SSH Gateway (valid 24h).
   */
  generateConnectToken(workspaceId, userId = 'developer') {
    const token = `cs_tok_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;

    this.tokens.set(token, {
      workspaceId,
      userId,
      createdAt: now,
      expiresAt,
    });

    return {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Verifies connect token.
   */
  verifyConnectToken(token) {
    if (!token) return null;
    const data = this.tokens.get(token);
    if (!data) return null;
    if (Date.now() > data.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    return data;
  }

  /**
   * Generates connection information and launch URIs for desktop editors (VS Code, Cursor, SSH).
   */
  getConnectionInfo(workspaceId, host = 'localhost:5000', protocol = 'http', token = null) {
    const wsDir = getWorkspacePath(workspaceId);
    const effectiveToken = token || this.generateConnectToken(workspaceId).token;
    const isSsl = protocol.startsWith('https');
    const wsProtocol = isSsl ? 'wss' : 'ws';
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const isLocalhost = cleanHost.startsWith('localhost') || cleanHost.startsWith('127.0.0.1');

    // Normalize path to POSIX forward slashes and ensure leading slash
    let normalizedPath = wsDir.replace(/\\/g, '/');
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    const encodedPath = encodeURI(normalizedPath);
    const sshHostAlias = `codesync-${workspaceId}`;

    // VS Code Remote SSH URI: vscode://vscode-remote/ssh-remote+<host>/<path>
    const vscodeRemoteUri = `vscode://vscode-remote/ssh-remote+${sshHostAlias}${encodedPath}`;
    // Cursor Remote SSH URI: cursor://vscode-remote/ssh-remote+<host>/<path>
    const cursorRemoteUri = `cursor://vscode-remote/ssh-remote+${sshHostAlias}${encodedPath}`;

    // Local filesystem URIs (for instant opening when running locally without SSH daemon)
    const vscodeLocalUri = `vscode://file${encodedPath}`;
    const cursorLocalUri = `cursor://file${encodedPath}`;

    // Default editor URIs: If running locally on localhost, default to native local file URI,
    // otherwise use the Remote SSH URI.
    const vscodeUri = isLocalhost ? vscodeLocalUri : vscodeRemoteUri;
    const cursorUri = isLocalhost ? cursorLocalUri : cursorRemoteUri;

    const cliCommand = `npx codesync-cli connect ${workspaceId} --host ${protocol}://${cleanHost} --token ${effectiveToken}`;

    const sshConfigSnippet = [
      `# CodeSync Remote Workspace: ${workspaceId}`,
      `Host ${sshHostAlias}`,
      `  HostName ${cleanHost.split(':')[0]}`,
      `  User codesync`,
      `  Port 2222`,
      `  ProxyCommand npx codesync-cli tunnel ${workspaceId} --token ${effectiveToken} --host ${protocol}://${cleanHost}`,
      `  StrictHostKeyChecking no`,
      `  UserKnownHostsFile /dev/null`,
      `  ServerAliveInterval 30`,
    ].join('\n');

    return {
      workspaceId,
      workspaceDirectory: wsDir,
      connectToken: effectiveToken,
      cliCommand,
      vscodeUri,
      cursorUri,
      vscodeRemoteUri,
      cursorRemoteUri,
      vscodeLocalUri,
      cursorLocalUri,
      isLocalhost,
      sshHostAlias,
      sshCommand: `ssh ${sshHostAlias}`,
      sshConfigSnippet,
      websocketTunnelUrl: `${wsProtocol}://${cleanHost}/api/gateway/tunnel/${workspaceId}?token=${effectiveToken}`,
    };
  }
}

export default new GatewayService();
