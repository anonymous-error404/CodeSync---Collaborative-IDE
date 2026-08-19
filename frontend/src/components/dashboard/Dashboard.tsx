import { useState, useEffect, useRef } from 'react';
import { Plus, Code2, FolderOpen, Sun, Moon, LogOut, Clock, Trash2, LayoutGrid } from 'lucide-react';
import type { Workspace } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

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

interface Props { onOpen: (ws: Workspace) => void; }

export function Dashboard({ onOpen }: Props) {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const newNameRef = useRef<HTMLInputElement>(null);

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

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/workspaces`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: newName.trim() }),
      });
      const d = await res.json();
      if (d.success && d.workspace) {
        setWorkspaces(prev => [d.workspace, ...prev]);
        setShowNew(false);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkspace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this workspace and all its files?')) return;
    await fetch(`${BASE_URL}/api/workspaces/${id}`, { method: 'DELETE', headers: authHeaders });
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  };

  const openNewForm = () => {
    setShowNew(true);
    setTimeout(() => newNameRef.current?.focus(), 50);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between" style={{ height: 60 }}>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--accent)' }}>
              <Code2 size={17} color="#fff" />
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>CodeSync</span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm hidden sm:block" style={{ color: 'var(--muted)' }}>
                {user.username}
              </span>
            )}

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
              title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Logout — clearly visible */}
            <button onClick={logout}
              className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--error)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
              title="Sign out">
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-8 py-12">

        {/* Page title row */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <LayoutGrid size={20} style={{ color: 'var(--accent)' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>My Workspaces</h1>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>
              Open a workspace or create a new one to start coding.
            </p>
          </div>
          <Button onClick={openNewForm} size="lg">
            <Plus size={16} />New Workspace
          </Button>
        </div>

        {/* ── New workspace inline form ── */}
        {showNew && (
          <div className="rounded-xl p-6 mb-8 animate-fade-in"
            style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
            <p className="font-semibold mb-4" style={{ color: 'var(--text)', fontSize: 15 }}>Create New Workspace</p>
            <div className="flex gap-3 flex-wrap items-center">
              <input
                ref={newNameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. My Python Project"
                onKeyDown={e => { if (e.key === 'Enter') createWorkspace(); if (e.key === 'Escape') { setShowNew(false); setNewName(''); } }}
                className="flex-1 h-10 px-4 rounded-lg text-sm focus:outline-none min-w-0"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', minWidth: 240 }}
              />
              <Button onClick={createWorkspace} isLoading={creating} size="md">Create</Button>
              <Button variant="ghost" onClick={() => { setShowNew(false); setNewName(''); }} size="md">Cancel</Button>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              You can create any file type (Python, JavaScript, Java…) inside the workspace.
            </p>
          </div>
        )}

        {/* ── Workspace grid ── */}
        {loading ? (
          <div className="flex justify-center py-24"><Spinner size={28} /></div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32" style={{ color: 'var(--muted)' }}>
            <FolderOpen size={48} className="mb-5 opacity-30" />
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>No workspaces yet</p>
            <p style={{ fontSize: 15 }}>Create your first workspace to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspaces.map(ws => (
              <div
                key={ws.id}
                onClick={() => onOpen(ws)}
                className="group rounded-xl cursor-pointer transition-all duration-150 relative"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 24, minHeight: 160 }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Delete button (hover) */}
                <button
                  onClick={e => deleteWorkspace(ws.id, e)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg transition-all"
                  style={{ color: 'var(--muted)', cursor: 'pointer', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--error)'; e.stopPropagation(); }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                >
                  <Trash2 size={13} />
                </button>

                {/* Workspace icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <Code2 size={18} style={{ color: 'var(--accent)' }} />
                </div>

                {/* Name */}
                <p className="font-semibold mb-1 truncate pr-8" style={{ color: 'var(--text)', fontSize: 15 }}>
                  {ws.name}
                </p>

                {/* Description */}
                {ws.description && (
                  <p className="text-sm truncate mb-3" style={{ color: 'var(--muted)' }}>{ws.description}</p>
                )}

                {/* ID + timestamp */}
                <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--muted)', maxWidth: '60%' }}>{ws.id}</span>
                  {(ws.updatedAt ?? ws.createdAt) && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                      <Clock size={11} />{timeAgo(ws.updatedAt ?? ws.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
