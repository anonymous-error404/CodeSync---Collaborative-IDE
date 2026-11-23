import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import { getWorkspacePath } from '../utils/pathSandbox.js';
import multiRepoService from './multiRepoService.js';

class CrossRepoTypeService {
  /**
   * Scans all mounted microservices in the workspace to detect shared types/schema packages.
   */
  async detectTypeMesh(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const repos = await multiRepoService.listRepos(workspaceId);

    const typeProviders = [];
    const consumers = [];

    for (const repo of repos) {
      const repoDir = repo.folder === '.' ? wsDir : path.join(wsDir, repo.folder);
      if (!fsSync.existsSync(repoDir)) continue;

      const pkgJsonPath = path.join(repoDir, 'package.json');
      const isSharedByName = repo.name.toLowerCase().includes('type') ||
                             repo.name.toLowerCase().includes('schema') ||
                             repo.name.toLowerCase().includes('proto') ||
                             repo.name.toLowerCase().includes('contract');

      if (fsSync.existsSync(pkgJsonPath)) {
        try {
          const raw = await fs.readFile(pkgJsonPath, 'utf-8');
          const pkg = JSON.parse(raw);

          if (isSharedByName || (pkg.types && !pkg.dependencies?.express && !pkg.dependencies?.react)) {
            typeProviders.push({
              name: pkg.name || repo.name,
              folder: repo.folder,
              path: repoDir,
              type: 'typescript_package',
            });
          } else {
            consumers.push({
              name: pkg.name || repo.name,
              folder: repo.folder,
              path: repoDir,
              dependencies: { ...pkg.dependencies, ...pkg.devDependencies },
            });
          }
        } catch { /* ignore */ }
      } else if (isSharedByName) {
        typeProviders.push({
          name: repo.name,
          folder: repo.folder,
          path: repoDir,
          type: 'schema_directory',
        });
      }
    }

    return {
      workspaceId,
      typeProviders,
      consumers,
      meshActive: typeProviders.length > 0 && consumers.length > 0,
    };
  }

  /**
   * Links shared types across microservices by creating node_modules symlinks or relative references.
   */
  async linkTypeMesh(workspaceId) {
    const mesh = await this.detectTypeMesh(workspaceId);
    if (!mesh.typeProviders.length) {
      return { success: false, message: 'No shared type providers detected in workspace.' };
    }

    const linked = [];

    for (const provider of mesh.typeProviders) {
      for (const consumer of mesh.consumers) {
        const consumerNm = path.join(consumer.path, 'node_modules');
        const linkTarget = path.join(consumerNm, provider.name);

        try {
          if (!fsSync.existsSync(consumerNm)) {
            await fs.mkdir(consumerNm, { recursive: true });
          }

          if (!fsSync.existsSync(linkTarget)) {
            await fs.symlink(provider.path, linkTarget, 'junction');
            linked.push({ from: provider.name, to: consumer.name });
          }
        } catch (err) {
          console.warn(`[TypeSync] Could not link ${provider.name} to ${consumer.name}: ${err.message}`);
        }
      }
    }

    return {
      success: true,
      linked,
      providers: mesh.typeProviders.map(p => p.name),
      consumers: mesh.consumers.map(c => c.name),
    };
  }

  /**
   * Runs TypeScript compile verification across all consuming microservices
   * to verify whether a change to shared types introduced breaking compilation errors.
   */
  async verifyTypeSync(workspaceId) {
    const mesh = await this.detectTypeMesh(workspaceId);
    const results = [];

    for (const consumer of mesh.consumers) {
      const tsconfigPath = path.join(consumer.path, 'tsconfig.json');
      if (!fsSync.existsSync(tsconfigPath)) {
        results.push({
          consumer: consumer.name,
          folder: consumer.folder,
          status: 'skipped',
          message: 'No tsconfig.json found',
        });
        continue;
      }

      // Run tsc --noEmit in consumer directory
      const errors = await new Promise((resolve) => {
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const proc = spawn(npxCmd, ['tsc', '--noEmit'], { cwd: consumer.path, stdio: 'pipe' });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { out += d.toString(); });
        proc.on('close', code => {
          resolve({
            passed: code === 0,
            output: out.trim().split('\n').slice(0, 10).join('\n'), // cap at 10 lines
          });
        });
        proc.on('error', err => resolve({ passed: false, output: err.message }));
      });

      results.push({
        consumer: consumer.name,
        folder: consumer.folder,
        status: errors.passed ? 'valid' : 'type_error',
        diagnostics: errors.passed ? 'All types valid across services' : errors.output,
      });
    }

    return {
      workspaceId,
      timestamp: new Date().toISOString(),
      typeProviders: mesh.typeProviders.map(p => p.name),
      results,
      allValid: results.every(r => r.status === 'valid' || r.status === 'skipped'),
    };
  }
}

export default new CrossRepoTypeService();
