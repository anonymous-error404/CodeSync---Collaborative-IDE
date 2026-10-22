import { Binary } from 'lucide-react';
import type { CanvasElement } from '../../types/whiteboard';

interface Props {
  element: CanvasElement;
  isSelected?: boolean;
}

export function EquationNode({ element, isSelected }: Props) {
  const latexStr = element.latex || element.text || '\\int f(x) dx';

  // Basic formatted preview parser for common mathematical expressions
  const renderMathPreview = (tex: string) => {
    return tex
      .replace(/\\int/g, '∫')
      .replace(/\\sum/g, '∑')
      .replace(/\\infty/g, '∞')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\theta/g, 'θ')
      .replace(/\\pi/g, 'π')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/_/g, ' ');
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-all select-none"
      style={{
        background: 'var(--surface)',
        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
        boxShadow: isSelected ? '0 0 0 2px var(--accent)' : 'var(--shadow-sm)',
        width: element.width || 180,
        height: element.height || 60,
      }}
    >
      <div
        className="w-7 h-7 rounded flex items-center justify-center shrink-0"
        style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
      >
        <Binary size={14} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="text-xs font-mono font-semibold truncate" style={{ color: 'var(--text)' }}>
          {renderMathPreview(latexStr)}
        </div>
        <div className="text-[10px] font-mono truncate" style={{ color: 'var(--muted)' }}>
          {latexStr}
        </div>
      </div>
    </div>
  );
}
