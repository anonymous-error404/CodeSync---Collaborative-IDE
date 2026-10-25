import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Globe,
  Home,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Check,
  Edit2,
  AlertCircle
} from 'lucide-react';

interface WebPreviewPanelProps {
  workspaceId: string;
  detectedPort: number | null;
  onPortChange?: (port: number) => void;
  isSplit?: boolean;
  onCloseSplit?: () => void;
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

export function WebPreviewPanel({
  workspaceId,
  detectedPort,
  onPortChange,
  isSplit = false,
  onCloseSplit,
}: WebPreviewPanelProps) {
  const [port, setPort] = useState<number | null>(detectedPort);
  const [path, setPath] = useState<string>('/');
  const [inputUrl, setInputUrl] = useState<string>('/');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [deviceMode, setDeviceMode] = useState<'responsive' | 'mobile' | 'tablet' | 'desktop'>('responsive');
  const [isEditingPort, setIsEditingPort] = useState<boolean>(false);
  const [portInput, setPortInput] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync with detected port when it arrives from socket/terminal
  useEffect(() => {
    if (detectedPort) {
      setPort(detectedPort);
      setPortInput(String(detectedPort));
    }
  }, [detectedPort]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIframeKey(k => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) target = '/';
    if (!target.startsWith('/')) target = '/' + target;
    setPath(target);
    setIframeKey(k => k + 1);
  };

  const handleSavePort = () => {
    const p = parseInt(portInput.trim(), 10);
    if (!isNaN(p) && p > 0 && p < 65536) {
      setPort(p);
      onPortChange?.(p);
      setIsEditingPort(false);
      setIframeKey(k => k + 1);
    }
  };

  // Preview proxy URL pointing to backend's sandboxed reverse proxy
  const previewProxyUrl = `${BASE_URL}/api/preview/${workspaceId}${path.startsWith('/') ? path : '/' + path}${port ? `${path.includes('?') ? '&' : '?'}_port=${port}` : ''}`;
  const directLocalUrl = port ? `http://localhost:${port}${path}` : null;

  // Determine iframe width based on device simulation
  const getDeviceWidth = () => {
    switch (deviceMode) {
      case 'mobile': return '390px';
      case 'tablet': return '768px';
      case 'desktop': return '1024px';
      default: return '100%';
    }
  };

  return (
    <div
      className="flex flex-col h-full w-full select-none overflow-hidden"
      style={{
        background: 'var(--surface, #161b22)',
        borderLeft: isSplit ? '1px solid var(--border, #30363d)' : 'none',
      }}
    >
      {/* ── Browser Navigation Toolbar ── */}
      <div
        className="flex items-center justify-between px-3 py-2 gap-2 shrink-0 border-b select-none"
        style={{
          background: 'var(--surface-2, #0d1117)',
          borderColor: 'var(--border, #30363d)',
        }}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Home */}
          <button
            onClick={() => {
              setPath('/');
              setInputUrl('/');
              setIframeKey(k => k + 1);
            }}
            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Go to root (/)"
          >
            <Home size={14} />
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-all ${
              isRefreshing ? 'rotate-180 duration-500' : ''
            }`}
            title="Reload web preview"
          >
            <RefreshCw size={14} />
          </button>

          {/* Device viewport selectors */}
          <div className="hidden sm:flex items-center gap-0.5 ml-1 p-0.5 rounded border border-[var(--border)] bg-[var(--bg)]">
            <button
              onClick={() => setDeviceMode('responsive')}
              className={`p-1 rounded text-xs transition-colors ${deviceMode === 'responsive' ? 'bg-[var(--surface-2)] text-[var(--accent)] font-bold' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              title="Responsive Viewport (100%)"
            >
              <Globe size={12} />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1 rounded text-xs transition-colors ${deviceMode === 'mobile' ? 'bg-[var(--surface-2)] text-[var(--accent)] font-bold' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              title="Mobile (390px)"
            >
              <Smartphone size={12} />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1 rounded text-xs transition-colors ${deviceMode === 'tablet' ? 'bg-[var(--surface-2)] text-[var(--accent)] font-bold' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              title="Tablet (768px)"
            >
              <Tablet size={12} />
            </button>
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1 rounded text-xs transition-colors ${deviceMode === 'desktop' ? 'bg-[var(--surface-2)] text-[var(--accent)] font-bold' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              title="Desktop (1024px)"
            >
              <Monitor size={12} />
            </button>
          </div>
        </div>

        {/* ── Address Bar ── */}
        <form onSubmit={handleNavigate} className="flex-1 max-w-xl flex items-center min-w-0">
          <div
            className="flex items-center w-full px-2.5 py-1 rounded-md text-xs font-mono border focus-within:border-[var(--accent)] transition-all"
            style={{
              background: 'var(--bg, #090d16)',
              borderColor: 'var(--border, #30363d)',
            }}
          >
            <span className="text-[var(--muted)] shrink-0 select-none mr-1.5 flex items-center gap-1">
              <Globe size={11} className="text-blue-400" />
              <span className="hidden md:inline text-[10px] opacity-75">preview:</span>
            </span>
            <input
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="/ (path)"
              className="flex-1 bg-transparent border-none outline-none text-[var(--text)] text-xs font-mono"
            />
          </div>
        </form>

        {/* ── Right side: Port & External Actions ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Port indicator / Editor */}
          {isEditingPort ? (
            <div className="flex items-center gap-1 bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--accent)]">
              <span className="text-[10px] text-[var(--muted)] font-mono">Port:</span>
              <input
                type="number"
                value={portInput}
                onChange={e => setPortInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePort(); }}
                className="w-14 bg-transparent text-xs font-mono border-none outline-none text-[var(--text)]"
                autoFocus
              />
              <button onClick={handleSavePort} className="text-emerald-400 hover:text-emerald-300">
                <Check size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPortInput(port ? String(port) : '3000');
                setIsEditingPort(true);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors"
              style={{
                background: port ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: port ? '#4ade80' : '#f87171',
                border: `1px solid ${port ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
              title="Click to set port manually"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${port ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span>{port ? `Port ${port}` : 'No Port'}</span>
              <Edit2 size={10} className="opacity-60 ml-0.5" />
            </button>
          )}

          {/* Open in new tab */}
          <a
            href={previewProxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Open sandboxed preview in new browser tab"
          >
            <ExternalLink size={14} />
          </a>

          {/* Close split button if rendered inside split mode */}
          {isSplit && onCloseSplit && (
            <button
              onClick={onCloseSplit}
              className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors ml-1"
              title="Close Preview Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Browser Viewport ── */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex justify-center items-center bg-[#0d1117]">
        {!port ? (
          /* Empty / Waiting state */
          <div className="max-w-md p-6 text-center select-text">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
              <Globe size={28} />
            </div>
            <h3 className="text-base font-bold text-[var(--text,#f0f6fc)] mb-2">
              Live Web Output
            </h3>
            <p className="text-xs text-[var(--muted,#8b949e)] leading-relaxed mb-4">
              When you run a web server (like <code className="text-amber-300">npm run dev</code> or <code className="text-amber-300">node index.js</code>) in the terminal, CodeSync captures its HTTP port and displays the output here.
            </p>

            <div className="p-3 rounded-lg bg-[var(--surface-2,#161b22)] border border-[var(--border,#30363d)] text-left mb-4">
              <div className="text-[11px] font-semibold text-[var(--text,#f0f6fc)] mb-1 flex items-center gap-1.5">
                <AlertCircle size={12} className="text-blue-400" />
                <span>How sandboxing works in deployment:</span>
              </div>
              <p className="text-[11px] text-[var(--muted,#8b949e)] leading-relaxed">
                Even when deployed on a remote server, CodeSync reverse-proxies the internal port through an isolated subpath (<code className="text-xs text-blue-300">/api/preview/...</code>) inside a secure sandboxed iframe so you can view, test, and interact with your app right here.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setPort(3000);
                  setPortInput('3000');
                }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent,#2f81f7)] text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Use Port 3000
              </button>
              <button
                onClick={() => {
                  setPort(5173);
                  setPortInput('5173');
                }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--surface-2,#21262d)] text-[var(--text,#c9d1d9)] border border-[var(--border,#30363d)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              >
                Use Port 5173 (Vite)
              </button>
            </div>
          </div>
        ) : (
          /* Live Iframe Sandbox */
          <div
            className="h-full transition-all duration-200 shadow-2xl relative flex flex-col"
            style={{
              width: getDeviceWidth(),
              border: deviceMode !== 'responsive' ? '1px solid var(--border, #30363d)' : 'none',
              background: '#ffffff',
            }}
          >
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={previewProxyUrl}
              title={`Web Preview (Port ${port})`}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              allow="camera; microphone; geolocation"
            />
          </div>
        )}
      </div>

      {/* ── Status Bar / Helper Footer ── */}
      {port && (
        <div
          className="flex items-center justify-between px-3 py-1 text-[11px] border-t shrink-0 select-none font-mono"
          style={{
            background: 'var(--surface-2, #0d1117)',
            borderColor: 'var(--border, #30363d)',
            color: 'var(--muted, #8b949e)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Connected
            </span>
            <span className="opacity-50">•</span>
            <span className="truncate max-w-[200px] sm:max-w-[320px]">
              Proxy: /api/preview/{workspaceId}/
            </span>
          </div>
          {directLocalUrl && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="opacity-75">Localhost:</span>
              <a
                href={directLocalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1"
                title="Open direct localhost port in browser"
              >
                <span>localhost:{port}</span>
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WebPreviewPanel;
