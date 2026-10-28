import type {
  WorkspaceMember,
  WorkspaceInvite,
  WorkspaceRole,
  ProjectTask,
  CodeReview,
  TaskPriority,
  ReviewStatus,
  StudentAccessLevel,
  LineComment,
} from '../types';

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

  updateStudentAccess: (wsId: string, userId: number, access: StudentAccessLevel, token: string | null) =>
    req<{ success: boolean; member: WorkspaceMember }>(`/api/workspaces/${wsId}/members/${userId}/access`, token, {
      method: 'PATCH',
      body: JSON.stringify({ access }),
    }),

  updateBulkStudentAccess: (wsId: string, userIds: number[], access: StudentAccessLevel, token: string | null) =>
    req<{ success: boolean; updatedCount: number; updatedUserIds: number[]; studentAccess: StudentAccessLevel }>(
      `/api/workspaces/${wsId}/members/access/bulk`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify({ userIds, access }),
      }
    ),

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

  // Professional Workspace (Tasks & Code Reviews)
  getTasks: (wsId: string, token: string | null) =>
    req<{ success: boolean; tasks: ProjectTask[] }>(`/api/workspaces/${wsId}/tasks`, token),

  createTask: (wsId: string, data: { title: string; description?: string; priority?: TaskPriority; assignedTo?: number | null; filePath?: string | null; sprint?: string; storyPoints?: number }, token: string | null) =>
    req<{ success: boolean; task: ProjectTask }>(`/api/workspaces/${wsId}/tasks`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTask: (wsId: string, taskId: number, updates: Partial<ProjectTask>, token: string | null) =>
    req<{ success: boolean; task: ProjectTask }>(`/api/workspaces/${wsId}/tasks/${taskId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteTask: (wsId: string, taskId: number, token: string | null) =>
    req<{ success: boolean; message: string; taskId: number }>(`/api/workspaces/${wsId}/tasks/${taskId}`, token, {
      method: 'DELETE',
    }),

  getReviews: (wsId: string, token: string | null) =>
    req<{ success: boolean; reviews: CodeReview[] }>(`/api/workspaces/${wsId}/reviews`, token),

  createReview: (wsId: string, data: { title: string; description?: string; filePath: string }, token: string | null) =>
    req<{ success: boolean; review: CodeReview }>(`/api/workspaces/${wsId}/reviews`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateReviewStatus: (wsId: string, reviewId: number, data: { status: ReviewStatus; reviewNote?: string }, token: string | null) =>
    req<{ success: boolean; review: CodeReview }>(`/api/workspaces/${wsId}/reviews/${reviewId}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteReview: (wsId: string, reviewId: number, token: string | null) =>
    req<{ success: boolean; message: string; reviewId: number }>(`/api/workspaces/${wsId}/reviews/${reviewId}`, token, {
      method: 'DELETE',
    }),

  // Inline Line Comments
  getComments: (wsId: string, filePath?: string, token?: string | null) =>
    req<{ success: boolean; comments: LineComment[] }>(
      `/api/workspaces/${wsId}/comments${filePath ? `?filePath=${encodeURIComponent(filePath)}` : ''}`,
      token ?? null
    ),

  createComment: (
    wsId: string,
    data: { filePath: string; lineNumber: number; content: string; parentId?: number | null },
    token: string | null
  ) =>
    req<{ success: boolean; comment: LineComment }>(`/api/workspaces/${wsId}/comments`, token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateComment: (
    wsId: string,
    commentId: number,
    data: { content?: string; resolved?: boolean },
    token: string | null
  ) =>
    req<{ success: boolean; comment: LineComment }>(`/api/workspaces/${wsId}/comments/${commentId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteComment: (wsId: string, commentId: number, token: string | null) =>
    req<{ success: boolean; message: string }>(`/api/workspaces/${wsId}/comments/${commentId}`, token, {
      method: 'DELETE',
    }),

  // Competitive Workspace Allowlist
  getAllowlist: (wsId: string, token: string | null) =>
    req<{ success: boolean; allowedEmails: string[] }>(`/api/workspaces/${wsId}/allowlist`, token),

  addAllowedEmails: (wsId: string, emails: string[], token: string | null) =>
    req<{ success: boolean; allowedEmails: string[] }>(`/api/workspaces/${wsId}/allowlist`, token, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),

  removeAllowedEmail: (wsId: string, email: string, token: string | null) =>
    req<{ success: boolean; allowedEmails: string[] }>(`/api/workspaces/${wsId}/allowlist/${encodeURIComponent(email)}`, token, {
      method: 'DELETE',
    }),

  // User Search Autocompletion
  searchUsers: (query: string, token: string | null) =>
    req<{ success: boolean; users: Array<{ id: number; username: string; email: string }> }>(
      `/api/auth/users/search?q=${encodeURIComponent(query)}`,
      token
    ),

  // Workspace Deletion
  deleteWorkspace: (wsId: string, token: string | null) =>
    req<{ success: boolean; message?: string; error?: string }>(`/api/workspaces/${wsId}`, token, {
      method: 'DELETE',
    }),

  bulkDeleteWorkspaces: (workspaceIds: string[], token: string | null) =>
    req<{ success: boolean; deletedIds: string[]; failedIds: string[]; message?: string; error?: string }>(
      '/api/workspaces/bulk-delete',
      token,
      {
        method: 'POST',
        body: JSON.stringify({ workspaceIds }),
      }
    ),
};
