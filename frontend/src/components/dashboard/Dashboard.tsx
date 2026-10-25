import { useState, useEffect, useRef } from 'react';
import {
  Plus, FolderOpen, Sun, Moon, LogOut, Clock, Trash2, LayoutGrid, UserPlus, Link2,
  GraduationCap, Briefcase, Trophy, Check, Crown, Terminal, Sparkles, Eye,
  Shield, X
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
    bgColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    roles: 'Teacher (Host) & Students',
    desc: 'Live classroom instruction with WebRTC voice lectures, student editor locking, focus mode, and hand raising.',
    features: ['Live Voice Lecture Broadcast', 'Editor Lock & Focus Follow Mode', 'Hand Raising & Help Requests'],
  },
  professional: {
    label: 'Professional',
    icon: Briefcase,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    roles: 'Admin, Developer & Tester',
    desc: 'Production team environment with peer code collaboration, granular file/line locking, and collaborative code reviews.',
    features: ['Multi-Cursor Real-Time Sync', 'Granular File & Line Locking', 'Kanban Tasks & Code Reviews'],
  },
  competitive: {
    label: 'Competitive',
    icon: Trophy,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    roles: 'Admin (View & Comment) & Team Members (Edit)',
    desc: 'Hackathon team workspaces. Admin can view and comment only across teams. Only allowlisted team members can enter (Gmail scoped) with full edit access.',
    features: ['Admin View & Inline Line Comments', 'Allowed Emails Scoped Team Access', 'Hackathon Real-Time Environment'],
  },
};

