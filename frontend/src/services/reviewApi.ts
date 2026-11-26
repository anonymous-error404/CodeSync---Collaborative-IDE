import type {
  PreviewEnvironment,
  PreviewAnnotation,
  ReviewMemo,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('codesync_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const reviewApi = {
  // Previews
  async getPreviews(workspaceId: string): Promise<PreviewEnvironment[]> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/previews`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.previews || [];
  },

  async createPreview(workspaceId: string, payload: Partial<PreviewEnvironment>): Promise<PreviewEnvironment> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/previews`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to provision preview');
    return data.preview;
  },

  async getPreviewById(previewId: string): Promise<PreviewEnvironment> {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch preview');
    return data.preview;
  },

  async terminatePreview(previewId: string): Promise<void> {
    await fetch(`${BASE_URL}/api/previews/${previewId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async compareRevisions(workspaceId: string, baseRevision: string, targetRevision: string) {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/${workspaceId}/previews/compare?baseRevision=${encodeURIComponent(
        baseRevision
      )}&targetRevision=${encodeURIComponent(targetRevision)}`,
      { headers: getHeaders() }
    );
    const data = await res.json();
    return data.comparison;
  },

  async getTestReport(previewId: string) {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/tests`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.report;
  },

  async getTestFiles(previewId: string) {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/tests/files`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.files || [];
  },

  async createTestFile(previewId: string, payload: { fileName?: string; templateType?: string; targetPort?: number }) {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/tests/create-file`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create test file');
    return data;
  },

  async runTests(previewId: string, payload?: { testFile?: string; targetPort?: number }) {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/tests/run`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to execute tests');
    return data;
  },

  // Annotations
  async getAnnotations(previewId: string): Promise<PreviewAnnotation[]> {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/annotations`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.annotations || [];
  },

  async createAnnotation(previewId: string, payload: Partial<PreviewAnnotation>): Promise<PreviewAnnotation> {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/annotations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to add annotation');
    return data.annotation;
  },

  async updateAnnotation(annotationId: string, payload: Partial<PreviewAnnotation>): Promise<PreviewAnnotation> {
    const res = await fetch(`${BASE_URL}/api/previews/annotations/${annotationId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update annotation');
    return data.annotation;
  },

  async addReply(annotationId: string, comment: string) {
    const res = await fetch(`${BASE_URL}/api/previews/annotations/${annotationId}/replies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to reply');
    return data;
  },

  // Structured Review Memo
  async getMemo(previewId: string): Promise<ReviewMemo> {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/memo`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.memo;
  },

  async updateMemo(previewId: string, payload: Partial<ReviewMemo>): Promise<ReviewMemo> {
    const res = await fetch(`${BASE_URL}/api/previews/${previewId}/memo`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.memo;
  },

  async exportMemo(memoId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/memos/${memoId}/export`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.markdown || '';
  },
};
