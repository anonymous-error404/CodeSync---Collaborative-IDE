import { useAuth } from '../../context/useAuth';

export const UserNav = ({ onOpenAuth }) => {
  const { user, isAuthenticated, logout } = useAuth();

  if (isAuthenticated && user) {
    const initial = (user.username || user.email || 'U').charAt(0).toUpperCase();

    return (
      <div className="user-nav">
        <div className="user-profile-badge">
          <div className="user-avatar" title={user.email}>
            {initial}
          </div>
          <div className="user-info">
            <span className="user-name">{user.username}</span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>

        <button
          type="button"
          className="auth-btn auth-btn-ghost"
          onClick={logout}
          title="Sign out of CodeSync"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="user-nav">
      <button
        type="button"
        className="auth-btn auth-btn-ghost"
        onClick={() => onOpenAuth('login')}
      >
        Sign In
      </button>
      <button
        type="button"
        className="auth-btn auth-btn-primary"
        onClick={() => onOpenAuth('register')}
      >
        Sign Up
      </button>
    </div>
  );
};
