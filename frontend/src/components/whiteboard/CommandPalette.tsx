/**
 * CommandPalette — Constrained NLP command input for canvas operations.
 *
 * Integrates with the deterministic nlpCommandParser.
 * Never calls an LLM or external API.
 */
import { useState, useRef, useEffect } from 'react';
import { Terminal, X, ChevronRight, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { parseCommand, suggestCompletions } from '../../services/nlpCommandParser';
import type { CanvasElement, ParsedCommand } from '../../types/whiteboard';

interface Props {
  elements: CanvasElement[];
  selectedIds: string[];
  onClose: () => void;
  onExecute: (cmd: ParsedCommand) => void;
}

export function CommandPalette({ elements, selectedIds, onClose, onExecute }: Props) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(suggestCompletions(''));
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (val: string) => {
    setInput(val);
    setConfirmed(false);
    setParsed(null);
    setSuggestions(suggestCompletions(val));
  };

  const handleParse = () => {
    if (!input.trim()) return;
    const result = parseCommand(input, elements, selectedIds);
    setParsed(result);
    setConfirmed(false);
  };

  const handleExecute = () => {
    if (!parsed || !parsed.confident) return;
    onExecute(parsed);
    setConfirmed(true);
    setTimeout(() => onClose(), 800);
  };

  const DESTRUCTIVE = ['delete', 'layout', 'align', 'arrange', 'group', 'ungroup'];
  const needsConfirm = parsed && DESTRUCTIVE.includes(parsed.intent) && !confirmed;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Terminal size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Command Palette</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'no selection'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (parsed && parsed.confident && !needsConfirm) handleExecute();
                else if (needsConfirm) handleExecute();
                else handleParse();
              }
            }}
            placeholder="e.g. align left · connect API to Database · validate board"
            className="flex-1 bg-transparent focus:outline-none text-sm"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
          />
          <button
            onClick={handleParse}
            disabled={!input.trim()}
            className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed' }}
          >
            Parse
          </button>
        </div>

        {/* Suggestions */}
        {!parsed && suggestions.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); setSuggestions([]); }}
                className="text-[11px] px-2 py-0.5 rounded border"
                style={{
                  color: 'var(--muted)',
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Parse result */}
        {parsed && (
          <div
            className="mx-4 mb-3 rounded-xl border p-3 flex flex-col gap-2"
            style={{
              background: 'var(--bg)',
              borderColor: parsed.error ? 'var(--error)' : parsed.confident ? 'var(--accent)' : 'var(--warning)',
            }}
          >
            {/* Intent line */}
            <div className="flex items-center gap-2">
              {parsed.error ? (
                <AlertTriangle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
              ) : parsed.confident ? (
                <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
              ) : (
                <Info size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              )}
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: parsed.error ? 'rgba(248,81,73,0.1)' : 'rgba(47,129,247,0.1)',
                  color: parsed.error ? 'var(--error)' : 'var(--accent)',
                }}
              >
                {parsed.intent}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted)' }}>
                {parsed.preview || parsed.error}
              </span>
            </div>

            {/* Ambiguities */}
            {(parsed.ambiguities ?? []).length > 0 && (
              <div className="flex flex-col gap-1">
                {parsed.ambiguities!.map((a, i) => (
                  <div key={i} className="text-xs flex items-center gap-1" style={{ color: 'var(--warning)' }}><AlertTriangle size={11} /> {a}</div>
                ))}
              </div>
            )}

            {/* Target count */}
            {parsed.targetIds.length > 0 && (
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Affects {parsed.targetIds.length} element(s)
              </div>
            )}

            {/* Action button */}
            {!parsed.error && parsed.confident && (
              <button
                onClick={handleExecute}
                className="flex items-center justify-center gap-1.5 mt-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{
                  background: confirmed ? 'var(--success)' : 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {confirmed ? (
                  <><CheckCircle size={12} /> Done</>
                ) : (
                  <><ChevronRight size={12} /> Execute: {parsed.preview}</>
                )}
              </button>
            )}

            {/* Error help */}
            {parsed.error && (
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Supported: align, arrange, connect X to Y, group, find, show dependencies, create node, fit canvas, validate
              </div>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div
          className="px-4 py-2 text-[11px] border-t"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
        >
          Enter to parse · Enter again to execute · Esc to close · All operations are undoable
        </div>
      </div>
    </div>
  );
}
