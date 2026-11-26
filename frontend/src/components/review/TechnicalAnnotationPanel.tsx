import React, { useState } from 'react';
import {
  Code,
  Terminal,
  Database,
  Server,
  Cpu,
  Plus,
  FileText,
  CornerDownRight,
  CheckCircle,
} from 'lucide-react';
import type { PreviewAnnotation, AnnotationSurface, AnnotationType } from '../../types';

interface Props {
  annotations: PreviewAnnotation[];
  previewType?: string;
  onAddAnnotation: (payload: Partial<PreviewAnnotation>) => void;
  onUpdateAnnotation: (id: string, payload: Partial<PreviewAnnotation>) => void;
  onAddReply: (id: string, comment: string) => void;
}

export function TechnicalAnnotationPanel({
  annotations,
  previewType: _previewType,
  onAddAnnotation,
  onUpdateAnnotation,
  onAddReply,
}: Props) {
  const [activeTab, setActiveTab] = useState<'api' | 'logs' | 'database' | 'terminal' | 'ml'>('api');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // New Technical Annotation Form State
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [type, setType] = useState<AnnotationType>('bug');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');

  // Technical Context
  const [endpoint, setEndpoint] = useState('POST /api/v1/checkout/charge');
  const [statusCode, setStatusCode] = useState(422);
  const [logLine, setLogLine] = useState(84);
  const [filePath, setFilePath] = useState('src/controllers/paymentController.js');
  const [dbTable, setDbTable] = useState('transactions');
  const [query, setQuery] = useState('SELECT * FROM transactions WHERE amount <= 0');
  const [replyText, setReplyText] = useState('');

  const filteredAnnotations = annotations.filter((a) => {
    if (activeTab === 'api') return a.surface === 'api';
    if (activeTab === 'logs') return a.surface === 'logs';
    if (activeTab === 'database') return a.surface === 'database';
    if (activeTab === 'terminal') return a.surface === 'terminal';
    if (activeTab === 'ml') return a.surface === 'ml';
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !comment.trim()) return;

    const surface: AnnotationSurface = activeTab;
    const technicalContext: Record<string, any> = {};

    if (activeTab === 'api') {
      technicalContext.endpoint = endpoint;
      technicalContext.statusCode = Number(statusCode);
    } else if (activeTab === 'logs') {
      technicalContext.logLine = Number(logLine);
      technicalContext.filePath = filePath;
    } else if (activeTab === 'database') {
      technicalContext.dbTable = dbTable;
      technicalContext.query = query;
    } else if (activeTab === 'terminal') {
      technicalContext.lineNumber = Number(logLine);
    }

    onAddAnnotation({
      surface,
      type,
      title: title.trim(),
      comment: comment.trim(),
      severity,
      priority,
      technicalContext,
    });

    setTitle('');
    setComment('');
    setShowAddForm(false);
  };

  const handleReply = (annotationId: string) => {
    if (!replyText.trim()) return;
    onAddReply(annotationId, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1,#0f141c)] text-[var(--foreground,#c9d1d9)]">
      {/* Surface Selector Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)]">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Server size={13} />
            <span>API & Requests</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FileText size={13} />
            <span>Runtime Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeTab === 'database'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Database size={13} />
            <span>Database & Schemas</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeTab === 'terminal'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Terminal size={13} />
            <span>Terminal Lines</span>
          </button>

          <button
            onClick={() => setActiveTab('ml')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              activeTab === 'ml'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Cpu size={13} />
            <span>ML Evals</span>
          </button>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>New Finding</span>
        </button>
      </div>

      {/* Technical Add Form Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-3 border-b border-[var(--border,#30363d)] bg-[var(--surface-3,#1a202c)] space-y-2.5 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400">
              Attach Technical Finding to {activeTab.toUpperCase()} Surface
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-neutral-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Unhandled zero amount validation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full px-2 py-1 text-xs rounded border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2 py-1 text-xs rounded border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-2 py-1 text-xs rounded border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="bug">Bug</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="change_request">Change Request</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contextual Input Fields based on active tab */}
          {activeTab === 'api' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-neutral-400">Endpoint / Operation</label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400">Status Code</label>
                <input
                  type="number"
                  value={statusCode}
                  onChange={(e) => setStatusCode(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400">Source File Path</label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400">Log / Stack Line #</label>
                <input
                  type="number"
                  value={logLine}
                  onChange={(e) => setLogLine(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400">Table / Schema</label>
                <input
                  type="text"
                  value={dbTable}
                  onChange={(e) => setDbTable(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400">Query Reference</label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-neutral-400">Description & Technical Rationale</label>
            <textarea
              rows={2}
              required
              placeholder="Explain the technical defect, schema flaw, or expected response..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-3 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Attach Finding
            </button>
          </div>
        </form>
      )}

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredAnnotations.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 text-xs">
            <Code size={24} className="mx-auto mb-2 opacity-40" />
            <p>No technical findings attached to {activeTab.toUpperCase()} yet.</p>
            <p className="text-[11px] mt-1 text-neutral-400">
              Click &quot;New Finding&quot; above to link a defect directly to an endpoint, log line, or query.
            </p>
          </div>
        ) : (
          filteredAnnotations.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnotationId(selectedAnnotationId === item.id ? null : item.id)}
              className="p-3 rounded-xl border border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] hover:border-indigo-500/50 transition-all cursor-pointer shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase text-white ${
                        item.severity === 'critical'
                          ? 'bg-red-600'
                          : item.severity === 'high'
                          ? 'bg-amber-600'
                          : 'bg-blue-600'
                      }`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {item.type}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-white mt-1.5">{item.title}</h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    title={item.status === 'resolved' ? 'Mark as Open' : 'Mark as Resolved'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateAnnotation(item.id, {
                        status: item.status === 'resolved' ? 'open' : 'resolved',
                      });
                    }}
                    className={`p-1 rounded text-xs transition-colors ${
                      item.status === 'resolved'
                        ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/40'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <CheckCircle size={13} />
                  </button>
                </div>
              </div>

              {/* Technical Context Pill */}
              {item.technicalContext && (
                <div className="mt-2 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-indigo-300 flex items-center gap-1.5 overflow-x-auto">
                  <CornerDownRight size={12} className="text-neutral-500 shrink-0" />
                  {item.technicalContext.endpoint && (
                    <span>Endpoint: {item.technicalContext.endpoint} ({item.technicalContext.statusCode})</span>
                  )}
                  {item.technicalContext.filePath && (
                    <span>Ref: {item.technicalContext.filePath}:{item.technicalContext.logLine || item.technicalContext.lineNumber}</span>
                  )}
                  {item.technicalContext.dbTable && (
                    <span>Table: {item.technicalContext.dbTable} | {item.technicalContext.query}</span>
                  )}
                </div>
              )}

              <p className="text-xs text-neutral-300 mt-2 leading-relaxed">{item.comment}</p>

              {/* Threaded comments when expanded */}
              {selectedAnnotationId === item.id && (
                <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                  <div className="space-y-1.5">
                    {(item.replies || []).map((r) => (
                      <div key={r.id} className="p-2 rounded bg-neutral-900 text-[11px]">
                        <div className="flex items-center justify-between text-neutral-400 text-[10px] mb-0.5">
                          <span className="font-semibold text-neutral-200">{r.username}</span>
                          <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-neutral-300">{r.comment}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Add engineering clarification..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs rounded bg-neutral-900 border border-neutral-700 text-white"
                    />
                    <button
                      onClick={() => handleReply(item.id)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
