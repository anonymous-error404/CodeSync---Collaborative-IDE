export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileItem[];
  path: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface WorkspaceMember {
  id: number;
  workspaceId: string;
  userId: number;
  role: WorkspaceRole;
  joinedAt: string;
  User?: { id: number; username: string; email: string };
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  inviteUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  activeUsers?: number;
  myRole?: WorkspaceRole;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  status: 'idle' | 'running' | 'success' | 'error';
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  message?: string;
}

export interface WorkspaceApiResponse {
  success: boolean;
  workspace?: Workspace;
  workspaces?: Workspace[];
  error?: string;
}
