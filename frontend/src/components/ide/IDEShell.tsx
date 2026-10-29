import { useState, useEffect, useRef, useCallback } from 'react';
import ChatAndVoicePanel, { type ChatMessage } from './ChatAndVoicePanel';
import {
  Play, Square, ChevronLeft, Sun, Moon, Plus, FileCode, Folder, FolderPlus,
  X, Terminal, LogOut, Code2, Save, Pencil, Trash2, CheckCheck,
  Users, Layers, MessageSquare,
  Phone, PhoneOff, Mic, MicOff, Headphones,
  Lock, Unlock, Hand, HelpCircle, Bell, Radio, GraduationCap,
  Eye, Send, EyeOff, Briefcase, Trophy, Edit3,
  Maximize2, Minimize2, ChevronUp, ChevronDown, GitPullRequest, Crown,
  Cpu, GitBranch, FolderOpen, ChevronRight, Globe
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import type { Workspace, FileItem, WorkspaceRole, SessionRole, WorkspaceType, StudentAccessLevel, LineComment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCodeEditor } from '../../hooks/useCodeEditor';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { MembersPanel } from './MembersPanel';
import { ProfessionalPanel } from './ProfessionalPanel';
import { KanbanSprintHub } from '../kanban/KanbanSprintHub';
import { SourceControlPanel } from './SourceControlPanel';
import { LineCommentThread } from './LineCommentThread';
import { RemoteCursorsOverlay, type RemoteCursorData } from './RemoteCursorsOverlay';
import { IntelligentWhiteboard } from '../whiteboard/IntelligentWhiteboard';
import { collabService } from '../../services/workspaceCollabService';
import { EnvironmentModal } from './EnvironmentModal';
import { LockManagerModal, type WorkspaceLockItem } from './LockManagerModal';
import { WebPreviewPanel } from './WebPreviewPanel';
import logoImg from '../../assets/logo.png';

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
  const [activeView, setActiveView] = useState<'editor' | 'whiteboard' | 'preview'>('editor');
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [showSplitPreview, setShowSplitPreview] = useState<boolean>(false);
  const [splitPreviewWidth, setSplitPreviewWidth] = useState<number>(() =>
    Math.max(340, Math.min(640, Math.round(window.innerWidth * 0.42)))
  );
  const isDraggingSplitRef = useRef<boolean>(false);
  const dragSplitStartXRef = useRef<number>(0);
  const dragSplitStartWidthRef = useRef<number>(400);

  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitRef.current = true;
    dragSplitStartXRef.current = e.clientX;
    dragSplitStartWidthRef.current = splitPreviewWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitRef.current) return;
      const deltaX = dragSplitStartXRef.current - moveEvent.clientX;
      const newWidth = Math.max(280, Math.min(Math.round(window.innerWidth * 0.7), dragSplitStartWidthRef.current + deltaX));
      setSplitPreviewWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingSplitRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [splitPreviewWidth]);

  const [tree, setTree] = useState<FileItem[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [terminalInput, setTerminalInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [terminalCwd, setTerminalCwd] = useState('~');
  const [saving, setSaving] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveSocket, setLiveSocket] = useState<Socket | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const showChatRef = useRef<boolean>(false);

  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) {
      setUnreadChatCount(0);
    }
  }, [showChat]);

  // Collab state
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showSourceControl, setShowSourceControl] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Array<{ socketId: string, username: string }>>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorData>>({});
  const [localCursor, setLocalCursor] = useState<{ line: number; col: number } | null>(null);
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0 });

  // File management UI state
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Inline file/folder creation inside folders
  const [inlineCreate, setInlineCreate] = useState<{
    parentPath: string;
    type: 'file' | 'folder';
  } | null>(null);
  const [inlineCreateName, setInlineCreateName] = useState('');
  const isCommittingCreateRef = useRef(false);
  // Drag and drop file moving state
  const [draggedNode, setDraggedNode] = useState<FileItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; node: FileItem;
  } | null>(null);

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

  // ── Professional Workspace State ──
  const [showProfessionalPanel, setShowProfessionalPanel] = useState(false);
  const [showKanbanHub, setShowKanbanHub] = useState(false);
  const [activeMemberFiles, setActiveMemberFiles] = useState<Record<number, string>>({});
  const [openReviewsCount, setOpenReviewsCount] = useState<number>(0);
  const [projectToast, setProjectToast] = useState<string | null>(null);

  // ── Line Comments State ──
  const [comments, setComments] = useState<LineComment[]>([]);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  // Resource Locks & Execution Environment state
  const [workspaceLocks, setWorkspaceLocks] = useState<WorkspaceLockItem[]>([]);
  const [showLockManager, setShowLockManager] = useState(false);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [globalExecutionMode, setGlobalExecutionMode] = useState(false);

  const [currentRole, setCurrentRole] = useState<WorkspaceRole>(workspace.myRole || myRole || 'owner');
  const [studentAccess, setStudentAccess] = useState<StudentAccessLevel>(workspace.studentAccess || 'editor');

  const workspaceType = (workspace.type || 'educational') as WorkspaceType;

  const isTeacher = currentRole === 'teacher' || sessionRole === 'teacher' || currentRole === 'owner' || currentRole === 'admin';
  const isStudent = currentRole === 'student' || (!isTeacher && sessionRole === 'student');
  const isTester = currentRole === 'tester';
  const isDeveloper = currentRole === 'developer';
  const isCompetitive = workspaceType === 'competitive';
  const isCompetitiveAdmin = isCompetitive && (currentRole === 'admin' || currentRole === 'owner');
  const isCompetitiveLeader = isCompetitive && currentRole === 'team_leader';
  const isCompetitiveMember = isCompetitive && currentRole === 'team_member';

  const isAccessComment = studentAccess === 'commenter' || studentAccess === 'comment';
  const isAccessView = studentAccess === 'viewer' || studentAccess === 'view';
  const isAccessEdit = studentAccess === 'editor' || studentAccess === 'edit';

  // In Educational workspace, students must wait until teacher starts a class session
  const isClassWaiting = workspaceType === 'educational' && isStudent && !sessionActive;

  const canAdmin = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'teacher' || currentRole === 'team_leader';

  const canComment =
    isCompetitiveAdmin ||
    isCompetitiveLeader ||
    isCompetitiveMember ||
    canAdmin ||
    (workspaceType === 'educational' && sessionActive && (isAccessComment || isAccessEdit)) ||
    (workspaceType === 'professional' && (
      (isDeveloper && !isAccessView) ||
      (isTester && isAccessComment) ||
      isAccessComment ||
      isAccessEdit
    ));

  const isViewer =
    currentRole === 'viewer' ||
    isCompetitiveAdmin ||
    (isStudent && (isAccessView || isAccessComment)) ||
    (isTester && !isAccessEdit) ||
    (isDeveloper && (isAccessView || isAccessComment));

  const canLock = !isCompetitiveAdmin && (canAdmin || currentRole === 'editor' || isAccessEdit || (workspaceType === 'professional' && isDeveloper && !isAccessView));

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  // Compute file lock status for active tab
  const activeFileLock = activeTab ? workspaceLocks.find(l =>
    l.targetPath === activeTab.path ||
    (l.lockType === 'folder' && activeTab.path.startsWith(l.targetPath.endsWith('/') ? l.targetPath : `${l.targetPath}/`))
  ) : null;
  const isFileLockedByOther = Boolean(activeFileLock && activeFileLock.lockedBy !== user?.id && !canAdmin);

  const isEffectiveReadOnly =
    isClassWaiting ||
    isCompetitiveAdmin ||
    (workspaceType === 'educational' && (isAccessView || isAccessComment || isEditorLocked)) ||
    (workspaceType === 'professional' && !canAdmin && (
      isAccessView ||
      isAccessComment ||
      (isTester && !isAccessEdit) ||
      (isDeveloper && (isAccessView || isAccessComment))
    )) ||
    isFileLockedByOther;
  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);
  const prevTabPathRef = useRef<string | null>(null);
  const localOffsetRef = useRef<number>(0);
  const gutterRef = useRef<HTMLDivElement>(null);

  // ── Sidebar Resizing State (VS Code style resizable explorer) ─────────────
  const [sidebarWidth, setSidebarWidth] = useState<number>(248);
  const isDraggingSidebarRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(248);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebarRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSidebarRef.current) return;
      const deltaX = moveEvent.clientX - dragStartXRef.current;
      const newWidth = Math.max(160, Math.min(Math.round(window.innerWidth * 0.45), dragStartWidthRef.current + deltaX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingSidebarRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setShowSourceControl(p => { const n = !p; if (n) { setShowMembersPanel(false); setShowChat(false); } return n; });
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

  // Auto-scroll terminal output to bottom when new chunks arrive
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, running]);

  // Auto-focus terminal input when terminal is open
  useEffect(() => {
    if (isTerminalOpen && !isTerminalCollapsed) {
      terminalInputRef.current?.focus();
    }
  }, [isTerminalOpen, isTerminalCollapsed]);

  // ── Voice call (broadcast from teacher or owner/admin) ──
  const isBroadcaster = sessionActive ? isTeacher : canAdmin;
  const voice = useVoiceCall(
    socketConnected ? socketRef.current : null,
    workspace.id,
    isBroadcaster
  );
  // ── Tab & File operations ──────────────────────────────────────────────────
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const openFileByPath = useCallback(async (filePath: string) => {
    if (!filePath || isClassWaiting) return;
    const existing = tabsRef.current.find(t => t.path === filePath);
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
      setTabs(prev => prev.some(t => t.path === filePath) ? prev : [...prev, tab]);
      setActiveTabId(tab.id);
    } catch {
      const tab: Tab = { id: `tab-${filePath}`, name: filename, path: filePath, content: '', dirty: false };
      setTabs(prev => prev.some(t => t.path === filePath) ? prev : [...prev, tab]);
      setActiveTabId(tab.id);
    }
  }, [workspace.id, authHeaders, isClassWaiting]);

  const openFileByPathRef = useRef(openFileByPath);
  useEffect(() => {
    openFileByPathRef.current = openFileByPath;
  }, [openFileByPath]);

  const openFile = useCallback(async (node: FileItem) => {
    if (node.type === 'directory') return;
    await openFileByPath(node.path);
  }, [openFileByPath]);

  const loadTree = useCallback(async () => {
    if (isClassWaiting) {
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
  }, [workspace.id, authHeaders, isClassWaiting]);

  useEffect(() => {
    loadTree();
    fetch(`${BASE_URL}/api/preview/${workspace.id}/status`)
      .then(res => res.json())
      .then(d => {
        if (d.success && d.port) {
          setPreviewPort(d.port);
        }
      })
      .catch(() => {});
  }, [loadTree, workspace.id]);

  // Fetch comments when active tab changes
  useEffect(() => {
    if (!activeTab?.path) {
      setComments([]);
      setActiveCommentLine(null);
      return;
    }
    collabService.getComments(workspace.id, activeTab.path, token)
      .then(res => {
        if (res.success && res.comments) {
          setComments(res.comments);
        }
      })
      .catch(() => {});
  }, [workspace.id, activeTab?.path, token]);

  // ── Socket.io connection ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(`${BASE_URL}/workspace`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    setLiveSocket(socket);

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

    socket.on('execution-started', ({ filePath, isGlobal, initiatedBy, isTerminal }: { filePath: string; isGlobal?: boolean; initiatedBy?: string; isTerminal?: boolean }) => {
      setRunning(true);
      setRunningCommand(filePath);
      setIsTerminalOpen(true);
      setIsTerminalCollapsed(false);
      const prefix = isGlobal ? `> [Global Broadcast by ${initiatedBy || 'Admin'}] ` : '> ';
      setOutput(prev => {
        const line = isTerminal ? `${prefix}${filePath}\n` : `${prefix}Running ${filePath}...\n`;
        if (prev.endsWith(line)) return prev;
        return prev ? `${prev}\n${line}` : line;
      });
    });

    socket.on('execution-stdout', ({ chunk }: { chunk: string }) => {
      setOutput(prev => prev + chunk);
    });

    socket.on('execution-stderr', ({ chunk }: { chunk: string }) => {
      setOutput(prev => prev + chunk);
    });

    socket.on('execution-finished', ({ exitCode, isGlobal, cwd }: { exitCode: number; isGlobal?: boolean; cwd?: string }) => {
      setRunning(false);
      setRunningCommand(null);
      if (cwd) setTerminalCwd(cwd);
      setOutput(prev => {
        if (exitCode === 0) return prev;
        const finishMsg = `\n> Process finished with exit code ${exitCode}${isGlobal ? ' [Global]' : ''}\n`;
        if (prev.endsWith(finishMsg)) return prev;
        return prev + finishMsg;
      });
      loadTree();
    });

    socket.on('preview:port-detected', ({ port }: { port: number | null }) => {
      setPreviewPort(port);
      if (port) {
        setShowSplitPreview(true);
      }
    });


    socket.on('workspace-ready', (data: {
      workspaceId: string;
      fileTree?: FileItem[];
      myRole?: WorkspaceRole;
      mySessionRole?: SessionRole;
      editorLocked?: boolean;
      studentAccess?: StudentAccessLevel;
      classInSession?: boolean;
      locks?: WorkspaceLockItem[];
    }) => {
      if (data.myRole) setCurrentRole(data.myRole);
      if (data.mySessionRole) setSessionRole(data.mySessionRole);
      if (data.editorLocked !== undefined) setIsEditorLocked(data.editorLocked);
      if (data.studentAccess) setStudentAccess(data.studentAccess);
      if (data.classInSession !== undefined) setSessionActive(data.classInSession);
      if (data.fileTree) setTree(data.fileTree);
      if (data.locks) setWorkspaceLocks(data.locks);
    });

    socket.on('lock:created', ({ lock }: { lock: WorkspaceLockItem }) => {
      setWorkspaceLocks(prev => [...prev.filter(l => l.id !== lock.id), lock]);
      setProjectToast(`Resource locked: ${lock.targetPath} (${lock.lockType}) by ${lock.lockedByName}`);
      setTimeout(() => setProjectToast(null), 4000);
    });

    socket.on('lock:released', ({ lockId, targetPath }: { lockId: string; targetPath: string }) => {
      setWorkspaceLocks(prev => prev.filter(l => l.id !== lockId));
      setProjectToast(`Resource unlocked: ${targetPath}`);
      setTimeout(() => setProjectToast(null), 3000);
    });

    socket.on('member:access_updated', (data: { workspaceId: string; studentAccess: StudentAccessLevel; updatedBy: string }) => {
      setStudentAccess(data.studentAccess);
      loadTree();
      setProjectToast(`Access set to ${data.studentAccess} by ${data.updatedBy}`);
      setTimeout(() => setProjectToast(null), 5000);
    });

    socket.on('member:access_changed', () => {
      // Trigger update if needed
    });

    socket.on('workspace-error', ({ message }: { message: string }) => {
      setRunning(false);
      setOutput(prev => prev + `\n[Server Error] ${message}\n`);
      setProjectToast(message);
      setTimeout(() => setProjectToast(null), 5000);
    });

    // ── Session socket events ──
    socket.on('session:active', (data: { active: boolean; teacherSocketId?: string; teacherId?: number; teacherUserId?: number; focusMode?: boolean; focusFilePath?: string; lockedAll?: boolean }) => {
      setSessionActive(data.active);
      if (data.active) {
        const teacherId = data.teacherId ?? data.teacherUserId;
        if (teacherId && user?.id) {
          setSessionRole(teacherId === user.id ? 'teacher' : 'student');
        }
        setIsFocusMode(!!data.focusMode);
        setFocusedFilePath(data.focusFilePath || null);
        if (data.lockedAll && teacherId !== user?.id) {
          setIsEditorLocked(true);
        }
      }
    });

    socket.on('session:started', (data: { teacherId?: number; teacherUserId?: number; teacherUsername?: string; teacherName?: string }) => {
      setSessionActive(true);
      const teacherId = data.teacherId ?? data.teacherUserId;
      const iamTeacher = user?.id === teacherId;
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
        openFileByPathRef.current(data.filePath);
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
      if (data.filePath) openFileByPathRef.current(data.filePath);
    });

    socket.on('session:kicked', (data: { reason: string }) => {
      alert(`You have been removed from the session: ${data.reason || 'By teacher'}`);
      setSessionRole('none');
    });

    // ── Professional Workspace Socket Events ──
    socket.on('developer:file_focused', (data: { userId: number; username: string; filePath: string | null }) => {
      setActiveMemberFiles(prev => ({
        ...prev,
        [data.userId]: data.filePath || '',
      }));
    });

    socket.on('task:created', (data: { task: any; createdBy: string }) => {
      setProjectToast(`${data.createdBy} created task: "${data.task.title}"`);
      setTimeout(() => setProjectToast(null), 5000);
    });

    socket.on('task:updated', (data: { task: any; updatedBy: string }) => {
      setProjectToast(`${data.updatedBy} updated task: "${data.task.title}" (${data.task.status})`);
      setTimeout(() => setProjectToast(null), 5000);
    });

    socket.on('task:deleted', () => {
      setProjectToast('A project task was deleted');
      setTimeout(() => setProjectToast(null), 3000);
    });

    socket.on('review:created', (data: { review: any; authorName: string }) => {
      setOpenReviewsCount(prev => prev + 1);
      setProjectToast(`New Code Review by ${data.authorName}: "${data.review.title}"`);
      setTimeout(() => setProjectToast(null), 6000);
    });

    socket.on('review:status_changed', (data: { review: any; updatedBy: string }) => {
      if (data.review.status !== 'open') {
        setOpenReviewsCount(prev => Math.max(0, prev - 1));
      }
      setProjectToast(`Code Review "${data.review.title}" set to ${data.review.status} by ${data.updatedBy}`);
      setTimeout(() => setProjectToast(null), 6000);
    });

    // ── Line Comment Socket Listeners ──
    socket.on('comment:created', ({ comment }: { comment: LineComment }) => {
      setComments(prev => {
        if (comment.parentId) {
          return prev.map(c => {
            if (c.id === comment.parentId) {
              const existingReplies = c.replies || [];
              if (existingReplies.some(r => r.id === comment.id)) return c;
              return { ...c, replies: [...existingReplies, comment] };
            }
            return c;
          });
        }
        if (prev.some(c => c.id === comment.id)) return prev;
        return [...prev, { ...comment, replies: [] }];
      });
    });

    socket.on('comment:updated', ({ commentId, resolved }: { commentId: number; resolved: boolean }) => {
      setComments(prev => prev.map(c => {
        if (c.id === commentId) return { ...c, resolved };
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => r.id === commentId ? { ...r, resolved } : r)
          };
        }
        return c;
      }));
    });

    socket.on('comment:deleted', ({ commentId }: { commentId: number }) => {
      setComments(prev => prev
        .filter(c => c.id !== commentId)
        .map(c => ({
          ...c,
          replies: (c.replies || []).filter(r => r.id !== commentId)
        }))
      );
    });

    // ── Educational Class In Session Listeners ──
    socket.on('class:started', (data: { sessionId?: string; teacherId?: number; teacherName?: string; fileTree?: FileItem[] }) => {
      setSessionActive(true);
      if (data.fileTree) setTree(data.fileTree);
      setProjectToast(`Class has started by teacher ${data.teacherName || ''}!`);
      setTimeout(() => setProjectToast(null), 4000);
    });

    socket.on('class:ended', (data: { workspaceId?: string; endedBy?: string }) => {
      setSessionActive(false);
      setSessionRole('none');
      setIsEditorLocked(false);
      setIsFocusMode(false);
      setFocusedFilePath(null);
      setRaisedHands([]);
      setMyHandRaised(false);
      if (currentRole === 'student') {
        setTabs([]);
        setActiveTabId(null);
        setTree([]);
      }
      setProjectToast(`Class ended by ${data.endedBy || 'teacher'}.`);
      setTimeout(() => setProjectToast(null), 4000);
    });

    socket.on('tree-updated', (data: { workspaceId?: string; fileTree?: FileItem[] }) => {
      if (data.fileTree) {
        setTree(data.fileTree);
      } else {
        loadTree();
      }
    });

    socket.on('chat-history', ({ messages }: { messages: ChatMessage[] }) => {
      if (Array.isArray(messages)) {
        setChatMessages(messages);
      }
    });

    socket.on('chatMessage', (msg: ChatMessage) => {
      setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (!showChatRef.current) {
        setUnreadChatCount(c => c + 1);
      }
    });

    return () => { socket.disconnect(); setLiveSocket(null); };
  }, [workspace.id, user?.id, user?.username, token]);

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

  // Professional workspace: Fetch open reviews count for badge
  useEffect(() => {
    if (workspaceType === 'professional') {
      let mounted = true;
      collabService.getReviews(workspace.id, token).then(res => {
        if (!mounted) return;
        if (res.success && res.reviews) {
          setOpenReviewsCount(res.reviews.filter(r => r.status === 'open').length);
        }
      }).catch(() => {});
      return () => { mounted = false; };
    }
  }, [workspaceType, workspace.id, token]);

  // Professional workspace: Broadcast active file focus when active tab changes
  useEffect(() => {
    if (workspaceType === 'professional' && socketRef.current && socketConnected) {
      socketRef.current.emit('developer:focus_file', {
        workspaceId: workspace.id,
        filePath: activeTab?.path || null,
      });
    }
  }, [activeTab?.path, workspaceType, workspace.id, socketConnected]);

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

  const handleSendChatMessage = useCallback((text: string) => {
    if (!text || !socketRef.current) return;
    const msgObj: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: user?.username || 'Anonymous',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages(prev => [...prev, msgObj]);
    socketRef.current.emit('chatMessage', { ...msgObj, workspaceId: workspace.id });
  }, [user?.username, workspace.id]);

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

  const createFile = async (nameOverride?: string, prefixDir?: string) => {
    if (isEffectiveReadOnly) return;
    const rawName = nameOverride ?? newFileName.trim();
    if (!rawName) return;
    const name = prefixDir ? `${prefixDir}/${rawName}` : rawName;
    try {
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filePath: name, isDirectory: false }),
      });
      const d = await res.json();
      if (d.success) {
        await loadTree();
        socketRef.current?.emit('file-tree-changed', { workspaceId: workspace.id });
        setShowNewFile(false);
        setNewFileName('');
        openFileByPath(name);
      } else {
        setProjectToast(d.error ?? 'Could not create file');
        setTimeout(() => setProjectToast(null), 4000);
      }
    } catch {
      setProjectToast('Could not connect to server');
      setTimeout(() => setProjectToast(null), 4000);
    }
  };

  const createFolder = async (nameOverride?: string, prefixDir?: string) => {
    if (isEffectiveReadOnly) return;
    const rawName = nameOverride ?? newFolderName.trim();
    if (!rawName) return;
    const name = prefixDir ? `${prefixDir}/${rawName}` : rawName;
    try {
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filePath: name, isDirectory: true }),
      });
      const d = await res.json();
      if (d.success) {
        await loadTree();
        socketRef.current?.emit('file-tree-changed', { workspaceId: workspace.id });
        setShowNewFolder(false);
        setNewFolderName('');
        // Auto-expand the new dir and parent dir
        setExpandedDirs(prev => {
          const next = new Set(prev);
          next.add(name);
          if (prefixDir) next.add(prefixDir);
          return next;
        });
      } else {
        setProjectToast(d.error ?? 'Could not create folder');
        setTimeout(() => setProjectToast(null), 4000);
      }
    } catch {
      setProjectToast('Could not connect to server');
      setTimeout(() => setProjectToast(null), 4000);
    }
  };

  const startCreateInFolder = (folderPath: string, type: 'file' | 'folder') => {
    if (isEffectiveReadOnly) return;
    setExpandedDirs(prev => new Set([...prev, folderPath]));
    setInlineCreate({ parentPath: folderPath, type });
    setInlineCreateName('');
    setShowNewFile(false);
    setShowNewFolder(false);
  };

  const commitInlineCreate = async () => {
    if (isCommittingCreateRef.current) return;
    isCommittingCreateRef.current = true;
    try {
      if (!inlineCreate || !inlineCreateName.trim() || isEffectiveReadOnly) {
        setInlineCreate(null);
        setInlineCreateName('');
        return;
      }
      const rawName = inlineCreateName.trim();
      const parent = inlineCreate.parentPath;
      const isFolder = inlineCreate.type === 'folder';

      setInlineCreate(null);
      setInlineCreateName('');

      if (isFolder) {
        await createFolder(rawName, parent);
      } else {
        await createFile(rawName, parent);
      }
    } finally {
      setTimeout(() => {
        isCommittingCreateRef.current = false;
      }, 100);
    }
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) { next.delete(dirPath); } else { next.add(dirPath); }
      return next;
    });
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
      socketRef.current?.emit('file-tree-changed', { workspaceId: workspace.id });
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
      socketRef.current?.emit('file-tree-changed', { workspaceId: workspace.id });
    } catch { /* ignore */ }
    setRenamingPath(null);
  };

  const moveItem = async (sourcePath: string, destinationDir: string) => {
    if (isEffectiveReadOnly || !sourcePath) return;

    const normSource = sourcePath.replace(/\\/g, '/');
    const normDestDir = destinationDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const itemName = normSource.split('/').pop();
    if (!itemName) return;

    const lastSlash = normSource.lastIndexOf('/');
    const currentParent = lastSlash === -1 ? '' : normSource.slice(0, lastSlash);

    // If destination folder is already the current folder, do nothing
    if (normDestDir === currentParent) return;

    const newPath = normDestDir ? `${normDestDir}/${itemName}` : itemName;
    if (newPath === normSource) return;

    // Guard against moving a directory into its own child folder
    if (newPath.startsWith(normSource + '/')) {
      setProjectToast('Cannot move a folder into its own subfolder');
      setTimeout(() => setProjectToast(null), 3000);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspace.id}/files/rename`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ oldPath: normSource, newPath }),
      });
      const d = await res.json();
      if (d.success) {
        // Update tabs for moved file or files inside moved directory
        setTabs(prev => prev.map(t => {
          if (t.path === normSource) {
            return { ...t, name: itemName, path: newPath, id: `tab-${newPath}` };
          }
          if (t.path.startsWith(normSource + '/')) {
            const suffix = t.path.slice(normSource.length);
            const updatedPath = newPath + suffix;
            return { ...t, path: updatedPath, id: `tab-${updatedPath}` };
          }
          return t;
        }));

        if (activeTabId === `tab-${normSource}`) {
          setActiveTabId(`tab-${newPath}`);
        }

        // Expand the destination folder so user sees the newly moved item
        if (normDestDir) {
          setExpandedDirs(prev => new Set([...prev, normDestDir]));
        }

        await loadTree();
        socketRef.current?.emit('file-tree-changed', { workspaceId: workspace.id });
        setProjectToast(`Moved ${itemName} to ${normDestDir ? `~/${normDestDir}` : 'workspace root'}`);
        setTimeout(() => setProjectToast(null), 3000);
      } else {
        setProjectToast(d.error ?? 'Failed to move item');
        setTimeout(() => setProjectToast(null), 4000);
      }
    } catch {
      setProjectToast('Failed to connect to server');
      setTimeout(() => setProjectToast(null), 4000);
    }
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
    setRunning(true);
    const prefix = globalExecutionMode && canAdmin ? '> [Global Broadcast] ' : '> ';
    setOutput(`${prefix}Running ${activeTab.path}...\n`);

    await saveActive();

    if (!socket.connected) {
      setRunning(false);
      setOutput(prev => prev + '\n[Error] Socket disconnected from server.\n');
      return;
    }

    socket.emit('execute-code', {
      workspaceId: workspace.id,
      filePath: activeTab.path,
      isGlobal: Boolean(globalExecutionMode && canAdmin),
    });
  };

  const stopExecution = () => {
    setRunning(false);
    setRunningCommand(null);
    setOutput(prev => prev + '\n[Client] Stop execution requested.\n');
    socketRef.current?.emit('stop-execution', {
      workspaceId: workspace.id,
      isGlobal: Boolean(globalExecutionMode && canAdmin),
    });
  };

  // ── Interactive Terminal Command Execution ─────────────────────────────────
  const runTerminalCommand = (customCmd?: string) => {
    const cmd = (customCmd !== undefined ? customCmd : terminalInput).trim();
    if (!cmd) return;
    if (isEffectiveReadOnly) {
      setOutput(prev => prev + '\n[Permission Denied] You do not have permission to run terminal commands.\n');
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setOutput(prev => prev + '\n[Error] Not connected to backend server.\n');
      return;
    }

    setIsTerminalOpen(true);
    setIsTerminalCollapsed(false);

    // If a process is ALREADY running and user typed in the box, send it to stdin!
    if (running && customCmd === undefined) {
      setOutput(prev => prev + `${cmd}\n`);
      socket.emit('terminal:stdin', {
        workspaceId: workspace.id,
        input: cmd,
        isGlobal: Boolean(globalExecutionMode && canAdmin),
      });
      setTerminalInput('');
      return;
    }

    // Otherwise, start a new terminal command
    setCommandHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 50));
    setHistoryIndex(null);
    setTerminalInput('');
    setRunning(true);
    setRunningCommand(cmd);

    // Optimistic directory update for instant UI feedback
    const trimmed = cmd.trim();
    if (trimmed === 'cd' || trimmed === 'cd ~' || trimmed === 'cd /') {
      setTerminalCwd('~');
    } else if (trimmed === 'cd ..') {
      setTerminalCwd(prev => {
        if (prev === '~' || !prev.includes('/')) return '~';
        const parts = prev.split('/').filter(Boolean);
        parts.pop();
        return parts.length === 0 || (parts[0] === '~' && parts.length === 1) ? '~' : parts.join('/');
      });
    } else if (trimmed.startsWith('cd ') || trimmed.startsWith('cd\t')) {
      const target = trimmed.slice(2).trim();
      if (target && !target.startsWith('..')) {
        setTerminalCwd(prev => (prev === '~' ? `~/${target}` : `${prev}/${target}`));
      }
    }

    const isGlobal = Boolean(globalExecutionMode && canAdmin);
    setOutput(prev => prev ? `${prev}\n${terminalCwd}$ ${cmd}\n` : `${terminalCwd}$ ${cmd}\n`);

    socket.emit('terminal:command', {
      workspaceId: workspace.id,
      command: cmd,
      isGlobal,
    });
  };

  const killTerminalProcess = () => {
    socketRef.current?.emit('terminal:kill', {
      workspaceId: workspace.id,
      isGlobal: Boolean(globalExecutionMode && canAdmin),
    });
    setRunning(false);
    setRunningCommand(null);
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runTerminalCommand();
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      if (running) {
        e.preventDefault();
        killTerminalProcess();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = historyIndex === null ? 0 : Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIdx);
        setTerminalInput(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== null) {
        if (historyIndex > 0) {
          const nextIdx = historyIndex - 1;
          setHistoryIndex(nextIdx);
          setTerminalInput(commandHistory[nextIdx]);
        } else {
          setHistoryIndex(null);
          setTerminalInput('');
        }
      }
    }
  };

  // ── Classroom Session Handlers (Teacher) ──
  const handleStartSession = async () => {
    setSessionLoading(true);
    try {
      const res = await collabService.startSession(workspace.id, token);
      if (res && res.success) {
        setSessionActive(true);
        setSessionRole('teacher');
        socketRef.current?.emit('session:announce_start', { workspaceId: workspace.id });
        socketRef.current?.emit('class:start', { workspaceId: workspace.id });
        await loadTree();
        setProjectToast('Classroom session started!');
        setTimeout(() => setProjectToast(null), 3000);
      } else {
        setProjectToast((res as any)?.error || 'Could not start classroom session');
        setTimeout(() => setProjectToast(null), 4000);
      }
    } catch (err) {
      console.error('[Session Error]', err);
      setProjectToast('Network error while starting classroom session');
      setTimeout(() => setProjectToast(null), 4000);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    setSessionLoading(true);
    try {
      const res = await collabService.endSession(workspace.id, token);
      if (res && res.success) {
        setSessionActive(false);
        setSessionRole('none');
        setIsFocusMode(false);
        setFocusedFilePath(null);
        setRaisedHands([]);
        socketRef.current?.emit('session:announce_end', { workspaceId: workspace.id });
        socketRef.current?.emit('class:end', { workspaceId: workspace.id });
        setProjectToast('Classroom session ended');
        setTimeout(() => setProjectToast(null), 3000);
      }
    } catch (err) {
      console.error('[Session Error]', err);
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

  // ── Line Comment Handlers ──
  const handleAddComment = async (content: string, parentId?: number) => {
    if (!activeTab || activeCommentLine === null || !content.trim()) return;
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('comment:create', {
          workspaceId: workspace.id,
          filePath: activeTab.path,
          lineNumber: activeCommentLine,
          content: content.trim(),
          parentId,
        });
      } else {
        const res = await collabService.createComment(
          workspace.id,
          {
            filePath: activeTab.path,
            lineNumber: activeCommentLine,
            content: content.trim(),
            parentId,
          },
          token
        );
        if (res.success && res.comment) {
          const newComment = res.comment;
          setComments(prev => {
            if (newComment.parentId) {
              return prev.map(c => c.id === newComment.parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c);
            }
            return [...prev, { ...newComment, replies: [] }];
          });
        }
      }
    } catch (err) {
      console.error('[Add Comment Error]', err);
    }
  };

  const handleResolveComment = async (commentId: number, currentResolved: boolean) => {
    const next = !currentResolved;
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('comment:resolve', {
          workspaceId: workspace.id,
          commentId,
          resolved: next,
        });
      }
      await collabService.updateComment(workspace.id, commentId, { resolved: next }, token);
      setComments(prev => prev.map(c => {
        if (c.id === commentId) return { ...c, resolved: next };
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => r.id === commentId ? { ...r, resolved: next } : r)
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('[Resolve Comment Error]', err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('comment:delete', {
          workspaceId: workspace.id,
          commentId,
        });
      }
      await collabService.deleteComment(workspace.id, commentId, token);
      setComments(prev => prev
        .filter(c => c.id !== commentId)
        .map(c => ({
          ...c,
          replies: (c.replies || []).filter(r => r.id !== commentId)
        }))
      );
    } catch (err) {
      console.error('[Delete Comment Error]', err);
    }
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
    nodes.map(node => {
      const isDir = node.type === 'directory';
      const isExpanded = isDir && expandedDirs.has(node.path);

      return (
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
            // ── Normal file/folder row ──
            (() => {
              const itemLock = workspaceLocks.find(l =>
                l.targetPath === node.path ||
                (l.lockType === 'folder' && node.path.startsWith(l.targetPath.endsWith('/') ? l.targetPath : `${l.targetPath}/`))
              );

              const isTargetFolder = isDir && dragOverTarget === node.path;
              const isBeingDragged = draggedNode?.path === node.path;

              return (
                <div
                  className="relative flex items-center transition-all select-none"
                  draggable={!isEffectiveReadOnly && renamingPath !== node.path}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', node.path);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedNode(node);
                  }}
                  onDragEnd={() => {
                    setDraggedNode(null);
                    setDragOverTarget(null);
                  }}
                  onDragOver={(e) => {
                    if (!draggedNode || draggedNode.path === node.path) return;
                    if (draggedNode.type === 'directory' && (node.path === draggedNode.path || node.path.startsWith(draggedNode.path + '/'))) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    const targetDir = isDir ? node.path : (node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '');
                    setDragOverTarget(targetDir || '__root__');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourcePath = e.dataTransfer.getData('text/plain') || draggedNode?.path;
                    setDraggedNode(null);
                    setDragOverTarget(null);
                    if (!sourcePath || sourcePath === node.path) return;
                    const destDir = isDir ? node.path : (node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '');
                    moveItem(sourcePath, destDir);
                  }}
                  style={{
                    opacity: isBeingDragged ? 0.35 : 1,
                  }}
                >
                  <button
                    onClick={() => {
                      if (isDir) { toggleDir(node.path); }
                      else { openFile(node); }
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, node });
                    }}
                    className="flex-1 flex items-center gap-1.5 py-1.5 text-left transition-colors"
                    style={{
                      paddingLeft: 12 + depth * 14,
                      paddingRight: 12,
                      background: isTargetFolder ? 'rgba(47, 129, 247, 0.2)' : 'transparent',
                      outline: isTargetFolder ? '1px dashed var(--accent)' : 'none',
                      borderRadius: isTargetFolder ? 4 : 0,
                      border: 'none',
                      color: tabs.find(t => t.path === node.path) ? 'var(--accent)' : 'var(--text-secondary)',
                      fontFamily: node.type === 'file' ? 'var(--font-mono)' : undefined,
                      fontSize: 13,
                      cursor: isBeingDragged ? 'grabbing' : 'pointer',
                      width: '100%',
                    }}
                    onMouseEnter={e => {
                      if (!isTargetFolder) {
                        e.currentTarget.style.background = 'var(--surface-2)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isTargetFolder) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {isDir ? (
                      <>
                        {isExpanded
                          ? <ChevronDown size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                          : <ChevronRight size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        }
                        {isExpanded
                          ? <FolderOpen size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                          : <Folder size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        }
                      </>
                    ) : (
                      <FileCode size={13} style={{ color: extColor(node.name), flexShrink: 0, marginLeft: 12 }} />
                    )}
                    <span className="truncate">{node.name}</span>
                    {itemLock && (
                      <span
                        title={`Locked by ${itemLock.lockedByName} (${itemLock.lockType})`}
                        className="ml-auto mr-1 flex items-center"
                      >
                        <Lock size={11} className="text-amber-400 shrink-0" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })()
          )}
          {isDir && isExpanded && (
            <>
              {inlineCreate && inlineCreate.parentPath === node.path && (
                <div
                  className="flex items-center gap-1 px-2 py-0.5"
                  style={{ paddingLeft: 12 + (depth + 1) * 14 }}
                  onClick={e => e.stopPropagation()}
                >
                  {inlineCreate.type === 'folder' ? (
                    <Folder size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginLeft: 12 }} />
                  ) : (
                    <FileCode size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginLeft: 12 }} />
                  )}
                  <input
                    value={inlineCreateName}
                    onChange={e => setInlineCreateName(e.target.value)}
                    placeholder={inlineCreate.type === 'folder' ? 'Folder name…' : 'File name…'}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitInlineCreate();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setInlineCreate(null);
                        setInlineCreateName('');
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (inlineCreateName.trim()) {
                          commitInlineCreate();
                        } else {
                          setInlineCreate(null);
                          setInlineCreateName('');
                        }
                      }, 100);
                    }}
                    className="flex-1 h-6 px-1.5 rounded text-xs focus:outline-none"
                    style={{
                      background: 'var(--bg)',
                      border: `1px solid ${inlineCreate.type === 'folder' ? 'var(--warning)' : 'var(--accent)'}`,
                      color: 'var(--text)',
                      fontFamily: inlineCreate.type === 'file' ? 'var(--font-mono)' : undefined,
                    }}
                  />
                  <button
                    onMouseDown={e => {
                      e.preventDefault();
                      commitInlineCreate();
                    }}
                    title="Create"
                    style={{ color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <CheckCheck size={12} />
                  </button>
                  <button
                    onMouseDown={e => {
                      e.preventDefault();
                      setInlineCreate(null);
                      setInlineCreateName('');
                    }}
                    title="Cancel"
                    style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {node.children && node.children.length > 0 ? (
                renderTree(node.children, depth + 1)
              ) : !(inlineCreate && inlineCreate.parentPath === node.path) ? (
                <div
                  className="text-[11px] py-1 select-none italic"
                  style={{ paddingLeft: 26 + depth * 14, color: 'var(--muted)' }}
                >
                  (empty folder)
                </div>
              ) : null}
            </>
          )}
        </div>
      );
    });



  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{ height: 52, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {/* Left Section: Back, Workspace Title, Type & Role */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
            title="Back to Workspaces"
          >
            <ChevronLeft size={14} />Workspaces
          </button>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          <div className="flex items-center gap-2 min-w-0">
            <img src={logoImg} alt="CodeSync" className="w-5 h-5 rounded object-contain shrink-0" />
            <span className="font-semibold truncate max-w-48" style={{ color: 'var(--text)', fontSize: 14 }}>
              {workspace.name}
            </span>
          </div>

          {/* Workspace Type Badge */}
          <span
            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 shrink-0"
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
            className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1 shrink-0"
            style={{
              background: workspaceType === 'educational'
                ? isTeacher
                  ? 'rgba(168, 85, 247, 0.18)'
                  : isAccessComment
                  ? 'rgba(59, 130, 246, 0.18)'
                  : isAccessView
                  ? 'rgba(56, 189, 248, 0.15)'
                  : 'rgba(63, 185, 80, 0.15)'
                : workspaceType === 'professional'
                ? (currentRole === 'team_leader' || currentRole === 'owner' || currentRole === 'admin')
                  ? 'rgba(88, 166, 255, 0.18)'
                  : isDeveloper
                  ? 'rgba(16, 185, 129, 0.18)'
                  : isTester
                  ? 'rgba(244, 63, 94, 0.18)'
                  : 'var(--surface-2)'
                : workspaceType === 'competitive'
                ? isCompetitiveAdmin
                  ? 'rgba(245, 158, 11, 0.18)'
                  : isCompetitiveLeader
                  ? 'rgba(99, 102, 241, 0.18)'
                  : 'rgba(16, 185, 129, 0.18)'
                : 'var(--surface-2)',
              color: workspaceType === 'educational'
                ? isTeacher
                  ? '#c084fc'
                  : isAccessComment
                  ? '#60a5fa'
                  : isAccessView
                  ? '#38bdf8'
                  : '#3fb950'
                : workspaceType === 'professional'
                ? (currentRole === 'team_leader' || currentRole === 'owner' || currentRole === 'admin')
                  ? '#58a6ff'
                  : isDeveloper
                  ? '#10b981'
                  : isTester
                  ? '#f43f5e'
                  : 'var(--text)'
                : workspaceType === 'competitive'
                ? isCompetitiveAdmin
                  ? '#fbbf24'
                  : isCompetitiveLeader
                  ? '#818cf8'
                  : '#10b981'
                : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {workspaceType === 'competitive' ? (
              isCompetitiveAdmin ? (
                <span className="flex items-center gap-1"><Crown size={11} /> Admin (View & Comment)</span>
              ) : isCompetitiveLeader ? (
                <span className="flex items-center gap-1"><Trophy size={11} /> Team Leader (All Access + Kanban)</span>
              ) : (
                <span className="flex items-center gap-1"><Trophy size={11} /> Team Member (Edit)</span>
              )
            ) : workspaceType === 'educational' ? (
              isTeacher ? (
                <span className="flex items-center gap-1"><GraduationCap size={11} /> {currentRole === 'owner' ? 'Admin' : 'Teacher'}</span>
              ) : (
                <span className="flex items-center gap-1">
                  {isAccessComment ? <MessageSquare size={11} /> : isAccessView ? <Eye size={11} /> : <Edit3 size={11} />}
                  Student: {isAccessComment ? 'comment' : isAccessView ? 'view' : 'edit'}
                </span>
              )
            ) : workspaceType === 'professional' ? (
              (currentRole === 'team_leader' || currentRole === 'owner' || currentRole === 'admin') ? (
                <span className="flex items-center gap-1"><Crown size={11} /> {currentRole === 'team_leader' ? 'Team Lead' : 'Admin'}</span>
              ) : isDeveloper ? (
                <span className="flex items-center gap-1"><Code2 size={11} /> Developer ({isAccessComment ? 'Comment' : isAccessView ? 'View' : 'Edit'})</span>
              ) : isTester ? (
                <span className="flex items-center gap-1"><Eye size={11} /> Tester ({isAccessEdit ? 'Edit' : isAccessComment ? 'Comment' : 'View'})</span>
              ) : (
                <span className="flex items-center gap-1">{currentRole}</span>
              )
            ) : (
              <span className="flex items-center gap-1">
                {currentRole === 'owner' || currentRole === 'admin' ? (
                  <><Crown size={11} /> {currentRole}</>
                ) : currentRole === 'editor' ? (
                  <><Edit3 size={11} /> Edit</>
                ) : (
                  <><Eye size={11} /> View</>
                )}
              </span>
            )}
          </span>
        </div>

        {/* Center Section: View Mode Switcher & Run / Stop */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Code Editor vs Whiteboard */}
          <div
            className="flex items-center p-0.5 rounded-lg border"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setActiveView('editor')}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all"
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
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all"
              style={{
                background: activeView === 'whiteboard' ? 'var(--surface-2)' : 'transparent',
                color: activeView === 'whiteboard' ? 'var(--accent)' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Layers size={13} /> Whiteboard
            </button>

            <button
              onClick={() => setActiveView('preview')}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all relative"
              style={{
                background: activeView === 'preview' ? 'var(--surface-2)' : 'transparent',
                color: activeView === 'preview' ? 'var(--accent)' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Full-screen Sandboxed Web Application Preview"
            >
              <Globe size={13} />
              <span>Web Preview</span>
              {previewPort && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" title={`Active on port ${previewPort}`} />
              )}
            </button>
          </div>

          {/* Run / Stop button */}
          {!isEffectiveReadOnly && (
            running ? (
              <button
                onClick={stopExecution}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'var(--error)', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                <Square size={12} /> Stop
              </button>
            ) : (
              <button
                onClick={runFile}
                disabled={!activeTab || !socketConnected}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all shadow-sm"
                style={{
                  background: globalExecutionMode && canAdmin ? '#8b5cf6' : 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: activeTab && socketConnected ? 'pointer' : 'not-allowed',
                }}
                title={globalExecutionMode && canAdmin ? 'Run in Global Environment (Broadcasts to all members)' : 'Run in Isolated Private Member Environment'}
              >
                <Play size={12} />
                {globalExecutionMode && canAdmin ? 'Global Run' : 'Run'}
              </button>
            )
          )}
        </div>

        {/* Right Section: Context Actions (Classroom, Sprint Hub, Voice, Theme, Sign Out) */}
        <div className="flex items-center gap-2">
          {/* Start Class button (Education mode) */}
          {workspaceType === 'educational' && !sessionActive && isTeacher && (
            <button
              onClick={handleStartSession}
              disabled={sessionLoading}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}
              title="Start a live classroom session"
            >
              <GraduationCap size={13} />
              {sessionLoading ? 'Starting…' : 'Start Class'}
            </button>
          )}

          {/* Active Class Live Indicator in Header */}
          {workspaceType === 'educational' && sessionActive && (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Class Live
              </span>
              {isTeacher && (
                <button
                  onClick={handleEndSession}
                  disabled={sessionLoading}
                  className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: 'var(--error)', color: 'white', border: 'none', cursor: 'pointer' }}
                  title="End classroom session"
                >
                  End Class
                </button>
              )}
            </div>
          )}


          {/* Sprint Hub Button for Competitive & Professional Workspaces */}
          {(workspaceType === 'professional' || workspaceType === 'competitive') && (
            <button
              onClick={() => setShowKanbanHub(v => !v)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all relative"
              style={{
                background: showKanbanHub ? 'rgba(59, 130, 246, 0.2)' : 'var(--surface-2)',
                color: showKanbanHub ? '#60a5fa' : 'var(--text)',
                border: `1px solid ${showKanbanHub ? '#3b82f6' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
              title="Open Kanban Sprint Hub"
            >
              <Briefcase size={13} className="text-blue-400" />
              <span>Sprint Hub</span>
            </button>
          )}

          {/* Professional Code Reviews Button */}
          {workspaceType === 'professional' && (
            <button
              onClick={() => setShowProfessionalPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all relative"
              style={{
                background: showProfessionalPanel ? 'rgba(168, 85, 247, 0.2)' : 'var(--surface-2)',
                color: showProfessionalPanel ? '#c084fc' : 'var(--text)',
                border: `1px solid ${showProfessionalPanel ? '#a855f7' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
              title="Open Code Reviews"
            >
              <GitPullRequest size={13} className="text-purple-400" />
              <span>Reviews</span>
              {openReviewsCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-amber-500 text-black">
                  {openReviewsCount}
                </span>
              )}
            </button>
          )}

          {/* Professional: Request Review button for active file */}
          {workspaceType === 'professional' && activeTab && !isEffectiveReadOnly && (
            <button
              onClick={() => setShowProfessionalPanel(true)}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                cursor: 'pointer',
              }}
              title="Request code review for current file"
            >
              <GitPullRequest size={12} />
              <span className="hidden lg:inline">Review File</span>
            </button>
          )}

          {/* Voice call controls */}
          {isBroadcaster ? (
            voice.joined ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
                  LIVE
                </span>
                <button onClick={voice.toggleMute} title={voice.muted ? 'Unmute' : 'Mute'}
                  className="flex items-center justify-center w-7 h-7 rounded-lg"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: voice.muted ? 'var(--error)' : 'var(--text)', cursor: 'pointer' }}>
                  {voice.muted ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button onClick={voice.endCall}
                  className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--error)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  <PhoneOff size={12} /> End
                </button>
              </div>
            ) : (
              <button onClick={voice.startCall}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}>
                <Phone size={12} /> Call
              </button>
            )
          ) : voice.callActive ? (
            voice.joined ? (
              <button onClick={voice.leaveCall}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--error)', border: '1px solid var(--error)', cursor: 'pointer' }}>
                <PhoneOff size={12} /> Leave
              </button>
            ) : (
              <button onClick={voice.joinCall}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold animate-pulse"
                style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}
                title={`${voice.teacherName || 'Broadcaster'} is speaking`}>
                <Headphones size={12} /> Join Call
              </button>
            )
          ) : null}

          {/* Workspace Chat toggle button (beside Call button) */}
          <button
            onClick={() => setShowChat(v => !v)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all shadow-sm"
            style={{
              background: showChat ? 'var(--accent)' : 'var(--surface-2)',
              color: showChat ? '#ffffff' : 'var(--text)',
              border: `1px solid ${showChat ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
            title={showChat ? 'Close Workspace Chat' : 'Open Workspace Chat'}
          >
            <MessageSquare size={13} style={{ color: showChat ? '#ffffff' : 'var(--accent)' }} />
            <span>Chat</span>
            {unreadChatCount > 0 && !showChat && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ── Project / Sprint Notification Toast ── */}
      {projectToast && (
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0 animate-fade-in z-40"
          style={{ background: '#2563eb', color: '#fff', borderBottom: '1px solid rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <Briefcase size={14} />
            <span>{projectToast}</span>
          </div>
          <button
            onClick={() => setProjectToast(null)}
            className="text-[11px] px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 cursor-pointer border-none text-white font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

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
      {workspaceType === 'educational' && sessionActive && (
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
                              <span className="font-semibold truncate max-w-[120px] flex items-center gap-1" style={{ color: 'var(--text)' }}>
                                <Hand size={11} className="text-amber-400" /> {h.username}
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
                  <Hand size={12} className={myHandRaised ? 'text-amber-400' : ''} />
                  {myHandRaised ? 'Hand Raised' : 'Raise Hand'}
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
          style={{ width: sidebarWidth, background: 'var(--surface)', overflow: 'hidden' }}
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowNewFile(v => !v); setShowNewFolder(false); setInlineCreate(null); }}
                  title="New File"
                  className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                  style={{ color: showNewFile ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => { setShowNewFolder(v => !v); setShowNewFile(false); setInlineCreate(null); }}
                  title="New Folder"
                  className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                  style={{ color: showNewFolder ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  <FolderPlus size={14} />
                </button>
              </div>
            )}
          </div>

          {/* New file input */}
          {showNewFile && (
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                placeholder="e.g. main.py or src/utils/helpers.js"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') createFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
                }}
                className="w-full h-8 px-2.5 rounded text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Tip: type <code style={{ color: 'var(--accent)' }}>src/utils/file.js</code> to nest inside folders · Enter to create · Esc to cancel
              </p>
            </div>
          )}

          {/* New folder input */}
          {showNewFolder && (
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="e.g. components or src/utils"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') createFolder();
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                }}
                className="w-full h-8 px-2.5 rounded text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--warning)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                New folder · Enter to create · Esc to cancel
              </p>
            </div>
          )}


          {/* File tree */}
          <div
            className="flex-1 overflow-y-auto py-2 transition-colors relative"
            onDragOver={(e) => {
              if (!draggedNode) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverTarget !== '__root__') {
                setDragOverTarget('__root__');
              }
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) {
                setDragOverTarget(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourcePath = e.dataTransfer.getData('text/plain') || draggedNode?.path;
              setDraggedNode(null);
              setDragOverTarget(null);
              if (sourcePath) {
                moveItem(sourcePath, '');
              }
            }}
            style={{
              background: dragOverTarget === '__root__' ? 'rgba(47, 129, 247, 0.05)' : 'transparent',
            }}
          >
            {isClassWaiting ? (
              <div className="p-4 text-center text-xs flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <GraduationCap size={24} className="text-purple-400 opacity-60 animate-pulse" />
                <span className="font-semibold text-purple-400">Class Inactive</span>
                <span>Waiting for teacher to start class…</span>
              </div>
            ) : tree.length === 0 ? (
              <p className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                No files yet — click + to create one
              </p>
            ) : (
              <>
                {renderTree(tree)}
                {draggedNode && dragOverTarget === '__root__' && (
                  <div
                    className="mx-3 my-2 p-2 rounded text-center text-xs font-mono select-none transition-all"
                    style={{
                      border: '1px dashed var(--accent)',
                      color: 'var(--accent)',
                      background: 'rgba(47, 129, 247, 0.1)',
                    }}
                  >
                    Drop here to move to root
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar Footer: Management Hub (Bottom Left Corner) */}
          <div
            className="p-2 shrink-0 flex flex-col gap-1 border-t select-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            {/* Git Source Control Button */}
            <button
              onClick={() => setShowSourceControl(v => { const n = !v; if (n) { setShowMembersPanel(false); setShowChat(false); } return n; })}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--surface)]"
              style={{
                color: showSourceControl ? '#fb923c' : 'var(--text)',
                border: 'none',
                background: showSourceControl ? 'var(--surface)' : 'transparent',
                cursor: 'pointer',
              }}
              title="Git Source Control & Version History (Ctrl+Shift+G)"
            >
              <div className="flex items-center gap-2">
                <GitPullRequest size={13} className="text-orange-400" />
                <span>Source Control</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono" style={{ background: 'var(--bg)', color: '#fb923c' }}>
                Git
              </span>
            </button>

            {/* Team Members Button */}
            <button
              onClick={() => setShowMembersPanel(v => { const n = !v; if (n) { setShowSourceControl(false); setShowChat(false); } return n; })}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--surface)]"
              style={{
                color: showMembersPanel ? 'var(--accent)' : 'var(--text)',
                border: 'none',
                background: showMembersPanel ? 'var(--surface)' : 'transparent',
                cursor: 'pointer',
              }}
              title="Workspace Members & Permissions"
            >
              <div className="flex items-center gap-2">
                <Users size={13} className="text-purple-400" />
                <span>Members</span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeUsers.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                  {activeUsers.length}
                </span>
              </div>
            </button>

            {/* Environment Manager Button */}
            <button
              onClick={() => setShowEnvironmentModal(true)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--surface)]"
              style={{
                color: showEnvironmentModal ? 'var(--accent)' : 'var(--text)',
                border: 'none',
                background: showEnvironmentModal ? 'var(--surface)' : 'transparent',
                cursor: 'pointer',
              }}
              title="Execution Environment Status & Runtimes"
            >
              <div className="flex items-center gap-2">
                <Cpu size={13} className="text-blue-400" />
                <span>Environment</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                {globalExecutionMode && canAdmin ? 'Global' : 'Private'}
              </span>
            </button>

            {/* Lock Manager Button */}
            <button
              onClick={() => setShowLockManager(true)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--surface)]"
              style={{
                color: showLockManager ? '#d29922' : 'var(--text)',
                border: 'none',
                background: showLockManager ? 'var(--surface)' : 'transparent',
                cursor: 'pointer',
              }}
              title="Manage File & Folder Locks"
            >
              <div className="flex items-center gap-2">
                <Lock size={13} className={workspaceLocks.length > 0 ? 'text-amber-400' : 'text-gray-400'} />
                <span>Locks</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono" style={{ background: 'var(--bg)', color: workspaceLocks.length > 0 ? '#d29922' : 'var(--muted)' }}>
                {workspaceLocks.length}
              </span>
            </button>
          </div>
        </aside>

        {/* ── Resizable Splitter between Sidebar and Main Content ── */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className="w-1 cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)] transition-colors shrink-0 z-10"
          style={{ background: 'var(--border)' }}
          title="Drag to resize file explorer"
        />

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
              userRole={currentRole}
              sessionRole={sessionRole}
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

          {/* Full Web Preview view */}
          <div
            className="w-full h-full flex flex-col overflow-hidden"
            style={{ display: activeView === 'preview' ? 'flex' : 'none' }}
          >
            <WebPreviewPanel
              workspaceId={workspace.id}
              detectedPort={previewPort}
              onPortChange={setPreviewPort}
            />
          </div>

          {/* Editor view (supports side-by-side split live preview) */}
          <div
            className="w-full h-full flex flex-row overflow-hidden"
            style={{ display: activeView === 'editor' ? 'flex' : 'none' }}
          >
            {/* Left Column: Code Tabs, Editor, and Terminal */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              {/* Tab bar */}
              <div
                className="flex items-center justify-between shrink-0"
                style={{ height: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', minHeight: 40 }}
              >
                <div className="flex items-end overflow-x-auto h-full flex-1">
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

                {/* Right side of tab bar: Split Live Preview button */}
                <div className="flex items-center gap-1.5 px-3 h-full shrink-0 border-l" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => setShowSplitPreview(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      showSplitPreview
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                    }`}
                    style={{
                      border: showSplitPreview ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    title={showSplitPreview ? 'Hide Live Preview' : 'Open Live Web Preview beside editor'}
                  >
                    <Globe size={13} />
                    <span>{showSplitPreview ? 'Hide Preview' : 'Live Preview'}</span>
                    {previewPort && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Editor + Console */}
              {isClassWaiting ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              style={{ background: 'var(--bg)', color: 'var(--text)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                <GraduationCap size={32} className="text-purple-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-2">Class Has Not Started Yet</h2>
              <p className="max-w-md text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Your teacher has not started this class session. Please wait; code files and classroom tools will appear here when class begins.
              </p>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: '#c084fc' }}>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping mr-1" />
                Waiting for teacher to start class…
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
                  {/* View Access Banner */}
                  {isViewer && !isEditorLocked && (
                    <div
                      className="flex items-center justify-between px-4 py-2 text-xs font-semibold shrink-0"
                      style={{ background: 'rgba(56, 189, 248, 0.12)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                    >
                      <span className="flex items-center gap-2">
                        <Eye size={13} />
                        {isStudent
                          ? 'View Access: You are observing live classroom code in read-only mode.'
                          : 'View Mode: Read-only access to this workspace.'}
                      </span>
                      <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">
                        {isStudent ? 'Assigned by Teacher' : 'Read Only'}
                      </span>
                    </div>
                  )}

                  {/* Resource Lock Banner */}
                  {isFileLockedByOther && activeFileLock && (
                    <div
                      className="flex items-center justify-between px-4 py-2 text-xs font-semibold shrink-0"
                      style={{ background: 'rgba(210, 153, 34, 0.15)', borderBottom: '1px solid rgba(210, 153, 34, 0.4)', color: '#d29922' }}
                    >
                      <span className="flex items-center gap-2">
                        <Lock size={13} />
                        Locked by {activeFileLock.lockedByName} ({activeFileLock.lockType.replace('_', ' ')}): Read-only access
                        {activeFileLock.reason ? ` · "${activeFileLock.reason}"` : ''}
                      </span>
                      <span className="text-[10px] font-mono opacity-80 uppercase tracking-wider">
                        Locked Resource
                      </span>
                    </div>
                  )}

                  {activeFileLock && activeFileLock.lockedBy === user?.id && (
                    <div
                      className="flex items-center justify-between px-4 py-1.5 text-xs font-semibold shrink-0"
                      style={{ background: 'rgba(47, 129, 247, 0.12)', borderBottom: '1px solid rgba(47, 129, 247, 0.3)', color: '#58a6ff' }}
                    >
                      <span className="flex items-center gap-2">
                        <Lock size={12} />
                        You have locked this {activeFileLock.lockType.replace('_', ' ')}. Collaborators cannot edit it.
                      </span>
                      <button
                        onClick={() => socketRef.current?.emit('lock:release', { workspaceId: workspace.id, lockId: activeFileLock.id })}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors"
                      >
                        Release Lock
                      </button>
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

                  {/* Line numbers gutter */}
                  <div
                    ref={gutterRef}
                    className="py-4 text-right select-none shrink-0 overflow-hidden"
                    style={{
                      width: 58,
                      background: '#0d1117',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      lineHeight: '23.8px',
                    }}
                  >
                    {activeTab.content.split('\n').map((_, i) => {
                      const lineNum = i + 1;
                      const lineComments = comments.filter(c => c.lineNumber === lineNum);
                      const hasComments = lineComments.length > 0;
                      const isHovered = hoveredLine === lineNum;
                      const isActive = activeCommentLine === lineNum;
                      const hasUnresolved = lineComments.some(c => !c.resolved);

                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between px-1 relative transition-colors"
                          style={{
                            height: 23.8,
                            background: isActive ? 'rgba(47, 129, 247, 0.18)' : isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          }}
                          onMouseEnter={() => setHoveredLine(lineNum)}
                          onMouseLeave={() => setHoveredLine(null)}
                        >
                          <div className="w-5 flex items-center justify-center">
                            {hasComments ? (
                              <button
                                onClick={() => setActiveCommentLine(prev => prev === lineNum ? null : lineNum)}
                                className="flex items-center justify-center w-4 h-4 rounded hover:bg-white/10 transition-colors"
                                style={{
                                  color: hasUnresolved ? '#60a5fa' : '#34d399',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                                title={`${lineComments.length} comment(s) on line ${lineNum}`}
                              >
                                <MessageSquare size={11} />
                              </button>
                            ) : canComment && isHovered ? (
                              <button
                                onClick={() => setActiveCommentLine(lineNum)}
                                className="flex items-center justify-center w-4 h-4 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                                style={{ border: 'none', cursor: 'pointer', padding: 0 }}
                                title={`Add comment on line ${lineNum}`}
                              >
                                <Plus size={11} />
                              </button>
                            ) : null}
                          </div>

                          <span
                            className="text-xs transition-colors"
                            style={{
                              color: isActive ? '#58a6ff' : hasComments ? '#e6edf3' : isHovered ? '#8b949e' : '#484f58',
                            }}
                          >
                            {lineNum}
                          </span>
                        </div>
                      );
                    })}
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
                    onScroll={e => {
                      setEditorScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });
                      if (gutterRef.current) {
                        gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                      }
                    }}
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

                  {/* Floating Line Comment Thread */}
                  {activeCommentLine !== null && activeTab && (
                    <div
                      className="absolute z-30 shadow-2xl transition-all"
                      style={{
                        top: Math.max(8, Math.min(window.innerHeight - 380, 16 + (activeCommentLine - 1) * 23.8 - editorScroll.top)),
                        left: 64,
                        width: 320,
                      }}
                    >
                      <LineCommentThread
                        comment={comments.find(c => c.lineNumber === activeCommentLine && !c.parentId)}
                        filePath={activeTab.path}
                        lineNumber={activeCommentLine}
                        canComment={canComment}
                        currentUserId={user?.id}
                        currentUserRole={currentRole}
                        onAddComment={handleAddComment}
                        onResolveToggle={handleResolveComment}
                        onDeleteComment={handleDeleteComment}
                        onClose={() => setActiveCommentLine(null)}
                      />
                    </div>
                  )}

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
                  <div className="flex items-center gap-2 min-w-0">
                    <Terminal size={13} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      Terminal
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded select-none opacity-60 hidden sm:inline"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                      title="Press Ctrl + ` to toggle terminal"
                    >
                      Ctrl + `
                    </span>
                    {running ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="truncate max-w-[140px] sm:max-w-[220px]">
                            {runningCommand || 'Running…'}
                          </span>
                        </span>
                        <button
                          onClick={killTerminalProcess}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
                          title="Stop process (Ctrl+C)"
                        >
                          <Square size={10} fill="currentColor" />
                          <span>Stop</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-400/80 font-mono hidden md:inline">
                        ● Ready
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOutput('')}
                      className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Clear terminal"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsTerminalCollapsed(prev => !prev)}
                      className="p-1 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title={isTerminalCollapsed ? "Expand terminal" : "Collapse terminal"}
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
                      title={isTerminalMaximized ? "Restore panel size" : "Maximize terminal panel"}
                    >
                      {isTerminalMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                    <button
                      onClick={() => setIsTerminalOpen(false)}
                      className="p-1 rounded transition-colors hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Close terminal (Ctrl + `)"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {!isTerminalCollapsed && (
                  <div
                    ref={outputRef}
                    onClick={() => {
                      if (!window.getSelection()?.toString()) {
                        terminalInputRef.current?.focus();
                      }
                    }}
                    className="p-4 text-xs sm:text-sm font-mono leading-relaxed overflow-auto flex-1 select-text cursor-text flex flex-col"
                    style={{
                      background: '#0a0c10',
                      color: '#e6edf3',
                    }}
                  >
                    {/* Rendered output text */}
                    {output && (
                      <div className="whitespace-pre-wrap break-all select-text mb-1">
                        {output}
                      </div>
                    )}

                    {/* Inline Active Command Prompt */}
                    <div className="flex items-center gap-1.5 select-none w-full">
                      <span className="font-bold select-none shrink-0" style={{ color: running ? '#f59e0b' : '#34d399' }}>
                        {running ? '>' : `${terminalCwd}$`}
                      </span>
                      <input
                        ref={terminalInputRef}
                        type="text"
                        value={terminalInput}
                        onChange={e => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalKeyDown}
                        placeholder=""
                        className="flex-1 bg-transparent font-mono text-xs sm:text-sm border-none outline-none shadow-none focus:outline-none focus:ring-0 focus:border-none focus:shadow-none p-0 m-0 select-text"
                        style={{
                          color: '#f0f6fc',
                          caretColor: '#38bdf8',
                          outline: 'none',
                          boxShadow: 'none',
                          border: 'none',
                          backgroundColor: 'transparent',
                        }}
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="off"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
            </div>

            {/* Right Column: Split Live Web Preview */}
            {showSplitPreview && (
              <>
                <div
                  onMouseDown={handleSplitMouseDown}
                  className="w-1 cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)] transition-colors shrink-0 z-10"
                  style={{ background: 'var(--border)' }}
                  title="Drag to resize live preview"
                />
                <div
                  style={{ width: splitPreviewWidth }}
                  className="h-full shrink-0 flex flex-col overflow-hidden"
                >
                  <WebPreviewPanel
                    workspaceId={workspace.id}
                    detectedPort={previewPort}
                    onPortChange={setPreviewPort}
                    isSplit={true}
                    onCloseSplit={() => setShowSplitPreview(false)}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── Bottom Status Bar (VS Code style) ── */}
      <footer
        className="flex items-center justify-between px-3 h-6 shrink-0 text-[11px] select-none z-20"
        style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
          color: 'var(--muted)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Workspace type & branch */}
          <span className="flex items-center gap-1 font-mono">
            <GitBranch size={11} className="text-blue-400" />
            <span className="font-semibold" style={{ color: 'var(--text)' }}>main</span>
          </span>

          {/* Cursor line & column */}
          {activeTab && (
            <span className="font-mono">
              Ln {localCursor ? localCursor.line + 1 : 1}, Col {localCursor ? localCursor.col + 1 : 1}
            </span>
          )}

          {/* Active file lock status / quick toggle */}
          {activeTab && (
            <div className="flex items-center gap-1">
              {activeFileLock ? (
                <span className="flex items-center gap-1 text-amber-400 font-mono">
                  <Lock size={10} /> Locked by {activeFileLock.lockedByName}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-mono text-[10px] opacity-75">
                  <Unlock size={10} /> Unlocked
                </span>
              )}
              {canLock && (
                <button
                  onClick={() => {
                    if (activeFileLock) {
                      socketRef.current?.emit('lock:release', { workspaceId: workspace.id, lockId: activeFileLock.id });
                    } else {
                      socketRef.current?.emit('lock:create', { workspaceId: workspace.id, lockType: 'file', targetPath: activeTab.path });
                    }
                  }}
                  className="ml-1 text-[10px] px-1.5 py-0.2 rounded hover:bg-black/20 cursor-pointer border-none text-[var(--accent)]"
                  title={activeFileLock ? 'Release lock on this file' : 'Lock this file'}
                >
                  {activeFileLock ? 'Unlock' : 'Lock'}
                </button>
              )}
            </div>
          )}

          {/* Dirty indicator */}
          {activeTab?.dirty && (
            <button
              onClick={saveActive}
              className="flex items-center gap-1 text-amber-400 font-medium cursor-pointer hover:underline border-none bg-transparent text-[11px] p-0"
              title="Click to save (Ctrl + S)"
            >
              <Save size={10} />
              <span>{saving ? 'Saving…' : 'Unsaved'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Terminal Toggle Button */}
          <button
            type="button"
            onClick={toggleTerminal}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:text-[var(--text)] hover:bg-black/10 cursor-pointer border-none bg-transparent"
            style={{ color: isTerminalOpen && !isTerminalCollapsed ? 'var(--accent)' : 'var(--muted)' }}
            title="Toggle Terminal (Ctrl + `)"
          >
            <Terminal size={11} />
            <span>Terminal</span>
          </button>

          {/* Chat Toggle Button */}
          <button
            type="button"
            onClick={() => setShowChat(prev => !prev)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:text-[var(--text)] hover:bg-black/10 cursor-pointer border-none bg-transparent"
            style={{ color: showChat ? 'var(--accent)' : 'var(--muted)' }}
            title="Toggle Collaboration Chat & Voice"
          >
            <MessageSquare size={11} />
            <span>Chat</span>
          </button>

          {/* Environment Status pill */}
          <button
            onClick={() => setShowEnvironmentModal(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:text-[var(--text)] hover:bg-black/10 cursor-pointer border-none bg-transparent"
            title="Execution Environment Settings"
          >
            <Cpu size={11} className="text-blue-400" />
            <span>Env: {globalExecutionMode && canAdmin ? 'Global' : 'Isolated'}</span>
          </button>

          {/* Online connection status dot */}
          <span className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: socketConnected ? '#10b981' : '#ef4444' }}
            />
            <span className="font-mono text-[10px]">{socketConnected ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </footer>

      {/* Members Panel Overlay */}
      {showMembersPanel && (
        <MembersPanel
          workspaceId={workspace.id}
          workspaceType={workspaceType}
          myRole={currentRole}
          currentUserId={user?.id ?? 0}
          token={token}
          activeMemberFiles={activeMemberFiles}
          socket={socketRef.current}
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

      {/* Git Source Control Panel Overlay */}
      {showSourceControl && (
        <SourceControlPanel
          workspaceId={workspace.id}
          token={token}
          currentUserId={user?.id}
          onOpenFile={(filePath) => openFileByPath(filePath)}
          onClose={() => setShowSourceControl(false)}
        />
      )}

      {/* Kanban Sprint Hub (Competitive & Professional) */}
      {showKanbanHub && (workspaceType === 'professional' || workspaceType === 'competitive') && (
        <KanbanSprintHub
          workspaceId={workspace.id}
          workspaceType={workspaceType as 'competitive' | 'professional'}
          myRole={currentRole}
          currentUserId={user?.id ?? 0}
          token={token}
          socket={liveSocket}
          activeFilePath={activeTab?.path}
          onOpenFile={(filePath) => openFileByPath(filePath)}
          onClose={() => setShowKanbanHub(false)}
        />
      )}

      {/* Professional Tasks & Code Review Panel Overlay */}
      {showProfessionalPanel && (
        <ProfessionalPanel
          workspaceId={workspace.id}
          myRole={currentRole}
          currentUserId={user?.id ?? 0}
          token={token}
          activeFilePath={activeTab?.path}
          onOpenFile={(filePath) => openFileByPath(filePath)}
          onClose={() => setShowProfessionalPanel(false)}
          onTaskCreated={(task) => {
            if (socketRef.current) {
              socketRef.current.emit('task:create', { workspaceId: workspace.id, task });
            }
          }}
          onTaskUpdated={(task) => {
            if (socketRef.current) {
              socketRef.current.emit('task:update', { workspaceId: workspace.id, task });
            }
          }}
          onTaskDeleted={(taskId) => {
            if (socketRef.current) {
              socketRef.current.emit('task:delete', { workspaceId: workspace.id, taskId });
            }
          }}
          onReviewCreated={(review) => {
            setOpenReviewsCount(prev => prev + 1);
            if (socketRef.current) {
              socketRef.current.emit('review:create', { workspaceId: workspace.id, review });
            }
          }}
          onReviewUpdated={(review) => {
            if (socketRef.current) {
              socketRef.current.emit('review:update_status', { workspaceId: workspace.id, review });
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
            socket={liveSocket}
            workspaceId={workspace.id}
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
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

      {/* Environment Management Modal */}
      <EnvironmentModal
        workspaceId={workspace.id}
        isOpen={showEnvironmentModal}
        onClose={() => setShowEnvironmentModal(false)}
        socket={socketRef.current}
        isAdmin={canAdmin}
        currentUserId={user?.id ?? 0}
        globalExecutionMode={globalExecutionMode}
        onToggleGlobalExecution={setGlobalExecutionMode}
      />

      {/* Resource Locks Manager Modal */}
      <LockManagerModal
        workspaceId={workspace.id}
        isOpen={showLockManager}
        onClose={() => setShowLockManager(false)}
        locks={workspaceLocks}
        socket={socketRef.current}
        canLock={canLock}
        isAdmin={canAdmin}
        currentUserId={user?.id ?? 0}
        activeFilePath={activeTab?.path}
      />

      {/* ── Right-click Context Menu ── */}
      {contextMenu && (
        <>
          {/* Backdrop to close the menu on outside click */}
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 rounded-lg shadow-2xl py-1 min-w-[170px] text-xs"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            {(() => {
              const itemLock = workspaceLocks.find(l =>
                l.targetPath === contextMenu.node.path ||
                (l.lockType === 'folder' && contextMenu.node.path.startsWith(l.targetPath.endsWith('/') ? l.targetPath : `${l.targetPath}/`))
              );
              const isLocker = itemLock && itemLock.lockedBy === user?.id;
              const canRelease = itemLock && (isLocker || canAdmin);

              return (
                <>
                  {contextMenu.node.type === 'directory' && !isEffectiveReadOnly && (!itemLock || isLocker || canAdmin) && (
                    <>
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        onClick={() => {
                          const targetPath = contextMenu.node.path;
                          setContextMenu(null);
                          startCreateInFolder(targetPath, 'file');
                        }}
                      >
                        <Plus size={12} style={{ color: 'var(--accent)' }} />
                        New File Inside
                      </button>
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        onClick={() => {
                          const targetPath = contextMenu.node.path;
                          setContextMenu(null);
                          startCreateInFolder(targetPath, 'folder');
                        }}
                      >
                        <FolderPlus size={12} style={{ color: 'var(--warning)' }} />
                        New Folder Inside
                      </button>
                      <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                    </>
                  )}

                  {contextMenu.node.type === 'file' && (
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                      onClick={() => {
                        openFile(contextMenu.node);
                        setContextMenu(null);
                      }}
                    >
                      <FileCode size={12} style={{ color: extColor(contextMenu.node.name) }} />
                      Open File
                    </button>
                  )}

                  {canLock && (
                    itemLock ? (
                      canRelease && (
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors text-amber-400"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            socketRef.current?.emit('lock:release', { workspaceId: workspace.id, lockId: itemLock.id });
                            setContextMenu(null);
                          }}
                        >
                          <Unlock size={12} />
                          Unlock {contextMenu.node.type === 'directory' ? 'Folder' : 'File'}
                        </button>
                      )
                    ) : (
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        onClick={() => {
                          socketRef.current?.emit('lock:create', {
                            workspaceId: workspace.id,
                            lockType: contextMenu.node.type === 'directory' ? 'folder' : 'file',
                            targetPath: contextMenu.node.path,
                          });
                          setContextMenu(null);
                        }}
                      >
                        <Lock size={12} style={{ color: 'var(--muted)' }} />
                        Lock {contextMenu.node.type === 'directory' ? 'Folder' : 'File'}
                      </button>
                    )
                  )}

                  {!isEffectiveReadOnly && (!itemLock || isLocker || canAdmin) && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        onClick={(e) => {
                          const node = contextMenu.node;
                          setContextMenu(null);
                          startRename(node.path, node.name, e as unknown as React.MouseEvent);
                        }}
                      >
                        <Pencil size={12} style={{ color: 'var(--accent)' }} />
                        Rename
                      </button>
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-2)] text-left transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}
                        onClick={(e) => {
                          const node = contextMenu.node;
                          setContextMenu(null);
                          deleteFile(node.path, e as unknown as React.MouseEvent);
                        }}
                      >
                        <Trash2 size={12} />
                        {contextMenu.node.type === 'directory' ? 'Delete Folder' : 'Delete File'}
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

    </div>
  );
}
