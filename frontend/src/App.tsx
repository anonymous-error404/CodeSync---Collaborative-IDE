import { useState } from 'react';
import { AuthPage } from './components/auth/AuthPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { IDEShell } from './components/ide/IDEShell';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './hooks/useAuth';
import type { Workspace } from './types';

export function App() {
  const { user, isLoading } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <AuthPage />;
  if (activeWorkspace) return <IDEShell workspace={activeWorkspace} onBack={() => setActiveWorkspace(null)} />;
  return <Dashboard onOpen={setActiveWorkspace} />;
}

export default App;
