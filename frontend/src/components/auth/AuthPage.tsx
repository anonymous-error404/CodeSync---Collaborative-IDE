import { useState, useEffect, type FormEvent } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff,
  Sun, Moon, AlertCircle,
  CheckCircle2, ChevronRight, Zap
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
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
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < passed ? barColor : 'bg-[var(--border)]'}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {STRENGTH_CHECKS.map(check => (
          <span key={check.label} className="flex items-center gap-1 text-[11px] font-mono transition-colors duration-200"
            style={{ color: check.test(password) ? 'var(--success)' : 'var(--muted)' }}>
            <CheckCircle2 size={10} />{check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TECHNICAL LINE-ART & ISOMETRIC WIREFRAME ILLUSTRATION
   (Faithfully modeled after the reference image style:
    - Bipartite matrix nodes with connector lattice
    - Solid orange-red central hub tile
    - Layered skeuomorphic cards with tabs & anchor dots
    - Wireframe donut chart & telemetry indicators)
   ───────────────────────────────────────────────────────── */
function TechnicalWireframeIllustration() {
  return (
    <div className="relative w-full my-auto py-2">
      <svg
        viewBox="0 0 540 330"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto select-none"
        style={{ filter: 'drop-shadow(0 4px 16px rgba(15,23,42,0.06))' }}
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="techGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="#CBD4E0" opacity="0.6" />
          </pattern>
          {/* Gradient for wireframe card faces */}
          <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F4F6F9" />
          </linearGradient>
          <linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8420C" />
            <stop offset="100%" stopColor="#C9370A" />
          </linearGradient>
        </defs>

        {/* Blueprint background grid */}
        <rect width="540" height="330" fill="url(#techGrid)" rx="14" />

        {/* ── 1. LEFT MATRIX (Runtimes & Containers) ── */}
        {/* Top Header Card (Vibrant Orange Red - like "Plans" in reference image) */}
        <g transform="translate(18, 30)">
          <rect width="84" height="24" rx="4" fill="#E8420C" stroke="#BA3307" strokeWidth="1" />
          <text x="42" y="15" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" textAnchor="middle" letterSpacing="0.04em">RUNTIMES</text>
        </g>
        {/* White Matrix Nodes */}
        <g transform="translate(18, 66)">
          <rect width="84" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="42" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">Node.js 22</text>
        </g>
        <g transform="translate(18, 98)">
          <rect width="84" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="42" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">Python 3.12</text>
        </g>
        <g transform="translate(18, 130)">
          <rect width="84" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="42" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">Rust 1.80</text>
        </g>

        {/* ── 2. MIDDLE MATRIX (Collaboration Modes) ── */}
        {/* Top Header Card (Vibrant Orange Red - like "Currencies" in reference image) */}
        <g transform="translate(126, 30)">
          <rect width="88" height="24" rx="4" fill="#E8420C" stroke="#BA3307" strokeWidth="1" />
          <text x="44" y="15" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" textAnchor="middle" letterSpacing="0.04em">PROTOCOLS</text>
        </g>
        <g transform="translate(126, 66)">
          <rect width="88" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="44" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">WebRTC Mesh</text>
        </g>
        <g transform="translate(126, 98)">
          <rect width="88" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="44" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">OT Delta Sync</text>
        </g>
        <g transform="translate(126, 130)">
          <rect width="88" height="22" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
          <text x="44" y="14" fill="#3D4451" fontSize="9" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">Docker Socket</text>
        </g>

        {/* ── Criss-cross connector lines between Runtimes & Protocols (Matrix lattice) ── */}
        <g stroke="#C2CBD6" strokeWidth="0.8" opacity="0.85">
          <line x1="102" y1="77" x2="126" y2="77" />
          <line x1="102" y1="77" x2="126" y2="109" />
          <line x1="102" y1="109" x2="126" y2="77" />
          <line x1="102" y1="109" x2="126" y2="109" />
          <line x1="102" y1="109" x2="126" y2="141" />
          <line x1="102" y1="141" x2="126" y2="109" />
          <line x1="102" y1="141" x2="126" y2="141" />
        </g>

        {/* ── 3. CENTRAL RED HUB TILE (Matches the red square logo tile in reference image) ── */}
        <g transform="translate(242, 70)">
          {/* Connector path from Protocols matrix to Hub */}
          <path d="M -28 9 H -10 V 26 H 0" fill="none" stroke="#C2CBD6" strokeWidth="1" />
          {/* Hub Card */}
          <rect width="52" height="52" rx="10" fill="url(#hubGrad)" stroke="#BA3307" strokeWidth="1.2" />
          {/* White stylized CodeSync symbol */}
          <path d="M 26 15 L 26 37 M 15 26 L 37 26 M 18 18 L 34 34 M 34 18 L 18 34" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <circle cx="26" cy="26" r="4" fill="#FFFFFF" />
          {/* Anchor dot on right edge connecting outward */}
          <circle cx="52" cy="26" r="4.5" fill="#E8420C" stroke="#FFFFFF" strokeWidth="1.5" />
        </g>

        {/* ── 4. SKEUOMORPHIC STACKED EDITOR & TERMINAL CARDS (Right side of image) ── */}
        {/* Connecting line from Hub to Editor Card */}
        <path d="M 298 96 H 325 C 335 96 340 102 340 110 V 120" fill="none" stroke="#C2CBD6" strokeWidth="1" />
        <circle cx="340" cy="120" r="4" fill="#E8420C" stroke="#FFFFFF" strokeWidth="1.5" />

        {/* Cascading Card 1 (Back Layer - Terminal Node) */}
        <g transform="translate(355, 34)">
          <rect width="165" height="110" rx="8" fill="#F4F6F9" stroke="#D1D8E2" strokeWidth="1" />
          <rect width="165" height="22" rx="8" fill="#E2E7EE" />
          <text x="12" y="14" fill="#64748B" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">TERMINAL / DOCKER</text>
          <circle cx="152" cy="11" r="3.5" fill="#16A34A" />
          {/* Terminal pseudo lines */}
          <line x1="14" y1="36" x2="80" y2="36" stroke="#94A3B8" strokeWidth="1.2" />
          <line x1="14" y1="48" x2="135" y2="48" stroke="#CBD5E1" strokeWidth="1" />
          <line x1="14" y1="60" x2="110" y2="60" stroke="#CBD5E1" strokeWidth="1" />
          <line x1="14" y1="72" x2="95" y2="72" stroke="#CBD5E1" strokeWidth="1" />
        </g>

        {/* Cascading Card 2 (Front Floating Layer - Code Editor Node with skeuomorphic tab) */}
        <g transform="translate(330, 68)">
          {/* Card shadow */}
          <rect x="0" y="0" width="180" height="130" rx="8" fill="url(#cardGrad)" stroke="#D1D8E2" strokeWidth="1.2" />
          {/* Card Header Tab strip */}
          <path d="M 0 8 C 0 3.5 3.5 0 8 0 H 172 C 176.5 0 180 3.5 180 8 V 26 H 0 Z" fill="#EDF1F5" stroke="#D1D8E2" strokeWidth="1" />
          <text x="14" y="17" fill="#191E28" fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">workspace.ts</text>
          <text x="100" y="17" fill="#8892A0" fontSize="8" fontFamily="JetBrains Mono, monospace">[Active]</text>
          {/* Red Anchor Dot on tab edge */}
          <circle cx="180" cy="13" r="4.5" fill="#E8420C" stroke="#FFFFFF" strokeWidth="1.5" />

          {/* Line art code representation */}
          <line x1="14" y1="40" x2="55" y2="40" stroke="#E8420C" strokeWidth="2" strokeLinecap="round" />
          <line x1="62" y1="40" x2="120" y2="40" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
          <line x1="24" y1="52" x2="150" y2="52" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="64" x2="105" y2="64" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="76" x2="135" y2="76" stroke="#E8420C" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <line x1="14" y1="88" x2="60" y2="88" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />

          {/* Simulated remote cursor with badge */}
          <rect x="136" y="70" width="2" height="12" fill="#E8420C" />
          <g transform="translate(138, 62)">
            <rect width="32" height="12" rx="3" fill="#E8420C" />
            <text x="16" y="9" fill="#FFFFFF" fontSize="7" fontWeight="700" fontFamily="Inter, sans-serif" textAnchor="middle">ALICE</text>
          </g>

          {/* Bottom Card Footer strip */}
          <line x1="0" y1="104" x2="180" y2="104" stroke="#E2E7EE" strokeWidth="1" />
          <text x="14" y="119" fill="#7E8A9C" fontSize="8" fontFamily="JetBrains Mono, monospace">UTF-8 · TS 5.4 · 24ms</text>
        </g>

        {/* ── 5. BOTTOM WIREFRAME DONUT & TELEMETRY (Like bottom right of reference image) ── */}
        {/* Wireframe segmented Donut / Ring chart */}
        <g transform="translate(355, 230)">
          {/* Outer circle */}
          <circle cx="36" cy="36" r="32" stroke="#D1D8E2" strokeWidth="12" fill="none" />
          {/* Active orange segment */}
          <circle cx="36" cy="36" r="32" stroke="#E8420C" strokeWidth="12" strokeDasharray="60 140" strokeLinecap="round" fill="none" transform="rotate(-90 36 36)" />
          {/* Inner label */}
          <text x="36" y="34" fill="#191E28" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono, monospace" textAnchor="middle">99.9%</text>
          <text x="36" y="45" fill="#8892A0" fontSize="7" fontWeight="600" fontFamily="Inter, sans-serif" textAnchor="middle">SYNC</text>

          {/* Connected telemetry cards with anchor dot */}
          <line x1="68" y1="28" x2="90" y2="28" stroke="#C2CBD6" strokeWidth="1" />
          <circle cx="90" cy="28" r="3.5" fill="#E8420C" stroke="#FFFFFF" strokeWidth="1.2" />

          <g transform="translate(94, 14)">
            <rect width="65" height="18" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="8" y="12" fill="#E8420C" fontSize="8" fontWeight="800" fontFamily="Inter, sans-serif">▲ +240 req/s</text>
          </g>

          <g transform="translate(94, 38)">
            <rect width="65" height="18" rx="4" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="8" y="12" fill="#16A34A" fontSize="8" fontWeight="800" fontFamily="Inter, sans-serif">▼ 8ms latency</text>
          </g>
        </g>

        {/* ── 6. BOTTOM SERVICE INTEGRATION PILLS (Payment/Integrations row in image) ── */}
        <g transform="translate(18, 180)">
          {/* Line connecting protocols to bottom service row */}
          <path d="M 50 -28 V 8" stroke="#C2CBD6" strokeWidth="1" fill="none" />
          <circle cx="50" cy="8" r="3.5" fill="#E8420C" stroke="#FFFFFF" strokeWidth="1.2" />

          {/* Pills row */}
          <g transform="translate(0, 14)">
            <rect width="70" height="22" rx="11" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="35" y="14" fill="#475163" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono, monospace" textAnchor="middle">GIT_SYNC</text>
          </g>
          <g transform="translate(76, 14)">
            <rect width="70" height="22" rx="11" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="35" y="14" fill="#475163" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono, monospace" textAnchor="middle">WEBRTC_VOICE</text>
          </g>
          <g transform="translate(152, 14)">
            <rect width="70" height="22" rx="11" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="35" y="14" fill="#475163" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono, monospace" textAnchor="middle">WHITEBOARD</text>
          </g>
          <g transform="translate(228, 14)">
            <rect width="60" height="22" rx="11" fill="#FFFFFF" stroke="#D1D8E2" strokeWidth="1" />
            <text x="30" y="14" fill="#8892A0" fontSize="8" fontWeight="500" fontFamily="JetBrains Mono, monospace" textAnchor="middle">+ Docker</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function LeftArchitecturalPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden"
      style={{
        width: '50%',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        backgroundImage: 'var(--grid-pattern)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Top Branding & Version Label */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="CodeSync" className="w-10 h-10 rounded-xl object-contain shrink-0 shadow-sm" />
            <div>
              <div className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--text)' }}>CodeSync</div>
              <div className="text-xs font-mono font-medium" style={{ color: 'var(--muted)' }}>Collaborative IDE Architecture</div>
            </div>
          </div>

          {/* Schematic Version Tag */}
          <span className="schematic-tag">
            <span className="anchor-dot-live" /> v2.4.0 · KERNEL
          </span>
        </div>

        <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight leading-tight mb-2" style={{ color: 'var(--text)' }}>
          High-concurrency collaborative IDE with isolated sandbox execution.
        </h2>
        <p className="text-sm max-w-xl leading-relaxed" style={{ color: 'var(--muted)' }}>
          Engineered for engineering teams, universities, and hackathons with multi-cursor OT sync and native container sandboxes.
        </p>
      </div>

      {/* Center: Technical Line-Art Illustration */}
      <TechnicalWireframeIllustration />

      {/* Bottom: Bento-style Metrics Chips */}
      <div className="relative z-10 grid grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="anchor-dot" />
            <span className="section-label">Latency</span>
          </div>
          <div className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>&lt; 12ms</div>
          <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Peer-to-peer sync</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="anchor-dot" />
            <span className="section-label">Sandboxes</span>
          </div>
          <div className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>Dockerized</div>
          <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Rootless containers</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="anchor-dot" />
            <span className="section-label">Workspaces</span>
          </div>
          <div className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>3 Workflows</div>
          <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Edu, Pro & Hackathon</div>
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    return err ? decodeURIComponent(err) : '';
  });
  const [oauthUnconfigured] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('oauth_unconfigured') === 'true';
  });
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('error') || params.has('oauth_unconfigured')) {
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
      {/* Theme toggle floating switch */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 z-50 flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer btn-physical-surface"
        title="Toggle dark/light theme"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Left Architectural / Technical Line-Art Panel */}
      <LeftArchitecturalPanel />

      {/* Right Panel — Skeuomorphic Form Card Container */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(180,184,196,0.25) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={logoImg} alt="CodeSync" className="w-10 h-10 rounded-xl object-contain shrink-0 shadow-sm" />
          <span className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--text)' }}>CodeSync</span>
        </div>

        {/* Skeuomorphic Minimalist Card Module */}
        <div
          className="w-full max-w-md animate-fade-in skeuo-card"
          style={{
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          {/* Card Header Strip (Matches Invoice/Scale tab in reference image) */}
          <div className="card-header-tab">
            <div className="flex items-center gap-2">
              <span className="anchor-dot" />
              <span>NODE: AUTH_GATEWAY</span>
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
              PORT: 5000 // TLS 1.3
            </span>
          </div>

          <div className="p-7 sm:p-8">
            {/* Title & subtitle */}
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
                {tab === 'login' ? 'Sign in to workspace' : 'Initialize account'}
              </h1>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--muted)' }}>
                {tab === 'login' ? 'Enter credentials to access collaborative sessions.' : 'Register user profile for real-time team collaboration.'}
              </p>
            </div>

            {/* Skeuomorphic Physical Tab Switcher */}
            <div
              className="flex mb-6 p-1 rounded-xl"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                gap: 4,
                boxShadow: 'var(--inset-shadow)',
              }}
            >
              {(['login', 'register'] as Tab[]).map(t => {
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTab(t)}
                    className="flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                    style={{
                      background: isActive ? 'var(--surface)' : 'transparent',
                      border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                      color: isActive ? 'var(--accent)' : 'var(--muted)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {isActive && <span className="anchor-dot" style={{ width: 6, height: 6 }} />}
                    <span>{t === 'login' ? 'Sign In' : 'Register'}</span>
                  </button>
                );
              })}
            </div>

            {/* Global Error Banner */}
            {globalError && (
              <div
                className="flex flex-col gap-2 p-3.5 rounded-xl mb-5 text-xs animate-fade-in"
                style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)' }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-snug font-medium">{globalError}</span>
                </div>
                {oauthUnconfigured && (
                  <button
                    type="button"
                    onClick={() => authService.googleAuthDemo()}
                    className="mt-1 py-1 px-2.5 rounded text-xs font-semibold self-start flex items-center gap-1.5 btn-physical-primary"
                  >
                    <Zap size={12} />
                    <span>Test with Demo Google Account</span>
                  </button>
                )}
              </div>
            )}

            {/* Google OAuth Button (Skeuomorphic Surface) */}
            <button
              type="button"
              onClick={() => authService.googleAuth()}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl text-xs sm:text-sm font-semibold transition-all mb-5 btn-physical-surface cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Technical Connector Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 connector-line-h" />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>or email credentials</span>
              <div className="flex-1 connector-line-h" />
            </div>

            {/* Form Fields */}
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  leftIcon={<Mail size={14} />}
                  placeholder="name@domain.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  error={errors.email}
                />
                <Input
                  label="Access Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  leftIcon={<Lock size={14} />}
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  error={errors.password}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="cursor-pointer bg-transparent border-none p-0 text-[var(--muted)] hover:text-[var(--text)] flex items-center"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={isLoading}
                  className="mt-2 btn-physical-primary h-11 text-sm font-bold"
                >
                  <span>Authorize &amp; Enter Workspace</span>
                  <ChevronRight size={15} />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <Input
                  label="Username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  leftIcon={<User size={14} />}
                  placeholder="developer_handle"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  error={errors.username}
                />
                <Input
                  label="Email Address"
                  type="email"
                  autoComplete="email"
                  leftIcon={<Mail size={14} />}
                  placeholder="name@domain.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  error={errors.email}
                />
                <div>
                  <Input
                    label="Master Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    leftIcon={<Lock size={14} />}
                    placeholder="Create a strong password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    error={errors.password}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="cursor-pointer bg-transparent border-none p-0 text-[var(--muted)] hover:text-[var(--text)] flex items-center"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                  {regPassword && <PasswordStrength password={regPassword} />}
                </div>
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  isLoading={isLoading}
                  className="mt-2 btn-physical-primary h-11 text-sm font-bold"
                >
                  <span>Create Account &amp; Provision Sandbox</span>
                  <ChevronRight size={15} />
                </Button>
              </form>
            )}

            {/* Footer link */}
            <div className="mt-6 pt-5 text-center text-xs border-t" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>
                {tab === 'login' ? "Don't have an access key? " : 'Already registered? '}
              </span>
              <button
                type="button"
                onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
                className="font-bold underline cursor-pointer"
                style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0 }}
              >
                {tab === 'login' ? 'Provision account' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Technical Monospace Readout */}
        <div className="mt-6 text-[11px] font-mono flex items-center gap-3" style={{ color: 'var(--muted)' }}>
          <span>CodeSync Cluster v2.4</span>
          <span>·</span>
          <span>Status: Operational</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <span className="anchor-dot-live" style={{ width: 6, height: 6 }} />
            Zero-Trust Sandbox
          </span>
        </div>
      </div>
    </div>
  );
}
