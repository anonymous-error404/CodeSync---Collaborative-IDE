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
export type StudentAccessLevel = 'viewer' | 'commenter' | 'editor' | 'view' | 'comment' | 'edit' | 'no-view';

export type WorkspaceRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer'
  | 'teacher'
  | 'student'
  | 'team_leader'
  | 'developer'
  | 'tester'
  | 'team_member'
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
  allowedEmails?: string[];
}

export interface LineComment {
  id: number;
  workspaceId: string;
  filePath: string;
  lineNumber: number;
  userId: number;
  content: string;
  parentId?: number | null;
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
  author?: {
    id: number;
    username: string;
    email: string;
  };
  replies?: LineComment[];
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
  sprint?: string;
  storyPoints?: number;
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


export interface GitFileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'U';
}

export interface GitStatus {
  isGitRepo: boolean;
  canInitialize?: boolean;
  branch?: string;
  tracking?: string | null;
  ahead?: number;
  behind?: number;
  remoteUrl?: string | null;
  lastCommit?: {
    hash: string;
    author: string;
    date: string;
    message: string;
  } | null;
  staged?: GitFileChange[];
  unstaged?: GitFileChange[];
  untracked?: GitFileChange[];
  hasCredentials?: boolean;
  authorName?: string | null;
  authorEmail?: string | null;
  error?: string;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

// ─── Professional Workspace Enterprise Enhancements ────────────────────────

export interface GatewayConnectionInfo {
  workspaceId: string;
  workspaceDirectory: string;
  connectToken: string;
  cliCommand: string;
  vscodeUri: string;
  cursorUri: string;
  sshHostAlias: string;
  sshCommand: string;
  sshConfigSnippet: string;
  websocketTunnelUrl: string;
}

export interface DotfilesStatus {
  installed: boolean;
  detectedFiles: string[];
}

export interface WarmPoolSnapshot {
  key: string;
  gitRepoUrl: string;
  branch: string;
  installType: string;
  prebuiltAt: string;
  status: string;
}

export interface DatabaseBranchStatus {
  initialized: boolean;
  workspaceId: string;
  branchId: string;
  databaseUrl: string;
  isolation: string;
  piiMasked: boolean;
  tables: Array<{ table: string; rows: number }>;
  migrations: Array<{ version: string; applied_at: string }>;
  message?: string;
}

export interface MountedRepository {
  id: string;
  name: string;
  folder: string;
  repoUrl?: string;
  branch: string;
  isPrimary?: boolean;
  status: string;
  exists: boolean;
}

export interface TypeMeshStatus {
  workspaceId: string;
  typeProviders: Array<{ name: string; folder: string; type: string }>;
  consumers: Array<{ name: string; folder: string }>;
  meshActive: boolean;
}
