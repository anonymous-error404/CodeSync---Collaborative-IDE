import { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, CheckCircle2, AlertCircle, Link2, RefreshCw, FolderGit2 } from 'lucide-react';
import type { MountedRepository, TypeMeshStatus } from '../../../types';
import { professionalCollabService } from '../../../services/professionalCollabService';
import { Spinner } from '../../ui/Spinner';

interface Props {
  workspaceId: string;
  token: string | null;
}

export function MultiRepoTab({ workspaceId, token }: Props) {
  const [repos, setRepos] = useState<MountedRepository[]>([]);
  const [typeMesh, setTypeMesh] = useState<TypeMeshStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Mount form
  const [showMountForm, setShowMountForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [targetFolder, setTargetFolder] = useState('');
  const [branch, setBranch] = useState('main');
  const [mounting, setMounting] = useState(false);

  // Type sync verification
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [repoList, mesh] = await Promise.all([
        professionalCollabService.getMountedRepos(workspaceId, token),
        professionalCollabService.detectTypeMesh(workspaceId, token),
      ]);
      setRepos(repoList);
      setTypeMesh(mesh);
    } catch (err: any) {
      setError(err.message || 'Failed to load multi-repo status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId, token]);

  const handleMountRepo = async () => {
    if (!repoUrl.trim()) return;
    setMounting(true);
    setError('');
    setSuccessMsg('');
    try {
      await professionalCollabService.mountRepo(
        workspaceId,
        repoUrl.trim(),
        targetFolder.trim() || '',
        branch.trim() || 'main',
        token
      );
      setSuccessMsg('✓ Repository mounted successfully into workspace file tree!');
      setShowMountForm(false);
      setRepoUrl('');
      setTargetFolder('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to mount repository');
    } finally {
      setMounting(false);
    }
  };

  const handleUnmountRepo = async (repoId: string, folder: string) => {
    if (!confirm(`Unmount repository "${folder}" from this workspace session?`)) return;
    setError('');
    setSuccessMsg('');
    try {
      await professionalCollabService.unmountRepo(workspaceId, repoId, token);
      setSuccessMsg(`✓ Unmounted ${folder}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to unmount repository');
    }
  };

  const handleLinkTypeMesh = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await professionalCollabService.linkTypeMesh(workspaceId, token);
      if (res.success) {
        setSuccessMsg(`✓ Linked ${res.linked.length} microservices to shared type packages.`);
      } else {
        setError(res.message || 'Could not link type mesh');
      }
    } catch (err: any) {
      setError(err.message || 'Type mesh linking failed');
    }
  };

  const handleVerifyTypes = async () => {
    setVerifying(true);
    setVerificationResult(null);
    setError('');
    try {
      const ver = await professionalCollabService.verifyTypeSync(workspaceId, token);
      setVerificationResult(ver);
    } catch (err: any) {
      setError(err.message || 'Type sync verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--muted)]">
        <Spinner size={22} />
        <span>Scanning mounted microservice repositories...</span>
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

      {successMsg && (
        <div className="p-2.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          {successMsg}
        </div>
      )}

      {/* ── Section: Multi-Root Microservices Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-xs text-[var(--text)]">Mounted Microservices</span>
          <p className="text-[11px] text-[var(--muted)]">Multi-root repositories mounted in this workspace session</p>
        </div>
        <button
          onClick={() => setShowMountForm(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer"
        >
          <Plus size={13} /> Mount Repo
        </button>
      </div>

      {/* ── Mount Form Modal/Dropdown ── */}
      {showMountForm && (
        <div className="p-3 rounded-xl border space-y-2.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <span className="font-semibold text-[var(--text)]">Mount Additional Git Repository</span>
          <input
            type="text"
            placeholder="Git URL (e.g. https://github.com/org/billing-service.git)"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
            style={{ borderColor: 'var(--border)' }}
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Target Folder Name (optional)"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
              style={{ borderColor: 'var(--border)' }}
            />
            <input
              type="text"
              placeholder="Branch"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg)] text-[var(--text)] border focus:outline-none"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowMountForm(false)}
              className="px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              style={{ background: 'none', border: 'none' }}
            >
              Cancel
            </button>
            <button
              onClick={handleMountRepo}
              disabled={mounting || !repoUrl.trim()}
              className="px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 cursor-pointer"
            >
              {mounting ? 'Cloning...' : 'Mount'}
            </button>
          </div>
        </div>
      )}

      {/* ── Repository List ── */}
      <div className="space-y-2">
        {repos.map(r => (
          <div
            key={r.id}
            className="p-3 rounded-xl border flex items-center justify-between gap-3"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          >
            <div className="space-y-1 truncate">
              <div className="flex items-center gap-2">
                <FolderGit2 size={14} className={r.isPrimary ? 'text-blue-400' : 'text-purple-400'} />
                <span className="font-semibold text-[var(--text)] truncate">{r.name}</span>
                {r.isPrimary && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    PRIMARY
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] font-mono">
                <span>Branch: {r.branch}</span>
                <span>•</span>
                <span>Path: /{r.folder}</span>
              </div>
            </div>

            {!r.isPrimary && (
              <button
                onClick={() => handleUnmountRepo(r.id, r.name)}
                className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                style={{ background: 'none', border: 'none' }}
                title="Unmount repository"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Section: Cross-Repo Type Sync Mesh ── */}
      <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
            <Layers size={15} className="text-indigo-400" />
            <span>Cross-Repo Type Sync Mesh</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            {typeMesh?.typeProviders.length ? `${typeMesh.typeProviders.length} Shared Schemas` : 'Active'}
          </span>
        </div>

        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          Editing a TypeScript interface or Protobuf schema in <code className="text-[10px] text-indigo-300">shared-types</code> instantly validates across consumer services in real time.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleLinkTypeMesh}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Link2 size={12} />
            Link Type Mesh
          </button>

          <button
            onClick={handleVerifyTypes}
            disabled={verifying}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[var(--bg)] border text-[var(--text)] hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} />
            Verify Types
          </button>
        </div>

        {/* Verification Diagnostics */}
        {verificationResult && (
          <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {verificationResult.allValid ? (
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={13} />
                  <span>All Microservice Types Valid</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-400">
                  <AlertCircle size={13} />
                  <span>Cross-Repo Type Mismatch Detected</span>
                </div>
              )}
            </div>

            {verificationResult.results.map((r: any) => (
              <div key={r.consumer} className="p-2 rounded bg-[var(--bg)] border font-mono text-[10px]" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between font-semibold text-[var(--text)]">
                  <span>{r.consumer}</span>
                  <span className={r.status === 'valid' ? 'text-emerald-400' : 'text-amber-400'}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[var(--muted)] text-[9px] truncate pt-0.5">{r.diagnostics}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
