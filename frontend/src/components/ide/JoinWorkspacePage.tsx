import { useState } from 'react';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { collabService } from '../../services/workspaceCollabService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface Props {
  inviteCode: string;
  onJoined: (workspaceId: string, role: string) => void;
}

export function JoinWorkspacePage({ inviteCode, onJoined }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await collabService.joinViaInvite(inviteCode, token);
      if (res.success && res.workspaceId) {
        setSuccess(true);
        setTimeout(() => {
          onJoined(res.workspaceId, res.role || 'viewer');
        }, 800);
      } else {
        setError((res as any).error || 'Invalid or expired invite link.');
      }
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('codesync_pending_join');
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    url.searchParams.delete('code');
    window.history.replaceState({}, '', '/');
    window.location.href = '/';
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-6 relative"
      style={{
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(circle, rgba(180,184,196,0.25) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        className="w-full max-w-md skeuo-card animate-fade-in text-center relative"
        style={{
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Skeuomorphic Header Tab */}
        <div className="card-header-tab">
          <div className="flex items-center gap-2">
            <span className="anchor-dot" />
            <span>NODE: INVITATION // INCOMING</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--muted)]">
            CODE: {inviteCode.slice(0, 8)}…
          </span>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--inset-shadow)',
              }}
            >
              <img src={logoImg} alt="CodeSync" className="w-12 h-12 rounded-xl object-contain shadow-xs" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
            Workspace Invitation
          </h1>
          <p className="text-xs sm:text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted)' }}>
            You have received an authorization token to join a collaborative CodeSync IDE session with live synchronization and isolated execution.
          </p>

          {/* Technical schematic code chip */}
          <div
            className="flex items-center justify-between px-3.5 py-2 rounded-xl border mb-6 font-mono text-xs"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          >
            <span className="text-[var(--muted)]">TOKEN:</span>
            <span className="font-bold text-[var(--accent)] truncate max-w-[200px]">{inviteCode}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          {error && (
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl mb-6 text-xs text-left border"
              style={{ background: 'var(--error-bg)', borderColor: 'var(--error)', color: 'var(--error)' }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div
              className="flex flex-col items-center gap-3 p-6 rounded-xl mb-6 border"
              style={{ background: 'var(--success-bg)', borderColor: 'var(--success)' }}
            >
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                Session Connected · Routing to IDE…
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleJoin}
                isLoading={loading}
                size="lg"
                fullWidth
                className="btn-physical-primary h-11 text-xs sm:text-sm font-bold"
              >
                <span>Accept &amp; Enter Workspace</span>
                <ArrowRight size={15} />
              </Button>

              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-semibold py-2 cursor-pointer transition-colors hover:underline"
                style={{ color: 'var(--muted)', background: 'none', border: 'none' }}
              >
                Cancel and return to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
