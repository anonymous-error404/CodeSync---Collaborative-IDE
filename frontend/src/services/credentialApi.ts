import type {
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('codesync_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const credentialApi = {
  // Providers
  async getProviders(): Promise<CredentialProvider[]> {
    const res = await fetch(`${BASE_URL}/api/credentials/providers`, { headers: getHeaders() });
    const data = await res.json();
    return data.providers || [];
  },

  async createProvider(payload: Partial<CredentialProvider>): Promise<CredentialProvider> {
    const res = await fetch(`${BASE_URL}/api/credentials/providers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to connect provider');
    return data.provider;
  },

  async toggleProvider(providerId: string): Promise<CredentialProvider> {
    const res = await fetch(`${BASE_URL}/api/credentials/providers/${providerId}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.provider;
  },

  // Ephemeral Credentials
  async getWorkspaceCredentials(workspaceId: string): Promise<EphemeralCredential[]> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/credentials`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.credentials || [];
  },

  async requestCredential(workspaceId: string, payload: {
    serviceName?: string;
    providerType: string;
    resourceTarget: string;
    environment?: string;
    operations?: string[];
    durationMinutes?: number;
    requestReason?: string;
  }): Promise<EphemeralCredential> {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/credentials/request`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to exchange credential');
    return data.credential;
  },

  async revokeCredential(credentialId: string): Promise<void> {
    await fetch(`${BASE_URL}/api/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  // Secret Scanning
  async scanSecrets(workspaceId: string) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/credentials/scan-secrets`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.scanResult;
  },

  async remediateSecret(
    workspaceId: string,
    payload: { filePath: string; lineNumber: number; envVarName?: string }
  ) {
    const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/credentials/remediate-secret`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to remediate secret');
    return data;
  },

  // Policies
  async getPolicies(): Promise<CredentialPolicy[]> {
    const res = await fetch(`${BASE_URL}/api/credentials/policies`, { headers: getHeaders() });
    const data = await res.json();
    return data.policies || [];
  },

  async createPolicy(payload: Partial<CredentialPolicy>): Promise<CredentialPolicy> {
    const res = await fetch(`${BASE_URL}/api/credentials/policies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create policy');
    return data.policy;
  },

  async togglePolicy(policyId: string): Promise<CredentialPolicy> {
    const res = await fetch(`${BASE_URL}/api/credentials/policies/${policyId}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.policy;
  },

  // Analytics & Audit
  async getAnalytics(workspaceId?: string): Promise<{
    stats: {
      totalCredentials: number;
      activeCredentials: number;
      totalAuditEvents: number;
      blockedLeakedEvents: number;
      deniedEvents: number;
    };
    logs: CredentialAuditLog[];
  }> {
    const url = workspaceId
      ? `${BASE_URL}/api/credentials/analytics?workspaceId=${workspaceId}`
      : `${BASE_URL}/api/credentials/analytics`;
    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    return {
      stats: data.stats || {},
      logs: data.logs || [],
    };
  },

  // Emergency Lockdown
  async emergencyLockdown(payload: { targetType: 'workspace' | 'user' | 'organization'; targetId?: string; reason?: string }) {
    const res = await fetch(`${BASE_URL}/api/credentials/emergency-lockdown`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Emergency lockdown failed');
    return data.result;
  },
};
