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


// ── Feature 5: Universal Review Hub & Figma-Style Pins ──

export type PreviewEnvironmentType =
  | 'web'
  | 'backend'
  | 'mobile'
  | 'desktop'
  | 'database'
  | 'cli'
  | 'ml'
  | 'distributed'
  | 'infrastructure';

export interface PreviewEnvironment {
  id: string;
  workspaceId: string;
  revisionId: string;
  name: string;
  type: PreviewEnvironmentType;
  status: 'provisioning' | 'ready' | 'failed' | 'terminated';
  targetUrl?: string | null;
  port?: number | null;
  runtimeConfig?: Record<string, any>;
  healthStatus?: { status: string; latencyMs: number; uptimeSeconds: number; lastChecked?: string };
  resourceLimits?: { cpu: string; memory: string; storage: string };
  accessPolicy?: { mode: string; allowComments: boolean; canRunTests: boolean };
  token?: string;
  expiresAt?: string;
  createdBy: number;
  creator?: { id: number; username: string; email: string };
  annotations?: PreviewAnnotation[];
  createdAt: string;
  updatedAt: string;
}

export type AnnotationSurface =
  | 'web'
  | 'mobile'
  | 'desktop'
  | 'api'
  | 'terminal'
  | 'logs'
  | 'database'
  | 'ml'
  | 'infrastructure';

export type AnnotationType = 'bug' | 'suggestion' | 'change_request' | 'observation';
export type AnnotationStatus = 'open' | 'in_progress' | 'resolved' | 'reopened' | 'verified' | 'closed';

export interface AnnotationCoordinates {
  x: number;
  y: number;
  viewportWidth?: number;
  viewportHeight?: number;
  selector?: string;
  route?: string;
}

export interface AnnotationTechnicalContext {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestBody?: string;
  responseBody?: string;
  responseSnippet?: string;
  logLine?: number;
  logTrace?: string;
  logText?: string;
  lineText?: string;
  dbTable?: string;
  query?: string;
  returnedRows?: number;
  sampleId?: string;
  expectedOutput?: string;
  predictedOutput?: string;
  input?: string;
  service?: string;
  status?: string;
  latency?: string;
  rps?: number;
  resourceType?: string;
  resourceName?: string;
  action?: string;
  filePath?: string;
  lineNumber?: number;
  executionId?: string;
  [key: string]: any;
}

export interface AnnotationReply {
  id: string;
  userId: number;
  username: string;
  comment: string;
  createdAt: string;
}

