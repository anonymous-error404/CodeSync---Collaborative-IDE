/**
 * CodeSync Authentication API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'codesync_auth_token';

/**
 * Helper to process Fetch API responses
 */
const handleResponse = async (response) => {
  let data;
  try {
    data = await response.json();
  } catch {
    data = { success: false, error: 'Failed to parse server response.' };
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const authService = {
  /**
   * Register a new user
   * @param {string} username
   * @param {string} email
   * @param {string} password
   */
  async register(username, email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });
    return handleResponse(response);
  },

  /**
   * Log in an existing user with email or username
   * @param {string} identifier (email or username)
   * @param {string} password
   */
  async login(identifier, password) {
    const isEmail = identifier.includes('@');
    const payload = isEmail
      ? { email: identifier, password }
      : { username: identifier, password };

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  /**
   * Get current authenticated user profile
   * @param {string} token
   */
  async getMe(token) {
    const authToken = token || this.getStoredToken();
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    return handleResponse(response);
  },

  /**
   * Token Storage Helpers
   */
  getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setStoredToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  removeStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
};
