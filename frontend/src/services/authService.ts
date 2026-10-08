import type { AuthResponse, LoginPayload, RegisterPayload } from '../types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

async function request(path: string, options: RequestInit = {}): Promise<AuthResponse> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) },
      ...options,
    });
    const data = await res.json() as AuthResponse;
    if (!res.ok) return { success: false, error: data.error ?? data.message ?? `Error ${res.status}` };
    return data;
  } catch {
    return { success: false, error: 'Cannot connect to server. Is the backend running?' };
  }
}

export const authService = {
  login: (p: LoginPayload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(p) }),
  register: (p: RegisterPayload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(p) }),
  getMe: (token: string) => request('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } as HeadersInit }),
  getToken: (): string | null => localStorage.getItem('codesync_token'),
  setToken: (t: string): void => { localStorage.setItem('codesync_token', t); },
  clearToken: (): void => { localStorage.removeItem('codesync_token'); },
  googleAuth: () => { window.location.href = `${BASE_URL}/api/auth/google`; },
  googleAuthDemo: () => { window.location.href = `${BASE_URL}/api/auth/google?demo=true`; },
  handleOAuthCallback: (): string | null => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('codesync_token', token);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
      return token;
    }
    return null;
  }
};
