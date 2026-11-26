import { useRef } from 'react';
import {
  Monitor,
  Maximize2,
  Minus,
  X,
} from 'lucide-react';
import { FigmaPinOverlay } from '../FigmaPinOverlay';
import type { PreviewAnnotation, AnnotationType } from '../../../types';

interface Props {
  previewUrl: string;
  pinModeActive: boolean;
  annotations: PreviewAnnotation[];
  onAddPin: (
    coords: { x: number; y: number },
    payload: { title: string; comment: string; type: AnnotationType; priority: string; severity: string }
  ) => void;
  onUpdateAnnotation: (id: string, payload: Partial<PreviewAnnotation>) => void;
  onAddReply: (id: string, comment: string) => void;
}

export function DesktopPreviewSurface({
  previewUrl,
  pinModeActive,
  annotations,
  onAddPin,
  onUpdateAnnotation,
  onAddReply,
}: Props) {
  const windowRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0"
           style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Monitor size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Desktop Application Remote Session</span>
        </div>
      </div>

      {/* Desktop Window Frame */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          ref={windowRef}
          className="relative w-full max-w-5xl h-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* macOS Title Bar */}
          <div className="h-9 px-3 border-b flex items-center justify-between select-none shrink-0"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:opacity-80 transition-opacity" />
              <div className="w-3 h-3 rounded-full bg-amber-500 hover:opacity-80 transition-opacity" />
              <div className="w-3 h-3 rounded-full bg-emerald-500 hover:opacity-80 transition-opacity" />
            </div>

            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>CodeSync Desktop Client - v1.4.0</span>

            <div className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Minus size={12} />
              <Maximize2 size={11} />
              <X size={13} />
            </div>
          </div>

          {/* Window Canvas */}
          <div className="relative flex-1 w-full bg-white overflow-hidden">
            <iframe
              src={previewUrl}
              title="CodeSync Desktop Preview"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            <FigmaPinOverlay
              annotations={annotations.filter((a) => a.surface === 'desktop' || a.surface === 'web')}
              pinModeActive={pinModeActive}
              onAddPin={onAddPin}
              onUpdateAnnotation={onUpdateAnnotation}
              onAddReply={onAddReply}
              containerRef={windowRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
