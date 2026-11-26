const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('codesync_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface LspSymbol {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  signature: string;
}

export interface LspDiagnostic {
  severity: 'error' | 'warning' | 'info';
  line: number;
  col: number;
  message: string;
  source: string;
}

export interface RagCitation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
}

export const lspRagApi = {
  async getIndex(workspaceId: string, refresh = false) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/index?refresh=${refresh}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async getCompletions(workspaceId: string, prefix: string, language: string) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/completions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prefix, language }),
    });
    return res.json();
  },

  async getInlineSuggestion(
    workspaceId: string,
    payload: { filePath: string; content: string; cursorOffset: number; language: string }
  ): Promise<{ success: boolean; suggestion: string; source?: string }> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/inline`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async findDefinition(workspaceId: string, symbol: string): Promise<{ success: boolean; definitions: LspSymbol[] }> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/definition`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ symbol }),
    });
    return res.json();
  },

  async getDiagnostics(workspaceId: string, filePath: string, content: string): Promise<{ success: boolean; diagnostics: LspDiagnostic[] }> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/diagnostics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ filePath, content }),
    });
    return res.json();
  },

  async queryRag(workspaceId: string, query: string, activeFilePath?: string, activeFileContent?: string) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/lsprag/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, activeFilePath, activeFileContent }),
    });
    return res.json();
  },
};
