import { Sparkles, Check, RotateCcw, Copy } from 'lucide-react';
import type { CanvasElement } from '../../types/whiteboard';

interface Props {
  candidate: Partial<CanvasElement>;
  onAccept: () => void;
  onReject: () => void;
  onKeepBoth: () => void;
}

export function SmartRecognitionBanner({ candidate, onAccept, onReject, onKeepBoth }: Props) {
  const shapeName = candidate.type ? candidate.type.toUpperCase() : 'SHAPE';

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg border animate-fade-in"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--accent)',
        color: 'var(--text)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
        <Sparkles size={16} />
        <span>Smart Recognition: Detected {shapeName}</span>
      </div>

      <div className="w-px h-4" style={{ background: 'var(--border)' }} />

      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer' }}
        >
          <Check size={12} /> Convert to Vector
        </button>

        <button
          onClick={onKeepBoth}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
        >
          <Copy size={12} /> Keep Both
        </button>

        <button
          onClick={onReject}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
        >
          <RotateCcw size={12} /> Keep Sketch
        </button>
      </div>
    </div>
  );
}
