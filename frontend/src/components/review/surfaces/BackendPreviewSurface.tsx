import { useState } from 'react';
import {
  Send,
  Activity,
  Server,
  Cpu,
  Clock,
  Layers,
  FileText,
  CornerDownRight,
  Database,
  Radio,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
  onAddReply: (id: string, comment: string) => void;
}

export function BackendPreviewSurface({
  annotations: _annotations,
  onAddTechnicalAnnotation,
}: Props) {
  const [activeTab, setActiveTab] = useState<'tester' | 'logs' | 'health' | 'traces'>('tester');

  // API Tester state
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('POST');
  const [endpoint, setEndpoint] = useState('/api/v1/checkout/charge');
  const [reqBody, setReqBody] = useState(`{\n  "amount": 0,\n  "currency": "USD",\n  "paymentMethodId": "pm_card_visa",\n  "idempotencyKey": "idem_849204829"\n}`);
  const [loadingReq, setLoadingReq] = useState(false);
  const [responseResult, setResponseResult] = useState<any>({
    status: 422,
    statusText: 'Unprocessable Entity',
    timeMs: 44,
    sizeBytes: 412,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_77a98b41cd',
      'x-spiffe-id': 'spiffe://codesync.internal/ns/ws_102/sa/payment-api',
    },
    body: {
      error: 'ValidationError',
      message: 'Charge amount must be strictly greater than $0.00',
      code: 'INVALID_AMOUNT',
      field: 'amount',
      rejectedValue: 0,
      traceId: 'trace_c84a1e941f',
    },
  });

  // Log filter
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [selectedLogLine, setSelectedLogLine] = useState<number | null>(null);

  // Sample runtime logs
  const rawLogs = [
    { line: 81, level: 'info', time: '03:15:20', text: '[HTTP] POST /api/v1/checkout/charge - Remote IP: 127.0.0.1' },
    { line: 82, level: 'info', time: '03:15:20', text: '[Identity] Workload validated: spiffe://codesync.internal/ns/ws_102/sa/payment-api' },
    { line: 83, level: 'info', time: '03:15:21', text: '[DB] Acquired read connection from pool (postgres://127.0.0.1:5432/codesync_dev)' },
    { line: 84, level: 'error', time: '03:15:21', text: '[ValidationError] Charge request failed: amount <= 0 received (file: src/controllers/paymentController.js:84)' },
    { line: 85, level: 'warn', time: '03:15:22', text: '[Telemetry] High 4xx rate detected on checkout controller (4.2% over 5m window)' },
    { line: 86, level: 'info', time: '03:15:23', text: '[Audit] Credential operation logged to tamper-evident audit trail' },
  ];

  const filteredLogs = rawLogs.filter((l) => (logFilter === 'all' ? true : l.level === logFilter));

  const handleSendRequest = () => {
    setLoadingReq(true);
    setTimeout(() => {
      setLoadingReq(false);
      try {
        const parsed = JSON.parse(reqBody);
        if (parsed.amount <= 0) {
          setResponseResult({
            status: 422,
            statusText: 'Unprocessable Entity',
            timeMs: 38,
            sizeBytes: 384,
            headers: {
              'content-type': 'application/json',
              'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`,
              'x-spiffe-id': 'spiffe://codesync.internal/ns/ws_102/sa/payment-api',
            },
            body: {
              error: 'ValidationError',
              message: 'Charge amount must be strictly greater than $0.00',
              code: 'INVALID_AMOUNT',
              field: 'amount',
              rejectedValue: parsed.amount,
            },
          });
        } else {
          setResponseResult({
            status: 200,
            statusText: 'OK',
            timeMs: 52,
            sizeBytes: 520,
            headers: {
              'content-type': 'application/json',
              'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`,
              'x-spiffe-id': 'spiffe://codesync.internal/ns/ws_102/sa/payment-api',
            },
            body: {
              success: true,
              chargeId: `ch_${Math.random().toString(36).substring(2, 10)}`,
              amount: parsed.amount,
              currency: parsed.currency || 'USD',
              status: 'succeeded',
            },
          });
        }
      } catch {
        setResponseResult({
          status: 400,
          statusText: 'Bad Request',
          timeMs: 12,
          sizeBytes: 150,
          headers: { 'content-type': 'application/json' },
          body: { error: 'SyntaxError', message: 'Malformed JSON payload' },
        });
      }
    }, 250);
  };

  const handlePinEndpoint = () => {
    onAddTechnicalAnnotation({
      surface: 'api',
      type: 'bug',
      title: `Endpoint Defect: ${method} ${endpoint}`,
      comment: `Observed HTTP ${responseResult.status} ${responseResult.statusText}. Expected valid rejection response with proper remediation fields.`,
      severity: responseResult.status >= 500 ? 'critical' : 'high',
      priority: 'high',
      technicalContext: {
        endpoint: `${method} ${endpoint}`,
        statusCode: responseResult.status,
        requestBody: reqBody,
        responseSnippet: JSON.stringify(responseResult.body),
      },
    });
  };

  const handlePinLogLine = (log: typeof rawLogs[0]) => {
    onAddTechnicalAnnotation({
      surface: 'logs',
      type: log.level === 'error' ? 'bug' : 'suggestion',
      title: `Log Finding at line #${log.line}: ${log.text.substring(0, 40)}...`,
      comment: `Runtime log flagged during QA review: ${log.text}`,
      severity: log.level === 'error' ? 'critical' : 'medium',
      priority: 'high',
      technicalContext: {
        logLine: log.line,
        logText: log.text,
        filePath: 'src/controllers/paymentController.js',
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top Backend Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('tester')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'tester'
                ? 'shadow'
                : 'hover:bg-[var(--surface-2)]'
            }`}
            style={activeTab === 'tester' ? { background: 'var(--accent)', color: 'var(--text)' } : { color: 'var(--muted)' }}
          >
            <Send size={13} />
            <span>API Request Tester</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? 'shadow'
                : 'hover:bg-[var(--surface-2)]'
            }`}
            style={activeTab === 'logs' ? { background: 'var(--accent)', color: 'var(--text)' } : { color: 'var(--muted)' }}
          >
            <FileText size={13} />
            <span>Runtime Logs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-600/60 text-[10px] font-mono" style={{ color: 'var(--text)' }}>
              1 error
            </span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'health'
                ? 'shadow'
                : 'hover:bg-[var(--surface-2)]'
            }`}
            style={activeTab === 'health' ? { background: 'var(--accent)', color: 'var(--text)' } : { color: 'var(--muted)' }}
          >
            <Activity size={13} />
            <span>Service Health & Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('traces')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'traces'
                ? 'shadow'
                : 'hover:bg-[var(--surface-2)]'
            }`}
            style={activeTab === 'traces' ? { background: 'var(--accent)', color: 'var(--text)' } : { color: 'var(--muted)' }}
          >
            <Layers size={13} />
            <span>Request Tracing</span>
          </button>
        </div>

        {activeTab === 'tester' && (
          <button
            onClick={handlePinEndpoint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={13} />
            <span>Pin Finding to Endpoint</span>
          </button>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'tester' && (
          <div className="h-full grid grid-cols-2 gap-4">
            {/* Request Composer */}
            <div className="flex flex-col h-full rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <div className="p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Request Configuration
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-xl border text-xs font-bold font-mono outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>

                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />

                  <button
                    onClick={handleSendRequest}
                    disabled={loadingReq}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow cursor-pointer transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    <Send size={13} />
                    <span>{loadingReq ? 'Sending...' : 'Send'}</span>
                  </button>
                </div>
              </div>

              {/* JSON Payload Editor */}
              <div className="flex-1 flex flex-col p-3 overflow-hidden">
                <label className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  Request JSON Body
                </label>
                <textarea
                  value={reqBody}
                  onChange={(e) => setReqBody(e.target.value)}
                  className="flex-1 w-full p-3 rounded-xl border text-xs font-mono resize-none outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#34d399' }}
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Response Viewer */}
            <div className="flex flex-col h-full rounded-2xl border overflow-hidden shadow-sm"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between p-3 border-b"
                   style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    Response
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-extrabold uppercase ${
                      responseResult.status < 300
                        ? 'bg-emerald-600 text-white'
                        : responseResult.status < 500
                        ? 'bg-amber-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {responseResult.status} {responseResult.statusText}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {responseResult.timeMs}ms
                  </span>
                  <span>{responseResult.sizeBytes} B</span>
                </div>
              </div>

              {/* Response Headers & Formatted Body */}
              <div className="flex-1 flex flex-col p-3 overflow-hidden">
                <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                  Response Body (JSON)
                </div>
                <pre className="flex-1 w-full p-3 rounded-xl border text-xs font-mono overflow-y-auto leading-relaxed"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                  {JSON.stringify(responseResult.body, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Runtime Logs with Click-to-Pin */}
        {activeTab === 'logs' && (
          <div className="h-full flex flex-col rounded-2xl border overflow-hidden shadow-sm"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between p-3 border-b"
                 style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Live Service Log Stream</span>
              </div>

              <div className="flex items-center gap-1">
                {(['all', 'error', 'warn', 'info'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogFilter(lvl)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all"
                    style={{
                      background: logFilter === lvl ? 'var(--surface-2)' : 'transparent',
                      color: logFilter === lvl ? 'var(--text)' : 'var(--muted)',
                      border: logFilter === lvl ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1" style={{ background: 'var(--bg)' }}>
              {filteredLogs.map((log) => (
                <div
                  key={log.line}
                  onClick={() => setSelectedLogLine(selectedLogLine === log.line ? null : log.line)}
                  className={`flex items-start justify-between p-2 rounded-lg cursor-pointer transition-all ${
                    selectedLogLine === log.line
                      ? 'bg-indigo-950/40 border border-indigo-500/50'
                      : 'hover:bg-neutral-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-600 select-none w-6 text-right">{log.line}</span>
                    <span className="text-neutral-500 text-[11px]">{log.time}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                        log.level === 'error'
                          ? 'bg-red-950 text-red-400 border border-red-800/40'
                          : log.level === 'warn'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                          : 'bg-blue-950 text-blue-400 border border-blue-800/40'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span style={{ color: 'var(--text)' }}>{log.text}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePinLogLine(log);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-all"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    title="Attach review finding to this log line"
                  >
                    <CornerDownRight size={11} />
                    <span>Pin Log</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Health Metrics */}
        {activeTab === 'health' && (
          <div className="h-full grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--accent)' }}>
                <Cpu size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Compute Utilization</h4>
              </div>
              <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>14.2%</div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>4 Cores isolated container limit</p>
              <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--surface)' }}>
                <div className="h-full w-[14%]" style={{ background: 'var(--accent)' }} />
              </div>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: '#c084fc' }}>
                <Server size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Memory RSS</h4>
              </div>
              <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>218 MB</div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Limit: 1024 MB (21.3% committed)</p>
              <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--surface)' }}>
                <div className="h-full bg-purple-500 w-[21%]" />
              </div>
            </div>

            <div className="p-4 rounded-2xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Radio size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Throughput</h4>
              </div>
              <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>128 req/s</div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>p95 latency: 42ms · Error rate: 0.2%</p>
              <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--surface)' }}>
                <div className="h-full bg-emerald-500 w-[65%]" />
              </div>
            </div>

            <div className="col-span-3 p-4 rounded-2xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>Upstream Dependency Health Checks</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-blue-400" />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>PostgreSQL 16 DB</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/40">
                    Connected (3ms)
                  </span>
                </div>

                <div className="p-3 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-red-400" />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Redis Cache Cluster</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/40">
                    Operational (1ms)
                  </span>
                </div>

                <div className="p-3 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-amber-400" />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Kafka Event Broker</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/40">
                    Synced
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Distributed Request Traces */}
        {activeTab === 'traces' && (
          <div className="h-full flex flex-col rounded-2xl border p-4 overflow-y-auto"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <h4 className="font-bold text-xs mb-3" style={{ color: 'var(--text)' }}>Distributed Execution Traces</h4>
            <div className="space-y-3">
              {[
                { traceId: 'tr_849204', root: 'POST /api/v1/checkout/charge', duration: '44ms', spans: 4, status: 422 },
                { traceId: 'tr_110294', root: 'GET /api/v1/user/profile', duration: '18ms', spans: 2, status: 200 },
                { traceId: 'tr_559281', root: 'POST /api/v1/auth/exchange', duration: '28ms', spans: 3, status: 200 },
              ].map((t) => (
                <div key={t.traceId} className="p-3 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{t.root}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${t.status < 300 ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
                        HTTP {t.status}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono mt-1 block" style={{ color: 'var(--muted)' }}>Trace ID: {t.traceId} · {t.spans} downstream service spans</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 font-mono">{t.duration}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
