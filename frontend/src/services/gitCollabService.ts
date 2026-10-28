import type { GitStatus, GitBranch } from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

class GitCollabService {
  private getHeaders(token: string | null) {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getStatus(workspaceId: string, token: string | null): Promise<GitStatus> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/status`, {
      headers: this.getHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch git status');
    return data;
  }

  async cloneRepo(
    workspaceId: string,
    params: {
      repoUrl: string;
      branch?: string;
      token?: string;
      username?: string;
      authorName?: string;
      authorEmail?: string;
    },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/clone`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clone repository');
    return data;
  }

  async initRepo(
    workspaceId: string,
    params: { authorName?: string; authorEmail?: string; initialBranch?: string },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/init`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize git repository');
    return data;
  }

  async commit(
    workspaceId: string,
    params: { message: string; files?: string[]; authorName?: string; authorEmail?: string },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/commit`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to commit changes');
    return data;
  }

  async push(
    workspaceId: string,
    params: { remote?: string; branch?: string; token?: string; username?: string; force?: boolean },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/push`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to push commits');
    return data;
  }

  async pull(
    workspaceId: string,
    params: { remote?: string; branch?: string; token?: string; username?: string },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/pull`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to pull changes');
    return data;
  }

  async getBranches(workspaceId: string, token: string | null): Promise<{ current: string; branches: GitBranch[] }> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/branches`, {
      headers: this.getHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch branches');
    return data;
  }

  async checkoutBranch(
    workspaceId: string,
    params: { branchName: string; createNew?: boolean },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/branch`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to checkout branch');
    return data;
  }

  async getDiff(
    workspaceId: string,
    params: { filePath?: string; staged?: boolean },
    token: string | null
  ): Promise<{ diff: string }> {
    const query = new URLSearchParams();
    if (params.filePath) query.set('filePath', params.filePath);
    if (params.staged) query.set('staged', 'true');

    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/diff?${query.toString()}`, {
      headers: this.getHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch diff');
    return data;
  }

  async stageFile(
    workspaceId: string,
    params: { filePath: string; unstage?: boolean },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/stage`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to stage file');
    return data;
  }

  async discardChanges(
    workspaceId: string,
    params: { filePath: string },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/discard`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to discard changes');
    return data;
  }

  async getCredentials(workspaceId: string, token: string | null) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/credentials`, {
      headers: this.getHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get git credentials');
    return data;
  }

  async saveCredentials(
    workspaceId: string,
    params: {
      token?: string;
      username?: string;
      authorName?: string;
      authorEmail?: string;
      saveToUser?: boolean;
    },
    token: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/git/credentials`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save git credentials');
    return data;
  }

  async saveUserGithubToken(
    params: { token: string; username?: string },
    authToken: string | null
  ) {
    const res = await fetch(`${BASE_URL}/api/git/user-credentials`, {
      method: 'POST',
      headers: this.getHeaders(authToken),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save user GitHub token');
    return data;
  }
}

export const gitCollabService = new GitCollabService();
