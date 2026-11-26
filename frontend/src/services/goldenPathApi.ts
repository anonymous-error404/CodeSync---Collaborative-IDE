import type {
  GoldenPathBlueprint,
  IDPExecution,
  IDPPolicy,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('codesync_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const goldenPathApi = {
  // Blueprints
  async getBlueprints(category?: string, search?: string): Promise<GoldenPathBlueprint[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetch(`${BASE_URL}/api/goldenpath/blueprints?${params.toString()}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.blueprints || [];
  },

  async getBlueprintById(blueprintId: string): Promise<GoldenPathBlueprint> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/blueprints/${blueprintId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Blueprint not found');
    return data.blueprint;
  },

  async createBlueprint(payload: Partial<GoldenPathBlueprint>): Promise<GoldenPathBlueprint> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/blueprints`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to register blueprint');
    return data.blueprint;
  },

  // IDP Provisioning
  async initiateProvisioning(payload: {
    blueprintId: string;
    workspaceId: string;
    projectName?: string;
    parameters: Record<string, any>;
  }): Promise<IDPExecution> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/provision`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to launch provisioning');
    return data.execution;
  },

  async getWorkspaceExecutions(workspaceId: string): Promise<IDPExecution[]> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/goldenpath/executions`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.executions || [];
  },

  async getExecutionById(executionId: string): Promise<IDPExecution> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/executions/${executionId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Execution not found');
    return data.execution;
  },

  async checkDrift(executionId: string) {
    const res = await fetch(`${BASE_URL}/api/goldenpath/executions/${executionId}/check-drift`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.driftResult;
  },

  async applyUpstreamUpdate(executionId: string): Promise<IDPExecution> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/executions/${executionId}/apply-update`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update');
    return data.execution;
  },

  // Policies & Platform Analytics
  async getPolicies(): Promise<IDPPolicy[]> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/policies`, { headers: getHeaders() });
    const data = await res.json();
    return data.policies || [];
  },

  async createPolicy(payload: Partial<IDPPolicy>): Promise<IDPPolicy> {
    const res = await fetch(`${BASE_URL}/api/goldenpath/policies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create governance policy');
    return data.policy;
  },

  async getPlatformAnalytics() {
    const res = await fetch(`${BASE_URL}/api/goldenpath/analytics`, { headers: getHeaders() });
    const data = await res.json();
    return data;
  },
};
