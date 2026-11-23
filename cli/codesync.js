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

        console.log(`✓ Workspace authenticated: ${info.workspaceDirectory}`);
        console.log(`✓ Connect Token: ${info.connectToken.substring(0, 16)}...`);

        if (editor === 'vscode') {
          console.log(`\n🚀 Launching Native VS Code Remote...`);
          openUri(info.vscodeUri);
        } else if (editor === 'cursor') {
          console.log(`\n🚀 Launching Native Cursor Remote...`);
          openUri(info.cursorUri);
        } else {
          console.log('\n[Native Editor Connections]:');
          console.log(`  • VS Code Remote: ${info.vscodeUri}`);
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
        const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');

        console.log(`\nSSH Configuration Snippet for ${workspaceId}:`);
        console.log('----------------------------------------------------');
        console.log(info.sshConfigSnippet);
        console.log('----------------------------------------------------\n');

        if (flags.write || flags.save) {
          fs.appendFileSync(sshConfigPath, `\n\n${info.sshConfigSnippet}\n`);
          console.log(`✓ Appended to ${sshConfigPath}! You can now run: ssh codesync-${workspaceId}`);
        } else {
          console.log(`Tip: Pass --save to automatically append this to your ${sshConfigPath}`);
        }
      } catch (err) {
        console.error(`\n❌ Error fetching config: ${err.message}`);
        process.exit(1);
      }
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
  codesync dotfiles <workspace-id> <git-url>

Options:
  --editor <vscode|cursor|ssh>   Open natively in VS Code, Cursor, or display SSH instructions
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
