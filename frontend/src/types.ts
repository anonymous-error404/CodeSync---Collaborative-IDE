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
  activeFile?: string;
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

// ── Professional Workspace Types ──
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReviewStatus = 'open' | 'approved' | 'changes_requested' | 'closed';

export interface ProjectTask {
  id: number;
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: number | null;
  createdBy: number;
  filePath?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignee?: { id: number; username: string; email: string };
  creator?: { id: number; username: string; email: string };
}

export interface CodeReview {
  id: number;
  workspaceId: string;
  title: string;
  description?: string;
  filePath: string;
  status: ReviewStatus;
  authorId: number;
  reviewerId?: number | null;
  reviewNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
  author?: { id: number; username: string; email: string };
  reviewer?: { id: number; username: string; email: string };
}

