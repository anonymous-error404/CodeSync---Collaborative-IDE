/**
 * TextToDiagramModal — Structured text-to-diagram conversion UI.
 *
 * Uses the deterministic textToDiagramParser.
 * Shows a preview of parsed nodes and edges.
 * Unresolved lines are shown separately.
 * Original text is preserved separately.
 * No AI calls.
 */
import { useState } from 'react';
import { FileText, X, CheckCircle, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { parseTextToDiagram, buildCanvasElements } from '../../services/textToDiagramParser';
import type { TextDiagramParseResult, CanvasElement } from '../../types/whiteboard';

interface Props {
  existingElements: CanvasElement[];
  onClose: () => void;
  onConfirm: (elements: CanvasElement[], originalText: string) => void;
}

const EXAMPLE_TEXT =
`Client -> API Gateway : calls
API Gateway -> Auth Service : calls
API Gateway -> User Service : calls
User Service -> PostgreSQL : reads_from
Auth Service -> Redis : reads_from
- Notification Worker (worker)
Notification Worker -> Email Service (external)`;

export function TextToDiagramModal({ existingElements, onClose, onConfirm }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TextDiagramParseResult | null>(null);
  const [preview, setPreview] = useState<CanvasElement[] | null>(null);

  const handleParse = () => {
    if (!text.trim()) return;
    const parsed = parseTextToDiagram(text, existingElements);
    setResult(parsed);
    setPreview(buildCanvasElements(parsed));
  };

  const handleConfirm = () => {
    if (!preview) return;
    onConfirm(preview, text);
    onClose();
  };

  const handleReset = () => {
    setResult(null);
    setPreview(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <FileText size={16} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Text → Diagram Conversion
            </div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Deterministic parser — only explicit relationships are created
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Input */}
          <div className="flex flex-col w-1/2 border-r" style={{ borderColor: 'var(--border)' }}>
            <div
              className="px-4 py-2 text-[11px] font-semibold border-b"
              style={{ color: 'var(--muted)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}
            >
              INPUT TEXT
            </div>

            <textarea
              value={text}
              onChange={e => { setText(e.target.value); handleReset(); }}
              placeholder={EXAMPLE_TEXT}
              className="flex-1 resize-none focus:outline-none p-4 font-mono text-xs"
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                border: 'none',
                lineHeight: 1.6,
              }}
            />

            {/* Supported formats hint */}
            <div
              className="px-4 py-3 border-t text-[11px] space-y-0.5"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}
            >
              <div className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Supported formats:</div>
              <div>• <code>Source -&gt; Target : relationship</code></div>
              <div>• <code>- ComponentName (type)</code></div>
              <div>• <code>Source | Relationship | Target</code> (table)</div>
              <div>• Limited prose: "Client sends request to API"</div>
              <div className="mt-1.5 text-[10px]" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                Unrecognised sentences are shown as unresolved — not added to diagram.
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setText(EXAMPLE_TEXT)}
                className="text-xs px-3 py-1.5 rounded-lg border"
                style={{ color: 'var(--muted)', borderColor: 'var(--border)', background: 'none', cursor: 'pointer' }}
              >
                Load example
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed' }}
              >
                <RefreshCw size={12} />
                Parse
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div
              className="px-4 py-2 text-[11px] font-semibold border-b"
              style={{ color: 'var(--muted)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}
            >
              PREVIEW {result ? `· ${result.nodes.length} nodes · ${result.edges.length} edges` : ''}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!result && (
                <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
                  <FileText size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div className="text-xs text-center">
                    Enter text and click Parse<br />to preview the diagram
                  </div>
                </div>
              )}

              {result && (
                <>
                  {/* Nodes */}
                  {result.nodes.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        NODES ({result.nodes.length})
                      </div>
                      <div className="space-y-1">
                        {result.nodes.map(node => (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                          >
                            <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{node.label}</span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{ color: 'var(--muted)', background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}
                            >
                              {node.diagramType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edges */}
                  {result.edges.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        RELATIONSHIPS ({result.edges.length})
                      </div>
                      <div className="space-y-1">
                        {result.edges.map((edge, i) => {
                          const src = result.nodes.find(n => n.id === edge.fromId);
                          const tgt = result.nodes.find(n => n.id === edge.toId);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                            >
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{src?.label ?? '?'}</span>
                              <ArrowRight size={10} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                              <span
                                className="px-1.5 py-0.5 rounded"
                                style={{ color: 'var(--accent)', background: 'rgba(47,129,247,0.1)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                              >
                                {edge.label ?? edge.relationship}
                              </span>
                              <ArrowRight size={10} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{tgt?.label ?? '?'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unresolved */}
                  {result.unresolved.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                        UNRESOLVED ({result.unresolved.length}) — not added
                      </div>
                      <div className="space-y-1">
                        {result.unresolved.map((line, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'rgba(210,153,34,0.07)', border: '1px solid rgba(210,153,34,0.3)' }}
                          >
                            <AlertTriangle size={11} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                              {line}
                            </span>
                          </div>
                        ))}
                        <div className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                          Rewrite these using supported formats (arrow notation, bullet list, or table rows).
                        </div>
                      </div>
                    </div>
                  )}

                  {result.nodes.length === 0 && (
                    <div className="text-xs text-center py-8" style={{ color: 'var(--muted)' }}>
                      No nodes could be extracted. Try arrow notation: "Service A -&gt; Service B : calls"
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Original text is preserved separately · All objects will be editable
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!preview || (result?.nodes.length ?? 0) === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--accent)', border: 'none', cursor: preview ? 'pointer' : 'not-allowed' }}
                >
                  <CheckCircle size={12} /> Add to Canvas
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
