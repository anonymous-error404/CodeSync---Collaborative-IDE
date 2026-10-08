import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import type { AuthUser, LoginPayload, RegisterPayload } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (p: LoginPayload) => Promise<string | null>;
  register: (p: RegisterPayload) => Promise<string | null>;
  logout: () => void;
}
const AuthContext = createContext<AuthCtx>({ user: null, token: null, isLoading: true, login: async () => null, register: async () => null, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let t = authService.handleOAuthCallback();
    if (!t) {
      t = authService.getToken();
    }
    if (!t) { setIsLoading(false); return; }
    authService.getMe(t).then(res => {
      if (res.success && res.user) { setUser(res.user); setToken(t); }
      else authService.clearToken();
      setIsLoading(false);
    }).catch(() => { authService.clearToken(); setIsLoading(false); });
  }, []);

  const login = async (p: LoginPayload) => {
    const res = await authService.login(p);
    if (res.success && res.token && res.user) { authService.setToken(res.token); setToken(res.token); setUser(res.user); return null; }
    return res.error ?? 'Login failed';
  };
  const register = async (p: RegisterPayload) => {
    const res = await authService.register(p);
    if (res.success && res.token && res.user) { authService.setToken(res.token); setToken(res.token); setUser(res.user); return null; }
    return res.error ?? 'Registration failed';
  };
  const logout = () => { authService.clearToken(); setUser(null); setToken(null); };

  return <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
