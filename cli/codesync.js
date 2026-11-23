#!/usr/bin/env node

/**
 * CodeSync CLI — "Bring Your Own Editor" & Hybrid Gateway Client
 * Usage:
 *   npx codesync-cli connect <workspace-id> [--editor vscode|cursor|ssh]
 *   npx codesync-cli config <workspace-id>
 *   npx codesync-cli dotfiles <workspace-id> <dotfiles-git-url>
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function parseFlags(flagArgs) {
  const flags = {};
  for (let i = 0; i < flagArgs.length; i++) {
    if (flagArgs[i].startsWith('--')) {
      const key = flagArgs[i].slice(2);
      const val = flagArgs[i + 1] && !flagArgs[i + 1].startsWith('--') ? flagArgs[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

const flags = parseFlags(args.slice(1));
const workspaceId = args[1] && !args[1].startsWith('--') ? args[1] : flags.workspace;
const baseUrl = (flags.host || process.env.CODESYNC_HOST || 'http://localhost:5000').replace(/\/$/, '');
const token = flags.token || process.env.CODESYNC_TOKEN || '';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data;
}

function openUri(uri) {
  const platform = process.platform;
  let cmd = '';
  if (platform === 'darwin') cmd = `open "${uri}"`;
  else if (platform === 'win32') cmd = `start "" "${uri}"`;
  else cmd = `xdg-open "${uri}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(`[CodeSync CLI] Could not automatically open URI: ${uri}`);
      console.log(`Please paste this link into your browser or editor: ${uri}`);
    }
  });
}

async function main() {
  switch (command) {
    case 'connect': {
      if (!workspaceId) {
        console.error('Error: Workspace ID is required. Example: codesync connect ws-1234abcd');
        process.exit(1);
      }

      console.log(`\n⚡ Connecting to CodeSync Workspace: ${workspaceId} ...`);
      console.log(`   Host: ${baseUrl}\n`);

      try {
        const info = await fetchJson(`${baseUrl}/api/gateway/workspace/${workspaceId}/connection-info?token=${token}`);
        const editor = flags.editor || (flags.vscode ? 'vscode' : flags.cursor ? 'cursor' : 'terminal');
        const preferRemote = flags.remote || false;

        console.log(`✓ Workspace authenticated: ${info.workspaceDirectory}`);
        console.log(`✓ Connect Token: ${info.connectToken.substring(0, 16)}...`);

        // If launching remote editor, ensure SSH host is configured in ~/.ssh/config
        if ((editor === 'vscode' || editor === 'cursor') && (preferRemote || !info.isLocalhost)) {
          const sshConfigDir = path.join(os.homedir(), '.ssh');
          const sshConfigPath = path.join(sshConfigDir, 'config');
          try {
            fs.mkdirSync(sshConfigDir, { recursive: true });
            let currentConfig = fs.existsSync(sshConfigPath) ? fs.readFileSync(sshConfigPath, 'utf8') : '';
            if (!currentConfig.includes(`Host ${info.sshHostAlias}`)) {
              fs.appendFileSync(sshConfigPath, `\n\n${info.sshConfigSnippet}\n`);
              console.log(`✓ Automatically configured SSH host in ${sshConfigPath}`);
            }
          } catch (e) {
            console.warn(`[CodeSync] Note: Could not auto-write ~/.ssh/config: ${e.message}`);
          }
        }

        if (editor === 'vscode') {
          const targetUri = preferRemote ? (info.vscodeRemoteUri || info.vscodeUri) : info.vscodeUri;
          console.log(`\n🚀 Launching VS Code (${preferRemote ? 'SSH Remote' : info.isLocalhost ? 'Local Workspace' : 'SSH Remote'})...`);
          openUri(targetUri);
        } else if (editor === 'cursor') {
          const targetUri = preferRemote ? (info.cursorRemoteUri || info.cursorUri) : info.cursorUri;
          console.log(`\n🚀 Launching Cursor AI (${preferRemote ? 'SSH Remote' : info.isLocalhost ? 'Local Workspace' : 'SSH Remote'})...`);
          openUri(targetUri);
        } else {
          console.log('\n[Native Editor Connections]:');
          console.log(`  • VS Code:        ${info.vscodeUri}`);
          if (info.vscodeRemoteUri && info.vscodeRemoteUri !== info.vscodeUri) {
            console.log(`  • VS Code Remote: ${info.vscodeRemoteUri}`);
          }
          console.log(`  • Cursor Remote:  ${info.cursorUri}`);
          console.log(`  • Direct SSH:     ${info.sshCommand}`);
          console.log('\n[SSH Config snippet]:');
          console.log(info.sshConfigSnippet);
        }
      } catch (err) {
        console.error(`\n❌ Failed to connect to workspace: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'config': {
      if (!workspaceId) {
        console.error('Error: Workspace ID is required. Example: codesync config ws-1234abcd');
        process.exit(1);
      }

      try {
        const info = await fetchJson(`${baseUrl}/api/gateway/workspace/${workspaceId}/connection-info?token=${token}`);
        const sshConfigDir = path.join(os.homedir(), '.ssh');
        const sshConfigPath = path.join(sshConfigDir, 'config');

        console.log(`\nSSH Configuration Snippet for ${workspaceId}:`);
        console.log('----------------------------------------------------');
        console.log(info.sshConfigSnippet);
        console.log('----------------------------------------------------\n');

        if (flags.write || flags.save) {
          fs.mkdirSync(sshConfigDir, { recursive: true });
          let currentConfig = fs.existsSync(sshConfigPath) ? fs.readFileSync(sshConfigPath, 'utf8') : '';
          if (currentConfig.includes(`Host ${info.sshHostAlias}`)) {
            console.log(`✓ Host '${info.sshHostAlias}' is already present in ${sshConfigPath}`);
          } else {
            fs.appendFileSync(sshConfigPath, `\n\n${info.sshConfigSnippet}\n`);
            console.log(`✓ Successfully appended to ${sshConfigPath}! You can now run: ssh ${info.sshHostAlias}`);
          }
        } else {
          console.log(`Tip: Pass --save to automatically append this to your ${sshConfigPath}`);
        }
      } catch (err) {
        console.error(`\n❌ Error fetching config: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'tunnel': {
      if (!workspaceId) {
        console.error('Error: Workspace ID is required for tunnel proxy.');
        process.exit(1);
      }

      const host = (flags.host || 'http://localhost:5000').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const [hostname] = host.split(':');
      const targetHost = hostname || '127.0.0.1';
      const targetPort = flags.port ? parseInt(flags.port, 10) : 2222;

      const socket = net.createConnection({ host: targetHost, port: targetPort }, () => {
        process.stdin.pipe(socket);
        socket.pipe(process.stdout);
      });

      socket.on('error', (err) => {
        console.error(`[CodeSync Tunnel Error]: ${err.message}`);
        process.exit(1);
      });

      socket.on('close', () => {
        process.exit(0);
      });
      break;
    }

    case 'dotfiles': {
      const dotfilesUrl = args[2] || flags.repo;
      if (!workspaceId || !dotfilesUrl) {
        console.error('Usage: codesync dotfiles <workspace-id> <dotfiles-repo-url>');
        process.exit(1);
      }

      console.log(`\n📦 Synchronizing dotfiles from ${dotfilesUrl} into workspace ${workspaceId}...`);
      try {
        const res = await fetchJson(`${baseUrl}/api/gateway/workspace/${workspaceId}/dotfiles`, {
          method: 'POST',
          body: JSON.stringify({ dotfilesRepoUrl: dotfilesUrl }),
        });
        console.log(`✓ Dotfiles synchronized successfully!`);
        console.log(`  Detected: ${res.detectedFiles.join(', ')}`);
        console.log(`  Linked:   ${res.linkedFiles.join(', ')}`);
      } catch (err) {
        console.error(`\n❌ Dotfiles sync error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'help':
    default: {
      console.log(`
CodeSync CLI — "Bring Your Own Editor" & Cloud Gateway

Usage:
  codesync connect <workspace-id> [options]
  codesync config <workspace-id> [--save]
  codesync tunnel <workspace-id> [options]
  codesync dotfiles <workspace-id> <git-url>

Options:
  --editor <vscode|cursor|ssh>   Open natively in VS Code, Cursor, or display SSH instructions
  --remote                       Force SSH Remote connection instead of local filesystem
  --host <url>                   CodeSync Server URL (default: http://localhost:5000)
  --token <token>                User authentication token
  --save                         Write SSH config snippet directly to ~/.ssh/config

Examples:
  npx codesync-cli connect ws-8f3a12bc --editor vscode
  npx codesync-cli connect ws-8f3a12bc --editor cursor
  npx codesync-cli config ws-8f3a12bc --save
  npx codesync-cli dotfiles ws-8f3a12bc https://github.com/myname/dotfiles.git
`);
      break;
    }
  }
}

main().catch(console.error);
