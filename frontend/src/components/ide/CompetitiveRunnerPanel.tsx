import { useState } from 'react';
import {
  Play, Plus, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, X, Trophy,
} from 'lucide-react';
import { Spinner } from '../ui/Spinner';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

export interface CompetitiveTestCase {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
}

export interface CompetitiveTestResult {
  id: string;
  name: string;
  verdict: 'AC' | 'WA' | 'TLE' | 'RE';
  durationMs: number;
  actualOutput: string;
  expectedOutput: string;
  stderr?: string;
}

interface Props {
  workspaceId: string;
  activeFilePath: string | null;
  token: string | null;
  onSaveBeforeRun?: () => Promise<void>;
  onClose: () => void;
}

const VERDICT_STYLE: Record<CompetitiveTestResult['verdict'], { label: string; bg: string; color: string; border: string }> = {
  AC:  { label: 'AC — Accepted',      bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' },
  WA:  { label: 'WA — Wrong Answer',  bg: 'var(--error-bg)',   color: 'var(--error)',   border: 'var(--error)' },
  TLE: { label: 'TLE — Time Limit',   bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)' },
  RE:  { label: 'RE — Runtime Error', bg: 'var(--error-bg)',   color: 'var(--error)',   border: 'var(--error)' },
};

export function CompetitiveRunnerPanel({
  workspaceId,
  activeFilePath,
  token,
  onSaveBeforeRun,
  onClose,
}: Props) {
  const [cases, setCases] = useState<CompetitiveTestCase[]>(() => {
    try {
      const saved = localStorage.getItem(`codesync_io_cases_${workspaceId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [{ id: 'case-1', name: 'Sample Case 1', stdin: '', expectedOutput: '' }];
  });

  const [results, setResults] = useState<Record<string, CompetitiveTestResult>>({});
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; executionMode?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const persistCases = (next: CompetitiveTestCase[]) => {
    setCases(next);
    try {
      localStorage.setItem(`codesync_io_cases_${workspaceId}`, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const addCase = () => {
    const idx = cases.length + 1;
    persistCases([
      ...cases,
      { id: `case-${Date.now()}-${idx}`, name: `Sample Case ${idx}`, stdin: '', expectedOutput: '' },
    ]);
  };

  const removeCase = (id: string) => {
    if (cases.length <= 1) return;
    persistCases(cases.filter(c => c.id !== id));
  };

  const updateCase = (id: string, patch: Partial<CompetitiveTestCase>) => {
    persistCases(cases.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleRunAll = async () => {
    if (!activeFilePath) {
      setError('Open a .js, .py, or .java file in the editor first.');
      return;
    }
    setRunning(true);
    setError('');
    try {
      if (onSaveBeforeRun) await onSaveBeforeRun();
      const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/competitive/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ filePath: activeFilePath, testCases: cases, timeoutMs: 5000 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute test cases');
      }
      const map: Record<string, CompetitiveTestResult> = {};
      for (const r of (data.results || []) as CompetitiveTestResult[]) {
        map[r.id] = r;
      }
      setResults(map);
      setSummary({ ...data.summary, executionMode: data.executionMode });
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="w-96 border-l h-full flex flex-col shrink-0 animate-fadeIn z-20"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Trophy size={15} className="text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold leading-none">Competitive I/O Judge</div>
            <div className="text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {activeFilePath || 'No active file'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg btn-physical-surface cursor-pointer"
          title="Close I/O Judge"
        >
          <X size={13} />
        </button>
      </div>

      {/* Action Bar */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={handleRunAll}
          disabled={running || !activeFilePath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold btn-physical-primary cursor-pointer disabled:opacity-40"
        >
          {running ? <Spinner size={12} /> : <Play size={12} fill="currentColor" />}
          <span>{running ? 'Judging...' : 'Run All Cases'}</span>
        </button>

        <button
          type="button"
          onClick={addCase}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold btn-physical-surface cursor-pointer"
        >
          <Plus size={12} />
          <span>Add Case</span>
        </button>
      </div>

      {/* Summary Banner */}
      {summary && (
        <div
          className="px-4 py-2 border-b flex items-center justify-between text-xs font-bold shrink-0"
          style={{
            background: summary.failed === 0 ? 'var(--success-bg)' : 'var(--error-bg)',
            borderColor: 'var(--border)',
            color: summary.failed === 0 ? 'var(--success)' : 'var(--error)',
          }}
        >
          <span>
            {summary.passed}/{summary.total} Accepted
          </span>
          <span className="text-[10px] font-mono uppercase opacity-80">
            {summary.executionMode === 'docker' ? 'Docker Sandbox' : 'Host Runtime'}
          </span>
        </div>
      )}

      {error && (
        <div
          className="mx-4 mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2"
          style={{ background: 'var(--error-bg)', borderColor: 'var(--error)', color: 'var(--error)' }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Test Cases List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--bg)' }}>
        {cases.map((tc, idx) => {
          const res = results[tc.id];
          const vStyle = res ? VERDICT_STYLE[res.verdict] : null;
          return (
            <div
              key={tc.id}
              className="p-3 rounded-xl border space-y-2.5 text-xs"
              style={{
                background: 'var(--surface)',
                borderColor: vStyle ? vStyle.border : 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={tc.name}
                  onChange={e => updateCase(tc.id, { name: e.target.value })}
                  className="font-bold text-xs bg-transparent border-none outline-none flex-1 min-w-0"
                  style={{ color: 'var(--text)' }}
                  placeholder={`Sample Case ${idx + 1}`}
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {res && vStyle && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold border"
                      style={{ background: vStyle.bg, color: vStyle.color, borderColor: vStyle.border }}
                    >
                      {res.verdict === 'AC' ? <CheckCircle2 size={11} /> : res.verdict === 'TLE' ? <Clock size={11} /> : <XCircle size={11} />}
                      <span>{res.verdict}</span>
                      <span className="font-mono opacity-80 ml-0.5">{res.durationMs}ms</span>
                    </span>
                  )}
                  {cases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCase(tc.id)}
                      className="p-1 rounded hover:opacity-80 cursor-pointer"
                      style={{ color: 'var(--muted)' }}
                      title="Delete case"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--muted)' }}>
                    Stdin
                  </label>
                  <textarea
                    rows={3}
                    value={tc.stdin}
                    onChange={e => updateCase(tc.id, { stdin: e.target.value })}
                    placeholder="Input..."
                    className="w-full p-2 rounded-lg border font-mono text-[11px] resize-y outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--muted)' }}>
                    Expected Stdout
                  </label>
                  <textarea
                    rows={3}
                    value={tc.expectedOutput}
                    onChange={e => updateCase(tc.id, { expectedOutput: e.target.value })}
                    placeholder="Expected..."
                    className="w-full p-2 rounded-lg border font-mono text-[11px] resize-y outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              {res && (res.verdict !== 'AC' || res.stderr) && (
                <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  {res.verdict === 'WA' && (
                    <div>
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--error)' }}>
                        Actual Stdout:
                      </span>
                      <pre
                        className="mt-1 p-2 rounded-lg border font-mono text-[11px] overflow-x-auto"
                        style={{ background: 'var(--bg)', borderColor: 'var(--error)', color: 'var(--text)' }}
                      >
                        {res.actualOutput || '(empty)'}
                      </pre>
                    </div>
                  )}
                  {res.stderr && (
                    <div>
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--error)' }}>
                        Stderr:
                      </span>
                      <pre
                        className="mt-1 p-2 rounded-lg border font-mono text-[11px] overflow-x-auto"
                        style={{ background: 'var(--error-bg)', borderColor: 'var(--error)', color: 'var(--error)' }}
                      >
                        {res.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
