import { useState, useEffect, useRef, useCallback } from 'react';
import ChatAndVoicePanel from './ChatAndVoicePanel';
import {
  Play, Square, ChevronLeft, Sun, Moon, Plus, FileCode, Folder,
  X, Terminal, LogOut, Code2, Save, Pencil, Trash2, CheckCheck,
  Users, Layers, MessageSquare,
  Phone, PhoneOff, Mic, MicOff, Headphones,
  Lock, Unlock, Hand, HelpCircle, Bell, Radio, GraduationCap,
  Eye, Send, EyeOff, Briefcase, Trophy, Edit3,
  Maximize2, Minimize2, ChevronUp, ChevronDown
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import type { Workspace, FileItem, WorkspaceRole, SessionRole, WorkspaceType, StudentAccessLevel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCodeEditor } from '../../hooks/useCodeEditor';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { MembersPanel } from './MembersPanel';
import { RemoteCursorsOverlay, type RemoteCursorData } from './RemoteCursorsOverlay';
import { IntelligentWhiteboard } from '../whiteboard/IntelligentWhiteboard';
import { collabService } from '../../services/workspaceCollabService';

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
  const [activeView, setActiveView] = useState<'editor' | 'whiteboard'>('editor');
  const [tree, setTree] = useState<FileItem[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);

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

  // ── Education & Professional RBAC State ──
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionRole, setSessionRole] = useState<SessionRole>('none');
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusedFilePath, setFocusedFilePath] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<Array<{ socketId?: string; userId: number; username: string; timestamp?: number }>>([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [showHandsDropdown, setShowHandsDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpNotification, setHelpNotification] = useState<{ username: string; message: string; timestamp: number } | null>(null);
  const [pingAlert, setPingAlert] = useState<{ message: string; from?: string } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [currentRole, setCurrentRole] = useState<WorkspaceRole>(workspace.myRole || myRole || 'owner');
  const [studentAccess, setStudentAccess] = useState<StudentAccessLevel>(workspace.studentAccess || 'editor');

  const workspaceType = (workspace.type || 'educational') as WorkspaceType;

  const isTeacher = currentRole === 'teacher' || sessionRole === 'teacher' || currentRole === 'owner' || currentRole === 'admin';
  const isStudent = currentRole === 'student' || (!isTeacher && sessionRole === 'student');
  const isNoView = (isStudent && studentAccess === 'no-view') || currentRole === 'no-view';
  const isViewer = currentRole === 'viewer' || (isStudent && studentAccess === 'viewer');
  const canAdmin = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'teacher' || currentRole === 'team_leader';
  const canEdit = !isNoView && !isViewer && (!isStudent || studentAccess === 'editor') && !(isStudent && isEditorLocked);
  const isEffectiveReadOnly = isNoView || isViewer || (isStudent && isEditorLocked);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);
  const prevTabPathRef = useRef<string | null>(null);
  const localOffsetRef = useRef<number>(0);

  // ── Terminal / Console sizing & state (VS Code style expandable) ───────────
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(true);
  const [terminalHeight, setTerminalHeight] = useState<number>(220);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState<boolean>(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState<boolean>(false);
  const isDraggingTerminalRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(220);

  const toggleTerminal = useCallback(() => {
    setActiveView('editor');
    setIsTerminalOpen(prevOpen => {
      if (!prevOpen) {
        setIsTerminalCollapsed(false);
        return true;
      }
      if (isTerminalCollapsed) {
        setIsTerminalCollapsed(false);
        return true;
      }
      return false;
    });
  }, [isTerminalCollapsed]);

  // Global shortcut: Ctrl/Cmd + ` opens or toggles the terminal (VS Code style)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isBackquote = e.key === '`' || e.code === 'Backquote' || e.keyCode === 192 || e.which === 192;
      if ((e.ctrlKey || e.metaKey) && isBackquote) {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleTerminal]);

  const handleTerminalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingTerminalRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingTerminalRef.current) return;
      const deltaY = dragStartYRef.current - moveEvent.clientY;
      const newHeight = Math.max(90, Math.min(window.innerHeight - 150, dragStartHeightRef.current + deltaY));
      setTerminalHeight(newHeight);
      setIsTerminalMaximized(false);
      setIsTerminalCollapsed(false);
    };

    const onMouseUp = () => {
      isDraggingTerminalRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight]);

  // ── Voice call (broadcast from teacher or owner/admin) ──
  const isBroadcaster = sessionActive ? isTeacher : canAdmin;
  const voice = useVoiceCall(
    socketConnected ? socketRef.current : null,
    workspace.id,
    isBroadcaster
  );
  // ── Tab & File operations ──────────────────────────────────────────────────
  const openFileByPath = useCallback(async (filePath: string) => {
    if (!filePath || isNoView) return;
    const existing = tabs.find(t => t.path === filePath);
    if (existing) { setActiveTabId(existing.id); return; }
    const filename = filePath.split('/').pop() || filePath;
    try {
      const res = await fetch(
        `${BASE_URL}/api/workspaces/${workspace.id}/files/content?filePath=${encodeURIComponent(filePath)}`,
        { headers: authHeaders() }
      );
      const d = await res.json();
      const content = d.success ? (d.content ?? '') : `// Error: ${d.error ?? 'unknown'}`;
      const tab: Tab = { id: `tab-${filePath}`, name: filename, path: filePath, content, dirty: false };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch {
      const tab: Tab = { id: `tab-${filePath}`, name: filename, path: filePath, content: '', dirty: false };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    }
  }, [tabs, workspace.id, authHeaders, isNoView]);

  const openFile = useCallback(async (node: FileItem) => {
    if (node.type === 'directory') return;
    await openFileByPath(node.path);
  }, [openFileByPath]);

  const loadTree = useCallback(async () => {
    if (studentAccess === 'no-view' && isStudent) {
      setTree([]);
      return;
    }
    try {
      const res = await fetch(
        `${BASE_URL}/api/workspaces/${workspace.id}/files/tree`,
        { headers: authHeaders() }
      );
      const d = await res.json();
      if (d.success && d.fileTree) setTree(d.fileTree);
    } catch { /* ignore */ }
  }, [workspace.id, authHeaders, studentAccess, isStudent]);

  useEffect(() => { loadTree(); }, [loadTree]);

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

    socket.on('workspace-ready', (data: {
      workspaceId: string;
      fileTree?: FileItem[];
      myRole?: WorkspaceRole;
      mySessionRole?: SessionRole;
      editorLocked?: boolean;
      studentAccess?: StudentAccessLevel;
    }) => {
      if (data.myRole) setCurrentRole(data.myRole);
      if (data.mySessionRole) setSessionRole(data.mySessionRole);
      if (data.editorLocked !== undefined) setIsEditorLocked(data.editorLocked);
      if (data.studentAccess) setStudentAccess(data.studentAccess);
      if (data.fileTree) setTree(data.fileTree);
    });

    socket.on('member:access_updated', (data: { workspaceId: string; studentAccess: StudentAccessLevel; updatedBy: string }) => {
      setStudentAccess(data.studentAccess);
      if (data.studentAccess === 'no-view') {
        setTabs([]);
        setActiveTabId(null);
        setTree([]);
        setOutput(prev => prev + `\n[Notice] Teacher (${data.updatedBy}) updated your access to No-View.`);
      } else {
        loadTree();
        setOutput(prev => prev + `\n[Notice] Teacher (${data.updatedBy}) updated your access to ${data.studentAccess}.`);
      }
    });

    socket.on('member:access_changed', () => {
      // Trigger update if needed
    });

    socket.on('workspace-error', ({ message }: { message: string }) => {
      setOutput(prev => prev + `\n[Error] ${message}`);
    });

    // ── Session socket events ──
    socket.on('session:active', (data: { active: boolean; teacherSocketId?: string; teacherId?: number; focusMode?: boolean; focusFilePath?: string; lockedAll?: boolean }) => {
      setSessionActive(data.active);
      if (data.active) {
        if (data.teacherId && user?.id) {
          setSessionRole(data.teacherId === user.id ? 'teacher' : 'student');
        }
        setIsFocusMode(!!data.focusMode);
        setFocusedFilePath(data.focusFilePath || null);
        if (data.lockedAll && data.teacherId !== user?.id) {
          setIsEditorLocked(true);
        }
      }
    });

    socket.on('session:started', (data: { teacherId: number; teacherUsername: string }) => {
      setSessionActive(true);
      const iamTeacher = user?.id === data.teacherId;
      setSessionRole(iamTeacher ? 'teacher' : 'student');
      if (!iamTeacher) {
        setIsEditorLocked(false);
        setMyHandRaised(false);
      }
    });

    socket.on('session:ended', () => {
      setSessionActive(false);
      setSessionRole('none');
      setIsEditorLocked(false);
      setIsFocusMode(false);
      setFocusedFilePath(null);
      setRaisedHands([]);
      setMyHandRaised(false);
    });

    socket.on('session:editor_locked', () => {
      setIsEditorLocked(true);
    });

    socket.on('session:editor_unlocked', () => {
      setIsEditorLocked(false);
    });

    socket.on('session:focus_changed', (data: { focusMode: boolean; filePath?: string }) => {
      setIsFocusMode(data.focusMode);
      setFocusedFilePath(data.filePath || null);
      if (data.focusMode && data.filePath) {
        openFileByPath(data.filePath);
      }
    });

    socket.on('session:hand_raised', (data: { socketId?: string; userId: number; username: string }) => {
      setRaisedHands(prev => {
        if (prev.some(h => h.userId === data.userId)) return prev;
        return [...prev, { ...data, timestamp: Date.now() }];
      });
      if (data.userId === user?.id) {
        setMyHandRaised(true);
      }
    });

    socket.on('session:hand_lowered', (data: { socketId?: string; userId: number }) => {
      setRaisedHands(prev => prev.filter(h => h.userId !== data.userId));
      if (data.userId === user?.id) {
        setMyHandRaised(false);
      }
    });

    socket.on('session:help_requested', (data: { studentUsername: string; message: string; timestamp: number }) => {
      setHelpNotification({ username: data.studentUsername, message: data.message, timestamp: data.timestamp });
      setTimeout(() => setHelpNotification(null), 10000);
    });

    socket.on('session:ping', (data: { message: string; from?: string }) => {
      setPingAlert(data);
      setTimeout(() => setPingAlert(null), 6000);
    });

    socket.on('session:open_file', (data: { filePath: string }) => {
      if (data.filePath) openFileByPath(data.filePath);
    });

    socket.on('session:kicked', (data: { reason: string }) => {
      alert(`You have been removed from the session: ${data.reason || 'By teacher'}`);
      setSessionRole('none');
    });

    return () => { socket.disconnect(); };
  }, [workspace.id, user?.id, user?.username, token, openFileByPath]);

  // Initial session fetch
  useEffect(() => {
    let mounted = true;
    collabService.getMySessionRole(workspace.id, token).then(res => {
      if (!mounted) return;
      if (res.success) {
        setSessionActive(res.sessionActive);
        setSessionRole(res.sessionRole);
        setIsEditorLocked(!!res.editorLocked);
        setMyHandRaised(!!res.handRaised);
      }
    }).catch(() => {});

    collabService.getSession(workspace.id, token).then(res => {
      if (!mounted) return;
      if (res.success && res.active && res.session) {
        setSessionActive(true);
        setIsFocusMode(!!res.session.focusMode);
        setFocusedFilePath(res.session.focusedFilePath || null);
      }
    }).catch(() => {});

    return () => { mounted = false; };
  }, [workspace.id, token]);

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

    if (activeTab && socketRef.current?.connected && !isEffectiveReadOnly) {
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
    if (!activeTab || isEffectiveReadOnly) return;
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
  }, [activeTab, activeTabId, workspace.id, authHeaders, isEffectiveReadOnly]);

  const createFile = async () => {
    if (isEffectiveReadOnly) return;
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
        openFileByPath(name);
      } else {
        setOutput(prev => prev + `\n[Error] ${d.error ?? 'Could not create file'}`);
      }
    } catch {
      setOutput(prev => prev + '\n[Error] Could not connect to server');
    }
  };

  const deleteFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEffectiveReadOnly) return;
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
    if (isEffectiveReadOnly) return;
    setRenamingPath(filePath);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    if (isEffectiveReadOnly || !renamingPath || !renameValue.trim()) { setRenamingPath(null); return; }
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
    if (!activeTab || running || isEffectiveReadOnly) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setOutput('[Error] Not connected to backend. Is the server running?\n');
      return;
    }
    setIsTerminalOpen(true);
    setIsTerminalCollapsed(false);
    await saveActive();
    socket.emit('execute-code', { workspaceId: workspace.id, filePath: activeTab.path });
  };

  const stopExecution = () => {
    socketRef.current?.emit('stop-execution', { workspaceId: workspace.id });
  };

  // ── Classroom Session Handlers (Teacher) ──
  const handleStartSession = async () => {
    setSessionLoading(true);
    try {
      const res = await collabService.startSession(workspace.id, token);
      if (res.success) {
        setSessionActive(true);
        setSessionRole('teacher');
        socketRef.current?.emit('session:announce_start', { workspaceId: workspace.id });
      } else {
        alert((res as any).error || 'Failed to start session');
      }
    } catch {
      alert('Network error starting session');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this classroom session?')) return;
    setSessionLoading(true);
    try {
      const res = await collabService.endSession(workspace.id, token);
      if (res.success) {
        setSessionActive(false);
        setSessionRole('none');
        setIsFocusMode(false);
        setFocusedFilePath(null);
        setRaisedHands([]);
        socketRef.current?.emit('session:announce_end', { workspaceId: workspace.id });
      }
    } finally {
      setSessionLoading(false);
    }
  };

  const handleToggleFocusMode = async () => {
    const next = !isFocusMode;
    const currentPath = activeTab?.path || null;
    setIsFocusMode(next);
    setFocusedFilePath(next ? currentPath : null);
    socketRef.current?.emit('session:focus', { workspaceId: workspace.id, filePath: currentPath, enabled: next });
    await collabService.setFocusMode(workspace.id, next, currentPath, token).catch(() => {});
  };

  const handleLockAll = async () => {
    await collabService.lockAllStudents(workspace.id, token).catch(() => {});
    socketRef.current?.emit('session:lock_all', { workspaceId: workspace.id });
  };

  const handleUnlockAll = async () => {
    await collabService.unlockAllStudents(workspace.id, token).catch(() => {});
    socketRef.current?.emit('session:unlock_all', { workspaceId: workspace.id });
  };

  const handlePingStudents = () => {
    socketRef.current?.emit('session:ping_students', {
      workspaceId: workspace.id,
      message: 'Teacher has requested everyone\'s attention!'
    });
  };

  const handleLowerStudentHand = (targetUserId: number) => {
    socketRef.current?.emit('session:lower_hand', { workspaceId: workspace.id, targetUserId });
    setRaisedHands(prev => prev.filter(h => h.userId !== targetUserId));
  };

  // ── Classroom Session Handlers (Student) ──
  const handleToggleHand = () => {
    if (myHandRaised) {
      socketRef.current?.emit('session:lower_hand', { workspaceId: workspace.id });
      setMyHandRaised(false);
    } else {
      socketRef.current?.emit('session:raise_hand', { workspaceId: workspace.id });
      setMyHandRaised(true);
    }
  };

  const handleSendHelp = () => {
    if (!helpMessage.trim()) return;
    socketRef.current?.emit('session:request_help', {
      workspaceId: workspace.id,
      message: helpMessage.trim(),
    });
    setHelpMessage('');
    setShowHelpModal(false);
    alert('Help request sent to teacher!');
  };

  // ── Smart editor hook ──────────────────────────────────────────────────────
  const { textareaRef, handleKeyDown } = useCodeEditor(
    activeTab?.content ?? '',
    updateCode,
    activeTab?.name ?? '',
    saveActive,
    toggleTerminal,
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
            {!isEffectiveReadOnly && (
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

          {/* Workspace Type Badge */}
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5"
            style={{
              background: workspaceType === 'educational' ? 'rgba(168, 85, 247, 0.15)' : workspaceType === 'professional' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: workspaceType === 'educational' ? '#c084fc' : workspaceType === 'professional' ? '#60a5fa' : '#fbbf24',
              border: `1px solid ${workspaceType === 'educational' ? 'rgba(168, 85, 247, 0.35)' : workspaceType === 'professional' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
            }}
          >
            {workspaceType === 'educational' ? <GraduationCap size={12} /> : workspaceType === 'professional' ? <Briefcase size={12} /> : <Trophy size={12} />}
            <span className="capitalize">{workspaceType}</span>
          </span>

          {/* Role / Access Level Badge */}
          <span
            className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1"
            style={{
              background: isTeacher
                ? 'rgba(168, 85, 247, 0.18)'
                : isStudent
                ? studentAccess === 'no-view'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : studentAccess === 'viewer'
                  ? 'rgba(56, 189, 248, 0.15)'
                  : 'rgba(63, 185, 80, 0.15)'
                : 'var(--surface-2)',
              color: isTeacher
                ? '#c084fc'
                : isStudent
                ? studentAccess === 'no-view'
                  ? '#ef4444'
                  : studentAccess === 'viewer'
                  ? '#38bdf8'
                  : '#3fb950'
                : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {isTeacher ? (
              <>🎓 Teacher</>
            ) : isStudent ? (
              <>
                {studentAccess === 'no-view' ? <EyeOff size={11} /> : studentAccess === 'viewer' ? <Eye size={11} /> : <Edit3 size={11} />}
                Student: {studentAccess}
              </>
            ) : currentRole === 'team_leader' ? (
              <>👑 Team Leader</>
            ) : currentRole === 'developer' ? (
              <>💻 Developer</>
            ) : (
              <>{currentRole}</>
            )}
          </span>

          {/* View Mode Toggle: Code Editor vs Whiteboard */}
          <div
            className="flex items-center p-0.5 rounded-lg border ml-2"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setActiveView('editor')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all"
              style={{
                background: activeView === 'editor' ? 'var(--surface-2)' : 'transparent',
                color: activeView === 'editor' ? 'var(--accent)' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Code2 size={13} /> Code Editor
            </button>

            <button
              onClick={() => setActiveView('whiteboard')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all"
              style={{
                background: activeView === 'whiteboard' ? 'var(--surface-2)' : 'transparent',
                color: activeView === 'whiteboard' ? 'var(--accent)' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Layers size={13} /> Whiteboard
            </button>
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
            title="Members &amp; Invites"
          >
            <Users size={13} />
          </button>

          {/* Save indicator */}
          {activeTab?.dirty && !isEffectiveReadOnly && (
            <button
              onClick={saveActive}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--warning)', cursor: 'pointer' }}
            >
              <Save size={13} />{saving ? 'Saving…' : 'Save'}
            </button>
          )}

          {/* Start Class button (Education mode) */}
          {!sessionActive && canEdit && (
            <button
              onClick={handleStartSession}
              disabled={sessionLoading}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors mr-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}
              title="Start a live classroom session"
            >
              <GraduationCap size={14} />
              {sessionLoading ? 'Starting…' : 'Start Class'}
            </button>
          )}

          {/* ── Voice call controls ── */}
          {isBroadcaster ? (
            voice.joined ? (
              <div className="flex items-center gap-1.5 mr-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
                  LIVE
                </span>
                <button onClick={voice.toggleMute} title={voice.muted ? 'Unmute' : 'Mute'}
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: voice.muted ? 'var(--error)' : 'var(--text)', cursor: 'pointer' }}>
                  {voice.muted ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button onClick={voice.endCall}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--error)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  <PhoneOff size={13} />End Call
                </button>
              </div>
            ) : (
              <button onClick={voice.startCall}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold mr-1"
                style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}>
                <Phone size={13} />Start Call
              </button>
            )
          ) : voice.callActive ? (
            voice.joined ? (
              <button onClick={voice.leaveCall}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold mr-1"
                style={{ background: 'var(--surface-2)', color: 'var(--error)', border: '1px solid var(--error)', cursor: 'pointer' }}>
                <PhoneOff size={13} />Leave
              </button>
            ) : (
              <button onClick={voice.joinCall}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold mr-1 animate-pulse"
                style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}
                title={`${voice.teacherName || 'Broadcaster'} is speaking`}>
                <Headphones size={13} />Join &amp; Listen
              </button>
            )
          ) : null}
          {voice.error && (
            <span className="text-xs mr-1" style={{ color: 'var(--error)' }}>{voice.error}</span>
          )}

          {/* Terminal toggle */}
          <button
            type="button"
            onClick={toggleTerminal}
            title={isTerminalOpen && !isTerminalCollapsed ? "Hide Terminal (Ctrl + `)" : "Open Terminal (Ctrl + `)"}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{
              background: isTerminalOpen && !isTerminalCollapsed ? 'var(--surface-2)' : 'transparent',
              border: '1px solid var(--border)',
              color: isTerminalOpen && !isTerminalCollapsed ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <Terminal size={13} />
          </button>

          {/* Chat & Voice toggle */}
          <button
            type="button"
            onClick={() => setShowChat(prev => !prev)}
            title={showChat ? 'Close Chat & Voice' : 'Open Chat & Voice'}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: showChat ? 'var(--surface-2)' : 'transparent', border: '1px solid var(--border)', color: showChat ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer' }}
          >
            <MessageSquare size={13} />
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Run / Stop button */}
          {!isEffectiveReadOnly && (
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

      {/* ── Ping Alert Banner ── */}
      {pingAlert && (
        <div
          className="flex items-center justify-between px-5 py-2.5 shrink-0 animate-bounce-once z-40"
          style={{ background: '#f85149', color: '#fff', borderBottom: '1px solid rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Radio size={16} />
            <span>ATTENTION: {pingAlert.message}</span>
          </div>
          <button
            onClick={() => setPingAlert(null)}
            className="text-xs px-2.5 py-0.5 rounded bg-black/20 hover:bg-black/30 cursor-pointer border-none text-white font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Help Request Toast for Teacher ── */}
      {isTeacher && helpNotification && (
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0 animate-fade-in z-40"
          style={{ background: '#2f81f7', color: '#fff', borderBottom: '1px solid rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <HelpCircle size={14} />
            <span>Help Request from <b>{helpNotification.username}</b>: &quot;{helpNotification.message}&quot;</span>
          </div>
          <button
            onClick={() => setHelpNotification(null)}
            className="text-[11px] px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 cursor-pointer border-none text-white font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Classroom Session Strip ── */}
      {sessionActive && (
        <div
          className="flex items-center justify-between px-5 py-1.5 shrink-0 select-none text-xs z-30"
          style={{
            background: isTeacher ? 'linear-gradient(90deg, #1f293d 0%, #161b22 100%)' : 'linear-gradient(90deg, #1c2826 0%, #161b22 100%)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Left badge */}
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-full text-[11px]"
              style={{
                background: isTeacher ? 'rgba(88, 166, 255, 0.2)' : 'rgba(63, 185, 80, 0.2)',
                color: isTeacher ? '#58a6ff' : '#3fb950',
                border: `1px solid ${isTeacher ? '#58a6ff55' : '#3fb95055'}`,
              }}
            >
              <GraduationCap size={13} />
              {isTeacher ? 'TEACHER MODE' : 'STUDENT MODE'}
            </span>

            {isFocusMode && (
              <span className="flex items-center gap-1 font-semibold text-[11px]" style={{ color: 'var(--accent)' }}>
                <Eye size={12} />
                Focus Mode Active {focusedFilePath ? `(${focusedFilePath.split('/').pop()})` : ''}
              </span>
            )}

            {isStudent && (
              <span
                className="flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: isEditorLocked ? 'rgba(210, 153, 34, 0.2)' : 'rgba(63, 185, 80, 0.15)',
                  color: isEditorLocked ? '#d29922' : '#3fb950',
                  border: `1px solid ${isEditorLocked ? '#d2992255' : '#3fb95055'}`,
                }}
              >
                {isEditorLocked ? <Lock size={11} /> : <Unlock size={11} />}
                {isEditorLocked ? 'Editor Locked' : 'Editor Unlocked'}
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {isTeacher ? (
              <>
                {/* Focus Mode toggle */}
                <button
                  onClick={handleToggleFocusMode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{
                    background: isFocusMode ? 'var(--accent)' : 'var(--surface-2)',
                    color: isFocusMode ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  title="Students will automatically follow whatever file you open"
                >
                  {isFocusMode ? <Eye size={12} /> : <EyeOff size={12} />}
                  {isFocusMode ? 'Focus Mode ON' : 'Focus Mode OFF'}
                </button>

                {/* Lock All / Unlock All */}
                <button
                  onClick={handleLockAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--surface-2)', color: 'var(--warning)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  title="Lock all student editors"
                >
                  <Lock size={12} />
                  Lock All
                </button>
                <button
                  onClick={handleUnlockAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--surface-2)', color: 'var(--success)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  title="Unlock all student editors"
                >
                  <Unlock size={12} />
                  Unlock All
                </button>

                {/* Ping Class */}
                <button
                  onClick={handlePingStudents}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  title="Alert students to look at the screen"
                >
                  <Bell size={12} />
                  Ping Class
                </button>

                {/* Raised Hands Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowHandsDropdown(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                    style={{
                      background: raisedHands.length > 0 ? 'var(--warning)' : 'var(--surface-2)',
                      color: raisedHands.length > 0 ? '#0d1117' : 'var(--muted)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <Hand size={12} />
                    Hands ({raisedHands.length})
                  </button>

                  {showHandsDropdown && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-60 rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--text)' }}>
                        <span>Raised Hands</span>
                        <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>{raisedHands.length} waiting</span>
                      </div>
                      {raisedHands.length === 0 ? (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--muted)' }}>No raised hands</p>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                          {raisedHands.map(h => (
                            <div
                              key={h.userId}
                              className="flex items-center justify-between p-1.5 rounded text-xs"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              <span className="font-semibold truncate max-w-[120px]" style={{ color: 'var(--text)' }}>
                                ✋ {h.username}
                              </span>
                              <button
                                onClick={() => handleLowerStudentHand(h.userId)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                              >
                                Lower
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* End Class */}
                <button
                  onClick={handleEndSession}
                  disabled={sessionLoading}
                  className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--error)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  End Class
                </button>
              </>
            ) : (
              <>
                {/* Student Controls */}
                <button
                  onClick={handleToggleHand}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold transition-all"
                  style={{
                    background: myHandRaised ? 'var(--warning)' : 'var(--surface-2)',
                    color: myHandRaised ? '#0d1117' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <Hand size={12} />
                  {myHandRaised ? 'Hand Raised ✋' : 'Raise Hand'}
                </button>

                <button
                  onClick={() => setShowHelpModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <HelpCircle size={12} />
                  Ask for Help
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
            {!isEffectiveReadOnly && (
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
            {isNoView ? (
              <div className="p-4 text-center text-xs flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <EyeOff size={24} className="text-red-400 opacity-60" />
                <span className="font-semibold text-red-400">File Tree Restricted</span>
                <span>Teacher has set your access to No-View.</span>
              </div>
            ) : tree.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No files yet — click + to create one
              </p>
            ) : renderTree(tree)}
          </div>
        </aside>

        {/* ── Main Pane ── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0d1117' }}>
          {/* Whiteboard view - kept mounted to preserve in-memory drawing state across tab shifts */}
          <div
            className="w-full h-full flex flex-col"
            style={{ display: activeView === 'whiteboard' ? 'flex' : 'none' }}
          >
            <IntelligentWhiteboard
              workspace={workspace}
              boardId={workspace.id}
              socket={socketRef.current}
              username={user?.username ?? 'Anonymous'}
              readOnly={isEffectiveReadOnly}
              onOpenFile={filePath => {
                setActiveView('editor');
                openFileByPath(filePath);
              }}
              onOpenInIDE={filePath => {
                setActiveView('editor');
                openFileByPath(filePath);
              }}
            />
          </div>

          {/* Editor view */}
          <div
            className="w-full h-full flex flex-col overflow-hidden"
            style={{ display: activeView === 'editor' ? 'flex' : 'none' }}
          >
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
          {isNoView ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              style={{ background: 'var(--bg)', color: 'var(--text)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                <EyeOff size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Access Restricted by Teacher</h2>
              <p className="max-w-md text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Your student access level is currently set to <strong>No-View</strong>. Please wait for your instructor to grant view or edit permissions during this session.
              </p>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: '#c084fc' }}>
                <GraduationCap size={15} /> Educational Classroom Active
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab ? (
                /* Code editor */
                <div
                  className="flex-1 overflow-hidden relative flex flex-col"
                  style={{ display: isTerminalMaximized ? 'none' : 'flex' }}
                >
                  {/* Viewer Access Banner */}
                  {isViewer && !isEditorLocked && (
                    <div
                      className="flex items-center justify-between px-4 py-2 text-xs font-semibold shrink-0"
                      style={{ background: 'rgba(56, 189, 248, 0.12)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                    >
                      <span className="flex items-center gap-2">
                        <Eye size={13} />
                        {isStudent
                          ? 'Viewer Access: You are observing live classroom code in read-only mode.'
                          : 'Viewer Mode: Read-only access to this workspace.'}
                      </span>
                      <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">
                        {isStudent ? 'Assigned by Teacher' : 'Read Only'}
                      </span>
                    </div>
                  )}
                  {/* Locked banner */}
                  {isEditorLocked && (
                    <div
                      className="flex items-center justify-between px-4 py-2 text-xs font-semibold shrink-0"
                      style={{ background: 'rgba(210, 153, 34, 0.15)', borderBottom: '1px solid rgba(210, 153, 34, 0.4)', color: '#d29922' }}
                    >
                      <span className="flex items-center gap-2">
                        <Lock size={13} />
                        Your editor is currently locked by the teacher. Editing and code execution are paused.
                      </span>
                      {isStudent && (
                        <button
                          onClick={handleToggleHand}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                          style={{
                            background: myHandRaised ? 'var(--warning)' : 'var(--surface-2)',
                            color: myHandRaised ? '#0d1117' : 'var(--text)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          <Hand size={12} />
                          {myHandRaised ? 'Lower Hand' : 'Raise Hand'}
                        </button>
                      )}
                    </div>
                  )}
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
                    readOnly={isEffectiveReadOnly}
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
                      opacity: isEffectiveReadOnly ? 0.8 : 1,
                    }}
                  />
                  {isEffectiveReadOnly && (
                    <div className="absolute top-4 right-6 pointer-events-none px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider z-20 flex items-center gap-1.5"
                      style={{
                        background: 'var(--surface-2)',
                        color: isEditorLocked ? 'var(--warning)' : 'var(--muted)',
                        border: `1px solid ${isEditorLocked ? 'var(--warning)' : 'var(--border)'}`,
                      }}>
                      {isEditorLocked ? <Lock size={12} /> : null}
                      {isEditorLocked ? 'Locked by Teacher' : 'View Only'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center"
                style={{ display: isTerminalMaximized ? 'none' : 'flex', color: 'var(--muted)' }}
              >
                <FileCode size={40} className="mb-4 opacity-20" />
                <p style={{ fontSize: 15, color: 'var(--text)' }}>Select a file to open it</p>
                {!isViewer && <p className="mt-1 text-sm">Or click + in the sidebar to create a new file</p>}
              </div>
            )}

            {/* Console / Terminal output (VS Code style expandable & draggable) */}
            {isTerminalOpen && (
              <div
                className="shrink-0 flex flex-col relative select-none"
                style={{
                  height: isTerminalMaximized ? '100%' : isTerminalCollapsed ? 36 : terminalHeight,
                  flex: isTerminalMaximized ? '1 1 0%' : undefined,
                  borderTop: '1px solid var(--border)',
                  background: 'var(--surface)',
                  transition: isDraggingTerminalRef.current ? 'none' : 'height 0.15s ease',
                }}
              >
                {/* Resizer bar (drag to resize terminal height, double click to maximize) */}
                {!isTerminalMaximized && (
                  <div
                    onMouseDown={handleTerminalMouseDown}
                    onDoubleClick={() => setIsTerminalMaximized(prev => !prev)}
                    className="w-full h-2 cursor-row-resize absolute -top-1 left-0 right-0 z-20 hover:bg-[var(--accent)] transition-colors opacity-0 hover:opacity-100"
                    title="Drag to resize console height, double-click to maximize"
                  />
                )}

                <div
                  className="flex items-center justify-between px-4 py-2 shrink-0 cursor-default"
                  style={{ borderBottom: isTerminalCollapsed ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}
                  onDoubleClick={() => setIsTerminalMaximized(prev => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <Terminal size={13} style={{ color: 'var(--muted)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      Console
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded select-none opacity-60"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                      title="Press Ctrl + ` to toggle console"
                    >
                      Ctrl + `
                    </span>
                    {running && (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--warning)' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--warning)', display: 'inline-block' }} />
                        Executing…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOutput('')}
                      className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Clear console"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsTerminalCollapsed(prev => !prev)}
                      className="p-1 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title={isTerminalCollapsed ? "Expand console" : "Collapse console"}
                    >
                      {isTerminalCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        setIsTerminalMaximized(prev => !prev);
                        if (isTerminalCollapsed) setIsTerminalCollapsed(false);
                      }}
                      className="p-1 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title={isTerminalMaximized ? "Restore panel size" : "Maximize console panel"}
                    >
                      {isTerminalMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="p-1 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Close console (Ctrl + `)"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {!isTerminalCollapsed && (
                  <pre
                    ref={outputRef}
                    className="p-4 text-sm leading-relaxed overflow-auto flex-1 select-text"
                    style={{
                      margin: 0,
                      background: '#0a0c10',
                      color: '#e6edf3',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {output || <span style={{ color: 'var(--muted)' }}>Console output will appear here after clicking Run…</span>}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
          </div>
        </main>
      </div>

      {/* Members Panel Overlay */}
      {showMembersPanel && (
        <MembersPanel
          workspaceId={workspace.id}
          workspaceType={workspaceType}
          myRole={currentRole}
          currentUserId={user?.id ?? 0}
          token={token}
          onClose={() => setShowMembersPanel(false)}
          onStudentAccessUpdated={(userId, access) => {
            if (socketRef.current) {
              socketRef.current.emit('member:set_access', {
                workspaceId: workspace.id,
                userId,
                access,
              });
            }
          }}
        />
      )}
      {/* Right Chat & Voice Panel */}
      {showChat && (
        <div
          className="fixed right-0 top-[52px] bottom-0 w-80 flex flex-col z-30"
          style={{
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            outline: 'none',
            boxShadow: 'none',
          }}
        >
          <ChatAndVoicePanel
            username={user?.username ?? 'Anonymous'}
            socket={socketRef.current}
            workspaceId={workspace.id}
            onClose={() => setShowChat(false)}
          />
        </div>
      )}

      {/* Ask for Help Modal (Student) */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scale-in"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Ask Teacher for Help</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-muted hover:text-text cursor-pointer bg-none border-none"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Send a real-time question or request to the teacher. This will alert them directly.
            </p>

            <textarea
              value={helpMessage}
              onChange={e => setHelpMessage(e.target.value)}
              placeholder="e.g. Could you explain the recursive step on line 24?"
              rows={4}
              autoFocus
              className="w-full p-3 rounded-xl text-sm focus:outline-none resize-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendHelp}
                disabled={!helpMessage.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: helpMessage.trim() ? 'pointer' : 'not-allowed' }}
              >
                <Send size={13} />
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
