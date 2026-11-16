import { useState, useEffect, useRef } from 'react';
import {
  Plus, FolderOpen, Sun, Moon, LogOut, Clock, Trash2, UserPlus, Link2,
  GraduationCap, Briefcase, Trophy, Check, Sparkles, Eye, EyeOff,
  Shield, X, GitPullRequest, AlertCircle, Search, ArrowRight
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import type { Workspace, WorkspaceRole, WorkspaceType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Spinner } from '../ui/Spinner';
import { collabService } from '../../services/workspaceCollabService';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const typeDetails: Record<WorkspaceType, {
  label: string;
  icon: typeof GraduationCap;
  color: string;
  bgColor: string;
  borderColor: string;
  roles: string;
  desc: string;
  features: string[];
}> = {
  educational: {
    label: 'Educational',
    icon: GraduationCap,
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.10)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    roles: 'Teacher & Students',
    desc: 'Live classroom with WebRTC broadcast, student editor locking, and hand raising.',
    features: ['Live Voice Lecture Broadcast', 'Editor Lock & Follow Mode', 'Hand Raising System'],
  },
  professional: {
    label: 'Professional',
    icon: Briefcase,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    roles: 'Admin, Dev & Tester',
    desc: 'Production team environment with peer collaboration, line locking, and reviews.',
    features: ['Multi-Cursor Real-Time Sync', 'Granular File Locking', 'Kanban Sprints & Reviews'],
  },
  competitive: {
    label: 'Competitive',
    icon: Trophy,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    roles: 'Admin & Team Members',
    desc: 'Hackathon team workspaces with allowlisted email access and real-time coding.',
    features: ['Admin View & Line Comments', 'Allowed Emails Scoped Access', 'Real-Time Hackathon Mode'],
  },
};

const PROJECT_TEMPLATES_LIST = [
  { id: 'blank', label: 'Blank Project', desc: 'Empty workspace with README.md', badge: 'Empty', icon: '📄' },
  { id: 'node-express', label: 'Node.js Express', desc: 'REST server with Express & package.json', badge: 'Node.js', icon: '🟢' },
  { id: 'python-flask', label: 'Python Flask', desc: 'Flask web app with requirements.txt', badge: 'Flask', icon: '🐍' },
  { id: 'python-script', label: 'Python Script', desc: 'Starter main.py script runner', badge: 'Python', icon: '⚡' },
  { id: 'java-maven', label: 'Java Maven', desc: 'Java 21 project with pom.xml', badge: 'Java', icon: '☕' },
  { id: 'react-vite', label: 'React + Vite', desc: 'React 19 single-page app', badge: 'React', icon: '⚛️' },
];

interface Props { onOpen: (ws: Workspace, role: WorkspaceRole) => void; }

