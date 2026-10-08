import { useState, useEffect } from 'react';
import { AuthPage } from './components/auth/AuthPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { IDEShell } from './components/ide/IDEShell';
import { JoinWorkspacePage } from './components/ide/JoinWorkspacePage';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './context/AuthContext';
import type { Workspace, WorkspaceRole } from './types';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

export function App() {
  const { user, isLoading } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join') || params.get('code');
    if (code) {
      sessionStorage.setItem('codesync_pending_join', code);
      setJoinCode(code);
    } else {
      const pending = sessionStorage.getItem('codesync_pending_join');
      if (pending) {
        setJoinCode(pending);
      }
    }
  }, []);

  const handleJoined = async (workspaceId: string, role: string) => {
    sessionStorage.removeItem('codesync_pending_join');
    // Clear join code from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.pathname);
    setJoinCode(null);

    let ws: Workspace = { id: workspaceId, name: `Workspace ${workspaceId}`, myRole: role as WorkspaceRole };
    try {
      const token = localStorage.getItem('codesync_token');
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.workspace) {
        ws = { ...data.workspace, myRole: role as WorkspaceRole };
      }
    } catch {}

    setActiveWorkspace(ws);
  };

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <AuthPage />;
  
  if (joinCode) {
    return <JoinWorkspacePage inviteCode={joinCode} onJoined={handleJoined} />;
  }

  if (activeWorkspace) {
    return <IDEShell workspace={activeWorkspace} myRole={activeWorkspace.myRole || 'owner'} onBack={() => setActiveWorkspace(null)} />;
  }
  
  return <Dashboard onOpen={(ws, role) => setActiveWorkspace({ ...ws, myRole: role })} />;
}

export default App;
