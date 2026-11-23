import { useState, useEffect } from 'react';
import { Zap, Play, CheckCircle2, Clock, GitBranch } from 'lucide-react';
import type { WarmPoolSnapshot } from '../../../types';
import { professionalCollabService } from '../../../services/professionalCollabService';
import { Spinner } from '../../ui/Spinner';

interface Props {
  workspaceId: string;
  token: string | null;
}

export function WarmPoolTab({ workspaceId, token }: Props) {
  const [snapshots, setSnapshots] = useState<WarmPoolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prebuild form
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const loadSnapshots = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await professionalCollabService.getWarmSnapshots(token);
      setSnapshots(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [workspaceId, token]);

  const handleTriggerPrebuild = async () => {
    if (!repoUrl.trim()) return;
    setTriggering(true);
    setTriggerMsg('');
    setError('');
    try {
      await professionalCollabService.triggerPrebuild(repoUrl.trim(), branch.trim() || 'main', token);
      setTriggerMsg('✓ Headless prebuild worker started in background. Snapshot will be hot in < 60s.');
      setRepoUrl('');
      setTimeout(loadSnapshots, 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger prebuild');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--muted)]">
        <Spinner size={22} />
        <span>Inspecting Copy-on-Write warm-pools...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-xs">
      {error && (
        <div className="p-2.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30">
          {error}
        </div>
      )}

      {/* ── Section: Instant Startup Metric Banner ── */}
      <div className="p-3.5 rounded-xl border space-y-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-amber-400">
            <Zap size={16} />
            <span>Copy-on-Write (CoW) Warm-Pools</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Startup &lt; 3s
          </span>
        </div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          Pre-built branch snapshots fork in milliseconds using zero-copy file hardlinks. 5GB of <code className="text-[10px] text-amber-300">node_modules</code> and compiled binaries are already hot in memory.
        </p>
      </div>

      {/* ── Section: Trigger Headless Branch Pre-Build ── */}
      <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
          <GitBranch size={14} className="text-blue-400" />
          <span>Pre-Build Branch Snapshot</span>
        </div>

        {triggerMsg && (
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/30">
            {triggerMsg}
          </div>
        )}

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Git Repo URL (e.g. https://github.com/org/repo.git)"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Branch name (default: main)"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
              style={{ borderColor: 'var(--border)' }}
            />
            <button
              onClick={handleTriggerPrebuild}
              disabled={triggering || !repoUrl.trim()}
              className="px-4 py-1.5 rounded-lg font-semibold text-xs text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={12} fill="white" />
              Pre-Build
            </button>
          </div>
        </div>
      </div>

      {/* ── Section: Available Pre-Built Snapshots ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)]">
            Warm Snapshots Pool ({snapshots.length})
          </span>
          <button
            onClick={loadSnapshots}
            className="text-[11px] text-blue-400 hover:underline cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            Refresh
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="p-6 text-center rounded-xl border text-[var(--muted)]" style={{ borderColor: 'var(--border)' }}>
            No warm snapshots cached yet. Trigger a pre-build above or push a commit to auto-freeze.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map(sn => (
              <div
                key={sn.key}
                className="p-3 rounded-xl border flex items-center justify-between gap-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="space-y-1 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)] truncate">
                      {sn.gitRepoUrl.split('/').slice(-1)[0]}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {sn.branch}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
                    <span>Engine: {sn.installType}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(sn.prebuiltAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0">
                  <CheckCircle2 size={13} />
                  <span>Ready</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
