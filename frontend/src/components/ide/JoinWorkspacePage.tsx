import { useState } from 'react';
import { Code2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md p-8 rounded-xl shadow-2xl animate-fade-in text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: 'var(--accent)' }}>
            <Code2 size={24} color="#fff" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Workspace Invitation</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>You've been invited to join a collaborative workspace on CodeSync.</p>
        
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-md mb-6 text-sm text-left"
            style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        
        {success ? (
          <div className="flex flex-col items-center gap-3 p-6 rounded-md mb-6"
            style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--success)', fontWeight: 500 }}>Successfully joined! Redirecting to IDE...</span>
          </div>
        ) : (
          <Button onClick={handleJoin} isLoading={loading} size="lg" fullWidth>
            Accept Invitation
          </Button>
        )}
        
        <div className="mt-6 text-xs" style={{ color: 'var(--muted)' }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Cancel & Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
