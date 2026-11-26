import { useState } from 'react';
import { KeyRound, X, AlertTriangle } from 'lucide-react';
import { credentialApi } from '../../services/credentialApi';
import type { EphemeralCredential } from '../../types';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (cred: EphemeralCredential) => void;
}

export function TokenRequestModal({ workspaceId, onClose, onSuccess }: Props) {
  const [providerType, setProviderType] = useState('aws_iam');
  const [resourceTarget, setResourceTarget] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [environment, setEnvironment] = useState('development');
  const [operations, setOperations] = useState<string[]>(['read']);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [requestReason, setRequestReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cred = await credentialApi.requestCredential(workspaceId, {
        serviceName,
        providerType,
        resourceTarget,
        environment,
        operations,
        durationMinutes,
        requestReason,
      });
      onSuccess(cred);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOp = (op: string) => {
    setOperations(
      operations.includes(op) ? operations.filter((o) => o !== op) : [...operations, op]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg p-6 rounded-2xl shadow-2xl skeuo-card border"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        <div
          className="flex items-center justify-between pb-3 mb-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl border"
              style={{
                background: 'var(--accent-subtle)',
                color: 'var(--accent)',
                borderColor: 'var(--accent-border)',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Dynamic Ephemeral Token Exchange
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Acquire a short-lived, resource-scoped credential without exposing master secrets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg btn-physical-surface"
            style={{ color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            className="p-3 mb-4 rounded-xl border text-xs flex items-center gap-2"
            style={{
              background: 'var(--error-bg)',
              borderColor: 'var(--error)',
              color: 'var(--error)',
            }}
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Provider Type
              </label>
              <select
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                <option value="aws_iam">AWS IAM (STS Temporary Credentials)</option>
                <option value="hashicorp_vault">HashiCorp Vault Dynamic Secrets</option>
                <option value="stripe">Stripe Sandbox Test API</option>
                <option value="postgres_db">PostgreSQL Dynamic Database User</option>
                <option value="gcp_iam">Google Cloud IAM Token</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                <option value="development">Development (Sandbox)</option>
                <option value="preview">Preview & QA (Restricted Mock)</option>
                <option value="staging">Staging</option>
                <option value="production">Production (Requires Elevation)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Resource Target
              </label>
              <input
                type="text"
                required
                placeholder="e.g. s3:payment-dev-bucket or pg:users_db"
                value={resourceTarget}
                onChange={(e) => setResourceTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border font-mono outline-none"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Service Workload
              </label>
              <input
                type="text"
                required
                placeholder="e.g. payment-service"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border font-mono outline-none"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
              Permitted Operations
            </label>
            <div className="flex gap-2">
              {['read', 'write', 'list', 'delete'].map((op) => {
                const isSelected = operations.includes(op);
                return (
                  <button
                    type="button"
                    key={op}
                    onClick={() => toggleOp(op)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected ? 'btn-physical-primary' : 'btn-physical-surface'
                    }`}
                    style={
                      isSelected
                        ? undefined
                        : {
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--muted)',
                          }
                    }
                  >
                    {op.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Lifetime / TTL (Minutes)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="flex-1 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-xs font-bold font-mono" style={{ color: 'var(--accent)' }}>
                {durationMinutes} min
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Reason for Credential Access
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Local workspace debugging and sandbox integration"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border outline-none"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div
            className="flex items-center justify-end gap-2 pt-3 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl btn-physical-surface cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold rounded-xl btn-physical-primary cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Evaluating Policy...' : 'Issue Scoped Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
