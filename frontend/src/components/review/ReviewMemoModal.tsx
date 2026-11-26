import { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Sparkles,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ReviewMemo, PreviewAnnotation } from '../../types';
import { reviewApi } from '../../services/reviewApi';

interface Props {
  memo: ReviewMemo | null;
  annotations: PreviewAnnotation[];
  onClose: () => void;
  onUpdateMemo: (payload: Partial<ReviewMemo>) => void;
}

export function ReviewMemoModal({ memo, annotations, onClose, onUpdateMemo }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'decisions' | 'action_items' | 'conclusions'>('overview');
  const [summary, setSummary] = useState(memo?.summary || '');
  const [objective, setObjective] = useState(memo?.objective || '');
  const [manualNotes, setManualNotes] = useState(memo?.manualNotes || '');
  const [status, setStatus] = useState(memo?.status || 'draft');
  const [saving, setSaving] = useState(false);

  // New action item state
  const [actionDesc, setActionDesc] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  if (!memo) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateMemo({
        summary,
        objective,
        manualNotes,
        status,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddActionItem = () => {
    if (!actionDesc.trim()) return;
    const items = Array.isArray(memo.actionItems) ? [...memo.actionItems] : [];
    items.push({
      id: `act-${Date.now().toString(36)}`,
      description: actionDesc.trim(),
      assignee: actionAssignee.trim() || 'Team Lead',
      dueDate: actionDueDate || 'Next Sprint',
      completed: false,
    });
    onUpdateMemo({ actionItems: items });
    setActionDesc('');
    setActionAssignee('');
    setActionDueDate('');
  };

  const handleToggleActionItem = (id: string) => {
    const items = (memo.actionItems || []).map((item: any) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onUpdateMemo({ actionItems: items });
  };

  const handleExportMarkdown = async () => {
    try {
      const md = await reviewApi.exportMemo(memo.id);
      // Trigger download
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Review-Memo-${memo.revisionId}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const blockingIssues = annotations.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const nonBlockingSuggestions = annotations.filter((a) => a.type === 'suggestion' || a.severity === 'low');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="flex flex-col w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden border skeuo-card"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header Bar */}
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
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{memo.title}</h3>
                <span
                  className="px-2 py-0.5 text-[11px] font-mono rounded border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  {memo.revisionId}
                </span>
                <span
                  className="px-2 py-0.5 text-[11px] font-extrabold rounded uppercase tracking-wider border"
                  style={{
                    background:
                      memo.status === 'approved'
                        ? 'var(--success-bg)'
                        : memo.status === 'changes_requested'
                        ? 'var(--warning-bg)'
                        : 'var(--accent-subtle)',
                    color:
                      memo.status === 'approved'
                        ? 'var(--success)'
                        : memo.status === 'changes_requested'
                        ? 'var(--warning)'
                        : 'var(--accent)',
                    borderColor:
                      memo.status === 'approved'
                        ? 'var(--success)'
                        : memo.status === 'changes_requested'
                        ? 'var(--warning)'
                        : 'var(--accent-border)',
                  }}
                >
                  {memo.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Central structured record of inspection, findings, discussions, decisions & action items.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer btn-physical-surface"
              style={{ color: 'var(--text)' }}
            >
              <Download size={14} />
              <span>Export .MD</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer btn-physical-surface"
              style={{ color: 'var(--text)' }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl transition-all cursor-pointer btn-physical-surface"
              style={{ color: 'var(--muted)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex items-center gap-1.5 px-6 py-2.5 border-b text-xs font-semibold overflow-x-auto"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          {[
            { id: 'overview', label: '1. Executive Context' },
            { id: 'findings', label: `2. Consolidated Findings (${annotations.length})` },
            { id: 'decisions', label: '3. Technical Decisions' },
            { id: 'action_items', label: `4. Action Items (${(memo.actionItems || []).length})` },
            { id: 'conclusions', label: '5. Final Approval & Sign-Off' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>
                  Review Objective & Scope
                </label>
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="e.g. Verify checkout payment gateway migration before production release"
                  className="w-full px-3 py-2 text-xs rounded-xl border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>
                  Executive Findings Summary
                </label>
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Provide overall summary of findings, test scenarios covered, and readiness..."
                  className="w-full px-3 py-2 text-xs rounded-xl border resize-none outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>
                  Architectural Notes & Discussion Records
                </label>
                <textarea
                  rows={5}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Document technical trade-offs, engineering agreements, or non-obvious design choices discussed during the QA review session..."
                  className="w-full px-3 py-2 text-xs rounded-xl border resize-none font-mono outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold shadow transition-all cursor-pointer btn-physical-primary"
                >
                  {saving ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FINDINGS */}
          {activeTab === 'findings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                <span>
                  All visual pins and technical annotations linked to revision{' '}
                  <strong style={{ color: 'var(--text)' }}>{memo.revisionId}</strong>
                </span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  {blockingIssues.length} Blocking Issues | {nonBlockingSuggestions.length} Non-blocking
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {annotations.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3.5 rounded-xl border space-y-2 shadow-sm"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase"
                          style={{
                            background:
                              finding.severity === 'critical'
                                ? 'var(--error-bg)'
                                : finding.severity === 'high'
                                ? 'var(--warning-bg)'
                                : 'var(--accent-subtle)',
                            color:
                              finding.severity === 'critical'
                                ? 'var(--error)'
                                : finding.severity === 'high'
                                ? 'var(--warning)'
                                : 'var(--accent)',
                            border: '1px solid',
                            borderColor:
                              finding.severity === 'critical'
                                ? 'var(--error)'
                                : finding.severity === 'high'
                                ? 'var(--warning)'
                                : 'var(--accent-border)',
                          }}
                        >
                          {finding.severity}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                        >
                          {finding.surface}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                        >
                          {finding.status}
                        </span>
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {finding.author?.username || 'Reviewer'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold" style={{ color: 'var(--text)' }}>{finding.title}</h4>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>{finding.comment}</p>

                    {finding.technicalContext && (
                      <div
                        className="p-2 rounded border text-[10px] font-mono"
                        style={{
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--accent)',
                        }}
                      >
                        {finding.technicalContext.endpoint && <span>Endpoint: {finding.technicalContext.endpoint} | </span>}
                        {finding.technicalContext.filePath && <span>File: {finding.technicalContext.filePath}:{finding.technicalContext.logLine}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DECISIONS */}
          {activeTab === 'decisions' && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Formal technical decisions made during the review session, recording reasoning and ownership.
              </p>

              {annotations.filter((a) => a.decision).length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--muted)' }}>
                  <Sparkles size={24} className="mx-auto mb-2 opacity-40" />
                  <p>No formal decisions recorded yet.</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                    Click &quot;Record Decision&quot; on any visual or technical finding to register an accepted or deferred resolution.
                  </p>
                </div>
              ) : (
                annotations
                  .filter((a) => a.decision)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border text-xs space-y-1.5"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs" style={{ color: 'var(--accent)' }}>
                          Finding: {item.title}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full font-extrabold uppercase text-[10px]"
                          style={{
                            background: 'var(--accent-subtle)',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent-border)',
                          }}
                        >
                          {item.decision?.outcome}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text)' }}>{item.decision?.reasoning}</p>
                      <div className="text-[10px] pt-1" style={{ color: 'var(--muted)' }}>
                        Recorded on: {new Date(item.decision?.decidedAt || item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* TAB 4: ACTION ITEMS */}
          {activeTab === 'action_items' && (
            <div className="space-y-4 max-w-2xl">
              <div
                className="p-3 rounded-xl border space-y-2"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>Add Concrete Action Item</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Action item description..."
                    value={actionDesc}
                    onChange={(e) => setActionDesc(e.target.value)}
                    className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <input
                    type="text"
                    placeholder="Assignee (e.g. Alice)"
                    value={actionAssignee}
                    onChange={(e) => setActionAssignee(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddActionItem}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all btn-physical-primary"
                  >
                    <Plus size={13} /> Add Task
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(memo.actionItems || []).map((action: any) => (
                  <div
                    key={action.id}
                    onClick={() => handleToggleActionItem(action.id)}
                    className="flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer"
                    style={{
                      background: action.completed ? 'var(--success-bg)' : 'var(--surface-2)',
                      borderColor: action.completed ? 'var(--success)' : 'var(--border)',
                      color: action.completed ? 'var(--muted)' : 'var(--text)',
                      textDecoration: action.completed ? 'line-through' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-md flex items-center justify-center border"
                        style={{
                          background: action.completed ? 'var(--success)' : 'transparent',
                          borderColor: action.completed ? 'var(--success)' : 'var(--border)',
                          color: '#fff',
                        }}
                      >
                        {action.completed && <CheckCircle2 size={12} />}
                      </div>
                      <span className="text-xs font-medium">{action.description}</span>
                    </div>

                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-semibold border"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--muted)',
                      }}
                    >
                      Assignee: {action.assignee}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONCLUSIONS & SIGN-OFF */}
          {activeTab === 'conclusions' && (
            <div className="space-y-5 max-w-2xl">
              <div
                className="p-5 rounded-2xl border space-y-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <ShieldCheck size={16} style={{ color: 'var(--accent)' }} /> Formal Review Sign-Off
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  The review memo permanently documents stakeholder consensus for revision <strong style={{ color: 'var(--text)' }}>{memo.revisionId}</strong>.
                  Marking approved signifies all blocking defects are resolved and the revision is safe to merge or deploy.
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setStatus('approved');
                      onUpdateMemo({ status: 'approved' });
                    }}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      status === 'approved' ? '' : 'btn-physical-surface'
                    }`}
                    style={
                      status === 'approved'
                        ? {
                            background: 'var(--success-bg)',
                            borderColor: 'var(--success)',
                            color: 'var(--success)',
                            fontWeight: 'bold',
                          }
                        : {
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }
                    }
                  >
                    <CheckCircle2 size={18} className="mx-auto mb-1" style={{ color: 'var(--success)' }} />
                    <span className="text-xs">Approve Revision</span>
                  </button>

                  <button
                    onClick={() => {
                      setStatus('changes_requested');
                      onUpdateMemo({ status: 'changes_requested' });
                    }}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      status === 'changes_requested' ? '' : 'btn-physical-surface'
                    }`}
                    style={
                      status === 'changes_requested'
                        ? {
                            background: 'var(--warning-bg)',
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)',
                            fontWeight: 'bold',
                          }
                        : {
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }
                    }
                  >
                    <Clock size={18} className="mx-auto mb-1" style={{ color: 'var(--warning)' }} />
                    <span className="text-xs">Changes Requested</span>
                  </button>

                  <button
                    onClick={() => {
                      setStatus('rejected');
                      onUpdateMemo({ status: 'rejected' });
                    }}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      status === 'rejected' ? '' : 'btn-physical-surface'
                    }`}
                    style={
                      status === 'rejected'
                        ? {
                            background: 'var(--error-bg)',
                            borderColor: 'var(--error)',
                            color: 'var(--error)',
                            fontWeight: 'bold',
                          }
                        : {
                            background: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }
                    }
                  >
                    <XCircle size={18} className="mx-auto mb-1" style={{ color: 'var(--error)' }} />
                    <span className="text-xs">Reject Revision</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
