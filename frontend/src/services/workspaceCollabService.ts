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
  // Members (Professional RBAC)
  getMembers: (wsId: string, token: string | null) =>
    req<{ success: boolean; members: WorkspaceMember[] }>(`/api/workspaces/${wsId}/members`, token),

  updateMemberRole: (wsId: string, userId: number, role: WorkspaceRole, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/${userId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  updateStudentAccess: (wsId: string, userId: number, access: 'no-view' | 'viewer' | 'editor', token: string | null) =>
    req<{ success: boolean; member: WorkspaceMember }>(`/api/workspaces/${wsId}/members/${userId}/access`, token, {
      method: 'PATCH',
      body: JSON.stringify({ access }),
    }),

  removeMember: (wsId: string, userId: number, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/${userId}`, token, { method: 'DELETE' }),

  leaveWorkspace: (wsId: string, token: string | null) =>
    req(`/api/workspaces/${wsId}/members/me`, token, { method: 'DELETE' }),

  // Invites (Professional RBAC)
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

  // Teaching Sessions (Education RBAC)
  startSession: (wsId: string, token: string | null) =>
    req<{ success: boolean; session: any }>(`/api/workspaces/${wsId}/session/start`, token, { method: 'POST' }),

  endSession: (wsId: string, token: string | null) =>
    req<{ success: boolean; message: string }>(`/api/workspaces/${wsId}/session/end`, token, { method: 'POST' }),

  getSession: (wsId: string, token: string | null) =>
    req<{ success: boolean; active: boolean; session?: any; members?: WorkspaceMember[] }>(`/api/workspaces/${wsId}/session`, token),

  getMySessionRole: (wsId: string, token: string | null) =>
    req<{ success: boolean; sessionRole: 'teacher' | 'student' | 'none'; editorLocked?: boolean; handRaised?: boolean; sessionActive: boolean }>(`/api/workspaces/${wsId}/session/my-role`, token),

  setFocusMode: (wsId: string, focusMode: boolean, focusedFilePath: string | null, token: string | null) =>
    req<{ success: boolean; focusMode: boolean; focusedFilePath: string | null }>(`/api/workspaces/${wsId}/session/focus`, token, {
      method: 'PATCH',
      body: JSON.stringify({ focusMode, focusedFilePath }),
    }),

  toggleStudentLock: (wsId: string, userId: number, locked: boolean, token: string | null) =>
    req<{ success: boolean; member: { userId: number; editorLocked: boolean } }>(`/api/workspaces/${wsId}/session/members/${userId}/lock`, token, {
      method: 'PATCH',
      body: JSON.stringify({ locked }),
    }),

  lockAllStudents: (wsId: string, token: string | null) =>
    req<{ success: boolean; message: string }>(`/api/workspaces/${wsId}/session/lock-all`, token, { method: 'POST' }),

  unlockAllStudents: (wsId: string, token: string | null) =>
    req<{ success: boolean; message: string }>(`/api/workspaces/${wsId}/session/unlock-all`, token, { method: 'POST' }),
};
