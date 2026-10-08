import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, ChevronLeft, Sun, Moon, Plus, FileCode, Folder,
  X, Terminal, LogOut, Code2, Save, Pencil, Trash2, CheckCheck, Users,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import type { Workspace, FileItem, WorkspaceRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCodeEditor } from '../../hooks/useCodeEditor';
import { MembersPanel } from './MembersPanel';
import { RemoteCursorsOverlay, type RemoteCursorData } from './RemoteCursorsOverlay';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

const CURSOR_COLORS = [
  '#3fb950', // emerald green
  '#a371f7', // vivid purple
  '#f0883e', // bright orange
  '#db61a2', // pink
  '#d29922', // amber
  '#58a6ff', // sky blue
  '#f85149', // crimson
];
function getDeterministicColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

function adjustCursorForRemoteChange(oldText: string, newText: string, cursorOffset: number): number {
  if (oldText === newText || cursorOffset <= 0) return cursorOffset;
  let prefix = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefix < minLen && oldText[prefix] === newText[prefix]) {
    prefix++;
  }
  if (prefix >= cursorOffset) {
    return cursorOffset;
  }
  const lengthDiff = newText.length - oldText.length;
  return Math.max(0, Math.min(newText.length, cursorOffset + lengthDiff));
}

const EXT_COLOR: Record<string, string> = {
  js: '#f7df1e', ts: '#2f81f7', jsx: '#61dafb', tsx: '#61dafb',
  py: '#3776ab', java: '#f89820', cpp: '#00599c', c: '#a8b9cc',
  md: '#7d8590', json: '#ffa500', html: '#e34c26', css: '#264de4',
  sh: '#89e051', rs: '#dea584', go: '#00add8',
};
const extColor = (name: string) =>
  EXT_COLOR[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'var(--muted)';

interface Props { workspace: Workspace; myRole?: WorkspaceRole; onBack: () => void; }
interface Tab { id: string; name: string; path: string; content: string; dirty: boolean; }

export function IDEShell({ workspace, myRole = 'owner', onBack }: Props) {
  const { token, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [tree, setTree] = useState<FileItem[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Collab state
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Array<{ socketId: string, username: string }>>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorData>>({});
  const [localCursor, setLocalCursor] = useState<{ line: number; col: number } | null>(null);
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0 });

  // File management UI state
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);
  const prevTabPathRef = useRef<string | null>(null);
  const localOffsetRef = useRef<number>(0);

  const isViewer = myRole === 'viewer';

  // ── Socket.io connection ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(`${BASE_URL}/workspace`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-workspace', {
        workspaceId: workspace.id,
        username: user?.username ?? 'Anonymous',
        token,
      });
    });

    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('user-joined', (payload: { socketId: string, username: string }) => {
      setActiveUsers(prev => {
        if (prev.find(u => u.socketId === payload.socketId)) return prev;
        return [...prev, payload];
      });
    });

    socket.on('user-left', (payload: { socketId: string }) => {
      setActiveUsers(prev => prev.filter(u => u.socketId !== payload.socketId));
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[payload.socketId];
        return next;
      });
    });

    socket.on('file-updated', ({ filePath, content, updatedBy }: { filePath: string, content: string, updatedBy: string }) => {
      if (updatedBy !== socket.id) {
        isRemoteUpdatingRef.current = true;
        setTabs(prev => prev.map(t => {
          if (t.path === filePath) {
            const oldContent = t.content;

            // Adjust any other remote cursors on this file so they stay anchored to their code
            setRemoteCursors(rcs => {
              let changed = false;
              const next = { ...rcs };
              for (const [sId, rc] of Object.entries(next)) {
                if (sId !== updatedBy && rc.filePath === filePath && rc.cursor.start !== undefined) {
                  const adj = adjustCursorForRemoteChange(oldContent, content, rc.cursor.start);
                  if (adj !== rc.cursor.start) {
                    const tb = content.slice(0, adj);
                    const lns = tb.split('\n');
                    next[sId] = {
                      ...rc,
                      cursor: {
                        ...rc.cursor,
                        line: lns.length - 1,
                        col: lns[lns.length - 1].length,
                        start: adj,
                        end: adj,
                      },
                    };
                    changed = true;
                  }
                }
              }
              return changed ? next : rcs;
            });

            if (t.id === activeTabId) {
              const curOffset = localOffsetRef.current;
              const newOffset = adjustCursorForRemoteChange(oldContent, content, curOffset);
              localOffsetRef.current = newOffset;

              const textBefore = content.slice(0, newOffset);
              const lines = textBefore.split('\n');
              const newLine = lines.length - 1;
              const newCol = lines[lines.length - 1].length;
              setLocalCursor({ line: newLine, col: newCol });

              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(newOffset, newOffset);
                }
                setTimeout(() => {
                  isRemoteUpdatingRef.current = false;
                }, 50);
              });
            } else {
              setTimeout(() => {
                isRemoteUpdatingRef.current = false;
              }, 50);
            }
            return { ...t, content, dirty: false };
          }
          return t;
        }));
      }
    });

    socket.on('remote-cursor', (payload: { socketId: string, username: string, filePath: string, cursor: any }) => {
      if (payload.socketId === socket.id) return;
      setRemoteCursors(prev => ({
        ...prev,
        [payload.socketId]: {
          socketId: payload.socketId,
          username: payload.username || 'Collaborator',
          filePath: payload.filePath,
          cursor: payload.cursor,
          color: getDeterministicColor(payload.username || payload.socketId),
          lastActive: Date.now(),
        }
      }));
    });

    socket.on('remote-cursor-remove', ({ socketId }: { socketId: string }) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on('execution-started', ({ filePath }: { filePath: string }) => {
      setRunning(true);
      setOutput(`> Running ${filePath}...\n`);
    });

    socket.on('execution-stdout', ({ chunk }: { chunk: string }) => {
      setOutput(prev => prev + chunk);
    });

    socket.on('execution-stderr', ({ chunk }: { chunk: string }) => {
      setOutput(prev => prev + chunk);
    });

    socket.on('execution-finished', ({ exitCode }: { exitCode: number }) => {
      setRunning(false);
      setOutput(prev => prev + `\n> Process finished with exit code ${exitCode}`);
    });

    socket.on('workspace-error', ({ message }: { message: string }) => {
      setOutput(prev => prev + `\n[Error] ${message}`);
    });

    return () => { socket.disconnect(); };
  }, [workspace.id, user?.username, token]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // ── File tree ──────────────────────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/workspaces/${workspace.id}/files/tree`,
        { headers: authHeaders() }
      );
      const d = await res.json();
      if (d.success && d.fileTree) setTree(d.fileTree);
    } catch { /* ignore */ }
  }, [workspace.id, authHeaders]);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ── Tab management ─────────────────────────────────────────────────────────
  const openFile = async (node: FileItem) => {
    if (node.type === 'directory') return;
    const existing = tabs.find(t => t.path === node.path);
    if (existing) { setActiveTabId(existing.id); return; }
    try {
      const res = await fetch(
        `${BASE_URL}/api/workspaces/${workspace.id}/files/content?filePath=${encodeURIComponent(node.path)}`,
        { headers: authHeaders() }
      );
      const d = await res.json();
      const content = d.success ? (d.content ?? '') : `// Error: ${d.error ?? 'unknown'}`;
      const tab: Tab = { id: `tab-${node.path}`, name: node.name, path: node.path, content, dirty: false };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch {
      const tab: Tab = { id: `tab-${node.path}`, name: node.name, path: node.path, content: '', dirty: false };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    }
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeTabId === id) setActiveTabId(next[next.length - 1]?.id ?? null);
      return next;
    });
  };

  const emitCursorRef = useRef<(isTyping?: boolean, forcedOffset?: number, currentText?: string) => void>(() => {});

  const updateCode = (value: string, cursorOffset?: number) => {
    const oldContent = activeTab?.content ?? '';
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: value, dirty: true } : t));

    // Keep other remote cursors on this file aligned with the modified text
    if (activeTab?.path) {
      setRemoteCursors(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [sId, rc] of Object.entries(next)) {
          if (rc.filePath === activeTab.path && rc.cursor.start !== undefined) {
            const adjOffset = adjustCursorForRemoteChange(oldContent, value, rc.cursor.start);
            if (adjOffset !== rc.cursor.start) {
              const tb = value.slice(0, adjOffset);
              const lns = tb.split('\n');
              next[sId] = {
                ...rc,
                cursor: {
                  ...rc.cursor,
                  line: lns.length - 1,
                  col: lns[lns.length - 1].length,
                  start: adjOffset,
                  end: adjOffset,
                },
              };
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }

    if (activeTab && socketRef.current?.connected && !isViewer) {
      socketRef.current.emit('file-change', {
        workspaceId: workspace.id,
        filePath: activeTab.path,
        content: value,
      });
      emitCursorRef.current(true, cursorOffset, value);
    }
  };

  // ── File operations ────────────────────────────────────────────────────────
  const saveActive = useCallback(async () => {
    if (!activeTab) return;
    setSaving(true);
    try {
      await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files/content`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ filePath: activeTab.path, content: activeTab.content }),
      });
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, dirty: false } : t));
    } finally {
      setSaving(false);
    }
  }, [activeTab, activeTabId, workspace.id, authHeaders]);

  const createFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filePath: name, isDirectory: false }),
      });
      const d = await res.json();
      if (d.success) {
        await loadTree();
        setShowNewFile(false);
        setNewFileName('');
        openFile({ id: name, name, path: name, type: 'file' });
      } else {
        setOutput(prev => prev + `\n[Error] ${d.error ?? 'Could not create file'}`);
      }
    } catch {
      setOutput(prev => prev + '\n[Error] Could not connect to server');
    }
  };

  const deleteFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${filePath.split('/').pop()}"? This cannot be undone.`)) return;
    // Close open tab if present
    setTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      if (activeTabId === `tab-${filePath}`) setActiveTabId(next[next.length - 1]?.id ?? null);
      return next;
    });
    try {
      await fetch(
        `${BASE_URL}/api/workspaces/${workspace.id}/files?filePath=${encodeURIComponent(filePath)}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      await loadTree();
    } catch { /* ignore */ }
  };

  const startRename = (filePath: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingPath(filePath);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    if (!renamingPath || !renameValue.trim()) { setRenamingPath(null); return; }
    const dir = renamingPath.includes('/')
      ? renamingPath.slice(0, renamingPath.lastIndexOf('/') + 1)
      : '';
    const newPath = dir + renameValue.trim();
    if (newPath === renamingPath) { setRenamingPath(null); return; }
    // Update open tab
    setTabs(prev => prev.map(t =>
      t.path === renamingPath
        ? { ...t, name: renameValue.trim(), path: newPath, id: `tab-${newPath}` }
        : t
    ));
    if (activeTabId === `tab-${renamingPath}`) setActiveTabId(`tab-${newPath}`);
    try {
      await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files/rename`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ oldPath: renamingPath, newPath }),
      });
      await loadTree();
    } catch { /* ignore */ }
    setRenamingPath(null);
  };

  // ── Code execution ─────────────────────────────────────────────────────────
  const runFile = async () => {
    if (!activeTab || running) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setOutput('[Error] Not connected to backend. Is the server running?\n');
      return;
    }
    await saveActive();
    socket.emit('execute-code', { workspaceId: workspace.id, filePath: activeTab.path });
  };

  const stopExecution = () => {
    socketRef.current?.emit('stop-execution', { workspaceId: workspace.id });
  };

  // ── Smart editor hook ──────────────────────────────────────────────────────
  const { textareaRef, handleKeyDown } = useCodeEditor(
    activeTab?.content ?? '',
    updateCode,
    activeTab?.name ?? '',
    saveActive,
  );

  // ── Remote cursor broadcast ───────────────────────────────────────────────
  const activeTabPath = activeTab?.path;
  const emitCursor = useCallback((isTyping = false, forcedOffset?: number, currentText?: string) => {
    if (isRemoteUpdatingRef.current) return;
    if (!textareaRef.current || !activeTabPath || !socketRef.current?.connected) return;
    const ta = textareaRef.current;
    const val = currentText !== undefined ? currentText : ta.value;
    const start = forcedOffset !== undefined ? forcedOffset : ta.selectionStart;
    const end = forcedOffset !== undefined ? forcedOffset : ta.selectionEnd;
    const textBefore = val.slice(0, start);
    const lines = textBefore.split('\n');
    const line = lines.length - 1;
    const col = lines[lines.length - 1].length;

    localOffsetRef.current = start;
    setLocalCursor({ line, col });

    socketRef.current.emit('cursor-move', {
      workspaceId: workspace.id,
      filePath: activeTabPath,
      cursor: {
        line,
        col,
        start,
        end,
        isTyping,
      },
    });
  }, [activeTabPath, workspace.id, textareaRef]);

  emitCursorRef.current = emitCursor;

  // Sync cursor ONLY when switching active tabs (NOT on content edits)!
  useEffect(() => {
    if (activeTabId && activeTabPath && socketRef.current?.connected) {
      if (prevTabPathRef.current && prevTabPathRef.current !== activeTabPath) {
        socketRef.current.emit('cursor-leave', {
          workspaceId: workspace.id,
          filePath: prevTabPathRef.current,
        });
      }
      prevTabPathRef.current = activeTabPath;
      emitCursorRef.current(false);
    }
  }, [activeTabId, activeTabPath, workspace.id]);

  // ── File tree renderer ─────────────────────────────────────────────────────
  const renderTree = (nodes: FileItem[], depth = 0): React.ReactNode =>
    nodes.map(node => (
      <div key={node.path ?? node.name} className="group">
        {renamingPath === node.path ? (
          // ── Inline rename input ──
          <div className="flex items-center gap-1 px-2 py-0.5" style={{ paddingLeft: 12 + depth * 14 }}>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') setRenamingPath(null);
              }}
              onBlur={commitRename}
              autoFocus
              className="flex-1 h-6 px-1.5 rounded text-xs focus:outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
            />
            <button onClick={commitRename} style={{ color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <CheckCheck size={12} />
            </button>
          </div>
        ) : (
          // ── Normal file row ──
          <div className="relative flex items-center">
            <button
              onClick={() => openFile(node)}
              className="flex-1 flex items-center gap-2 py-1.5 text-left transition-colors"
              style={{
                paddingLeft: 12 + depth * 14,
                paddingRight: 48,
                background: 'transparent',
                border: 'none',
                color: tabs.find(t => t.path === node.path) ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: node.type === 'file' ? 'var(--font-mono)' : undefined,
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {node.type === 'directory'
                ? <Folder size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                : <FileCode size={13} style={{ color: extColor(node.name), flexShrink: 0 }} />
              }
              <span className="truncate">{node.name}</span>
            </button>

            {/* Hover action buttons */}
            {!isViewer && (
              <div
                className="absolute right-1 top-0 bottom-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ display: 'flex' }}
              >
                <button
                  onClick={e => startRename(node.path, node.name, e)}
                  title="Rename"
                  className="flex items-center justify-center w-5 h-5 rounded"
                  style={{ color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={e => deleteFile(node.path, e)}
                  title="Delete"
                  className="flex items-center justify-center w-5 h-5 rounded"
                  style={{ color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>
        )}
        {node.type === 'directory' && node.children && renderTree(node.children, depth + 1)}
      </div>
    ));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{ height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm px-3 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
          >
            <ChevronLeft size={14} />Workspaces
          </button>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          <div className="flex items-center gap-2">
            <Code2 size={15} style={{ color: 'var(--accent)' }} />
            <span className="font-semibold truncate max-w-56" style={{ color: 'var(--text)', fontSize: 15 }}>
              {workspace.name}
            </span>
          </div>

          {/* Connection status badge */}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: socketConnected ? 'var(--success-bg)' : 'var(--error-bg)',
              color: socketConnected ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${socketConnected ? 'var(--success)' : 'var(--error)'}`,
            }}
          >
            {socketConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Active users */}
          {activeUsers.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-2">
              {activeUsers.slice(0, 3).map((u, i) => (
                <div key={u.socketId} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                  style={{ background: `hsl(${i * 60 + 120}, 70%, 50%)`, color: '#fff', borderColor: 'var(--surface)' }}
                  title={u.username}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
              ))}
              {activeUsers.length > 3 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--surface)' }}>
                  +{activeUsers.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Members Panel toggle */}
          <button
            onClick={() => setShowMembersPanel(v => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: showMembersPanel ? 'var(--surface-2)' : 'transparent', border: '1px solid var(--border)', color: showMembersPanel ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer' }}
            title="Members & Invites"
          >
            <Users size={13} />
          </button>

          {/* Save indicator */}
          {activeTab?.dirty && !isViewer && (
            <button
              onClick={saveActive}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--warning)', cursor: 'pointer' }}
            >
              <Save size={13} />{saving ? 'Saving…' : 'Save'}
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Run / Stop button */}
          {!isViewer && (
            running ? (
              <button
                onClick={stopExecution}
                className="flex items-center gap-2 px-4 h-8 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'var(--error)', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                <Square size={12} />Stop
              </button>
            ) : (
              <button
                onClick={runFile}
                disabled={!activeTab || !socketConnected}
                className="flex items-center gap-2 px-4 h-8 rounded-lg text-sm font-semibold disabled:opacity-40 transition-all"
                style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: activeTab && socketConnected ? 'pointer' : 'not-allowed' }}
              >
                <Play size={12} />Run
              </button>
            )
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col shrink-0"
          style={{ width: 248, background: 'var(--surface)', borderRight: '1px solid var(--border)', overflow: 'hidden' }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
            >
              Explorer
            </span>
            {!isViewer && (
              <button
                onClick={() => setShowNewFile(v => !v)}
                title="New file"
                className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                style={{ color: showNewFile ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {/* New file input */}
          {showNewFile && (
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="e.g. main.py"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') createFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
                }}
                className="w-full h-8 px-2.5 rounded text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Enter to create · Esc to cancel</p>
            </div>
          )}

          {/* File tree */}
          <div className="flex-1 overflow-y-auto py-2">
            {tree.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No files yet — click + to create one
              </p>
            ) : renderTree(tree)}
          </div>
        </aside>

        {/* ── Editor area ── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0d1117' }}>

          {/* Tab bar */}
          <div
            className="flex items-end overflow-x-auto shrink-0"
            style={{ height: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', minHeight: 40 }}
          >
            {tabs.map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className="flex items-center gap-2 px-4 h-full text-sm cursor-pointer transition-colors shrink-0 select-none"
                style={{
                  borderRight: '1px solid var(--border)',
                  borderTop: activeTabId === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  background: activeTabId === tab.id ? '#0d1117' : 'var(--surface)',
                  color: activeTabId === tab.id ? 'var(--text)' : 'var(--muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                }}
              >
                <FileCode size={12} style={{ color: extColor(tab.name), flexShrink: 0 }} />
                <span>{tab.name}</span>
                {tab.dirty && <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>}
                <button
                  onClick={e => closeTab(tab.id, e)}
                  className="ml-1 flex items-center justify-center w-4 h-4 rounded opacity-60 hover:opacity-100 transition-opacity"
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* Editor + Console */}
          {activeTab ? (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Code editor */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                {/* Active file collaborators bar */}
                {Object.values(remoteCursors).filter(c => c.filePath === activeTab.path).length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1 text-xs shrink-0" style={{ background: '#161b22', borderBottom: '1px solid var(--border)' }}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                      Collaborating in {activeTab.name}:
                    </span>
                    {Object.values(remoteCursors).filter(c => c.filePath === activeTab.path).map(c => {
                      const isTyping = (Date.now() - c.lastActive) < 3000 && c.cursor.isTyping;
                      return (
                        <span key={c.socketId} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: c.color + '22', color: c.color, border: `1px solid ${c.color}66` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                          {c.username}
                          {isTyping && <span className="text-[10px] italic animate-pulse">(typing...)</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex-1 flex relative overflow-hidden">
                  {/* Remote cursors overlay */}
                  <RemoteCursorsOverlay
                    cursors={Object.values(remoteCursors)
                      .filter(c => c.filePath === activeTab.path)
                      .map(c => ({
                        ...c,
                        username: c.username === user?.username ? `${c.username} (collab)` : c.username,
                      }))}
                    localCursor={localCursor ? { line: localCursor.line, col: localCursor.col, username: user?.username ?? 'You', color: '#2f81f7' } : null}
                    scrollTop={editorScroll.top}
                    scrollLeft={editorScroll.left}
                  />

                  {/* Line numbers */}
                  <div
                    className="py-4 pr-3 text-right select-none shrink-0 overflow-hidden"
                    style={{ width: 52, background: '#0d1117', color: '#444', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '1.7' }}
                  >
                    {activeTab.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  {/* Smart textarea */}
                  <textarea
                    ref={textareaRef}
                    value={activeTab.content}
                    onChange={e => updateCode(e.target.value, e.target.selectionStart)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={() => emitCursor(false)}
                    onClick={() => emitCursor(false)}
                    onMouseUp={() => emitCursor(false)}
                    onFocus={() => emitCursor(false)}
                    onScroll={e => setEditorScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
                    spellCheck={false}
                    readOnly={isViewer}
                    wrap="off"
                    className="flex-1 py-4 px-3 resize-none focus:outline-none"
                    style={{
                      background: '#0d1117',
                      color: '#e6edf3',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 14,
                      lineHeight: '1.7',
                      border: 'none',
                      tabSize: 2,
                      whiteSpace: 'pre',
                      overflowX: 'auto',
                      opacity: isViewer ? 0.8 : 1,
                    }}
                  />
                  {isViewer && (
                    <div className="absolute top-4 right-6 pointer-events-none px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider z-20"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      View Only
                    </div>
                  )}
                </div>
              </div>

              {/* Console / Terminal output */}
              <div className="shrink-0" style={{ height: 220, borderTop: '1px solid var(--border)' }}>
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex items-center gap-2">
                    <Terminal size={13} style={{ color: 'var(--muted)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      Console
                    </span>
                    {running && (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--warning)' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--warning)', display: 'inline-block' }} />
                        Executing…
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setOutput('')}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
                <pre
                  ref={outputRef}
                  className="p-4 text-sm leading-relaxed overflow-auto"
                  style={{
                    margin: 0,
                    height: 'calc(100% - 40px)',
                    background: '#0a0c10',
                    color: '#e6edf3',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {output || <span style={{ color: 'var(--muted)' }}>Console output will appear here after clicking Run…</span>}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--muted)' }}>
              <FileCode size={40} className="mb-4 opacity-20" />
              <p style={{ fontSize: 15, color: 'var(--text)' }}>Select a file to open it</p>
              {!isViewer && <p className="mt-1 text-sm">Or click + in the sidebar to create a new file</p>}
            </div>
          )}
        </main>
      </div>

      {/* Members Panel Overlay */}
      {showMembersPanel && (
        <MembersPanel
          workspaceId={workspace.id}
          myRole={myRole}
          currentUserId={user?.id ?? 0}
          token={token}
          onClose={() => setShowMembersPanel(false)}
        />
      )}
    </div>
  );
}
