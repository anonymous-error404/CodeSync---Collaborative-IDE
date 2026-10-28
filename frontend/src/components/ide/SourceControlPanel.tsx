import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch as GitBranchIcon,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Plus,
  Minus,
  Check,
  RotateCcw,
  UploadCloud,
  DownloadCloud,
  Key,
  Eye,
  X,
  AlertCircle,
  FileCode,
  FolderGit2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { GitStatus, GitBranch, GitFileChange } from '../../types';
import { gitCollabService } from '../../services/gitCollabService';
import { Spinner } from '../ui/Spinner';

interface Props {
  workspaceId: string;
  token: string | null;
  currentUserId?: number;
  onOpenFile?: (filePath: string) => void;
  onClose: () => void;
}

export function SourceControlPanel({
  workspaceId,
  token,
  onOpenFile,
  onClose,
}: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Commit state
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);

  // Sync state
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  // Branch state
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  // Clone / Init in uninitialized workspace
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [cloneToken, setCloneToken] = useState('');
  const [cloning, setCloning] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Credentials settings
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credToken, setCredToken] = useState('');
  const [credUsername, setCredUsername] = useState('');
  const [credAuthorName, setCredAuthorName] = useState('');
  const [credAuthorEmail, setCredAuthorEmail] = useState('');
  const [saveToUser, setSaveToUser] = useState(true);
  const [savingCreds, setSavingCreds] = useState(false);
  const [showTokenPlain, setShowTokenPlain] = useState(false);

  // Diff viewer state
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Section collapsible state
  const [showStaged, setShowStaged] = useState(true);
  const [showUnstaged, setShowUnstaged] = useState(true);
  const [showUntracked, setShowUntracked] = useState(true);

  // Fetch Git Status
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gitCollabService.getStatus(workspaceId, token);
      setStatus(data);
      if (data.isGitRepo) {
        try {
          const bRes = await gitCollabService.getBranches(workspaceId, token);
          setBranches(bRes.branches || []);
        } catch { /* ignore branch list error */ }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch git status');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Load existing credentials when modal opens
  const handleOpenCredentials = async () => {
    setShowCredentialsModal(true);
    try {
      const creds = await gitCollabService.getCredentials(workspaceId, token);
      if (creds) {
        setCredUsername(creds.username || '');
        setCredAuthorName(creds.authorName || '');
        setCredAuthorEmail(creds.authorEmail || '');
      }
    } catch { /* ignore */ }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    setError(null);
    try {
      await gitCollabService.saveCredentials(
        workspaceId,
        {
          token: credToken || undefined,
          username: credUsername || undefined,
          authorName: credAuthorName || undefined,
          authorEmail: credAuthorEmail || undefined,
          saveToUser,
        },
        token
      );
      setSuccessMsg('GitHub credentials saved successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowCredentialsModal(false);
      setCredToken('');
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  // Commit Changes
  const handleCommit = async (andPush = false) => {
    if (!commitMessage.trim()) {
      setError('Please enter a commit message');
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      const res = await gitCollabService.commit(
        workspaceId,
        { message: commitMessage.trim() },
        token
      );
      setCommitMessage('');
      setSuccessMsg(res.message || 'Committed changes successfully');
      setTimeout(() => setSuccessMsg(null), 3000);

      if (andPush) {
        handlePush();
      } else {
        fetchStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  // Push Commits
  const handlePush = async () => {
    setPushing(true);
    setError(null);
    try {
      const res = await gitCollabService.push(workspaceId, {}, token);
      setSuccessMsg(res.message || 'Pushed commits to remote repository');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Push failed');
    } finally {
      setPushing(false);
    }
  };

  // Pull Changes
  const handlePull = async () => {
    setPulling(true);
    setError(null);
    try {
      const res = await gitCollabService.pull(workspaceId, {}, token);
      setSuccessMsg(res.message || 'Pulled latest changes');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  // Stage / Unstage File
  const handleStageFile = async (filePath: string, unstage = false) => {
    try {
      await gitCollabService.stageFile(workspaceId, { filePath, unstage }, token);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to stage/unstage file');
    }
  };

  // Discard File Changes
  const handleDiscardChanges = async (filePath: string) => {
    if (!confirm(`Are you sure you want to discard changes in '${filePath}'?`)) return;
    try {
      await gitCollabService.discardChanges(workspaceId, { filePath }, token);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to discard changes');
    }
  };

  // Switch or Create Branch
  const handleCheckoutBranch = async (branchName: string, createNew = false) => {
    setShowBranchMenu(false);
    setCreatingBranch(false);
    try {
      const res = await gitCollabService.checkoutBranch(
        workspaceId,
        { branchName, createNew },
        token
      );
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to checkout branch');
    }
  };

  // View Diff
  const handleViewDiff = async (filePath: string, staged = false) => {
    setActiveDiffFile(filePath);
    setLoadingDiff(true);
    setDiffContent(null);
    try {
      const res = await gitCollabService.getDiff(workspaceId, { filePath, staged }, token);
      setDiffContent(res.diff || '(No text differences detected)');
    } catch (err: any) {
      setDiffContent(`Error loading diff: ${err.message}`);
    } finally {
      setLoadingDiff(false);
    }
  };

  // Clone in uninitialized workspace
  const handleCloneRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl.trim()) return;
    setCloning(true);
    setError(null);
    try {
      const res = await gitCollabService.cloneRepo(
        workspaceId,
        {
          repoUrl: cloneUrl.trim(),
          branch: cloneBranch.trim() || undefined,
          token: cloneToken.trim() || undefined,
        },
        token
      );
      setSuccessMsg(res.message || 'Repository cloned successfully');
      setShowCloneForm(false);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
    } finally {
      setCloning(false);
    }
  };

  // Initialize empty Git repo
  const handleInitRepo = async () => {
    setInitializing(true);
    setError(null);
    try {
      const res = await gitCollabService.initRepo(workspaceId, {}, token);
      setSuccessMsg(res.message || 'Initialized Git repository');
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Git repository');
    } finally {
      setInitializing(false);
    }
  };

  const stagedCount = status?.staged?.length || 0;
  const unstagedCount = status?.unstaged?.length || 0;
  const untrackedCount = status?.untracked?.length || 0;
  const totalChanges = stagedCount + unstagedCount + untrackedCount;

  return (
    <div
      className="fixed top-0 bottom-0 left-12 z-40 flex flex-col shadow-2xl animate-fade-in"
      style={{
        width: 360,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3.5 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-orange-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
            Source Control {status?.isGitRepo && totalChanges > 0 && `(${totalChanges})`}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Refresh Git status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCredentials}
            className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="GitHub Credentials & Author Settings"
          >
            <Key className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            title="Close Source Control"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Status Messages ──────────────────────────────────────────────── */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="shrink-0 text-emerald-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading && !status ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--muted)]">
            <Spinner size={22} />
            <span>Checking Git repository...</span>
          </div>
        ) : !status?.isGitRepo ? (
          /* ── Uninitialized Repository View ────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-8 px-2 text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <FolderGit2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[var(--text)]">No Git Repository Found</h3>
              <p className="text-[11px] text-[var(--muted)] max-w-xs leading-relaxed">
                Track version history, sync with GitHub, and collaborate across branches by initializing or cloning a repository.
              </p>
            </div>

            <div className="flex flex-col w-full gap-2 pt-2">
              <button
                onClick={handleInitRepo}
                disabled={initializing}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {initializing ? <Spinner size={14} /> : <Plus className="w-3.5 h-3.5" />}
                <span>Initialize Git Repository</span>
              </button>

              <button
                onClick={() => setShowCloneForm((prev) => !prev)}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-blue-400" />
                <span>{showCloneForm ? 'Cancel Clone' : 'Clone from GitHub'}</span>
              </button>
            </div>

            {/* Inline Clone Form */}
            {showCloneForm && (
              <form onSubmit={handleCloneRepo} className="w-full text-left p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3 mt-2 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                    Repository URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo.git"
                    className="w-full text-xs p-2 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                    Branch (Optional)
                  </label>
                  <input
                    type="text"
                    value={cloneBranch}
                    onChange={(e) => setCloneBranch(e.target.value)}
                    placeholder="main"
                    className="w-full text-xs p-2 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                    Personal Access Token (For private repos)
                  </label>
                  <input
                    type="password"
                    value={cloneToken}
                    onChange={(e) => setCloneToken(e.target.value)}
                    placeholder="ghp_••••••••••••"
                    className="w-full text-xs p-2 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={cloning}
                  className="w-full py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {cloning ? <Spinner size={14} /> : <DownloadCloud className="w-3.5 h-3.5" />}
                  <span>{cloning ? 'Cloning repository...' : 'Clone Repository'}</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ── Initialized Git Repository Controls ───────────────────────── */
          <>
            {/* Branch Bar & Sync Controls */}
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center justify-between relative">
                {/* Branch Dropdown Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowBranchMenu((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--bg)] text-xs font-semibold text-blue-400 border border-blue-500/20 bg-blue-500/5 transition-colors cursor-pointer"
                    title="Switch or create branch"
                  >
                    <GitBranchIcon className="w-3.5 h-3.5" />
                    <span>{status.branch || 'main'}</span>
                    <ChevronDown className="w-3 h-3 text-[var(--muted)]" />
                  </button>

                  {/* Branch Menu Popup */}
                  {showBranchMenu && (
                    <div
                      className="absolute left-0 top-full mt-1 w-64 rounded-xl shadow-2xl bg-[#0f172a] border border-gray-700 p-2 z-50 animate-fade-in"
                    >
                      <div className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1 border-b border-gray-800 flex items-center justify-between">
                        <span>Branches</span>
                        <button
                          onClick={() => setCreatingBranch(true)}
                          className="text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> New
                        </button>
                      </div>

                      {creatingBranch && (
                        <div className="p-2 border-b border-gray-800 space-y-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={newBranchInput}
                            onChange={(e) => setNewBranchInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCheckoutBranch(newBranchInput, true);
                              if (e.key === 'Escape') setCreatingBranch(false);
                            }}
                            placeholder="branch-name"
                            className="w-full text-xs p-1.5 rounded bg-gray-900 border border-gray-700 text-white outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCheckoutBranch(newBranchInput, true)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white"
                            >
                              Create
                            </button>
                            <button
                              onClick={() => setCreatingBranch(false)}
                              className="px-2 py-0.5 rounded text-[10px] text-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="max-h-48 overflow-y-auto py-1">
                        {branches.map((b) => (
                          <button
                            key={b.name}
                            onClick={() => handleCheckoutBranch(b.name, false)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-gray-800 transition-colors ${
                              b.isCurrent ? 'text-blue-400 font-semibold' : 'text-gray-300'
                            }`}
                          >
                            <span className="truncate">{b.name}</span>
                            {b.isCurrent && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ahead / Behind Metrics */}
                <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono">
                  {status.ahead ? <span className="text-blue-400" title={`${status.ahead} commits ahead of remote`}>↑{status.ahead}</span> : null}
                  {status.behind ? <span className="text-amber-400" title={`${status.behind} commits behind remote`}>↓{status.behind}</span> : null}
                </div>
              </div>

              {/* Sync Actions Bar */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border)]">
                <button
                  onClick={handlePull}
                  disabled={pulling}
                  className="flex-1 py-1 px-2 rounded text-xs font-medium bg-[var(--bg)] hover:bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Pull latest commits from remote"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 text-blue-400 ${pulling ? 'animate-bounce' : ''}`} />
                  <span>{pulling ? 'Pulling...' : 'Pull'}</span>
                </button>

                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="flex-1 py-1 px-2 rounded text-xs font-medium bg-[var(--bg)] hover:bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Push local commits to remote"
                >
                  <UploadCloud className={`w-3.5 h-3.5 text-emerald-400 ${pushing ? 'animate-bounce' : ''}`} />
                  <span>{pushing ? 'Pushing...' : 'Push'}</span>
                </button>
              </div>
            </div>

            {/* Commit Message Box */}
            <div className="space-y-2">
              <textarea
                rows={3}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    handleCommit(false);
                  }
                }}
                placeholder="Commit message (Ctrl+Enter to commit)"
                className="w-full text-xs p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-blue-500 transition-colors resize-none"
              />

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCommit(false)}
                  disabled={committing || totalChanges === 0}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {committing ? <Spinner size={13} /> : <GitCommit className="w-3.5 h-3.5" />}
                  <span>Commit</span>
                </button>

                <button
                  onClick={() => handleCommit(true)}
                  disabled={committing || totalChanges === 0}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--surface)] disabled:opacity-50 text-[var(--text)] border border-[var(--border)] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Commit and immediately push to remote"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>& Push</span>
                </button>
              </div>
            </div>

            {/* ── File Lists ────────────────────────────────────────────── */}
            <div className="space-y-3 pt-2">
              {/* 1. Staged Changes */}
              {stagedCount > 0 && (
                <div className="space-y-1">
                  <div
                    onClick={() => setShowStaged((p) => !p)}
                    className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none py-1 hover:text-[var(--text)]"
                  >
                    <div className="flex items-center gap-1">
                      {showStaged ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Staged Changes ({stagedCount})</span>
                    </div>
                  </div>

                  {showStaged && (
                    <div className="space-y-0.5">
                      {status.staged?.map((f) => (
                        <FileChangeRow
                          key={`staged-${f.path}`}
                          file={f}
                          isStaged
                          onOpenFile={onOpenFile}
                          onViewDiff={() => handleViewDiff(f.path, true)}
                          onStageToggle={() => handleStageFile(f.path, true)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Changes (Unstaged) */}
              <div className="space-y-1">
                <div
                  onClick={() => setShowUnstaged((p) => !p)}
                  className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none py-1 hover:text-[var(--text)]"
                >
                  <div className="flex items-center gap-1">
                    {showUnstaged ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Changes ({unstagedCount})</span>
                  </div>
                </div>

                {showUnstaged && (
                  <div className="space-y-0.5">
                    {unstagedCount === 0 && untrackedCount === 0 && stagedCount === 0 ? (
                      <p className="text-xs text-[var(--muted)] italic py-2 px-1">
                        Working directory clean (no changes).
                      </p>
                    ) : (
                      status.unstaged?.map((f) => (
                        <FileChangeRow
                          key={`unstaged-${f.path}`}
                          file={f}
                          isStaged={false}
                          onOpenFile={onOpenFile}
                          onViewDiff={() => handleViewDiff(f.path, false)}
                          onStageToggle={() => handleStageFile(f.path, false)}
                          onDiscard={() => handleDiscardChanges(f.path)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 3. Untracked Files */}
              {untrackedCount > 0 && (
                <div className="space-y-1">
                  <div
                    onClick={() => setShowUntracked((p) => !p)}
                    className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none py-1 hover:text-[var(--text)]"
                  >
                    <div className="flex items-center gap-1">
                      {showUntracked ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Untracked Files ({untrackedCount})</span>
                    </div>
                  </div>

                  {showUntracked && (
                    <div className="space-y-0.5">
                      {status.untracked?.map((f) => (
                        <FileChangeRow
                          key={`untracked-${f.path}`}
                          file={f}
                          isStaged={false}
                          onOpenFile={onOpenFile}
                          onViewDiff={() => handleViewDiff(f.path, false)}
                          onStageToggle={() => handleStageFile(f.path, false)}
                          onDiscard={() => handleDiscardChanges(f.path)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer / Last Commit ─────────────────────────────────────────── */}
      {status?.lastCommit && (
        <div
          className="p-2.5 text-[11px] text-[var(--muted)] shrink-0 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-blue-400">[{status.lastCommit.hash}]</span>
            <span className="truncate">{status.lastCommit.message}</span>
          </div>
          <span className="text-[10px] shrink-0 opacity-75">{status.lastCommit.date}</span>
        </div>
      )}

      {/* ── Diff Modal ───────────────────────────────────────────────────── */}
      {activeDiffFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setActiveDiffFile(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] bg-[#0d131f] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-[#090d15] shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-white">{activeDiffFile}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">Git Diff</span>
              </div>
              <button onClick={() => setActiveDiffFile(null)} className="p-1 rounded text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-[#0a0e17] font-mono text-xs">
              {loadingDiff ? (
                <div className="flex justify-center py-8"><Spinner size={20} /></div>
              ) : (
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {(diffContent || '').split('\n').map((line, idx) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isHeader = line.startsWith('@@') || line.startsWith('diff ');

                    let bg = 'transparent';
                    let color = '#cbd5e1';
                    if (isAdd) {
                      bg = 'rgba(16, 185, 129, 0.15)';
                      color = '#34d399';
                    } else if (isDel) {
                      bg = 'rgba(239, 68, 68, 0.15)';
                      color = '#f87171';
                    } else if (isHeader) {
                      color = '#60a5fa';
                    }

                    return (
                      <div key={idx} style={{ background: bg, color }} className="px-2 py-0.5 rounded-sm">
                        {line || ' '}
                      </div>
                    );
                  })}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials / Author Modal ────────────────────────────────────── */}
      {showCredentialsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowCredentialsModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#0d131f] border border-gray-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">GitHub Credentials & Git Author</h3>
              </div>
              <button onClick={() => setShowCredentialsModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-300">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Generate on GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showTokenPlain ? 'text' : 'password'}
                    value={credToken}
                    onChange={(e) => setCredToken(e.target.value)}
                    placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                    className="w-full text-xs p-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:border-blue-500 font-mono pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTokenPlain((p) => !p)}
                    className="absolute right-2 top-2 text-gray-400 hover:text-white"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Requires <code className="text-gray-400">repo</code> scope for private repositories or pushing code.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  GitHub Username
                </label>
                <input
                  type="text"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  placeholder="e.g. octocat"
                  className="w-full text-xs p-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Commit Author Name
                  </label>
                  <input
                    type="text"
                    value={credAuthorName}
                    onChange={(e) => setCredAuthorName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full text-xs p-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Commit Author Email
                  </label>
                  <input
                    type="email"
                    value={credAuthorEmail}
                    onChange={(e) => setCredAuthorEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-xs p-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveToUser"
                  checked={saveToUser}
                  onChange={(e) => setSaveToUser(e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="saveToUser" className="text-xs text-gray-300 cursor-pointer select-none">
                  Save to my CodeSync Account (use across all workspaces)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingCreds}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {savingCreds ? <Spinner size={14} /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCredentialsModal(false)}
                  className="py-2 px-3 rounded-lg text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single file change item row
 */
function FileChangeRow({
  file,
  isStaged,
  onOpenFile,
  onViewDiff,
  onStageToggle,
  onDiscard,
}: {
  file: GitFileChange;
  isStaged: boolean;
  onOpenFile?: (p: string) => void;
  onViewDiff: () => void;
  onStageToggle: () => void;
  onDiscard?: () => void;
}) {
  const statusColor =
    file.status === 'A'
      ? 'text-emerald-400 bg-emerald-500/10'
      : file.status === 'D'
      ? 'text-red-400 bg-red-500/10'
      : file.status === 'U'
      ? 'text-green-400 bg-green-500/10'
      : 'text-blue-400 bg-blue-500/10';

  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--surface-2)] transition-colors text-xs">
      <div
        onClick={() => onOpenFile?.(file.path)}
        className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
        title="Open file in editor"
      >
        <span className={`px-1 py-0.2 rounded text-[10px] font-mono font-bold ${statusColor}`}>
          {file.status}
        </span>
        <span className="truncate text-[var(--text)] text-[11px]">{file.path}</span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onViewDiff}
          className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-blue-400"
          title="View Git Diff"
        >
          <Eye className="w-3 h-3" />
        </button>

        {onDiscard && (
          <button
            onClick={onDiscard}
            className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-red-400"
            title="Discard changes"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={onStageToggle}
          className="p-1 rounded hover:bg-[var(--bg)] text-[var(--muted)] hover:text-white"
          title={isStaged ? 'Unstage file' : 'Stage file'}
        >
          {isStaged ? <Minus className="w-3 h-3 text-amber-400" /> : <Plus className="w-3 h-3 text-emerald-400" />}
        </button>
      </div>
    </div>
  );
}
