export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  children?: FileItem[];
  path: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  language: 'python' | 'javascript' | 'cpp' | 'java';
  updatedAt: string;
  rootFolder: FileItem;
  storageUsedMB: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  memoryKB: number;
  status: 'idle' | 'running' | 'success' | 'error';
}