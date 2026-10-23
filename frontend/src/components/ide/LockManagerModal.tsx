import { useState } from 'react';
import { Lock, Unlock, Folder, FileCode, Code, X, Plus, AlertCircle, Shield } from 'lucide-react';
import type { Socket } from 'socket.io-client';

export interface WorkspaceLockItem {
  id: string;
  workspaceId: string;
  lockType: 'file' | 'folder' | 'code_block';
  targetPath: string;
  startLine?: number | null;
  endLine?: number | null;
  lockedBy: number;
  lockedByName: string;
  reason?: string | null;
  createdAt?: string;
}

interface Props {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  locks: WorkspaceLockItem[];
  socket: Socket | null;
  canLock: boolean;
  isAdmin: boolean;
  currentUserId: number;
  activeFilePath?: string;
}

export function LockManagerModal({
  workspaceId,
  isOpen,
  onClose,
  locks,
  socket,
  canLock,
  isAdmin,
  currentUserId,
  activeFilePath,
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [lockType, setLockType] = useState<'file' | 'folder' | 'code_block'>('file');
  const [targetPath, setTargetPath] = useState(activeFilePath || '');
  const [startLine, setStartLine] = useState<string>('');
  const [endLine, setEndLine] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim()) {
      setError('Target path is required');
      return;
    }

    if (lockType === 'code_block' && (!startLine || !endLine)) {
      setError('Start line and end line are required for code block locking');
      return;
    }

    socket?.emit('lock:create', {
      workspaceId,
      lockType,
      targetPath: targetPath.trim(),
      startLine: startLine ? Number(startLine) : undefined,
      endLine: endLine ? Number(endLine) : undefined,
      reason: reason.trim() || undefined,
    });

    setShowCreateForm(false);
    setReason('');
    setError(null);
  };

  const handleReleaseLock = (lockId: string) => {
    socket?.emit('lock:release', { workspaceId, lockId });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Resource Access Locks
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {locks.length} Active
                </span>
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Control file, folder, and code block edit restrictions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action bar */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
        >
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Only Admins and Editors can lock resources across workspaces
          </span>
          {canLock && !showCreateForm && (
            <button
              onClick={() => {
                setTargetPath(activeFilePath || '');
                setShowCreateForm(true);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} /> Lock New Resource
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Create Lock Form */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateLock}
              className="p-4 rounded-xl border space-y-3"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield size={13} className="text-amber-400" /> Create Resource Lock
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['file', 'folder', 'code_block'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLockType(type)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-colors flex items-center justify-center gap-1.5 ${
                      lockType === type
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {type === 'file' && <FileCode size={12} />}
                    {type === 'folder' && <Folder size={12} />}
                    {type === 'code_block' && <Code size={12} />}
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                  Target Path (e.g. src/App.tsx or src/components)
                </label>
                <input
                  type="text"
                  value={targetPath}
                  onChange={e => setTargetPath(e.target.value)}
                  placeholder="Relative path in workspace"
                  className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  required
                />
              </div>

              {lockType === 'code_block' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                      Start Line
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={startLine}
                      onChange={e => setStartLine(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                      End Line
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={endLine}
                      onChange={e => setEndLine(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                  Reason (Optional note for teammates)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Refactoring component architecture"
                  className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-lg shadow-amber-600/20"
              >
                Apply Lock
              </button>
            </form>
          )}

          {/* List of active locks */}
          {locks.length === 0 ? (
            <div
              className="p-8 rounded-xl border text-center text-xs space-y-1"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              <Lock size={24} className="mx-auto opacity-30 mb-2" />
              <p>No active locks in this workspace.</p>
              <p className="text-[11px]">All files and folders are currently editable according to your workspace role.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {locks.map(lk => {
                const isLocker = lk.lockedBy === currentUserId;
                const canRelease = isLocker || isAdmin;

                return (
                  <div
                    key={lk.id}
                    className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {lk.lockType === 'folder' ? (
                          <Folder size={13} className="text-amber-400 shrink-0" />
                        ) : lk.lockType === 'code_block' ? (
                          <Code size={13} className="text-purple-400 shrink-0" />
                        ) : (
                          <FileCode size={13} className="text-blue-400 shrink-0" />
                        )}
                        <span className="font-mono font-bold truncate text-white">
                          {lk.targetPath}
                        </span>
                        {lk.lockType === 'code_block' && lk.startLine && lk.endLine && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 font-mono">
                            L{lk.startLine}-L{lk.endLine}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-gray-400 capitalize">
                          {lk.lockType.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-[11px] flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                        <span>
                          Locked by <strong className="text-gray-300">{isLocker ? 'You' : lk.lockedByName}</strong>
                        </span>
                        {lk.reason && (
                          <span className="truncate italic">· "{lk.reason}"</span>
                        )}
                      </div>
                    </div>

                    {canRelease && (
                      <button
                        onClick={() => handleReleaseLock(lk.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Unlock size={12} /> Unlock
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
