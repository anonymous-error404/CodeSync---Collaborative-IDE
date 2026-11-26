import { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Lock,
  ExternalLink,
  Terminal,
  Activity,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  CheckCircle,
  Server,
  Lightbulb,
} from 'lucide-react';
import { FigmaPinOverlay } from '../FigmaPinOverlay';
import type { PreviewAnnotation, AnnotationType } from '../../../types';

interface Props {
  previewUrl: string;
  previewPort?: number | null;
  onPortChange?: (port: number) => void;
  onLaunchDevServer?: () => void;
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  pinModeActive: boolean;
  annotations: PreviewAnnotation[];
  onAddPin: (
    coords: { x: number; y: number },
    payload: { title: string; comment: string; type: AnnotationType; priority: string; severity: string }
  ) => void;
  onUpdateAnnotation: (id: string, payload: Partial<PreviewAnnotation>) => void;
  onAddReply: (id: string, comment: string) => void;
}

export function WebPreviewSurface({
  previewUrl,
  previewPort,
  onPortChange,
  onLaunchDevServer,
  viewportMode,
  pinModeActive,
  annotations,
  onAddPin,
  onUpdateAnnotation,
  onAddReply,
}: Props) {
  const [port, setPort] = useState<number | null>(previewPort ?? null);
  const [isEditingPort, setIsEditingPort] = useState(false);
  const [portInput, setPortInput] = useState(previewPort ? String(previewPort) : '');
  const [currentRoute, setCurrentRoute] = useState('/');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showDevDrawer, setShowDevDrawer] = useState(false);
  const [devTab, setDevTab] = useState<'console' | 'network'>('console');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (previewPort) {
      setPort(previewPort);
      setPortInput(String(previewPort));
    }
  }, [previewPort]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleSavePort = () => {
    const p = parseInt(portInput.trim(), 10);
    if (!isNaN(p) && p > 0 && p < 65536) {
      setPort(p);
      onPortChange?.(p);
      setIsEditingPort(false);
    }
  };

  const handleSelectPort = (p: number) => {
    setPort(p);
    setPortInput(String(p));
    onPortChange?.(p);
  };

  const activeUrl = port
    ? `${previewUrl.split('?')[0]}?_port=${port}${currentRoute && currentRoute !== '/' ? `&_path=${encodeURIComponent(currentRoute)}` : ''}`
    : previewUrl;

  // Simulated browser console logs
  const [consoleLogs] = useState([
    { type: 'info', text: '[App] React 19 Client Hydrated in 34ms', time: '03:14:02' },
    { type: 'log', text: '[Socket] Connected to CodeSync Collaboration Gateway', time: '03:14:03' },
    { type: 'warn', text: '[Layout] Responsive container resize detected (768px)', time: '03:14:05' },
    { type: 'info', text: '[Security] Zero-trust security envelope active', time: '03:14:10' },
  ]);

  // Simulated network requests
  const [networkRequests] = useState([
    { method: 'GET', url: '/api/v1/session', status: 200, time: '12ms', size: '1.2 KB' },
    { method: 'GET', url: '/api/v1/workspace/tree', status: 200, time: '28ms', size: '8.4 KB' },
    { method: 'POST', url: '/api/v1/telemetry/heartbeat', status: 204, time: '18ms', size: '0.4 KB' },
    { method: 'GET', url: '/api/v1/review/annotations', status: 200, time: '35ms', size: '3.1 KB' },
  ]);

  const reloadIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (iframeRef.current) {
      const cleanRoute = currentRoute.startsWith('/') ? currentRoute : `/${currentRoute}`;
      iframeRef.current.src = `${previewUrl.replace(/\/$/, '')}${cleanRoute}`;
    }
  };

  const viewportWidth =
    viewportMode === 'mobile' ? '375px' : viewportMode === 'tablet' ? '768px' : '100%';

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Browser Navigation & Address Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
          <button
            onClick={() => iframeRef.current?.contentWindow?.history.back()}
            className="p-1 rounded hover:bg-[var(--surface)] transition-colors cursor-pointer"
            style={{ color: 'var(--text)' }}
            title="Back"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            onClick={() => iframeRef.current?.contentWindow?.history.forward()}
            className="p-1 rounded hover:bg-[var(--surface)] transition-colors cursor-pointer"
            style={{ color: 'var(--text)' }}
            title="Forward"
          >
            <ArrowRight size={13} />
          </button>
          <button
            onClick={reloadIframe}
            className="p-1 rounded hover:bg-[var(--surface)] transition-colors cursor-pointer"
            style={{ color: 'var(--text)' }}
            title="Reload Preview"
          >
            <RotateCw size={13} />
          </button>
        </div>

        {/* Address Route Bar */}
        <form onSubmit={handleRouteSubmit} className="flex-1 flex items-center">
          <div className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Lock size={12} className="text-emerald-400 shrink-0" />
            <span style={{ color: 'var(--muted)' }} className="shrink-0 select-none">preview.internal</span>
            <input
              type="text"
              value={currentRoute}
              onChange={(e) => setCurrentRoute(e.target.value)}
              placeholder="/route or /path"
              className="flex-1 bg-transparent border-none outline-none text-xs font-mono"
              style={{ color: 'var(--text)' }}
            />
          </div>
        </form>

        {/* Port indicator / switcher */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono shrink-0"
             style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: port ? '#10b981' : '#f59e0b' }} />
          <span style={{ color: 'var(--muted)' }}>Port:</span>
          {isEditingPort ? (
            <form onSubmit={e => { e.preventDefault(); handleSavePort(); }} className="inline">
              <input
                type="text"
                value={portInput}
                onChange={e => setPortInput(e.target.value)}
                onBlur={handleSavePort}
                className="w-14 px-1 py-0 bg-transparent border-b border-[var(--accent)] text-xs text-[var(--accent)] font-bold outline-none"
                autoFocus
              />
            </form>
          ) : (
            <button
              onClick={() => { setIsEditingPort(true); setPortInput(port ? String(port) : ''); }}
              className="hover:underline font-bold cursor-pointer"
              style={{ color: port ? 'var(--accent)' : 'var(--muted)' }}
              title="Click to manually set port"
            >
              {port || 'none'}
            </button>
          )}
        </div>

        {/* Browser Utilities */}
        <div className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <div className="flex items-center border rounded-lg p-0.5 text-[11px]"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <button
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
              className="p-1 cursor-pointer"
              style={{ color: 'var(--text)' }}
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="px-1.5 font-mono" style={{ color: 'var(--text)' }}>{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(150, zoomLevel + 25))}
              className="p-1 cursor-pointer"
              style={{ color: 'var(--text)' }}
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          <button
            onClick={() => setShowDevDrawer(!showDevDrawer)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
            style={{
              background: showDevDrawer ? 'var(--accent-subtle)' : 'var(--surface)',
              color: showDevDrawer ? 'var(--accent)' : 'var(--muted)',
              borderColor: showDevDrawer ? 'var(--accent)' : 'var(--border)',
            }}
            title="Toggle Console and Network diagnostics"
          >
            <Terminal size={12} />
            <span>Dev Tools</span>
            {showDevDrawer ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          <button
            onClick={() => window.open(previewUrl, '_blank')}
            className="p-1.5 rounded-lg border transition-all cursor-pointer"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Open preview in standalone tab"
          >
            <ExternalLink size={13} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border transition-all cursor-pointer"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden" style={{ background: 'var(--bg)' }}>
        {!port ? (
          /* Empty / Waiting state with updated CodeSync UI and original text */
          <div className="max-w-md p-7 text-center select-text skeuo-card m-4">
            <div
              className="w-13 h-13 rounded-xl flex items-center justify-center mx-auto mb-4 border"
              style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
            >
              <Server size={24} />
            </div>
            <h2 className="text-base font-extrabold text-[var(--text)] mb-2.5 tracking-tight">
              No running server detected
            </h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
              Start your application in the terminal (e.g.{' '}
              <code className="text-[var(--accent)] font-mono font-bold bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded border border-[var(--accent-border)]">
                npm run dev
              </code>{' '}
              or{' '}
              <code className="text-[var(--accent)] font-mono font-bold bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded border border-[var(--accent-border)]">
                node index.js
              </code>
              ).
            </p>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">
              CodeSync will automatically detect the port and display your web app here.
            </p>

            <div
              className="p-3 rounded-lg border text-xs text-[var(--muted)] mb-5 flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <Lightbulb size={14} className="text-[var(--accent)] shrink-0" />
              <span>
                Once your app starts, click the <strong className="text-[var(--text)]">Refresh</strong> button in the top bar.
              </span>
            </div>

            <div className="flex flex-col gap-2.5 max-w-xs mx-auto mb-4">
              {onLaunchDevServer && (
                <button
                  onClick={onLaunchDevServer}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold btn-physical-primary cursor-pointer shadow-md"
                >
                  <Server size={14} />
                  <span>Start Dev Server in Terminal</span>
                </button>
              )}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handleSelectPort(3000)}
                  className="flex-1 btn-physical-surface text-xs cursor-pointer py-1.5"
                >
                  Port 3000
                </button>
                <button
                  onClick={() => handleSelectPort(5173)}
                  className="flex-1 btn-physical-surface text-xs cursor-pointer py-1.5"
                >
                  Port 5173
                </button>
                <button
                  onClick={reloadIframe}
                  className="btn-physical-surface text-xs cursor-pointer py-1.5 px-3"
                  title="Rescan and reload preview"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="relative h-full transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border flex flex-col bg-white"
            style={{
              borderColor: 'var(--border)',
              width: viewportWidth,
              maxHeight: '100%',
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
              transformOrigin: 'top center',
            }}
          >
            <iframe
              ref={iframeRef}
              src={activeUrl}
              title="CodeSync Universal Web Preview"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            <FigmaPinOverlay
              annotations={annotations.filter((a) => a.surface === 'web' || a.surface === 'mobile')}
              pinModeActive={pinModeActive}
              onAddPin={onAddPin}
              onUpdateAnnotation={onUpdateAnnotation}
              onAddReply={onAddReply}
              containerRef={canvasRef}
            />
          </div>
        )}
      </div>

      {/* Bottom Drawer: Console & Network Inspector */}
      {showDevDrawer && (
        <div className="h-44 border-t flex flex-col shrink-0 animate-fadeIn"
             style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b text-xs"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDevTab('console')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold text-xs cursor-pointer"
                style={{
                  background: devTab === 'console' ? 'var(--accent)' : 'transparent',
                  color: devTab === 'console' ? 'var(--accent-fg)' : 'var(--muted)',
                }}
              >
                <Terminal size={12} />
                <span>Console ({consoleLogs.length})</span>
              </button>
              <button
                onClick={() => setDevTab('network')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold text-xs cursor-pointer"
                style={{
                  background: devTab === 'network' ? 'var(--accent)' : 'transparent',
                  color: devTab === 'network' ? 'var(--accent-fg)' : 'var(--muted)',
                }}
              >
                <Activity size={12} />
                <span>Network ({networkRequests.length})</span>
              </button>
            </div>
            <button
              onClick={() => setShowDevDrawer(false)}
              className="text-xs px-2 py-0.5 rounded cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
            {devTab === 'console' ? (
              <div className="space-y-1">
                {consoleLogs.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-[var(--surface-2)] text-[11px]"
                  >
                    <span style={{ color: 'var(--muted)' }} className="shrink-0">{log.time}</span>
                    {log.type === 'error' ? (
                      <AlertCircle size={12} className="text-red-400 shrink-0" />
                    ) : log.type === 'warn' ? (
                      <AlertCircle size={12} className="text-amber-400 shrink-0" />
                    ) : (
                      <Info size={12} className="text-blue-400 shrink-0" />
                    )}
                    <span
                      className={
                        log.type === 'error'
                          ? 'text-red-300'
                          : log.type === 'warn'
                          ? 'text-amber-300'
                          : ''
                      }
                      style={log.type !== 'error' && log.type !== 'warn' ? { color: 'var(--text)' } : undefined}
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b pb-1" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
                    <th className="py-1 px-2 font-semibold">Method</th>
                    <th className="py-1 px-2 font-semibold">Endpoint</th>
                    <th className="py-1 px-2 font-semibold">Status</th>
                    <th className="py-1 px-2 font-semibold">Time</th>
                    <th className="py-1 px-2 font-semibold">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {networkRequests.map((req, i) => (
                    <tr key={i} className="hover:bg-[var(--surface-2)] border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-1 px-2 font-bold" style={{ color: 'var(--accent)' }}>{req.method}</td>
                      <td className="py-1 px-2" style={{ color: 'var(--text)' }}>{req.url}</td>
                      <td className="py-1 px-2">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle size={10} />
                          {req.status}
                        </span>
                      </td>
                      <td className="py-1 px-2" style={{ color: 'var(--muted)' }}>{req.time}</td>
                      <td className="py-1 px-2" style={{ color: 'var(--muted)' }}>{req.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