export function Dashboard({ onOpen }: Props) {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedType, setSelectedType] = useState<WorkspaceType>('educational');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [cloneFromGit, setCloneFromGit] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [showGitToken, setShowGitToken] = useState(false);
  const [allowedEmailsList, setAllowedEmailsList] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState('');
  const [createError, setCreateError] = useState('');
  const newNameRef = useRef<HTMLInputElement>(null);

  // UX Enhancements: Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const joinInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchWorkspaces = () => {
    setLoading(true);
    fetch(`${BASE_URL}/api/workspaces`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) setWorkspaces(d.workspaces ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWorkspaces(); }, [token]);

  useEffect(() => {
    const q = memberSearchQuery.trim();
    if (!q) {
      setMemberSuggestions([]);
      setShowMemberDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingMembers(true);
      try {
        const res = await collabService.searchUsers(q, token);
        if (res.success && res.users) {
          const filtered = res.users.filter(u => !allowedEmailsList.map(e => e.toLowerCase()).includes(u.email.toLowerCase()));
          setMemberSuggestions(filtered);
          setShowMemberDropdown(true);
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingMembers(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [memberSearchQuery, token, allowedEmailsList]);

  const handleAddAllowedEmail = async (emailToAdd?: string) => {
    const email = (emailToAdd || memberSearchQuery).trim().toLowerCase();
    setMemberSearchError('');
    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMemberSearchError('Please enter a valid email address.');
      return;
    }

    if (allowedEmailsList.some(e => e.toLowerCase() === email)) {
      setMemberSearchError('This email is already added to the team.');
      return;
    }

    try {
      setIsSearchingMembers(true);
      const res = await collabService.searchUsers(email, token);
      if (res.success && res.users) {
        const exactMatch = res.users.find(u => u.email.toLowerCase() === email);
        if (!exactMatch) {
          setMemberSearchError(`No CodeSync account found for "${email}". Team members must have an account on CodeSync.`);
          return;
        }
        setAllowedEmailsList(prev => [...prev, exactMatch.email]);
        setMemberSearchQuery('');
        setShowMemberDropdown(false);
        setMemberSuggestions([]);
      }
    } catch {
      setMemberSearchError('Error verifying user account.');
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleRemoveAllowedEmail = (emailToRemove: string) => {
    if (user?.email && emailToRemove.toLowerCase() === user.email.toLowerCase()) return;
    setAllowedEmailsList(prev => prev.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const allowedEmails = selectedType === 'competitive'
        ? Array.from(new Set([
            ...(user?.email ? [user.email.toLowerCase().trim()] : []),
            ...allowedEmailsList.map(e => e.toLowerCase().trim()),
          ]))
        : undefined;

      const res = await fetch(`${BASE_URL}/api/workspaces`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newName.trim(),
          type: selectedType,
          allowedEmails,
          template: cloneFromGit ? 'blank' : selectedTemplate,
          gitRepoUrl: cloneFromGit && gitRepoUrl.trim() ? gitRepoUrl.trim() : undefined,
          gitBranch: cloneFromGit && gitBranch.trim() ? gitBranch.trim() : undefined,
          gitToken: cloneFromGit && gitToken.trim() ? gitToken.trim() : undefined,
        }),
      });
      const d = await res.json();
      if (d.success && d.workspace) {
        setWorkspaces(prev => [d.workspace, ...prev]);
        setShowNew(false);
        setNewName('');
        setAllowedEmailsList([]);
        setCloneFromGit(false);
        setGitRepoUrl('');
        setGitBranch('');
        setGitToken('');
        setMemberSearchQuery('');
        setMemberSuggestions([]);
        setMemberSearchError('');
      } else {
        setCreateError(d.error || 'Failed to create workspace');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const toggleSelectWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkspaceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedWorkspaceIds.length === filteredWorkspaces.length) {
      setSelectedWorkspaceIds([]);
    } else {
      setSelectedWorkspaceIds(filteredWorkspaces.map(w => w.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedWorkspaceIds([]);
  };

  const deleteWorkspace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ws = workspaces.find(w => w.id === id);
    const wsName = ws?.name ? `"${ws.name}"` : 'this workspace';
    if (!confirm(`Delete ${wsName} and all its files? This action cannot be undone.`)) return;

    setDeletingWorkspaceId(id);
    try {
      const res = await collabService.deleteWorkspace(id, token);
      if (res.success) {
        setWorkspaces(prev => prev.filter(w => w.id !== id));
        setSelectedWorkspaceIds(prev => prev.filter(x => x !== id));
      } else {
        alert(res.error || 'Failed to delete workspace. You may not have permission.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while deleting workspace.');
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedWorkspaceIds.length === 0) return;
    const count = selectedWorkspaceIds.length;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${count} selected workspace${count === 1 ? '' : 's'} and all associated files? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const res = await collabService.bulkDeleteWorkspaces(selectedWorkspaceIds, token);
      if (res.success && res.deletedIds && res.deletedIds.length > 0) {
        const deletedSet = new Set(res.deletedIds);
        setWorkspaces(prev => prev.filter(w => !deletedSet.has(w.id)));
        setSelectedWorkspaceIds(prev => prev.filter(id => !deletedSet.has(id)));
        if (res.failedIds && res.failedIds.length > 0) {
          alert(
            `Deleted ${res.deletedIds.length} workspace(s). Could not delete ${res.failedIds.length} workspace(s) due to insufficient permissions.`
          );
        }
      } else {
        alert(res.error || 'Failed to delete selected workspaces.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while deleting workspaces.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleOpen = async (ws: Workspace) => {
    try {
      const res = await collabService.getMembers(ws.id, token);
      let role: WorkspaceRole = 'owner';
      if (res.success && res.members && user) {
        const member = res.members.find(m => m.userId === user.id);
        if (member) role = member.role;
      }
      onOpen(ws, role);
    } catch {
      onOpen(ws, 'owner');
    }
  };

  const generateQuickInvite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const targetWs = workspaces.find(w => w.id === id);
      const defaultRole = targetWs?.type === 'educational' ? 'student' : targetWs?.type === 'professional' ? 'developer' : 'editor';
      const res = await collabService.createInvite(id, { role: defaultRole }, token);
      if (res.success && res.invite) {
        const url = res.invite.inviteUrl || `${window.location.origin}/?join=${res.invite.id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        alert('Failed to generate invite');
      }
    } catch {
      alert('Failed to generate invite');
    }
  };

  const openNewForm = (presetTemplate?: string) => {
    setShowNew(true);
    setShowJoin(false);
    if (presetTemplate) {
      setSelectedTemplate(presetTemplate);
      setCloneFromGit(false);
    }
    if (selectedType === 'competitive' && user?.email) {
      const email = user.email.toLowerCase().trim();
      setAllowedEmailsList(prev => prev.includes(email) ? prev : [email, ...prev]);
    }
    setTimeout(() => newNameRef.current?.focus(), 50);
  };

  const openJoinForm = () => {
    setShowJoin(true);
    setShowNew(false);
    setJoinError('');
    setTimeout(() => joinInputRef.current?.focus(), 50);
  };

  const extractInviteCode = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const code = url.searchParams.get('join') || url.searchParams.get('code');
        if (code) return code;
      }
    } catch {}
    if (trimmed.includes('join=')) {
      return trimmed.split('join=')[1].split('&')[0];
    }
    if (trimmed.includes('code=')) {
      return trimmed.split('code=')[1].split('&')[0];
    }
    return trimmed;
  };

  const handleJoinWorkspace = async () => {
    const code = extractInviteCode(joinInput);
    if (!code) {
      setJoinError('Please enter a valid invite link or invite code.');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const res = await collabService.joinViaInvite(code, token);
      if (res.success && res.workspaceId) {
        let ws: Workspace = { id: res.workspaceId, name: `Workspace ${res.workspaceId}` };
        try {
          const wsRes = await fetch(`${BASE_URL}/api/workspaces/${res.workspaceId}`, { headers: authHeaders });
          const wsData = await wsRes.json();
          if (wsData.success && wsData.workspace) {
            ws = wsData.workspace;
          }
        } catch {}

        setShowJoin(false);
        setJoinInput('');
        fetchWorkspaces();
        onOpen(ws, res.role || 'viewer');
      } else {
        setJoinError((res as any).error || 'Invalid or expired invite link.');
      }
    } catch {
      setJoinError('Could not connect to the server.');
    } finally {
      setJoining(false);
    }
  };

  // Instant developer filtering
  const filteredWorkspaces = workspaces.filter(ws => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      ws.name.toLowerCase().includes(q) ||
      ws.id.toLowerCase().includes(q) ||
      (ws.description && ws.description.toLowerCase().includes(q));
    const matchesType = filterType === 'all' || ws.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Technical Skeuomorphic Header ── */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex items-center justify-between" style={{ height: 60 }}>

          {/* Left: Logo & IDE Tag */}
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt="CodeSync"
              className="w-8 h-8 rounded-xl object-contain shrink-0 shadow-sm"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--text)' }}>CodeSync</span>
              <span className="schematic-tag hidden sm:inline-flex">
                <span className="anchor-dot-live" style={{ width: 6, height: 6 }} /> WORKSPACE_HUB
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {user && (
              <div
                className="flex items-center gap-2.5 px-3 py-1 rounded-xl border"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--inset-shadow)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm"
                  style={{ background: 'var(--accent)' }}
                >
                  {user.username.charAt(0)}
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                  {user.username}
                </span>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-xl cursor-pointer btn-physical-surface"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Sign Out */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold cursor-pointer btn-physical-surface"
              title="Sign out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-7xl mx-auto px-6 sm:px-10 py-7">

        {/* ── ACTION HUB / WORKSPACE LAUNCHER ── */}
        <div
          className="skeuo-card mb-7"
          style={{
            padding: 0,
            backgroundImage: 'radial-gradient(circle, rgba(180,184,196,0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="card-header-tab">
            <div className="flex items-center gap-2">
              <span className="anchor-dot-live" />
              <span>DEVELOPER // WORKSPACE_LAUNCHER</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted)]">
              {workspaces.length} ACTIVE {workspaces.length === 1 ? 'ENV' : 'ENVS'}
            </span>
          </div>

          <div className="p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="max-w-xl">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1.5" style={{ color: 'var(--text)' }}>
                {user ? `Welcome back, ${user.username}` : 'Your Collaborative IDE'}
              </h1>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                Launch isolated Docker environments with remote cursors, WebRTC voice streaming, and integrated Git collaboration.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                onClick={() => openNewForm()}
                className="flex items-center gap-2 px-4 h-10 rounded-xl text-xs sm:text-sm font-bold cursor-pointer btn-physical-primary"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>New Workspace</span>
              </button>

              <button
                onClick={() => {
                  setShowNew(true);
                  setCloneFromGit(true);
                  setTimeout(() => newNameRef.current?.focus(), 50);
                }}
                className="flex items-center gap-2 px-3.5 h-10 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer btn-physical-surface"
              >
                <GitPullRequest size={14} className="text-orange-500" />
                <span>Clone Git Repo</span>
              </button>

              <button
                onClick={openJoinForm}
                className="flex items-center gap-2 px-3.5 h-10 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer btn-physical-surface"
              >
                <Link2 size={14} />
                <span>Join Session</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Join Workspace Inline Panel ── */}
        {showJoin && (
          <div
            className="mb-7 skeuo-card animate-fade-in"
            style={{
              borderColor: 'var(--accent)',
              boxShadow: '0 4px 20px rgba(232,66,12,0.12)',
            }}
          >
            <div className="card-header-tab" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)' }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--accent)' }}>
                <Link2 size={14} />
                <span>CONNECT // JOIN_EXISTING_WORKSPACE</span>
              </div>
              <button
                onClick={() => { setShowJoin(false); setJoinInput(''); setJoinError(''); }}
                className="cursor-pointer bg-transparent border-none text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Paste the invite URL (e.g. <code>http://localhost:5173/?join=...</code>) or the invitation token provided by your team lead.
              </p>

              {joinError && (
                <div className="p-3 rounded-lg text-xs mb-4 flex items-center gap-2 font-medium bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error)]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="flex gap-3 flex-wrap items-center">
                <input
                  ref={joinInputRef}
                  value={joinInput}
                  onChange={e => { setJoinInput(e.target.value); setJoinError(''); }}
                  placeholder="Paste invite link or code…"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleJoinWorkspace();
                    if (e.key === 'Escape') { setShowJoin(false); setJoinInput(''); setJoinError(''); }
                  }}
                  className="flex-1 h-10 px-4 rounded-xl text-xs sm:text-sm input-well focus:outline-none"
                  style={{ minWidth: 260 }}
                />
                <button
                  onClick={handleJoinWorkspace}
                  disabled={joining}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl text-xs sm:text-sm font-bold cursor-pointer btn-physical-primary disabled:opacity-50"
                >
                  {joining ? <Spinner size={13} /> : <Link2 size={14} />}
                  <span>Join Session</span>
                </button>
                <button
                  onClick={() => { setShowJoin(false); setJoinInput(''); setJoinError(''); }}
                  className="px-4 h-10 rounded-xl text-xs sm:text-sm font-medium cursor-pointer btn-physical-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── New Workspace Provisioning Panel ── */}
        {showNew && (
          <div
            className="mb-7 skeuo-card animate-fade-in"
            style={{
              borderColor: 'var(--accent)',
              boxShadow: '0 8px 32px rgba(232,66,12,0.15)',
            }}
          >
            <div className="card-header-tab" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)' }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--accent)' }}>
                <Sparkles size={14} />
                <span>PROVISION // NEW_SANDBOX_WORKSPACE</span>
              </div>
              <button
                onClick={() => {
                  setShowNew(false);
                  setNewName('');
                  setAllowedEmailsList([]);
                  setMemberSearchQuery('');
                  setMemberSuggestions([]);
                  setMemberSearchError('');
                  setCreateError('');
                }}
                className="cursor-pointer bg-transparent border-none text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 sm:p-7">
              <div className="mb-4">
                <span className="section-label">STEP 1: SELECT WORKFLOW TOPOLOGY</span>
              </div>

              {createError && (
                <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-2 bg-[var(--error-bg)] text-[var(--error)] border border-[var(--error)]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* 3 Selectable Workflow Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
                {(['educational', 'professional', 'competitive'] as WorkspaceType[]).map(typeKey => {
                  const item = typeDetails[typeKey];
                  const ItemIcon = item.icon;
                  const isSelected = selectedType === typeKey;

                  return (
                    <div
                      key={typeKey}
                      onClick={() => {
                        setSelectedType(typeKey);
                        if (typeKey === 'competitive' && user?.email) {
                          const email = user.email.toLowerCase().trim();
                          setAllowedEmailsList(prev => prev.includes(email) ? prev : [email, ...prev]);
                        }
                      }}
                      className="p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between relative skeuo-card"
                      style={{
                        background: isSelected ? item.bgColor : 'var(--surface)',
                        borderColor: isSelected ? item.color : 'var(--border)',
                        borderWidth: isSelected ? '2px' : '1px',
                      }}
                    >
                      {isSelected && (
                        <div
                          className="absolute top-3.5 right-3.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
                          style={{ background: item.color }}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: item.bgColor, color: item.color, border: `1px solid ${item.borderColor}` }}
                          >
                            <ItemIcon size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{item.label}</p>
                            <span className="text-[10px] font-mono text-[var(--muted)]">
                              {item.roles}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
                          {item.desc}
                        </p>

                        <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                          {item.features.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text)' }}>
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Competitive Allowed Members */}
              {selectedType === 'competitive' && (
                <div className="mb-5 p-3.5 rounded-xl border bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>
                      SCOPED TEAM MEMBERS (ALLOWLIST):
                    </label>
                    <span className="schematic-tag">
                      {allowedEmailsList.length} members
                    </span>
                  </div>

                  {allowedEmailsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: 'var(--border)' }}>
                      {allowedEmailsList.map(email => {
                        const isMe = user?.email && email.toLowerCase() === user.email.toLowerCase();
                        return (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium"
                            style={{
                              background: isMe ? 'rgba(59, 130, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: isMe ? '#3b82f6' : '#f59e0b',
                              border: `1px solid ${isMe ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            }}
                          >
                            <Shield size={11} />
                            <span>{email}</span>
                            {isMe ? (
                              <span className="text-[9px] font-bold px-1 rounded bg-blue-500/20 text-blue-500">Host</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveAllowedEmail(email)}
                                className="cursor-pointer bg-transparent border-none p-0 text-[var(--muted)] hover:text-red-500"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={e => { setMemberSearchQuery(e.target.value); setMemberSearchError(''); }}
                        onFocus={() => { if (memberSuggestions.length > 0) setShowMemberDropdown(true); }}
                        placeholder="Search registered user's email to add to team…"
                        className="flex-1 h-9 px-3 text-xs rounded-lg input-well focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAllowedEmail()}
                        disabled={!memberSearchQuery.trim() || isSearchingMembers}
                        className="px-3.5 h-9 rounded-lg text-xs font-bold btn-physical-primary cursor-pointer disabled:opacity-50"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>

                    {showMemberDropdown && (
                      <div
                        className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl overflow-hidden bg-[var(--surface)]"
                        style={{ borderColor: 'var(--border)', maxHeight: 180, overflowY: 'auto' }}
                      >
                        {memberSuggestions.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { handleAddAllowedEmail(u.email); setShowMemberDropdown(false); }}
                            className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)] border-b last:border-none"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white uppercase text-[9px] bg-amber-500">
                              {u.username.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-[var(--text)]">{u.username}</div>
                              <div className="text-[10px] text-[var(--muted)]">{u.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {memberSearchError && (
                    <div className="mt-1 text-xs text-red-500 font-medium">{memberSearchError}</div>
                  )}
                </div>
              )}

              {/* Starter Project Templates */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="section-label">STEP 2: RUNTIME TEMPLATE</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={cloneFromGit}
                      onChange={e => setCloneFromGit(e.target.checked)}
                      className="rounded"
                    />
                    <GitPullRequest size={13} className="text-[var(--accent)]" />
                    <span>Clone from Git instead</span>
                  </label>
                </div>

                {!cloneFromGit ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {PROJECT_TEMPLATES_LIST.map(tmpl => {
                      const isSelected = selectedTemplate === tmpl.id;
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => setSelectedTemplate(tmpl.id)}
                          className="p-2.5 rounded-xl text-left transition-all flex flex-col justify-between border cursor-pointer"
                          style={{
                            background: isSelected ? 'var(--accent-subtle)' : 'var(--surface)',
                            borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                            borderWidth: isSelected ? '1.5px' : '1px',
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase"
                              style={{
                                background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                                color: isSelected ? '#fff' : 'var(--muted)',
                              }}
                            >
                              {tmpl.badge}
                            </span>
                            {isSelected && <Check size={11} style={{ color: 'var(--accent)' }} />}
                          </div>
                          <div className="text-xs font-bold truncate" style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                            {tmpl.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border bg-[var(--surface-2)] grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono font-medium block mb-1" style={{ color: 'var(--muted)' }}>
                        GIT REPO URL
                      </label>
                      <input
                        type="text"
                        value={gitRepoUrl}
                        onChange={e => setGitRepoUrl(e.target.value)}
                        placeholder="https://github.com/organization/repository.git"
                        className="w-full h-9 px-3 text-xs rounded-lg input-well font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono font-medium block mb-1" style={{ color: 'var(--muted)' }}>
                        BRANCH (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        value={gitBranch}
                        onChange={e => setGitBranch(e.target.value)}
                        placeholder="main"
                        className="w-full h-9 px-3 text-xs rounded-lg input-well font-mono focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-mono font-medium block mb-1" style={{ color: 'var(--muted)' }}>
                        GITHUB TOKEN (FOR PRIVATE REPOSITORIES)
                      </label>
                      <div className="relative">
                        <input
                          type={showGitToken ? 'text' : 'password'}
                          value={gitToken}
                          onChange={e => setGitToken(e.target.value)}
                          placeholder="ghp_••••••••••••"
                          className="w-full h-9 pl-3 pr-10 text-xs rounded-lg input-well font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGitToken(p => !p)}
                          className="absolute right-3 top-2 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer bg-transparent border-none"
                        >
                          {showGitToken ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Workspace Name & Provision Action */}
              <div className="pt-3.5 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="section-label block mb-1.5">STEP 3: WORKSPACE NAME &amp; LAUNCH</span>
                <div className="flex gap-2.5 flex-wrap items-center">
                  <input
                    ref={newNameRef}
                    value={newName}
                    onChange={e => { setNewName(e.target.value); setCreateError(''); }}
                    placeholder="e.g. Distributed-Cluster-CS101 or API-Engine"
                    onKeyDown={e => {
                      if (e.key === 'Enter') createWorkspace();
                      if (e.key === 'Escape') {
                        setShowNew(false);
                        setNewName('');
                      }
                    }}
                    className="flex-1 h-10 px-3.5 rounded-xl text-xs sm:text-sm input-well focus:outline-none"
                    style={{ minWidth: 240 }}
                  />
                  <button
                    onClick={createWorkspace}
                    disabled={creating || !newName.trim()}
                    className="flex items-center gap-2 px-5 h-10 rounded-xl text-xs sm:text-sm font-bold cursor-pointer btn-physical-primary disabled:opacity-50"
                  >
                    {creating ? <Spinner size={14} /> : <Plus size={15} strokeWidth={2.5} />}
                    <span>Create &amp; Launch</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowNew(false);
                      setNewName('');
                    }}
                    className="px-3.5 h-10 rounded-xl text-xs sm:text-sm font-medium cursor-pointer btn-physical-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── UNIFIED FILTER & SEARCH TABLET ── */}
        <div
          className="skeuo-card p-1.5 flex flex-col md:flex-row items-center gap-2 mb-6"
          style={{ background: 'var(--surface)' }}
        >
          {/* Search Input (By ID / Name) */}
          <div className="relative flex-1 w-full flex items-center">
            <Search size={14} className="absolute left-3 text-[var(--muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search workspace by ID or name…"
              className="w-full h-9 pl-9 pr-8 text-xs rounded-lg input-well focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-[var(--muted)] hover:text-[var(--text)] bg-transparent border-none cursor-pointer p-1"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Subtle Vertical Divider on Desktop */}
          <div className="hidden md:block w-px h-6 bg-[var(--border)] shrink-0 mx-1" />

          {/* Filter Category Segmented Control */}
          <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto p-0.5 rounded-lg bg-[var(--surface-2)] shrink-0">
            {[
              { id: 'all', label: `All (${workspaces.length})` },
              { id: 'educational', label: 'Educational' },
              { id: 'professional', label: 'Professional' },
              { id: 'competitive', label: 'Competitive' },
            ].map(tab => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: isActive ? 'var(--surface)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bulk Actions Bar (When Items Selected) ── */}
        {selectedWorkspaceIds.length > 0 && (
          <div
            className="flex items-center justify-between p-3 rounded-xl border mb-5 skeuo-card animate-fade-in"
            style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold btn-physical-surface cursor-pointer"
              >
                <Check size={12} strokeWidth={3} className="text-[var(--accent)]" />
                <span>Select All ({filteredWorkspaces.length})</span>
              </button>
              <span className="schematic-tag">
                <span className="anchor-dot" /> {selectedWorkspaceIds.length} SELECTED
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-physical-surface cursor-pointer"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--error)] text-white border-none cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isBulkDeleting ? <Spinner size={12} /> : <Trash2 size={13} />}
                <span>Delete Selected ({selectedWorkspaceIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* ── WORKSPACE CARDS GRID ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size={30} color="var(--accent)" />
            <p className="text-xs font-mono font-medium" style={{ color: 'var(--muted)' }}>
              LOADING WORKSPACES…
            </p>
          </div>
        ) : workspaces.length === 0 ? (
          /* Initial empty state when user has zero workspaces */
          <div className="py-16 text-center animate-fade-in flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)' }}>
              <FolderOpen size={24} className="text-[var(--muted)]" />
            </div>
            <h2 className="text-base font-extrabold mb-1" style={{ color: 'var(--text)' }}>
              No workspaces yet
            </h2>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
              Get started by creating your first workspace or joining an existing one.
            </p>
            <button
              onClick={() => openNewForm()}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-xs font-bold btn-physical-primary cursor-pointer"
            >
              <Plus size={14} /> Create Workspace
            </button>
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          /* Filter zero-match state: Displays inline directly in the UI instead of a modal box */
          <div
            className="p-8 rounded-xl border border-dashed text-center animate-fade-in my-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Search size={18} className="text-[var(--muted)]" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
              No workspaces match your search or filter
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              No workspaces found {searchQuery ? <span>for &ldquo;<strong className="text-[var(--accent)]">{searchQuery}</strong>&rdquo;</span> : null}
              {filterType !== 'all' ? <span> under <strong className="capitalize text-[var(--accent)]">{filterType}</strong></span> : null}.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterType('all'); }}
              className="btn-physical-surface text-xs py-1.5 px-4 cursor-pointer inline-flex items-center gap-1.5 font-bold"
            >
              <X size={12} />
              <span>Clear Filter &amp; Show All ({workspaces.length})</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWorkspaces.map(ws => {
              const wsType = (ws.type || 'educational') as WorkspaceType;
              const meta = typeDetails[wsType] || typeDetails.educational;
              const TypeIcon = meta.icon;
              const isSelected = selectedWorkspaceIds.includes(ws.id);
              const isDeletingThis = deletingWorkspaceId === ws.id;

              return (
                <div
                  key={ws.id}
                  onClick={() => handleOpen(ws)}
                  className={`skeuo-card group cursor-pointer flex flex-col justify-between transition-all ${isSelected ? 'border-[var(--accent)] ring-2 ring-[var(--accent-subtle)]' : ''}`}
                  style={{
                    opacity: isDeletingThis ? 0.4 : 1,
                    minHeight: 210,
                  }}
                >
                  {/* Card Header Strip */}
                  <div className="card-header-tab">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => toggleSelectWorkspace(ws.id, e)}
                        className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer"
                        style={{
                          background: isSelected ? 'var(--accent)' : 'var(--surface)',
                          borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                          color: '#ffffff',
                        }}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </button>

                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono uppercase"
                        style={{ background: meta.bgColor, color: meta.color, border: `1px solid ${meta.borderColor}` }}
                      >
                        <TypeIcon size={10} />
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => generateQuickInvite(ws.id, e)}
                        className="w-7 h-7 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer bg-transparent border-none"
                        title={copiedId === ws.id ? 'Invite Link Copied!' : 'Copy Invite Link'}
                      >
                        {copiedId === ws.id ? <Check size={13} className="text-emerald-500" /> : <UserPlus size={13} />}
                      </button>
                      <button
                        onClick={e => deleteWorkspace(ws.id, e)}
                        disabled={isDeletingThis}
                        className="w-7 h-7 rounded flex items-center justify-center text-[var(--muted)] hover:text-red-500 transition-colors cursor-pointer bg-transparent border-none"
                        title="Delete Workspace"
                      >
                        {isDeletingThis ? <Spinner size={12} /> : <Trash2 size={13} />}
                      </button>
                      <span className="anchor-dot ml-0.5" style={{ width: 6, height: 6 }} />
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        className="font-extrabold text-base tracking-tight group-hover:text-[var(--accent)] transition-colors line-clamp-1 mb-1.5"
                        style={{ color: 'var(--text)' }}
                      >
                        {ws.name}
                      </h3>

                      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                        {ws.description || meta.desc}
                      </p>
                    </div>

                    {/* Bottom Metadata & Open IDE trigger */}
                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 font-mono" style={{ color: 'var(--muted)' }}>
                        <span className="truncate max-w-[80px]">{ws.id}</span>
                        {ws.updatedAt && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {timeAgo(ws.updatedAt)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] group-hover:translate-x-0.5 transition-transform">
                        <span>Open IDE</span>
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
