import { useState, useRef } from 'react';
import {
  RotateCw,
  Camera,
  Wifi,
  Battery,
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

export function MobilePreviewSurface({
  previewUrl,
  pinModeActive,
  annotations,
  onAddPin,
  onUpdateAnnotation,
  onAddReply,
}: Props) {
  const [deviceModel, setDeviceModel] = useState<'iphone' | 'pixel'>('iphone');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const screenRef = useRef<HTMLDivElement>(null);

  const isPortrait = orientation === 'portrait';
  const width = isPortrait ? 385 : 740;
  const height = isPortrait ? 780 : 420;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Mobile Device Control Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0"
           style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Device:</span>
          <div className="flex items-center p-0.5 rounded-xl border text-xs"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <button
              onClick={() => setDeviceModel('iphone')}
              className="px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer"
              style={{
                background: deviceModel === 'iphone' ? 'var(--surface-2)' : 'transparent',
                color: deviceModel === 'iphone' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              iPhone 16 Pro
            </button>
            <button
              onClick={() => setDeviceModel('pixel')}
              className="px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer"
              style={{
                background: deviceModel === 'pixel' ? 'var(--surface-2)' : 'transparent',
                color: deviceModel === 'pixel' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              Google Pixel 9
            </button>
          </div>

          <button
            onClick={() => setOrientation(isPortrait ? 'landscape' : 'portrait')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:bg-[var(--surface-2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <RotateCw size={13} />
            <span>Rotate ({isPortrait ? 'Portrait' : 'Landscape'})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Screenshot captured & linked to review session evidence.')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-[var(--surface-2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <Camera size={13} />
            <span>Capture Screenshot</span>
          </button>
        </div>
      </div>

      {/* Device Chassis Frame */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto" style={{ background: 'var(--bg)' }}>
        <div
          className="relative transition-all duration-300 bg-black rounded-[48px] p-3 shadow-2xl border-4 border-neutral-800 ring-1 ring-neutral-700/50 flex flex-col shrink-0"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          {/* Hardware notch / island */}
          {deviceModel === 'iphone' ? (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-between px-2.5 pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 ring-1 ring-neutral-800" />
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 ring-1 ring-neutral-800" />
            </div>
          ) : (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-30 ring-1 ring-neutral-800 pointer-events-none" />
          )}

          {/* Status Bar */}
          <div className="h-7 w-full flex items-center justify-between px-6 text-[11px] font-semibold text-white select-none shrink-0 z-20">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Wifi size={12} />
              <span className="text-[10px] font-mono">5G</span>
              <Battery size={13} />
            </div>
          </div>

          {/* Mobile Screen Iframe & Pins */}
          <div
            ref={screenRef}
            className="relative flex-1 w-full bg-white rounded-[36px] overflow-hidden"
          >
            <iframe
              src={previewUrl}
              title="CodeSync Mobile Preview"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            <FigmaPinOverlay
              annotations={annotations.filter((a) => a.surface === 'mobile' || a.surface === 'web')}
              pinModeActive={pinModeActive}
              onAddPin={onAddPin}
              onUpdateAnnotation={onUpdateAnnotation}
              onAddReply={onAddReply}
              containerRef={screenRef}
            />
          </div>

          {/* Home indicator bar */}
          <div className="h-4 w-full flex items-center justify-center shrink-0">
            <div className="w-32 h-1 rounded-full bg-neutral-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