export interface PreviewAnnotation {
  id: string;
  previewId: string;
  workspaceId: string;
  revisionId: string;
  surface: AnnotationSurface;
  type: AnnotationType;
  title: string;
  comment: string;
  coordinates?: AnnotationCoordinates | null;
  technicalContext?: AnnotationTechnicalContext | null;
  status: AnnotationStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: number | null;
  createdBy: number;
  replies?: AnnotationReply[];
  decision?: {
    outcome: 'accepted' | 'rejected' | 'deferred' | 'investigation';
    reasonedBy?: number;
    reasoning?: string;
    decidedAt?: string;
  } | null;
  actionItem?: {
    description: string;
    assignedTo?: number;
    dueDate?: string;
    verifiedRevision?: string;
    completed?: boolean;
  } | null;
  author?: { id: number; username: string; email?: string };
  assignee?: { id: number; username: string; email?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewMemo {
  id: string;
  previewId?: string | null;
  workspaceId: string;
  revisionId: string;
  title: string;
  objective?: string;
  scope?: string;
  status: 'draft' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';
  summary?: string;
  findingsSnapshot?: any[];
  decisions?: any[];
  actionItems?: any[];
  conclusions?: {
    outcome?: string;
    blockingIssues?: string[];
    nonBlockingSuggestions?: string[];
    nextSteps?: string[];
  };
  manualNotes?: string;
  participants?: Array<{ userId: number; username: string; role: string; attendedAt: string }>;
  approvals?: Array<{ userId: number; username: string; approved: boolean; note?: string; timestamp: string }>;
  createdBy: number;
  creator?: { id: number; username: string; email?: string };
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Feature 6: Zero-Trust Ephemeral Credential Brokering ──

export type CredentialProviderType =
  | 'aws_iam'
  | 'gcp_iam'
  | 'azure_vault'
  | 'hashicorp_vault'
  | 'postgres_db'
  | 'mysql_db'
  | 'stripe'
  | 'twilio'
  | 'custom_api'
  | 'oauth';

export interface CredentialProvider {
  id: string;
  name: string;
  providerType: CredentialProviderType;
  environment: 'development' | 'testing' | 'staging' | 'preview' | 'production';
  config?: Record<string, any>;
  status: 'active' | 'degraded' | 'disabled' | 'unhealthy';
  isHealthy: boolean;
  rotationPolicy?: { autoRotate: boolean; rotationIntervalDays: number; lastRotatedAt?: string };
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface EphemeralCredential {
  id: string;
  providerId?: string | null;
  providerType?: string;
  workspaceId: string;
  workloadIdentity: string;
  resourceTarget: string;
  environment: 'development' | 'testing' | 'staging' | 'preview' | 'production';
  permissions: string[];
  maskedToken: string;
  tokenValue?: string;
  rawSecretRef?: string;
  status: 'active' | 'expired' | 'revoked';
  requestReason?: string;
  issuedAt: string;
  expiresAt: string;
  issuedToUser: number;
  provider?: CredentialProvider;
  user?: { id: number; username: string; email?: string };
}

export interface CredentialPolicy {
  id: string;
  name: string;
  environment: string;
  role: string;
  workloadPattern: string;
  allowedResources: string[];
  allowedOperations: string[];
  requiresApproval: boolean;
  maxTtlMinutes: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialAuditLog {
  id: string;
  workspaceId?: string;
  userId?: number;
  workloadIdentity: string;
  providerType: string;
  resourceTarget: string;
  operation: string;
  environment: string;
  action: 'allowed' | 'denied' | 'revoked' | 'leaked_blocked' | 'emergency_lockdown';
  reason?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  user?: { id: number; username: string };
}

// ── Feature 10: Internal Developer Platform & Golden Path Scaffolding ──

export interface GoldenPathBlueprint {
  id: string;
  name: string;
  category: 'backend' | 'frontend' | 'ai_ml' | 'data_pipeline' | 'mobile' | 'distributed' | 'infrastructure';
  description: string;
  ownerTeam: string;
  version: string;
  sourceProvider: 'backstage' | 'cookiecutter' | 'copier' | 'yeoman' | 'terraform' | 'crossplane' | 'helm';
  tags: string[];
  approved: boolean;
  deprecationNotice?: string | null;
  inputsSchema: Array<{
    id: string;
    label: string;
    type: 'text' | 'select' | 'boolean' | 'number';
    options?: string[];
    default?: any;
    required?: boolean;
  }>;
  dependencyGraph: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    provides?: string[];
    dependsOn?: string[];
  }>;
  infrastructureSpec?: Record<string, any>;
  ciCdSpec?: Record<string, any>;
  securityPolicy?: Record<string, any>;
  compatibility?: Record<string, any>;
}

export interface IDPExecution {
  id: string;
  blueprintId: string;
  blueprintVersion: string;
  workspaceId: string;
  projectName: string;
  status: 'pending' | 'provisioning' | 'completed' | 'failed' | 'drifted' | 'updating';
  parameters: Record<string, any>;
  provisionedServices?: Array<{
    serviceId: string;
    name: string;
    type: string;
    endpoint: string;
    port: number;
    status: string;
    provisionedAt: string;
  }>;
  dependencyGraphStatus?: Record<string, any>;
  logs?: Array<{ timestamp: string; stage: string; message: string; level: string }>;
  driftStatus?: {
    hasDrift: boolean;
    checkedAt?: string;
    outdatedDependencies?: any[];
    missingConfigs?: any[];
    driftDetails?: any[];
  };
  upstreamUpdatesAvailable?: {
    latestVersion: string;
    currentVersion: string;
    changelog: string[];
    breakingChanges: boolean;
  } | null;
  initiatedBy: number;
  blueprint?: GoldenPathBlueprint;
  createdAt: string;
  updatedAt: string;
}

export interface IDPPolicy {
  id: string;
  name: string;
  ruleType: string;
  parameters: Record<string, any>;
  enforcement: 'mandatory' | 'recommended';
  isActive: boolean;
  description?: string;
}
