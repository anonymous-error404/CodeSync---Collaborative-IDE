import { useState, useEffect } from 'react';
import {
  Cpu, Server, Shield, StopCircle, RefreshCw, X, Globe, User, CheckCircle2
} from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface SupportedEnv {
  id: string;
  name: string;
  runtime: string;
  image: string;
  extensions: string[];
  memoryLimit: string;
  cpuLimit: string;
  status: string;
  description: string;
}

interface ActiveEnv {
  envKey: string;
  userId: string | number;
  username: string;
  isGlobal: boolean;
  containerName: string;
  filePath: string;
  startedAt: number;
  uptimeSec: number;
  status: string;
}

interface Props {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  isAdmin: boolean;
  currentUserId: number;
  globalExecutionMode: boolean;
  onToggleGlobalExecution: (enabled: boolean) => void;
}

export function EnvironmentModal({
  workspaceId,
  isOpen,
  onClose,
  socket,
  isAdmin,
  currentUserId,
  globalExecutionMode,
  onToggleGlobalExecution,
}: Props) {
  const [activeTab, setActiveTab] = useState<'my_env' | 'supported' | 'admin'>('my_env');
  const [supportedEnvs, setSupportedEnvs] = useState<SupportedEnv[]>([]);
  const [activeEnvs, setActiveEnvs] = useState<ActiveEnv[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatus = () => {
    if (!socket?.connected) return;
    setLoading(true);
    socket.emit('env:get_status', { workspaceId });
  };

  useEffect(() => {
    if (!isOpen || !socket) return;
    fetchStatus();

    const handleStatus = (data: {
      supported: SupportedEnv[];
      activeEnvironments: ActiveEnv[];
    }) => {
      setLoading(false);
      if (data.supported) setSupportedEnvs(data.supported);
      if (data.activeEnvironments) setActiveEnvs(data.activeEnvironments);
    };

    socket.on('env:status', handleStatus);
    const interval = setInterval(fetchStatus, 3000);

    return () => {
      socket.off('env:status', handleStatus);
      clearInterval(interval);
    };
  }, [isOpen, socket, workspaceId]);

  if (!isOpen) return null;

  const myRunningEnv = activeEnvs.find(
    e => String(e.userId) === String(currentUserId) && !e.isGlobal
  );

  const handleStopMyEnv = () => {
    socket?.emit('stop-execution', { workspaceId, targetUserId: currentUserId });
    setTimeout(fetchStatus, 300);
  };

  const handleStopMember = (targetUserId: string | number) => {
    socket?.emit('env:stop_member', { workspaceId, targetUserId });
    setTimeout(fetchStatus, 300);
  };

  const handleStopGlobal = () => {
    socket?.emit('stop-execution', { workspaceId, isGlobal: true });
    setTimeout(fetchStatus, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
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
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cpu size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Execution Environments
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Isolated Docker Sandbox
                </span>
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Per-member containerized sandbox with zero interference
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

        {/* Tab Navigation */}
        <div
          className="flex items-center gap-1 px-6 pt-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setActiveTab('my_env')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'my_env'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <User size={13} /> My Environment
            {myRunningEnv && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('supported')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'supported'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server size={13} /> Supported Runtimes ({supportedEnvs.length})
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Globe size={13} /> Admin Controls & Management
              {activeEnvs.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-purple-500/20 text-purple-300">
                  {activeEnvs.length}
                </span>
              )}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchStatus}
              title="Refresh status"
              className="p-1 rounded hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
              style={{ color: 'var(--muted)' }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ─── TAB 1: MY ENVIRONMENT ─── */}
          {activeTab === 'my_env' && (
            <div className="space-y-4">
              {/* Status Card */}
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{
                  background: 'var(--bg)',
                  borderColor: myRunningEnv ? 'rgba(63, 185, 80, 0.4)' : 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        myRunningEnv ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-sm font-bold">
                      {myRunningEnv ? 'Environment Active & Running' : 'Environment Idle'}
                    </span>
                  </div>
                  {myRunningEnv && (
                    <button
                      onClick={handleStopMyEnv}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1 transition-colors"
                    >
                      <StopCircle size={13} /> Stop My Container
                    </button>
                  )}
                </div>

                {myRunningEnv ? (
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-white/5">
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Running File:</span>
                      <div className="font-mono text-blue-400 truncate mt-0.5">
                        {myRunningEnv.filePath}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Uptime:</span>
                      <div className="font-mono text-gray-200 mt-0.5">
                        {myRunningEnv.uptimeSec} seconds
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Container Name:</span>
                      <div className="font-mono text-gray-400 truncate text-[11px] mt-0.5">
                        {myRunningEnv.containerName}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Isolation:</span>
                      <div className="text-emerald-400 font-semibold text-[11px] mt-0.5 flex items-center gap-1">
                        <Shield size={11} /> Private Member Sandbox
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Your private container is spun up on-demand whenever you click "Run Code" and is strictly isolated to your user session. Output streams only to your terminal without disturbing collaborators.
                  </p>
                )}
              </div>

              {/* Resource & Isolation Specs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>RAM Limit</span>
                  <div className="text-sm font-bold font-mono text-blue-400 mt-1">128 MB</div>
                </div>
                <div className="p-3 rounded-xl border text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>CPU Cap</span>
                  <div className="text-sm font-bold font-mono text-blue-400 mt-1">0.5 Cores</div>
                </div>
                <div className="p-3 rounded-xl border text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Network</span>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-1">Airgapped</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: SUPPORTED RUNTIMES ─── */}
          {activeTab === 'supported' && (
            <div className="space-y-3">
              {supportedEnvs.map(env => (
                <div
                  key={env.id}
                  className="p-4 rounded-xl border flex items-start justify-between"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{env.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        {env.runtime}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{env.description}</p>
                    <div className="flex items-center gap-1.5 pt-1.5">
                      {env.extensions.map(ext => (
                        <span key={ext} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                    <CheckCircle2 size={13} /> {env.status}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── TAB 3: ADMIN CONTROLS ─── */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-5">
              {/* Global Run Mode Toggle */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div>
                  <h3 className="text-xs font-bold flex items-center gap-1.5">
                    <Globe size={14} className="text-purple-400" /> Global Execution Option
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    When enabled, running code executes globally and broadcasts terminal output to all connected members.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-xs font-semibold transition-colors select-none"
                    style={{
                      color: globalExecutionMode ? '#c084fc' : 'var(--muted)',
                    }}
                  >
                    {globalExecutionMode ? 'Global Run ON' : 'Global Run OFF'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={globalExecutionMode}
                    onClick={() => onToggleGlobalExecution(!globalExecutionMode)}
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out p-0.5 border outline-none"
                    style={{
                      backgroundColor: globalExecutionMode ? '#9333ea' : 'var(--surface-2)',
                      borderColor: globalExecutionMode ? '#a855f7' : 'var(--border)',
                      boxShadow: globalExecutionMode ? '0 0 10px rgba(168, 85, 247, 0.4)' : 'none',
                    }}
                    title={globalExecutionMode ? 'Click to turn off Global Run' : 'Click to turn on Global Run'}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                      style={{
                        transform: globalExecutionMode ? 'translateX(20px)' : 'translateX(0px)',
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* Active Containers List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-300">
                    Running Containers ({activeEnvs.length})
                  </h3>
                  {activeEnvs.length > 0 && (
                    <button
                      onClick={() => {
                        activeEnvs.forEach(e => {
                          if (e.isGlobal) handleStopGlobal();
                          else handleStopMember(e.userId);
                        });
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Stop All Containers
                    </button>
                  )}
                </div>

                {activeEnvs.length === 0 ? (
                  <div
                    className="p-6 rounded-xl border text-center text-xs"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                  >
                    No member environments are currently executing code.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeEnvs.map(env => (
                      <div
                        key={env.envKey}
                        className="p-3 rounded-xl border flex items-center justify-between text-xs"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {env.isGlobal ? 'Global Workspace Run' : env.username}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              (u{env.userId})
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                              {env.filePath}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            Uptime: {env.uptimeSec}s · {env.containerName}
                          </div>
                        </div>
                        <button
                          onClick={() => env.isGlobal ? handleStopGlobal() : handleStopMember(env.userId)}
                          className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <StopCircle size={12} /> Terminate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
