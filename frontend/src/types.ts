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

export type WorkspaceType = 'educational' | 'professional' | 'competitive';
export type StudentAccessLevel = 'no-view' | 'viewer' | 'editor';

export type WorkspaceRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'teacher'
  | 'student'
  | 'team_leader'
  | 'developer'
  | 'no-view';
export type SessionRole = 'teacher' | 'student' | 'none';

export interface WorkspaceMember {
  id: number;
  workspaceId: string;
  userId: number;
  role: WorkspaceRole;
  sessionRole?: SessionRole;
  editorLocked?: boolean;
  handRaised?: boolean;
  studentAccess?: StudentAccessLevel;
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
  type?: WorkspaceType;
  createdAt?: string;
  updatedAt?: string;
  activeUsers?: number;
  myRole?: WorkspaceRole;
  mySessionRole?: SessionRole;
  studentAccess?: StudentAccessLevel;
}

export interface TeachingSessionState {
  id?: string;
  active: boolean;
  teacherUserId?: number;
  teacherName?: string;
  focusMode: boolean;
  focusedFilePath?: string | null;
  mySessionRole: SessionRole;
  editorLocked?: boolean;
  handRaised?: boolean;
  studentAccess?: StudentAccessLevel;
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
