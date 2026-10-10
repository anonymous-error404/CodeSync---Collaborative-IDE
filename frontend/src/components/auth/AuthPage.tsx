import { useState, useEffect, type FormEvent } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff,
  Sun, Moon, Code2, Terminal, AlertCircle,
  CheckCircle2, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authService } from '../../services/authService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Tab = 'login' | 'register';

const STRENGTH_CHECKS = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  const passed = STRENGTH_CHECKS.filter(c => c.test(password)).length;
  const colors = ['bg-[var(--border)]', 'bg-[var(--error)]', 'bg-[var(--warning)]', 'bg-[var(--success)]'];
  const barColor = passed === 0 ? 'bg-[var(--border)]' : colors[passed];
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {STRENGTH_CHECKS.map((_, i) => (
          <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${i < passed ? barColor : 'bg-[var(--border)]'}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {STRENGTH_CHECKS.map(check => (
          <span key={check.label} className="flex items-center gap-1 text-[11px] transition-colors duration-200"
            style={{ color: check.test(password) ? 'var(--success)' : 'var(--muted)' }}>
            <CheckCircle2 size={9} />{check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const CODE_PREVIEW = `// CodeSync — real-time collaboration
import { useWorkspace } from '@codesync/core';

async function main() {
  const ws = await useWorkspace({
    id: 'ws-collab-2026',
    users: ['alice', 'bob'],
  });

  ws.on('change', (delta) => {
    applyDelta(editor, delta);
    broadcastToRoom(delta);
  });

  await ws.connect();
  console.log('Connected');
}

main();`;

function getLineColor(line: string): string {
  if (line.startsWith('//')) return 'var(--muted)';
  if (/\b(import|async|await|const|function|return)\b/.test(line)) return '#79c0ff';
  if (/'[^']*'|"[^"]*"|`[^`]*`/.test(line)) return '#a5d6ff';
  return 'var(--text-secondary)';
}

function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      style={{ width: '42%', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
      <div className="absolute inset-0 opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(47,129,247,0.08)' }} />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--accent)' }}>
            <Code2 size={18} color="#fff" />
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--text)' }}>CodeSync</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Collaborative IDE</div>
          </div>
        </div>
        <h2 className="text-2xl font-bold leading-snug mb-3" style={{ color: 'var(--text)' }}>
          Code together,<br />ship faster.
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Real-time collaborative IDE with Docker-powered code execution. Write, run, and debug with your team.
        </p>
      </div>
      <div className="relative z-10">
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
            </div>
            <div className="flex items-center gap-1.5 ml-2 text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              <Terminal size={11} />workspace.ts
            </div>
          </div>
          <pre className="p-4 text-xs leading-relaxed overflow-x-auto" style={{ fontFamily: 'var(--font-mono)', margin: 0 }}>
            <code>
              {CODE_PREVIEW.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none w-7 shrink-0 text-right pr-3" style={{ color: 'var(--border)' }}>{i + 1}</span>
                  <span style={{ color: getLineColor(line) }}>{line || '\u00A0'}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            Connected &middot; 2 collaborators
          </span>
          <span>TypeScript</span>
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [oauthUnconfigured, setOauthUnconfigured] = useState(false);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const unconf = params.get('oauth_unconfigured');
    if (err) {
      setGlobalError(decodeURIComponent(err));
      if (unconf === 'true') {
        setOauthUnconfigured(true);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('oauth_unconfigured');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearState = () => { setGlobalError(''); setErrors({}); setShowPassword(false); };
  const switchTab = (t: Tab) => { setTab(t); clearState(); };

  const validateLogin = () => {
    const e: Record<string, string> = {};
    if (!loginEmail.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) e.email = 'Enter a valid email';
    if (!loginPassword) e.password = 'Password is required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const validateRegister = () => {
    const e: Record<string, string> = {};
    if (!regUsername.trim()) e.username = 'Username is required';
    else if (regUsername.length < 3) e.username = 'At least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) e.username = 'Letters, numbers, _ only';
    if (!regEmail.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) e.email = 'Enter a valid email';
    if (!regPassword) e.password = 'Password is required';
    else if (regPassword.length < 8) e.password = 'At least 8 characters';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setIsLoading(true); setGlobalError('');
    const err = await login({ email: loginEmail.trim(), password: loginPassword });
    if (err) setGlobalError(err);
    setIsLoading(false);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setIsLoading(true); setGlobalError('');
    const err = await register({ username: regUsername.trim(), email: regEmail.trim(), password: regPassword });
    if (err) setGlobalError(err);
    setIsLoading(false);
  };

  return (
    <div className="flex" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <button onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}>
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <LeftPanel />

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--accent)' }}>
            <Code2 size={16} color="#fff" />
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--text)' }}>CodeSync</span>
        </div>

        <div className="w-full animate-fade-in" style={{ maxWidth: 360 }}>
          <div className="mb-6">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {tab === 'login' ? 'Sign in to your CodeSync workspace' : 'Start collaborating in minutes'}
            </p>
          </div>

          <div className="flex mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            {(['login', 'register'] as Tab[]).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                className="flex-1 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer"
                style={{ background: 'transparent', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--muted)', marginBottom: -1 }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {globalError && (
            <div className="flex flex-col gap-2 p-3 rounded-md mb-4 text-sm"
              style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}>
              <div className="flex items-start gap-2.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{globalError}</span>
              </div>
              {oauthUnconfigured && (
                <button
                  type="button"
                  onClick={() => authService.googleAuthDemo()}
                  className="mt-1 py-1 px-2.5 rounded text-xs font-semibold self-start transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  ⚡ Test with Demo Google Account
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => authService.googleAuth()}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-lg text-sm font-medium transition-all mb-4"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>or continue with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input label="Email" type="email" autoComplete="email" autoFocus
                leftIcon={<Mail size={14} />} placeholder="you@example.com"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)} error={errors.email} />
              <Input label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                leftIcon={<Lock size={14} />} placeholder="Your password"
                value={loginPassword} onChange={e => setLoginPassword(e.target.value)} error={errors.password}
                rightElement={
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                } />
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} className="mt-2">
                Sign In <ChevronRight size={14} />
              </Button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <Input label="Username" type="text" autoComplete="username" autoFocus
                leftIcon={<User size={14} />} placeholder="your_username"
                value={regUsername} onChange={e => setRegUsername(e.target.value)} error={errors.username} />
              <Input label="Email" type="email" autoComplete="email"
                leftIcon={<Mail size={14} />} placeholder="you@example.com"
                value={regEmail} onChange={e => setRegEmail(e.target.value)} error={errors.email} />
              <div>
                <Input label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  leftIcon={<Lock size={14} />} placeholder="Create a strong password"
                  value={regPassword} onChange={e => setRegPassword(e.target.value)} error={errors.password}
                  rightElement={
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  } />
                {regPassword && <PasswordStrength password={regPassword} />}
              </div>
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} className="mt-2">
                Create Account <ChevronRight size={14} />
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 }}>
              {tab === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
