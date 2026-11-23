import { useState, useEffect } from 'react';
import { Terminal, Copy, Check, ExternalLink, RefreshCw, FolderGit2 } from 'lucide-react';
import type { GatewayConnectionInfo, DotfilesStatus } from '../../../types';
import { professionalCollabService } from '../../../services/professionalCollabService';
import { Spinner } from '../../ui/Spinner';

interface Props {
  workspaceId: string;
  token: string | null;
}

export function GatewayTab({ workspaceId, token }: Props) {
  const [connInfo, setConnInfo] = useState<GatewayConnectionInfo | null>(null);
  const [dotfilesStatus, setDotfilesStatus] = useState<DotfilesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dotfiles sync state
  const [dotfilesUrl, setDotfilesUrl] = useState('');
  const [syncingDotfiles, setSyncingDotfiles] = useState(false);
  const [dotfilesSuccess, setDotfilesSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [info, dfStatus] = await Promise.all([
        professionalCollabService.getConnectionInfo(workspaceId, token),
        professionalCollabService.getDotfilesStatus(workspaceId, token),
      ]);
      setConnInfo(info);
      setDotfilesStatus(dfStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to load gateway info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId, token]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSyncDotfiles = async () => {
    if (!dotfilesUrl.trim()) return;
    setSyncingDotfiles(true);
    setDotfilesSuccess('');
    setError('');
    try {
      const res = await professionalCollabService.syncDotfiles(workspaceId, dotfilesUrl.trim(), token);
      setDotfilesSuccess(`✓ Synced ${res.linkedFiles.length} dotfiles (.zshrc, .vimrc, etc.)`);
      setDotfilesStatus({ installed: true, detectedFiles: res.detectedFiles });
      setDotfilesUrl('');
    } catch (err: any) {
      setError(err.message || 'Dotfiles sync failed');
    } finally {
      setSyncingDotfiles(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--muted)]">
        <Spinner size={22} />
        <span>Generating secure SSH gateway credentials...</span>
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

      {/* ── Section: One-Click Desktop Editors ── */}
      <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Terminal size={15} className="text-blue-400" />
            <span>Bring Your Own Editor (Desktop)</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            SSH Gateway Active
          </span>
        </div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          Write code in your native local desktop editor with custom keybindings and plugins, while language servers, compilers, and Docker run in CodeSync cloud.
        </p>

        {connInfo && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={connInfo.vscodeUri}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-semibold text-xs transition-all no-underline text-white shadow-sm"
              style={{ background: '#007ACC' }}
              title="Launch in Desktop VS Code Remote"
            >
              <ExternalLink size={13} />
              Open in VS Code
            </a>

            <a
              href={connInfo.cursorUri}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-semibold text-xs transition-all no-underline text-white shadow-sm"
              style={{ background: '#6366F1' }}
              title="Launch in Desktop Cursor AI"
            >
              <ExternalLink size={13} />
              Open in Cursor
            </a>
          </div>
        )}
      </div>

      {/* ── Section: CodeSync CLI Connect Command ── */}
      {connInfo && (
        <div className="p-3.5 rounded-xl border space-y-2.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text)]">CLI Connection Command</span>
            <button
              onClick={() => handleCopy(connInfo.cliCommand, 'cli')}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copiedKey === 'cli' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedKey === 'cli' ? 'Copied' : 'Copy Command'}
            </button>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--bg)] border font-mono text-[11px] text-emerald-400 select-all overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {connInfo.cliCommand}
          </div>
        </div>
      )}

      {/* ── Section: Direct SSH & Config Snippet ── */}
      {connInfo && (
        <div className="p-3.5 rounded-xl border space-y-2.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text)]">Direct SSH Host Config</span>
            <button
              onClick={() => handleCopy(connInfo.sshConfigSnippet, 'ssh')}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copiedKey === 'ssh' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedKey === 'ssh' ? 'Copied Config' : 'Copy ~/.ssh/config'}
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-[var(--bg)] border font-mono text-[10px] text-[var(--muted)] overflow-x-auto whitespace-pre select-all" style={{ borderColor: 'var(--border)' }}>
            {connInfo.sshConfigSnippet}
          </pre>
        </div>
      )}

      {/* ── Section: Personal Dotfiles Sync ── */}
      <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
            <FolderGit2 size={14} className="text-purple-400" />
            <span>Personal Dotfiles Sync</span>
          </div>
          {dotfilesStatus?.installed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              {dotfilesStatus.detectedFiles.length} files linked
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          Automatically pull your GitHub dotfiles repository (<code className="text-[10px] text-purple-300">.zshrc</code>, <code className="text-[10px] text-purple-300">.vimrc</code>, <code className="text-[10px] text-purple-300">.tmux.conf</code>) into your cloud workspace shell.
        </p>

        {dotfilesSuccess && (
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/30">
            {dotfilesSuccess}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://github.com/username/dotfiles.git"
            value={dotfilesUrl}
            onChange={e => setDotfilesUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          />
          <button
            onClick={handleSyncDotfiles}
            disabled={syncingDotfiles || !dotfilesUrl.trim()}
            className="px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
          >
            {syncingDotfiles ? <RefreshCw size={12} className="animate-spin" /> : null}
            Sync
          </button>
        </div>

        {dotfilesStatus?.detectedFiles && dotfilesStatus.detectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {dotfilesStatus.detectedFiles.map(f => (
              <span key={f} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg)] border font-mono text-[var(--muted)]" style={{ borderColor: 'var(--border)' }}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
