import { useState, useEffect } from 'react';
import {
  Split,
  Layers,
  Server,
  Database,
  Zap,
  ArrowRight,
  X,
} from 'lucide-react';
import { reviewApi } from '../../services/reviewApi';

interface Props {
  workspaceId: string;
  onClose: () => void;
}

export function EnvironmentComparisonModal({ workspaceId, onClose }: Props) {
  const [baseRev, setBaseRev] = useState('rev-v1.0.4');
  const [targetRev, setTargetRev] = useState('rev-current');
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState<'ui' | 'api' | 'database' | 'performance'>('ui');

  useEffect(() => {
    loadComparison();
  }, [baseRev, targetRev]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const data = await reviewApi.compareRevisions(workspaceId, baseRev, targetRev);
      setComparison(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden border skeuo-card"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{
                background: 'var(--accent-subtle)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
              }}
            >
              <Split size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Environment & Revision Comparison
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Side-by-side behavioral, architectural, schema, and UI regression analysis.
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

        {/* Revision Selector Bar */}
        <div
          className="flex items-center justify-between px-6 py-2.5 border-b text-xs flex-wrap gap-2"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-medium" style={{ color: 'var(--muted)' }}>Base:</span>
              <input
                type="text"
                value={baseRev}
                onChange={(e) => setBaseRev(e.target.value)}
                className="px-2.5 py-1 rounded-lg border font-mono text-xs focus:outline-none"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <ArrowRight size={14} style={{ color: 'var(--muted)' }} />

            <div className="flex items-center gap-1.5">
              <span className="font-medium" style={{ color: 'var(--muted)' }}>Target:</span>
              <input
                type="text"
                value={targetRev}
                onChange={(e) => setTargetRev(e.target.value)}
                className="px-2.5 py-1 rounded-lg border font-mono text-xs focus:outline-none"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: 'ui', label: 'Web / UI', icon: Layers },
              { id: 'api', label: 'API & Endpoints', icon: Server },
              { id: 'database', label: 'Database Schema', icon: Database },
              { id: 'performance', label: 'Performance', icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeArea === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveArea(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive ? 'btn-physical-primary' : 'btn-physical-surface'
                  }`}
                  style={
                    isActive
                      ? undefined
                      : {
                          color: 'var(--muted)',
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                        }
                  }
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-16 text-xs" style={{ color: 'var(--muted)' }}>
              Analyzing environment diff...
            </div>
          ) : !comparison ? (
            <div className="text-center py-16 text-xs" style={{ color: 'var(--muted)' }}>
              No comparison data available.
            </div>
          ) : (
            <div className="space-y-4">
              {activeArea === 'ui' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    Visual & UI Component Differences
                  </span>
                  {(!comparison.dimensions?.ui || comparison.dimensions.ui.length === 0) ? (
                    <div
                      className="p-8 rounded-xl border text-center text-xs"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      No visual or UI component differences detected between revisions <strong>{baseRev}</strong> and <strong>{targetRev}</strong>.
                    </div>
                  ) : (
                    (comparison.dimensions?.ui || []).map((diff: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border flex items-start justify-between"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                      >
                        <div>
                          <h4 className="text-xs font-bold" style={{ color: 'var(--text)' }}>{diff.component}</h4>
                          <p className="text-xs mt-1" style={{ color: 'var(--text)' }}>{diff.diff}</p>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                          style={{
                            background: 'var(--warning-bg)',
                            color: 'var(--warning)',
                            borderColor: 'var(--warning)',
                          }}
                        >
                          {diff.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeArea === 'api' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    REST & Service Contract Diffs
                  </span>
                  {(!comparison.dimensions?.api || comparison.dimensions.api.length === 0) ? (
                    <div
                      className="p-8 rounded-xl border text-center text-xs"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      No REST or API service contract changes detected between revisions <strong>{baseRev}</strong> and <strong>{targetRev}</strong>.
                    </div>
                  ) : (
                    (comparison.dimensions?.api || []).map((api: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border space-y-2"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>
                            {api.endpoint}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                            style={{
                              background: 'var(--error-bg)',
                              color: 'var(--error)',
                              borderColor: 'var(--error)',
                            }}
                          >
                            {api.status}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text)' }}>{api.diff}</p>
                        {api.oldSchema && (
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                            <div
                              className="p-2 rounded border"
                              style={{
                                background: 'var(--error-bg)',
                                borderColor: 'var(--error)',
                                color: 'var(--error)',
                              }}
                            >
                              <strong>Base Schema:</strong> {api.oldSchema}
                            </div>
                            <div
                              className="p-2 rounded border"
                              style={{
                                background: 'var(--success-bg)',
                                borderColor: 'var(--success)',
                                color: 'var(--success)',
                              }}
                            >
                              <strong>Target Schema:</strong> {api.newSchema}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeArea === 'database' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    Database Schema & Migration Diffs
                  </span>
                  {(!comparison.dimensions?.database || comparison.dimensions.database.length === 0) ? (
                    <div
                      className="p-8 rounded-xl border text-center text-xs"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      No database schema or migration differences detected between revisions <strong>{baseRev}</strong> and <strong>{targetRev}</strong>.
                    </div>
                  ) : (
                    (comparison.dimensions?.database || []).map((db: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border flex items-center justify-between"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                      >
                        <div>
                          <h4 className="text-xs font-bold font-mono" style={{ color: 'var(--accent)' }}>
                            {db.entity}
                          </h4>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{db.diff}</p>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border"
                          style={{
                            background: 'var(--success-bg)',
                            color: 'var(--success)',
                            borderColor: 'var(--success)',
                          }}
                        >
                          {db.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeArea === 'performance' && (
                !comparison.dimensions?.performance ? (
                  <div
                    className="p-8 rounded-xl border text-center text-xs"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                  >
                    Performance delta benchmarks will be recorded once comparative load tests run.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="p-4 rounded-xl border space-y-2"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Response Latency</span>
                      <div className="text-2xl font-extrabold" style={{ color: 'var(--success)' }}>
                        {comparison.dimensions?.performance?.targetLatencyMs} ms
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        Baseline: {comparison.dimensions?.performance?.baseLatencyMs} ms ({comparison.dimensions?.performance?.improvementPercent}% faster)
                      </p>
                    </div>

                    <div
                      className="p-4 rounded-xl border space-y-2"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Memory Allocation Delta</span>
                      <div className="text-2xl font-extrabold" style={{ color: 'var(--accent)' }}>
                        {comparison.dimensions?.performance?.memoryDeltaMb}
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Within allocated cgroups resource envelope</p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