const PROJECT_TEMPLATES_LIST = [
  { id: 'blank', label: 'Blank Project', desc: 'Clean workspace with README.md', badge: 'Empty' },
  { id: 'node-express', label: 'Node.js Express', desc: 'REST server with Express & package.json', badge: 'Node.js' },
  { id: 'python-flask', label: 'Python Flask', desc: 'Flask web app with requirements.txt', badge: 'Flask' },
  { id: 'python-script', label: 'Python Script', desc: 'Starter main.py script runner', badge: 'Python' },
  { id: 'java-maven', label: 'Java Maven', desc: 'Java 21 project with pom.xml', badge: 'Java' },
  { id: 'react-vite', label: 'React + Vite', desc: 'React 19 single-page app structure', badge: 'React' },
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
  const [allowedEmailsList, setAllowedEmailsList] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState('');
  const [createError, setCreateError] = useState('');
  const newNameRef = useRef<HTMLInputElement>(null);

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

  // Search registered CodeSync users as admin types
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

    // Verify user exists on CodeSync
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
          template: selectedTemplate,
        }),
      });
      const d = await res.json();
      if (d.success && d.workspace) {
        setWorkspaces(prev => [d.workspace, ...prev]);
        setShowNew(false);
        setNewName('');
        setAllowedEmailsList([]);
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
    if (selectedWorkspaceIds.length === workspaces.length) {
      setSelectedWorkspaceIds([]);
    } else {
      setSelectedWorkspaceIds(workspaces.map(w => w.id));
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
        alert('Invite link copied to clipboard!');
      } else {
        alert('Failed to generate invite');
      }
    } catch {
      alert('Failed to generate invite');
    }
  };

  const openNewForm = () => {
    setShowNew(true);
    setShowJoin(false);
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex items-center justify-between" style={{ height: 68 }}>

          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoImg}
              alt="CodeSync"
              className="w-10 h-10 rounded-xl object-contain shrink-0 shadow-sm transition-transform hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--text)' }}>CodeSync</span>
              <span className="hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full items-center gap-1"
                style={{ background: 'rgba(47,129,247,0.12)', color: 'var(--accent)', border: '1px solid rgba(47,129,247,0.25)' }}>
                Cloud IDE
              </span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)' }}>
                  {user.username.charAt(0)}
                </div>
                <span className="text-sm font-semibold hidden sm:inline" style={{ color: 'var(--text)' }}>
                  {user.username}
                </span>
              </div>
            )}

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:bg-[var(--surface-2)]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              title="Toggle theme">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Logout */}
            <button onClick={logout}
              className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all hover:bg-[var(--error-bg)]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--error)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
              title="Sign out">
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14">

        {/* ── Hero / Page Title Row ── */}
        <div className="flex items-start sm:items-center justify-between mb-8 flex-col sm:flex-row gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: 'rgba(47,129,247,0.15)', color: 'var(--accent)', border: '1px solid rgba(47,129,247,0.3)' }}>
                <LayoutGrid size={20} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                My Workspaces
              </h1>
            </div>
            <p className="text-base sm:text-lg max-w-2xl" style={{ color: 'var(--muted)' }}>
              Create isolated Docker development environments, collaborate with remote cursors, or launch intelligent whiteboard sessions.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <button
              onClick={openJoinForm}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 h-11 rounded-xl text-base font-medium transition-all"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            >
              <Link2 size={18} />
              <span>Join Workspace</span>
            </button>

            <button
              onClick={openNewForm}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 h-11 rounded-xl text-base font-semibold shadow-lg transition-all"
              style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>New Workspace</span>
            </button>
          </div>
        </div>

        {/* ── Join workspace inline form ── */}
        {showJoin && (
          <div className="rounded-2xl p-7 sm:p-8 mb-10 shadow-2xl animate-fade-in"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)' }}>
            <div className="flex items-center gap-3 mb-2">
              <Link2 size={20} style={{ color: 'var(--accent)' }} />
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Join Workspace with Link or Code</p>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              Paste an invite link (e.g. <code>http://localhost:5173/?join=51b55f9f-...</code>) or the invite code shared by your teammate.
            </p>

            {joinError && (
              <div className="p-3.5 rounded-xl text-sm mb-4 flex items-center gap-2"
                style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
                <span>{joinError}</span>
              </div>
            )}

            <div className="flex gap-3.5 flex-wrap items-center">
              <input
                ref={joinInputRef}
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value); setJoinError(''); }}
                placeholder="Paste invite link or code (e.g. http://localhost:5173/?join=... or 51b55f9f-...)"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleJoinWorkspace();
                  if (e.key === 'Escape') { setShowJoin(false); setJoinInput(''); setJoinError(''); }
                }}
                className="flex-1 h-12 px-5 rounded-xl text-base focus:outline-none min-w-0 shadow-inner"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', minWidth: 280 }}
              />
              <button
                onClick={handleJoinWorkspace}
                disabled={joining}
                className="flex items-center gap-2 px-6 h-12 rounded-xl text-base font-semibold shadow-md transition-all"
                style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: joining ? 'not-allowed' : 'pointer' }}
              >
                {joining ? <Spinner size={16} /> : <Link2 size={16} />}
                <span>Join Workspace</span>
              </button>
              <button
                onClick={() => { setShowJoin(false); setJoinInput(''); setJoinError(''); }}
                className="px-5 h-12 rounded-xl text-base font-medium transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── New workspace inline form ── */}
        {showNew && (
          <div className="rounded-2xl p-7 sm:p-8 mb-10 shadow-2xl animate-fade-in"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)' }}>
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Sparkles size={20} style={{ color: 'var(--accent)' }} />
                <p className="font-extrabold text-xl" style={{ color: 'var(--text)' }}>Create a New Workspace</p>
              </div>
              <p className="text-sm sm:text-base" style={{ color: 'var(--muted)' }}>
                Select the workspace workflow type that fits your goals:
              </p>
            </div>

            {createError && (
              <div className="p-3.5 rounded-xl text-sm mb-5 flex items-center gap-2"
                style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
                <span>{createError}</span>
              </div>
            )}

            {/* 3 Workspace Type Selectable Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-6">
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
                    className="p-5 sm:p-6 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between relative shadow-sm"
                    style={{
                      background: isSelected ? item.bgColor : 'var(--surface-2)',
                      border: `2px solid ${isSelected ? item.color : 'var(--border)'}`,
                      boxShadow: isSelected ? `0 0 20px ${item.bgColor}` : 'none',
                      transform: isSelected ? 'scale(1.01)' : 'none',
                    }}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md"
                        style={{ background: item.color }}>
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-3.5 mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ background: item.bgColor, color: item.color, border: `1px solid ${item.borderColor}` }}>
                          <ItemIcon size={22} />
                        </div>
                        <div>
                          <p className="font-bold text-base sm:text-lg" style={{ color: 'var(--text)' }}>{item.label}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5"
                            style={{ background: item.bgColor, color: item.color, border: `1px solid ${item.borderColor}` }}>
                            {item.roles}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
                        {item.desc}
                      </p>

                      <div className="space-y-1.5 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        {item.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
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

            {/* Competitive Workspace: Allowed Emails Input with Registered Account Autocomplete */}
            {selectedType === 'competitive' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold" style={{ color: 'var(--text)' }}>
                    Add Registered Team Members (Gmail / email scoped):
                  </label>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {allowedEmailsList.length} member{allowedEmailsList.length === 1 ? '' : 's'} added
                  </span>
                </div>

                {/* Added Members Chips */}
                {allowedEmailsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 rounded-xl border"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                    {allowedEmailsList.map(email => {
                      const isMe = user?.email && email.toLowerCase() === user.email.toLowerCase();
                      return (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium"
                          style={{
                            background: isMe ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isMe ? '#3b82f6' : '#f59e0b',
                            border: `1px solid ${isMe ? 'rgba(59, 130, 246, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                          }}
                        >
                          <Shield size={11} />
                          <span>{email}</span>
                          {isMe ? (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa' }}
                            >
                              Admin (You)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveAllowedEmail(email)}
                              className="hover:text-red-400 p-0.5 ml-0.5 rounded cursor-pointer border-none bg-transparent"
                              title="Remove email"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Autocomplete Search Input */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={e => {
                          setMemberSearchQuery(e.target.value);
                          setMemberSearchError('');
                        }}
                        onFocus={() => {
                          if (memberSuggestions.length > 0) setShowMemberDropdown(true);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAllowedEmail();
                          }
                          if (e.key === 'Escape') {
                            setShowMemberDropdown(false);
                          }
                        }}
                        placeholder="Type registered user's email or username to search…"
                        className="w-full h-11 px-4 text-sm rounded-xl focus:outline-none shadow-inner"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                      {isSearchingMembers && (
                        <span className="absolute right-3.5 top-3.5">
                          <Spinner size={14} />
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!memberSearchQuery.trim() || isSearchingMembers}
                      onClick={() => handleAddAllowedEmail()}
                      className="px-4 h-11 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
                      style={{ background: '#f59e0b', color: '#000', border: 'none' }}
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Dropdown of matching registered users */}
                  {showMemberDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border shadow-2xl overflow-hidden animate-fade-in"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                        style={{ background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--border)' }}>
                        Registered CodeSync Users
                      </div>
                      {memberSuggestions.length === 0 ? (
                        <div className="p-3 text-center text-xs" style={{ color: 'var(--error)' }}>
                          No registered user found for &quot;{memberSearchQuery}&quot;. Team members must have an account on CodeSync.
                        </div>
                      ) : (
                        memberSuggestions.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              handleAddAllowedEmail(u.email);
                            }}
                            className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)] transition-colors border-b last:border-b-0"
                            style={{
                              borderColor: 'var(--border)',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0"
                                style={{ background: 'var(--accent)', color: '#fff' }}
                              >
                                {u.username[0] || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                                  {u.username}
                                </div>
                                <div className="text-[11px] font-mono truncate" style={{ color: 'var(--muted)' }}>
                                  {u.email}
                                </div>
                              </div>
                            </div>
                            <span
                              className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                              style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                            >
                              + Select
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {memberSearchError && (
                  <p className="text-xs mt-1.5 text-red-400 font-medium">{memberSearchError}</p>
                )}

                <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
                  Only users logged in with these registered emails will be permitted into this hackathon workspace. The workspace creator is Admin (can view & comment only).
                </p>
              </div>
            )}

            {/* Starter Project Template Selector */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                Starter Project Template:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {PROJECT_TEMPLATES_LIST.map(tmpl => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className="p-3 rounded-xl text-left transition-all flex flex-col justify-between border"
                      style={{
                        background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg)',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        boxShadow: isSelected ? '0 0 12px rgba(59, 130, 246, 0.2)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono uppercase"
                          style={{
                            background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                            color: isSelected ? '#fff' : 'var(--muted)',
                          }}
                        >
                          {tmpl.badge}
                        </span>
                        {isSelected && <Check size={12} style={{ color: 'var(--accent)' }} />}
                      </div>
                      <div className="text-xs font-semibold truncate" style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                        {tmpl.label}
                      </div>
                      <div className="text-[10px] leading-tight mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
                        {tmpl.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input + Action row */}
            <div className="flex gap-3.5 flex-wrap items-center">
              <input
                ref={newNameRef}
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(''); }}
                placeholder={
                  selectedType === 'educational'
                    ? 'e.g. CS101: Web & Algorithms Classroom'
                    : selectedType === 'professional'
                    ? 'e.g. Microservices Production Suite'
                    : 'e.g. Hackathon Team ByteSpeed'
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') createWorkspace();
                  if (e.key === 'Escape') {
                    setShowNew(false);
                    setNewName('');
                    setAllowedEmailsList([]);
                    setMemberSearchQuery('');
                    setMemberSuggestions([]);
                    setMemberSearchError('');
                    setCreateError('');
                  }
                }}
                className="flex-1 h-12 px-5 rounded-xl text-base focus:outline-none min-w-0 shadow-inner"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', minWidth: 280 }}
              />
              <button
                onClick={createWorkspace}
                disabled={creating}
                className="flex items-center gap-2 px-7 h-12 rounded-xl text-base font-semibold shadow-lg transition-all"
                style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
              >
                {creating ? <Spinner size={16} /> : <Plus size={18} strokeWidth={2.5} />}
                <span>Create {typeDetails[selectedType].label} Workspace</span>
              </button>
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
                className="px-5 h-12 rounded-xl text-base font-medium transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Workspace grid / Empty State ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size={32} />
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Loading workspaces…</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in" style={{ color: 'var(--muted)' }}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <FolderOpen size={40} className="opacity-40" style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2.5" style={{ color: 'var(--text)' }}>No workspaces yet</h2>
            <p className="text-base max-w-md mb-8 leading-relaxed">
              Create your first workspace or join an existing one with an invite link to get started.
            </p>
            <div className="flex items-center gap-3.5">
              <button
                onClick={openNewForm}
                className="flex items-center gap-2 px-6 h-11 rounded-xl text-base font-semibold shadow-md transition-all"
                style={{ background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Create Workspace</span>
              </button>
              <button
                onClick={openJoinForm}
                className="flex items-center gap-2 px-5 h-11 rounded-xl text-base font-medium transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <Link2 size={16} />
                <span>Join Workspace</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Workspaces Section (when workspaces exist) ── */
          <div>
            {/* Workspace Controls & Bulk Selection Bar */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 mb-5 p-3 sm:p-3.5 rounded-2xl border transition-all"
              style={{
                background: 'var(--surface)',
                borderColor: selectedWorkspaceIds.length > 0 ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Select All Checkbox Button */}
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border"
                  style={{
                    background: selectedWorkspaceIds.length === workspaces.length ? 'var(--accent)' : 'var(--surface-2)',
                    borderColor: selectedWorkspaceIds.length === workspaces.length ? 'var(--accent)' : 'var(--border)',
                    color: selectedWorkspaceIds.length === workspaces.length ? '#ffffff' : 'var(--text)',
                  }}
                  title={selectedWorkspaceIds.length === workspaces.length ? 'Deselect all' : 'Select all workspaces'}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-all"
                    style={{
                      background: selectedWorkspaceIds.length > 0 ? (selectedWorkspaceIds.length === workspaces.length ? '#ffffff' : 'var(--accent)') : 'transparent',
                      border: `1.5px solid ${selectedWorkspaceIds.length === workspaces.length ? '#ffffff' : 'var(--border)'}`,
                      color: selectedWorkspaceIds.length === workspaces.length ? 'var(--accent)' : '#ffffff',
                    }}
                  >
                    {selectedWorkspaceIds.length === workspaces.length && <Check size={11} strokeWidth={3} />}
                    {selectedWorkspaceIds.length > 0 && selectedWorkspaceIds.length < workspaces.length && (
                      <div className="w-2 h-0.5 rounded-full" style={{ background: '#ffffff' }} />
                    )}
                  </div>
                  <span>Select All ({workspaces.length})</span>
                </button>

                {/* Selected Counter Pill */}
                {selectedWorkspaceIds.length > 0 && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-lg font-mono font-medium animate-fade-in"
                    style={{
                      background: 'rgba(47, 129, 247, 0.15)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(47, 129, 247, 0.3)',
                    }}
                  >
                    {selectedWorkspaceIds.length} of {workspaces.length} selected
                  </span>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedWorkspaceIds.length > 0 && (
                <div className="flex items-center gap-2.5 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all border"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border)',
                      color: 'var(--muted)',
                    }}
                  >
                    Deselect All
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm"
                    style={{
                      background: 'var(--error)',
                      color: '#ffffff',
                      border: 'none',
                      opacity: isBulkDeleting ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
                  >
                    {isBulkDeleting ? <Spinner size={13} /> : <Trash2 size={13} />}
                    <span>Delete Selected ({selectedWorkspaceIds.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* ── Workspaces Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {workspaces.map(ws => {
                const wsType = (ws.type || 'educational') as WorkspaceType;
                const meta = typeDetails[wsType] || typeDetails.educational;
                const TypeIcon = meta.icon;
                const isSelected = selectedWorkspaceIds.includes(ws.id);
                const isDeletingThis = deletingWorkspaceId === ws.id;

                return (
                  <div
                    key={ws.id}
                    onClick={() => handleOpen(ws)}
                    className="group rounded-2xl cursor-pointer transition-all duration-200 relative flex flex-col justify-between shadow-md"
                    style={{
                      background: isSelected ? 'var(--surface-2)' : 'var(--surface)',
                      border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      boxShadow: isSelected ? '0 0 16px rgba(47, 129, 247, 0.25)' : 'none',
                      padding: 26,
                      minHeight: 210,
                      opacity: isDeletingThis ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = meta.color;
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 25px rgba(0,0,0,0.35)`;
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = isSelected ? '0 0 16px rgba(47, 129, 247, 0.25)' : 'none';
                    }}
                  >
                    {/* Actions (hover) */}
                    <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all z-10">
                      <button
                        onClick={e => generateQuickInvite(ws.id, e)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm"
                        style={{ color: 'var(--muted)', cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = meta.color; (e.currentTarget as HTMLButtonElement).style.borderColor = meta.color; e.stopPropagation(); }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                        title="Copy invite link"
                      >
                        <UserPlus size={15} />
                      </button>
                      <button
                        onClick={e => deleteWorkspace(ws.id, e)}
                        disabled={isDeletingThis}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all shadow-sm"
                        style={{ color: 'var(--muted)', cursor: isDeletingThis ? 'not-allowed' : 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--error)'; e.stopPropagation(); }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                        title="Delete workspace"
                      >
                        {isDeletingThis ? <Spinner size={14} /> : <Trash2 size={15} />}
                      </button>
                    </div>

                    <div>
                      {/* Top Row: Type Badge + Selection Checkbox + Icon */}
                      <div className="flex items-center justify-between mb-4 pr-16">
                        <div className="flex items-center gap-2.5">
                          {/* Checkbox button */}
                          <button
                            type="button"
                            onClick={e => toggleSelectWorkspace(ws.id, e)}
                            className="w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            style={{
                              background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              color: '#ffffff',
                            }}
                            title={isSelected ? 'Deselect workspace' : 'Select workspace'}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </button>

                          <div className="flex items-center justify-center w-11 h-11 rounded-xl shadow-sm"
                            style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}`, color: meta.color }}>
                            <TypeIcon size={20} />
                          </div>
                        </div>

                        <span className="text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5"
                          style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}`, color: meta.color }}>
                          <TypeIcon size={13} />
                          {meta.label}
                        </span>
                      </div>

                    {/* Name */}
                    <h3 className="font-extrabold mb-1.5 truncate text-lg sm:text-xl group-hover:text-[var(--accent)] transition-colors"
                      style={{ color: 'var(--text)' }}>
                      {ws.name}
                    </h3>

                    {/* Description / Roles hint */}
                    <p className="text-xs sm:text-sm truncate mb-4" style={{ color: 'var(--muted)' }}>
                      {ws.description || `${meta.roles}`}
                    </p>
                  </div>

                  {/* ID + timestamp + role */}
                  <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono truncate" style={{ color: 'var(--muted)', maxWidth: 120 }}>{ws.id}</span>
                      {ws.myRole && (
                        <span className="text-xs px-2 py-0.5 rounded font-mono font-medium truncate"
                          style={{
                            background:
                              wsType === 'competitive'
                                ? ws.myRole === 'team_member'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(234, 179, 8, 0.15)'
                                : ws.myRole === 'teacher'
                                ? 'rgba(168, 85, 247, 0.15)'
                                : ws.myRole === 'student'
                                ? 'rgba(56, 189, 248, 0.15)'
                                : ws.myRole === 'developer'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : ws.myRole === 'tester'
                                ? 'rgba(244, 63, 94, 0.15)'
                                : ws.myRole === 'team_leader' || ws.myRole === 'owner' || ws.myRole === 'admin'
                                ? 'rgba(88, 166, 255, 0.15)'
                                : 'var(--surface-2)',
                            color:
                              wsType === 'competitive'
                                ? ws.myRole === 'team_member'
                                  ? '#10b981'
                                  : '#eab308'
                                : ws.myRole === 'teacher'
                                ? '#c084fc'
                                : ws.myRole === 'student'
                                ? '#38bdf8'
                                : ws.myRole === 'developer'
                                ? '#10b981'
                                : ws.myRole === 'tester'
                                ? '#f43f5e'
                                : ws.myRole === 'team_leader' || ws.myRole === 'owner' || ws.myRole === 'admin'
                                ? '#58a6ff'
                                : 'var(--text)',
                            border: '1px solid var(--border)',
                          }}>
                          {wsType === 'competitive' && (ws.myRole === 'admin' || ws.myRole === 'owner') ? (
                            <span className="flex items-center gap-1"><Crown size={12} /> Admin (Comment)</span>
                          ) : ws.myRole === 'team_member' ? (
                            <span className="flex items-center gap-1"><Terminal size={12} /> Team Member</span>
                          ) : ws.myRole === 'teacher' ? (
                            <span className="flex items-center gap-1"><GraduationCap size={12} /> Teacher</span>
                          ) : ws.myRole === 'student' ? (
                            <span className="flex items-center gap-1"><GraduationCap size={12} /> Student</span>
                          ) : ws.myRole === 'team_leader' ? (
                            <span className="flex items-center gap-1"><Crown size={12} /> Team Lead</span>
                          ) : ws.myRole === 'developer' ? (
                            <span className="flex items-center gap-1"><Terminal size={12} /> Developer</span>
                          ) : ws.myRole === 'tester' ? (
                            <span className="flex items-center gap-1"><Eye size={12} /> Tester</span>
                          ) : ws.myRole === 'owner' || ws.myRole === 'admin' ? (
                            <span className="flex items-center gap-1"><Crown size={12} /> Admin</span>
                          ) : ws.myRole === 'editor' ? (
                            <span className="flex items-center gap-1"><Terminal size={12} /> Edit</span>
                          ) : ws.myRole === 'viewer' ? (
                            <span className="flex items-center gap-1"><Eye size={12} /> View</span>
                          ) : (
                            ws.myRole
                          )}
                        </span>
                      )}
                    </div>
                    {(ws.updatedAt ?? ws.createdAt) && (
                      <span className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: 'var(--muted)' }}>
                        <Clock size={12} />{timeAgo(ws.updatedAt ?? ws.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
