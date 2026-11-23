import type {
  GatewayConnectionInfo,
  DotfilesStatus,
  WarmPoolSnapshot,
  DatabaseBranchStatus,
  MountedRepository,
  TypeMeshStatus,
} from '../types';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:5000';

function authHeaders(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        !res.ok
          ? `Server error (${res.status}): ${res.statusText || 'Endpoint returned non-JSON'}`
          : 'Invalid server response'
      );
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const professionalCollabService = {
  // ─── 1. Hybrid Workflow / SSH & CLI Gateway ──────────────────────────────
  async getConnectionInfo(workspaceId: string, token: string | null): Promise<GatewayConnectionInfo> {
    return apiFetch<GatewayConnectionInfo>(`/api/gateway/workspace/${workspaceId}/connection-info`, {
      headers: authHeaders(token),
    });
  },

  async syncDotfiles(workspaceId: string, dotfilesRepoUrl: string, token: string | null) {
    return apiFetch(`/api/gateway/workspace/${workspaceId}/dotfiles`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ dotfilesRepoUrl }),
    });
  },

  async getDotfilesStatus(workspaceId: string, token: string | null): Promise<DotfilesStatus> {
    return apiFetch<DotfilesStatus>(`/api/gateway/workspace/${workspaceId}/dotfiles/status`, {
      headers: authHeaders(token),
    });
  },

  // ─── 2. Copy-on-Write (CoW) Warm-Pools ────────────────────────────────────
  async getWarmSnapshots(token: string | null): Promise<WarmPoolSnapshot[]> {
    const data = await apiFetch<{ snapshots?: WarmPoolSnapshot[] }>(`/api/warmpool/snapshots`, {
      headers: authHeaders(token),
    });
    return data.snapshots || [];
  },

  async triggerPrebuild(gitRepoUrl: string, branch = 'main', token: string | null) {
    return apiFetch(`/api/warmpool/prebuild`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ gitRepoUrl, branch }),
    });
  },

  // ─── 3. Ephemeral Database Branching ──────────────────────────────────────
  async initDatabaseBranch(workspaceId: string, token: string | null): Promise<DatabaseBranchStatus> {
    return apiFetch<DatabaseBranchStatus>(`/api/workspaces/${workspaceId}/database/init`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  async getDatabaseStatus(workspaceId: string, token: string | null): Promise<DatabaseBranchStatus> {
    return apiFetch<DatabaseBranchStatus>(`/api/workspaces/${workspaceId}/database/status`, {
      headers: authHeaders(token),
    });
  },

  async resetDatabaseBranch(workspaceId: string, token: string | null) {
    return apiFetch(`/api/workspaces/${workspaceId}/database/reset`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  async executeDatabaseQuery(workspaceId: string, sql: string, token: string | null) {
    return apiFetch(`/api/workspaces/${workspaceId}/database/query`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ sql }),
    });
  },

  // ─── 4. Multi-Repo & Cross-Repo Type Sync ─────────────────────────────────
  async getMountedRepos(workspaceId: string, token: string | null): Promise<MountedRepository[]> {
    const data = await apiFetch<{ repositories?: MountedRepository[] }>(`/api/workspaces/${workspaceId}/repos`, {
      headers: authHeaders(token),
    });
    return data.repositories || [];
  },

  async mountRepo(workspaceId: string, repoUrl: string, targetFolder: string, branch = 'main', token: string | null) {
    return apiFetch(`/api/workspaces/${workspaceId}/repos/mount`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ repoUrl, targetFolder, branch }),
    });
  },

  async unmountRepo(workspaceId: string, repoId: string, token: string | null) {
    return apiFetch(`/api/workspaces/${workspaceId}/repos/${repoId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async detectTypeMesh(workspaceId: string, token: string | null): Promise<TypeMeshStatus> {
    const data = await apiFetch<{ mesh: TypeMeshStatus }>(`/api/workspaces/${workspaceId}/types/mesh`, {
      headers: authHeaders(token),
    });
    return data.mesh;
  },

  async linkTypeMesh(workspaceId: string, token: string | null) {
    return apiFetch(`/api/workspaces/${workspaceId}/types/link`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  async verifyTypeSync(workspaceId: string, token: string | null) {
    const data = await apiFetch<{ verification: any }>(`/api/workspaces/${workspaceId}/types/verify`, {
      headers: authHeaders(token),
    });
    return data.verification;
  },
};
