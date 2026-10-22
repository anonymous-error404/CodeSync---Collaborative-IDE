import { Code2, ExternalLink, FileCode } from 'lucide-react';
import type { CanvasElement, CodeBlockType } from '../../types/whiteboard';

interface Props {
  element: CanvasElement;
  isSelected?: boolean;
  onOpenInIDE?: (filePath: string) => void;
}

const BADGE_CONFIG: Record<CodeBlockType, { label: string; color: string; bg: string }> = {
  static: { label: 'Static Snippet', color: 'var(--muted)', bg: 'var(--surface-2)' },
  snapshot: { label: 'Linked Snapshot', color: 'var(--warning)', bg: 'rgba(210,153,34,0.1)' },
  reference: { label: 'Live Reference', color: 'var(--success)', bg: 'var(--success-bg)' },
  proposed: { label: 'Proposed Code', color: 'var(--accent)', bg: 'rgba(47,129,247,0.1)' },
};

export function CodeCellNode({ element, isSelected, onOpenInIDE }: Props) {
  const linkType: CodeBlockType = element.codeLinkType || 'static';
  const badge = BADGE_CONFIG[linkType];
  const filePath = element.linkedFilePath || '';

  return (
    <div
      className="flex flex-col rounded-xl border shadow-md overflow-hidden transition-all select-none"
      style={{
        background: '#0d1117',
        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
        boxShadow: isSelected ? '0 0 0 2px var(--accent)' : 'var(--shadow-md)',
        width: element.width || 280,
        minHeight: element.height || 140,
      }}
    >
      {/* Code Header Bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <Code2 size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text)' }}>
            {element.codeLanguage || 'javascript'}
          </span>
        </div>

        {/* Link Type Badge */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
          style={{ color: badge.color, background: badge.bg, borderColor: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* Code Content */}
      <div className="flex-1 p-3 font-mono text-xs overflow-auto" style={{ color: '#e6edf3', lineHeight: 1.5 }}>
        <pre className="whitespace-pre-wrap font-mono">
          {element.codeContent || element.text || '// Type code here...'}
        </pre>
      </div>

      {/* Source File Link & Action Footer */}
      {filePath && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-t shrink-0 text-xs"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-1.5 truncate max-w-[180px]" style={{ color: 'var(--muted)' }}>
            <FileCode size={12} />
            <span className="font-mono text-[11px] truncate">{filePath}</span>
          </div>

          {onOpenInIDE && (
            <button
              onClick={() => onOpenInIDE(filePath)}
              className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Open in IDE <ExternalLink size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
