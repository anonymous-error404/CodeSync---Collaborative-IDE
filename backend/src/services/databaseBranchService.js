import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import sqlite3 from 'sqlite3';
import { getWorkspacePath } from '../utils/pathSandbox.js';
import dataMaskerService from './dataMaskerService.js';

function openSqliteDb(filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filename, (err) => {
      if (err) return reject(err);
      resolve({
        exec: (sql) => new Promise((res, rej) => db.exec(sql, (e) => (e ? rej(e) : res()))),
        get: (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (e, row) => (e ? rej(e) : res(row)))),
        all: (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows)))),
        run: (sql, ...params) => new Promise((res, rej) => db.run(sql, params, function (e) {
          if (e) return rej(e);
          res({ lastID: this.lastID, changes: this.changes });
        })),
        prepare: (sql) => new Promise((res, rej) => {
          const stmt = db.prepare(sql, (e) => {
            if (e) return rej(e);
            res({
              run: (...params) => new Promise((sRes, sRej) => stmt.run(params, (err) => (err ? sRej(err) : sRes()))),
              finalize: () => new Promise((fRes, fRej) => stmt.finalize((err) => (err ? fRej(err) : fRes()))),
            });
          });
        }),
        close: () => new Promise((res, rej) => db.close((e) => (e ? rej(e) : res()))),
      });
    });
  });
}

class DatabaseBranchService {
  /**
   * Initializes an ephemeral, isolated database branch for a workspace.
   * Creates an isolated SQLite branch with sanitized/PII-masked seed data and
   * injects connection environment variables into the workspace `.env` file.
   */
  async initDatabaseBranch(workspaceId, provider = 'local_sqlite') {
    const wsDir = getWorkspacePath(workspaceId);
    const dbDir = path.join(wsDir, '.codesync-db');
    const dbFile = path.join(dbDir, 'branch.sqlite');

    if (!fsSync.existsSync(dbDir)) {
      await fs.mkdir(dbDir, { recursive: true });
    }

    // Open connection to isolated workspace SQLite database
    const db = await openSqliteDb(dbFile);

    // 1. Create standard schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        masked_credit_card TEXT,
        balance_cents INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 1,
        password_hash TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        owner_id INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY,
        event TEXT NOT NULL,
        actor TEXT NOT NULL,
        timestamp TEXT
      );
    `);

    // 2. Populate with PII-masked seed data
    const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');
    if (existingUsers && existingUsers.count === 0) {
      const seed = dataMaskerService.generateSanitizedSeedData(10);

      const userStmt = await db.prepare(`
        INSERT INTO users (id, username, email, role, phone, masked_credit_card, balance_cents, is_verified, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const u of seed.users) {
        await userStmt.run(
          u.id,
          u.username,
          u.email,
          u.role,
          u.phone,
          u.maskedCreditCard,
          u.balanceCents,
          u.isVerified ? 1 : 0,
          u.passwordHash,
          u.createdAt
        );
      }
      await userStmt.finalize();

      const projStmt = await db.prepare(`
        INSERT INTO projects (id, name, status, owner_id)
        VALUES (?, ?, ?, ?)
      `);
      for (const p of seed.projects) {
        await projStmt.run(p.id, p.name, p.status, p.ownerId);
      }
      await projStmt.finalize();

      await db.run(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        '20261123_init_schema',
        new Date().toISOString()
      );
    }

    await db.close();

    // 3. Inject / Update .env file in workspace root
    const envPath = path.join(wsDir, '.env');
    const relativeDbPath = './.codesync-db/branch.sqlite';
    const dbUrl = `sqlite:${relativeDbPath}`;

    let envContent = '';
    if (fsSync.existsSync(envPath)) {
      envContent = await fs.readFile(envPath, 'utf-8');
    }

    const envLines = [
      `# CodeSync Ephemeral Database Branch`,
      `DATABASE_URL=${dbUrl}`,
      `DB_BRANCH_ID=branch-${workspaceId}`,
      `DB_PROVIDER=${provider}`,
      `DB_PII_MASKED=true`,
      `DB_ISOLATED=true`,
    ].join('\n');

    if (!envContent.includes('DATABASE_URL=')) {
      envContent = `${envContent.trim()}\n\n${envLines}\n`;
      await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');
    }

    return {
      success: true,
      workspaceId,
      branchId: `branch-${workspaceId}`,
      provider,
      databaseUrl: dbUrl,
      dbFilePath: dbFile,
      piiMasked: true,
      isolation: 'ephemeral_dedicated',
    };
  }

  /**
   * Returns current branch inspection info, table list, and row counts.
   */
  async getBranchStatus(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const dbFile = path.join(wsDir, '.codesync-db', 'branch.sqlite');

    if (!fsSync.existsSync(dbFile)) {
      return {
        initialized: false,
        workspaceId,
        message: 'No ephemeral database branch initialized yet.',
      };
    }

    const db = await openSqliteDb(dbFile);

    const tables = await db.all(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    const tableStats = [];
    for (const t of tables) {
      const rowCount = await db.get(`SELECT COUNT(*) as count FROM ${t.name}`);
      tableStats.push({
        table: t.name,
        rows: rowCount ? rowCount.count : 0,
      });
    }

    const migrations = await db.all('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC').catch(() => []);
    await db.close();

    return {
      initialized: true,
      workspaceId,
      branchId: `branch-${workspaceId}`,
      databaseUrl: `sqlite:./.codesync-db/branch.sqlite`,
      isolation: 'ephemeral_dedicated',
      piiMasked: true,
      tables: tableStats,
      migrations,
    };
  }

  /**
   * Resets the ephemeral database branch to a fresh sanitized state.
   */
  async resetBranch(workspaceId) {
    const wsDir = getWorkspacePath(workspaceId);
    const dbFile = path.join(wsDir, '.codesync-db', 'branch.sqlite');

    if (fsSync.existsSync(dbFile)) {
      await fs.rm(dbFile, { force: true });
    }

    return this.initDatabaseBranch(workspaceId);
  }

  /**
   * Executes a safe query or migration on the isolated workspace database.
   */
  async executeQuery(workspaceId, sql) {
    if (!sql || !sql.trim()) throw new Error('SQL query is required');
    const wsDir = getWorkspacePath(workspaceId);
    const dbFile = path.join(wsDir, '.codesync-db', 'branch.sqlite');

    if (!fsSync.existsSync(dbFile)) {
      await this.initDatabaseBranch(workspaceId);
    }

    const db = await openSqliteDb(dbFile);

    const cleanSql = sql.trim();
    let result = null;

    if (cleanSql.toUpperCase().startsWith('SELECT') || cleanSql.toUpperCase().startsWith('PRAGMA')) {
      result = await db.all(cleanSql);
    } else {
      result = await db.exec(cleanSql);
    }

    await db.close();
    return { success: true, result };
  }
}

export default new DatabaseBranchService();
