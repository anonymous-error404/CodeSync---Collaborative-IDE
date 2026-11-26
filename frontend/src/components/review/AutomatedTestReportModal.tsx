import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  X,
  Play,
  Plus,
  FileCode,
  Terminal,
  RotateCw,
  Code2,
  Sparkles,
  Globe,
} from 'lucide-react';
import { reviewApi } from '../../services/reviewApi';
import { Spinner } from '../ui/Spinner';

interface Props {
  previewId: string;
  onClose?: () => void;
  onOpenInIDE?: (filePath: string) => void;
  isEmbedded?: boolean;
}

export function AutomatedTestReportModal({
  previewId,
  onClose,
  onOpenInIDE,
  isEmbedded = false,
}: Props) {
  const [report, setReport] = useState<any>(null);
  const [testFiles, setTestFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'suites' | 'files' | 'console'>('suites');
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [selectedTestFile] = useState<string>('');

  // Create Manual Test Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('tests/api.test.js');
  const [newTemplateType, setNewTemplateType] = useState<'api' | 'unit' | 'e2e'>('api');
  const [creatingFile, setCreatingFile] = useState(false);

  useEffect(() => {
    loadData();
  }, [previewId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportData, filesData] = await Promise.all([
        reviewApi.getTestReport(previewId).catch(() => null),
        reviewApi.getTestFiles(previewId).catch(() => []),
      ]);
      if (reportData) setReport(reportData);
      setTestFiles(filesData || []);
    } catch (err) {
      console.error('[AutomatedTestReport] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTests = async (fileToRun?: string) => {
    setRunning(true);
    setActiveTab('suites');
    try {
      const res = await reviewApi.runTests(previewId, {
        testFile: fileToRun || selectedTestFile || undefined,
      });
      if (res?.report) {
        setReport(res.report);
      }
      const rawLog = [res?.stdout, res?.stderr].filter(Boolean).join('\n');
      setConsoleOutput(rawLog || 'Test execution completed with exit code 0.');

      // Refresh discovered files in case a default was auto-created
      const files = await reviewApi.getTestFiles(previewId).catch(() => []);
      setTestFiles(files || []);
    } catch (err: any) {
      setConsoleOutput(`Execution failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleCreateTest = async (template: 'api' | 'unit' | 'e2e' = newTemplateType, name = newFileName) => {
    setCreatingFile(true);
    try {
      const res = await reviewApi.createTestFile(previewId, {
        fileName: name,
        templateType: template,
      });

      setShowCreateModal(false);
      // Reload discovered files
      const files = await reviewApi.getTestFiles(previewId);
      setTestFiles(files || []);

      // If user wants to edit in IDE, trigger navigation
      if (res?.filePath && onOpenInIDE) {
        onOpenInIDE(res.filePath);
      }

      // Automatically run newly created test
      await handleRunTests(res.filePath);
    } catch (err: any) {
      alert(`Failed to create test file: ${err.message}`);
    } finally {
      setCreatingFile(false);
    }
  };

  const totalTests = report?.summary?.total ?? 0;
  const passedTests = report?.summary?.passed ?? 0;
  const failedTests = report?.summary?.failed ?? 0;
  const durationSec = report?.summary?.durationSeconds ?? 0;

  const content = (
    <div className="flex flex-col h-full overflow-hidden select-text">
      {/* ── Sub-Bar Action Header (Manual creation & execution primary) ── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0 flex-wrap gap-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Main Run Button */}
          <button
            onClick={() => handleRunTests()}
            disabled={running}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold btn-physical-primary cursor-pointer disabled:opacity-50 transition-all shadow-sm"
            title="Execute workspace test suites via Node native runner"
          >
            {running ? <Spinner size={13} /> : <Play size={13} fill="currentColor" />}
            <span>{running ? 'Running Suite...' : 'Run Test Suite'}</span>
          </button>

          {/* New Test File Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold btn-physical-surface cursor-pointer"
            title="Create a new manual test file with a contract/unit template"
          >
            <Plus size={13} />
            <span>Create Test File</span>
          </button>

          {/* Refresh file discovery */}
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg btn-physical-surface cursor-pointer"
            title="Rescan workspace for test files"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div
          className="flex items-center p-0.5 rounded-xl border text-xs font-semibold"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setActiveTab('suites')}
            className="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            style={{
              background: activeTab === 'suites' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'suites' ? 'var(--accent)' : 'var(--muted)',
            }}
          >
            Results ({totalTests})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className="px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
            style={{
              background: activeTab === 'files' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'files' ? 'var(--accent)' : 'var(--muted)',
            }}
          >
            <span>Files</span>
            <span
              className="px-1.5 py-0.2 rounded-full text-[9px] font-mono text-white"
              style={{ background: 'var(--accent)' }}
            >
              {testFiles.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className="px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
            style={{
              background: activeTab === 'console' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'console' ? 'var(--accent)' : 'var(--muted)',
            }}
          >
            <Terminal size={11} />
            <span>Console</span>
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ background: 'var(--bg)' }}>
        {/* KPI Metrics Dashboard */}
        <div className="grid grid-cols-4 gap-2.5">
          <div
            className="p-2.5 rounded-xl border text-center"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total Tests</span>
            <div className="text-lg font-black mt-0.5" style={{ color: 'var(--text)' }}>{totalTests}</div>
          </div>

          <div
            className="p-2.5 rounded-xl border text-center"
            style={{ background: 'var(--success-bg)', borderColor: 'var(--success)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--success)' }}>Passed</span>
            <div className="text-lg font-black mt-0.5" style={{ color: 'var(--success)' }}>{passedTests}</div>
          </div>

          <div
            className="p-2.5 rounded-xl border text-center"
            style={{
              background: failedTests > 0 ? 'var(--error-bg)' : 'var(--surface)',
              borderColor: failedTests > 0 ? 'var(--error)' : 'var(--border)',
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: failedTests > 0 ? 'var(--error)' : 'var(--muted)' }}
            >
              Failed
            </span>
            <div
              className="text-lg font-black mt-0.5"
              style={{ color: failedTests > 0 ? 'var(--error)' : 'var(--text)' }}
            >
              {failedTests}
            </div>
          </div>

          <div
            className="p-2.5 rounded-xl border text-center"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Duration</span>
            <div className="text-lg font-black mt-0.5 font-mono" style={{ color: 'var(--text)' }}>{durationSec}s</div>
          </div>
        </div>

        {/* ── TAB 1: Test Suites & Results ── */}
        {activeTab === 'suites' && (
          <div className="space-y-3">
            {running && (
              <div
                className="p-4 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-semibold animate-pulse"
                style={{ background: 'var(--surface)', borderColor: 'var(--accent)' }}
              >
                <Spinner size={16} />
                <span style={{ color: 'var(--text)' }}>Executing manual and automated workspace test files...</span>
              </div>
            )}

            {!running && (!report?.suites || report.suites.length === 0) ? (
              /* Guided Zero-State to Start Writing Tests */
              <div
                className="p-6 rounded-2xl border text-center space-y-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto border"
                  style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                >
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    No Tests Executed Yet
                  </h4>
                  <p className="text-xs max-w-md mx-auto mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Author a test script or choose a pre-configured template to run contract, unit, and regression assertions directly in your workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto pt-1">
                  <button
                    onClick={() => handleCreateTest('api', 'tests/api.test.js')}
                    className="p-3 rounded-xl border text-left btn-physical-surface cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: 'var(--text)' }}>
                      <Globe size={13} style={{ color: 'var(--accent)' }} />
                      <span>API Contract</span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      HTTP endpoint response & status verification.
                    </p>
                  </button>

                  <button
                    onClick={() => handleCreateTest('unit', 'tests/unit.test.js')}
                    className="p-3 rounded-xl border text-left btn-physical-surface cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: 'var(--text)' }}>
                      <Code2 size={13} className="text-emerald-400" />
                      <span>Core Logic</span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      Component state & pure function assertions.
                    </p>
                  </button>

                  <button
                    onClick={() => handleCreateTest('e2e', 'tests/e2e.test.js')}
                    className="p-3 rounded-xl border text-left btn-physical-surface cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: 'var(--text)' }}>
                      <Sparkles size={13} className="text-purple-400" />
                      <span>Integration</span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      End-to-end workflow validation.
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              (report?.suites || []).map((suite: any, sIdx: number) => (
                <div
                  key={sIdx}
                  className="p-3.5 rounded-xl border space-y-2.5"
                  style={{
                    background: 'var(--surface)',
                    borderColor: suite.status === 'passed' ? 'var(--border)' : 'var(--error)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      {suite.status === 'passed' ? (
                        <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                      ) : (
                        <XCircle size={15} style={{ color: 'var(--error)' }} />
                      )}
                      <span>{suite.name}</span>
                    </span>
                    <span
                      className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        background: suite.status === 'passed' ? 'var(--success-bg)' : 'var(--error-bg)',
                        color: suite.status === 'passed' ? 'var(--success)' : 'var(--error)',
                        borderColor: suite.status === 'passed' ? 'var(--success)' : 'var(--error)',
                      }}
                    >
                      {suite.tests.length} tests
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {suite.tests.map((test: any, tIdx: number) => (
                      <div
                        key={tIdx}
                        className="flex items-center justify-between p-2 rounded-lg text-xs border"
                        style={{
                          background: 'var(--surface-2)',
                          borderColor: test.status === 'passed' ? 'var(--border)' : 'var(--error)',
                          color: 'var(--text)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background:
                                test.status === 'passed'
                                  ? 'var(--success)'
                                  : test.status === 'skipped'
                                  ? 'var(--muted)'
                                  : 'var(--error)',
                            }}
                          />
                          <span className="truncate">{test.name}</span>
                        </div>
                        <span className="text-[10px] font-mono shrink-0 ml-2" style={{ color: 'var(--muted)' }}>
                          {test.durationMs}ms
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Failure details if any test failed */}
                  {suite.tests.some((t: any) => t.status === 'failed') && (
                    <div
                      className="p-3 rounded-lg border text-xs font-mono space-y-1"
                      style={{
                        background: 'var(--error-bg)',
                        borderColor: 'var(--error)',
                        color: 'var(--error)',
                      }}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={13} />
                        <span>Assertion Failure in {suite.name}:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed break-all">
                        {suite.tests.find((t: any) => t.status === 'failed')?.error || 'Test condition did not evaluate to true.'}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 2: Workspace Test Files List ── */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                Detected Test Files in Workspace ({testFiles.length})
              </span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 text-xs font-semibold btn-physical-surface px-2.5 py-1 rounded-lg cursor-pointer"
              >
                <Plus size={12} />
                <span>Add Test File</span>
              </button>
            </div>

            {testFiles.length === 0 ? (
              <div
                className="p-8 rounded-xl border text-center space-y-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <FileCode size={28} className="mx-auto opacity-40" style={{ color: 'var(--muted)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  No test files detected in this workspace.
                </p>
                <button
                  onClick={() => handleCreateTest('api', 'tests/api.test.js')}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold btn-physical-primary cursor-pointer"
                >
                  Create tests/api.test.js
                </button>
              </div>
            ) : (
              testFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border flex items-center justify-between gap-3"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCode size={16} style={{ color: 'var(--accent)' }} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold font-mono truncate" style={{ color: 'var(--text)' }}>
                        {file.filePath}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {file.sizeBytes} bytes • Modified {new Date(file.modifiedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenInIDE && (
                      <button
                        onClick={() => onOpenInIDE(file.filePath)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium btn-physical-surface rounded-lg cursor-pointer"
                        title="Open file in IDE Code Editor"
                      >
                        <Code2 size={12} />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleRunTests(file.filePath)}
                      disabled={running}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold btn-physical-primary rounded-lg cursor-pointer"
                      title="Run this specific test file"
                    >
                      <Play size={11} fill="currentColor" />
                      <span>Run</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 3: Raw Terminal Console Output ── */}
        {activeTab === 'console' && (
          <div
            className="rounded-xl border overflow-hidden font-mono text-xs"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Terminal size={13} style={{ color: 'var(--accent)' }} />
                <span className="font-bold text-[11px]" style={{ color: 'var(--text)' }}>
                  Node.js Test Runner Terminal Output
                </span>
              </div>
              <button
                onClick={() => setConsoleOutput('')}
                className="text-[10px] btn-physical-surface px-2 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            </div>
            <pre
              className="p-4 overflow-x-auto max-h-80 overflow-y-auto leading-relaxed"
              style={{ background: 'var(--bg)', color: 'var(--text)' }}
            >
              {consoleOutput || 'No output recorded. Click "Run Test Suite" to execute tests.'}
            </pre>
          </div>
        )}
      </div>

      {/* ── Create New Test File Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md p-5 rounded-2xl border shadow-2xl skeuo-card space-y-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={18} style={{ color: 'var(--accent)' }} />
                <h4 className="text-sm font-bold">New Manual Test File</h4>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg btn-physical-surface cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  Target File Path
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="tests/app.test.js"
                  className="w-full px-3 py-2 rounded-xl border font-mono outline-none"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  Test Template Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'api', label: 'API Contract' },
                    { id: 'unit', label: 'Unit Test' },
                    { id: 'e2e', label: 'Integration' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewTemplateType(t.id as any)}
                      className="p-2 rounded-xl border text-center font-bold cursor-pointer transition-colors"
                      style={{
                        background: newTemplateType === t.id ? 'var(--accent-subtle)' : 'var(--surface-2)',
                        borderColor: newTemplateType === t.id ? 'var(--accent)' : 'var(--border)',
                        color: newTemplateType === t.id ? 'var(--accent)' : 'var(--muted)',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs font-semibold btn-physical-surface rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateTest()}
                disabled={creatingFile || !newFileName.trim()}
                className="px-3.5 py-1.5 text-xs font-bold btn-physical-primary rounded-lg cursor-pointer disabled:opacity-40"
              >
                {creatingFile ? 'Creating...' : 'Create & Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If embedded in a side inspector drawer (Flaw 1 resolution), return bare content
  if (isEmbedded) {
    return content;
  }

  // Otherwise render as standard modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="flex flex-col w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden border skeuo-card"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl border"
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
                borderColor: 'var(--success)',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Testing Suite & Contract Runner
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Manual test file authoring and continuous contract verification for revision {report?.revisionId || 'current'}.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl transition-all cursor-pointer btn-physical-surface"
            style={{ color: 'var(--muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}