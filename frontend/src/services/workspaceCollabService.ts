import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

async function req<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  return res.json();
}

export const collabService = {
  // Members
  getMembers: (wsId: string, token: string | null) =>
    req<{ success: boolean; members: WorkspaceMember[] }>(`/api/workspaces/${wsId}/members`, token),

  updateMemberRole: (wsId: string, userId: number, role: WorkspaceRole, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/${userId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (wsId: string, userId: number, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/${userId}`, token, { method: 'DELETE' }),

  leaveWorkspace: (wsId: string, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/me`, token, { method: 'DELETE' }),

  // Invites
  createInvite: (wsId: string, params: { role: WorkspaceRole; expiresInHours?: number; maxUses?: number }, token: string | null) =>
    req<{ success: boolean; invite: WorkspaceInvite }>(`/api/workspaces/${wsId}/invites`, token, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getInvites: (wsId: string, token: string | null) =>
    req<{ success: boolean; invites: WorkspaceInvite[] }>(`/api/workspaces/${wsId}/invites`, token),

  revokeInvite: (wsId: string, inviteId: string, token: string | null) =>
    req(`/api/workspaces/${wsId}/invites/${inviteId}`, token, { method: 'DELETE' }),

  joinViaInvite: (inviteId: string, token: string | null) =>
    req<{ success: boolean; workspaceId: string; role: WorkspaceRole }>(`/api/invites/${inviteId}/join`, token, {
      method: 'POST',
    }),
};
