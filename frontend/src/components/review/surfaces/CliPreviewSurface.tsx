import { useState } from 'react';
import {
  Terminal,
  Play,
  CornerDownRight,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
}

export function CliPreviewSurface({
  onAddTechnicalAnnotation,
}: Props) {
  const [commandInput, setCommandInput] = useState('npm test -- --grep "CheckoutValidation"');
  const [terminalHistory, setTerminalHistory] = useState<Array<{ line: number; text: string; isError?: boolean }>>([
    { line: 1, text: '$ npm test -- --grep "CheckoutValidation"' },
    { line: 2, text: '> codesync-backend@1.0.0 test' },
    { line: 3, text: '> mocha tests/checkout.test.js --grep "CheckoutValidation"' },
    { line: 4, text: '' },
    { line: 5, text: '  Checkout Validation Suite' },
    { line: 6, text: '    ✓ should accept valid payment with credit card (18ms)' },
    { line: 7, text: '    1) should reject charge request when amount is zero' },
    { line: 8, text: '' },
    { line: 9, text: '  0 passing (82ms)', isError: true },
    { line: 10, text: '  1 failing', isError: true },
    { line: 11, text: '  1) Checkout Validation Suite should reject charge request when amount is zero:', isError: true },
    { line: 12, text: '     AssertionError [ERR_ASSERTION]: Expected status 422 but received 200 OK', isError: true },
    { line: 13, text: '       at Context.<anonymous> (tests/checkout.test.js:84:12)', isError: true },
    { line: 14, text: '       at processImmediate (node:internal/timers:478:21)', isError: true },
  ]);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const nextLine = terminalHistory.length + 1;
    const newLines = [
      { line: nextLine, text: `$ ${commandInput.trim()}` },
      { line: nextLine + 1, text: `[Process executed successfully with exit code 0]` },
    ];
    setTerminalHistory([...terminalHistory, ...newLines]);
    setCommandInput('');
  };

  const handlePinLine = (line: { line: number; text: string; isError?: boolean }) => {
    onAddTechnicalAnnotation({
      surface: 'terminal',
      type: 'bug',
      title: `CLI Test Failure at line #${line.line}`,
      comment: `Assertion failed on CLI test suite: ${line.text}`,
      severity: line.isError ? 'critical' : 'high',
      priority: 'high',
      technicalContext: {
        lineNumber: line.line,
        lineText: line.text,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-indigo-400" />
          <span className="text-xs font-bold text-white">CLI & Systems Runtime Terminal</span>
          <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 text-[10px] font-bold border border-red-800/40">
            Exit Code: 1 (Assertion Failed)
          </span>
        </div>

        <button
          onClick={() => {
            const line = terminalHistory.find((l) => l.isError) || terminalHistory[0];
            handlePinLine(line);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Pin Terminal Finding</span>
        </button>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1" style={{ background: 'var(--bg)' }}>
        {terminalHistory.map((item) => (
          <div
            key={item.line}
            onClick={() => setSelectedLine(selectedLine === item.line ? null : item.line)}
            className="flex items-start justify-between p-1 px-2 rounded cursor-pointer transition-colors"
            style={{
              background: selectedLine === item.line ? 'var(--accent-subtle)' : 'transparent',
              borderColor: selectedLine === item.line ? 'var(--accent)' : 'transparent',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="select-none w-6 text-right shrink-0" style={{ color: 'var(--muted)' }}>{item.line}</span>
              <span className={item.isError ? 'text-red-400 font-bold' : item.text.startsWith('$') ? 'text-emerald-400 font-bold' : ''}
                    style={!item.isError && !item.text.startsWith('$') ? { color: 'var(--text)' } : undefined}>
                {item.text}
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePinLine(item);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border shrink-0 cursor-pointer transition-all"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              title="Pin finding to this terminal line"
            >
              <CornerDownRight size={11} />
              <span>Pin Line</span>
            </button>
          </div>
        ))}
      </div>

      {/* Command Input Bar */}
      <form onSubmit={handleRunCommand} className="p-3 border-t shrink-0 flex items-center gap-2"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <span className="text-emerald-400 font-mono text-xs font-bold select-none">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Execute CLI command in container (e.g. npm test, curl -I localhost:5000)"
          className="flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          type="submit"
          className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <Play size={12} />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}
