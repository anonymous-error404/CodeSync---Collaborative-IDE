import { useState } from 'react';
import { useAuth } from '../../context/useAuth';

export const Login = ({ onSuccess, onSwitchToRegister }) => {
  const { login, isLoading, authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (authError) {
      clearError();
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.identifier.trim()) {
      errors.identifier = 'Email or username is required.';
    }
    if (!formData.password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await login(formData.identifier.trim(), formData.password);
    if (result.success && onSuccess) {
      onSuccess(result.user);
    }
  };

  return (
    <div className="auth-form-wrapper">
      <div className="auth-form-header">
        <h2 className="auth-form-title">Welcome Back</h2>
        <p className="auth-form-subtitle">Sign in to your CodeSync workspace</p>
      </div>

      {authError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="login-identifier">
            Email or Username
          </label>
          <div className="auth-input-wrapper">
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              className={`auth-input ${fieldErrors.identifier ? 'has-error' : ''}`}
              placeholder="e.g. developer@codesync.io or dev_user"
              value={formData.identifier}
              onChange={handleChange}
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.identifier && (
            <span className="auth-field-error">{fieldErrors.identifier}</span>
          )}
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="login-password">
            Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`auth-input ${fieldErrors.password ? 'has-error' : ''}`}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {fieldErrors.password && (
            <span className="auth-field-error">{fieldErrors.password}</span>
          )}
        </div>

        <button
          type="submit"
          className="auth-btn auth-btn-primary auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="auth-switch-prompt">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          className="auth-switch-btn"
          onClick={() => {
            clearError();
            onSwitchToRegister();
          }}
        >
          Create an account
        </button>
      </p>
    </div>
  );
};
