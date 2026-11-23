import type {
  GatewayConnectionInfo,
  DotfilesStatus,
  WarmPoolSnapshot,
  DatabaseBranchStatus,
  MountedRepository,
  TypeMeshStatus,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function authHeaders(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const professionalCollabService = {
  // ─── 1. Hybrid Workflow / SSH & CLI Gateway ──────────────────────────────
  async getConnectionInfo(workspaceId: string, token: string | null): Promise<GatewayConnectionInfo> {
    const res = await fetch(`${BASE_URL}/api/gateway/workspace/${workspaceId}/connection-info`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch connection info');
    return data;
  },

  async syncDotfiles(workspaceId: string, dotfilesRepoUrl: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/gateway/workspace/${workspaceId}/dotfiles`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ dotfilesRepoUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to sync dotfiles');
    return data;
  },

  async getDotfilesStatus(workspaceId: string, token: string | null): Promise<DotfilesStatus> {
    const res = await fetch(`${BASE_URL}/api/gateway/workspace/${workspaceId}/dotfiles/status`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch dotfiles status');
    return data;
  },

  // ─── 2. Copy-on-Write (CoW) Warm-Pools ────────────────────────────────────
  async getWarmSnapshots(token: string | null): Promise<WarmPoolSnapshot[]> {
    const res = await fetch(`${BASE_URL}/api/warmpool/snapshots`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch snapshots');
    return data.snapshots || [];
  },

  async triggerPrebuild(gitRepoUrl: string, branch = 'main', token: string | null) {
    const res = await fetch(`${BASE_URL}/api/warmpool/prebuild`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ gitRepoUrl, branch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to trigger prebuild');
    return data;
  },

  // ─── 3. Ephemeral Database Branching ──────────────────────────────────────
  async initDatabaseBranch(workspaceId: string, token: string | null): Promise<DatabaseBranchStatus> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/database/init`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize database branch');
    return data;
  },

  async getDatabaseStatus(workspaceId: string, token: string | null): Promise<DatabaseBranchStatus> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/database/status`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch database status');
    return data;
  },

  async resetDatabaseBranch(workspaceId: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/database/reset`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset database branch');
    return data;
  },

  async executeDatabaseQuery(workspaceId: string, sql: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/database/query`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ sql }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to execute query');
    return data;
  },

  // ─── 4. Multi-Repo & Cross-Repo Type Sync ─────────────────────────────────
  async getMountedRepos(workspaceId: string, token: string | null): Promise<MountedRepository[]> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/repos`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch mounted repos');
    return data.repositories || [];
  },

  async mountRepo(workspaceId: string, repoUrl: string, targetFolder: string, branch = 'main', token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/repos/mount`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ repoUrl, targetFolder, branch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to mount repository');
    return data;
  },

  async unmountRepo(workspaceId: string, repoId: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/repos/${repoId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to unmount repository');
    return data;
  },

  async detectTypeMesh(workspaceId: string, token: string | null): Promise<TypeMeshStatus> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/types/mesh`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to detect type mesh');
    return data.mesh;
  },

  async linkTypeMesh(workspaceId: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/types/link`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to link type mesh');
    return data;
  },

  async verifyTypeSync(workspaceId: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/types/verify`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify type sync');
    return data.verification;
  },
};
