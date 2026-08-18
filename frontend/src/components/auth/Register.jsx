import { useState } from 'react';
import { useAuth } from '../../context/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Register = ({ onSuccess, onSwitchToLogin }) => {
  const { register, isLoading, authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
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
    const trimmedUsername = formData.username.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedUsername) {
      errors.username = 'Username is required.';
    } else if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      errors.username = 'Username must be between 3 and 50 characters.';
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await register(
      formData.username.trim(),
      formData.email.trim(),
      formData.password
    );

    if (result.success && onSuccess) {
      onSuccess(result.user);
    }
  };

  return (
    <div className="auth-form-wrapper">
      <div className="auth-form-header">
        <h2 className="auth-form-title">Create Account</h2>
        <p className="auth-form-subtitle">Join CodeSync for collaborative coding</p>
      </div>

      {authError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field-group">
          <label className="auth-label" htmlFor="register-username">
            Username
          </label>
          <div className="auth-input-wrapper">
            <input
              id="register-username"
              name="username"
              type="text"
              className={`auth-input ${fieldErrors.username ? 'has-error' : ''}`}
              placeholder="Choose a unique username"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.username && (
            <span className="auth-field-error">{fieldErrors.username}</span>
          )}
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="register-email">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <input
              id="register-email"
              name="email"
              type="email"
              className={`auth-input ${fieldErrors.email ? 'has-error' : ''}`}
              placeholder="e.g. developer@codesync.io"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.email && (
            <span className="auth-field-error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="register-password">
            Password (min. 6 characters)
          </label>
          <div className="auth-input-wrapper">
            <input
              id="register-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`auth-input ${fieldErrors.password ? 'has-error' : ''}`}
              placeholder="Create a secure password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
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

        <div className="auth-field-group">
          <label className="auth-label" htmlFor="register-confirm-password">
            Confirm Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              className={`auth-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>
          {fieldErrors.confirmPassword && (
            <span className="auth-field-error">{fieldErrors.confirmPassword}</span>
          )}
        </div>

        <button
          type="submit"
          className="auth-btn auth-btn-primary auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <p className="auth-switch-prompt">
        Already have an account?{' '}
        <button
          type="button"
          className="auth-switch-btn"
          onClick={() => {
            clearError();
            onSwitchToLogin();
          }}
        >
          Sign in here
        </button>
      </p>
    </div>
  );
};
