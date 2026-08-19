import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextDef';
import { authService } from '../services/authService';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(authService.getStoredToken());
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Hydrate authentication session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = authService.getStoredToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await authService.getMe(storedToken);
        if (data.success && data.user) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          authService.removeStoredToken();
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth]: Stored session is invalid or expired:', err.message);
        authService.removeStoredToken();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Register action
   */
  const register = async (username, email, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const data = await authService.register(username, email, password);
      if (data.success) {
        authService.setStoredToken(data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      }
      throw new Error(data.error || 'Registration failed');
    } catch (err) {
      const errorMsg = err.message || 'Registration failed. Please try again.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login action
   */
  const login = async (identifier, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const data = await authService.login(identifier, password);
      if (data.success) {
        authService.setStoredToken(data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      }
      throw new Error(data.error || 'Login failed');
    } catch (err) {
      const errorMsg = err.message || 'Login failed. Please check your credentials.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout action
   */
  const logout = useCallback(() => {
    authService.removeStoredToken();
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    authError,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
