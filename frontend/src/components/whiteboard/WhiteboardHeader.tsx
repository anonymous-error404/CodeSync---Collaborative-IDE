/**
 * WhiteboardHeader — Top navigation for the engineering canvas.
 *
 * Teach Mode fully removed.
 * Added: command palette trigger, layout selector, text-to-diagram,
 *        validation panel, fit-to-canvas, PNG/SVG/JSON export,
 *        proper save-state feedback.
 */
import { useState, useRef } from 'react';
import {
  Undo2, Redo2, Download, LayoutDashboard, Terminal,
  FileText, ShieldCheck, Maximize2,
  CheckCircle, AlertCircle, Clock, ChevronDown, Loader2,
} from 'lucide-react';
import type { LayoutAlgorithm } from '../../types/whiteboard';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

interface Props {
  title: string;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitCanvas: (selection?: boolean) => void;
  onCleanLayout: (algorithm: LayoutAlgorithm) => void;
  onExport: (format: 'json' | 'svg' | 'png') => void;
  onOpenCommandPalette: () => void;
  onOpenTextToDiagram: () => void;
  onOpenValidation: () => void;
  selectedCount: number;
}

const LAYOUT_OPTIONS: { value: LayoutAlgorithm; label: string }[] = [
  { value: 'hierarchical', label: 'Hierarchical (top-down)' },
  { value: 'force',        label: 'Force-directed' },
  { value: 'radial',       label: 'Radial' },
  { value: 'grid',         label: 'Grid' },
  { value: 'timeline',     label: 'Timeline (left-right)' },
];

const EXPORT_OPTIONS = [
  { value: 'json' as const, label: 'Native JSON (.json)' },
  { value: 'svg'  as const, label: 'SVG vector (.svg)' },
  { value: 'png'  as const, label: 'PNG image (.png)' },
];

function SaveIndicator({ state }: { state: SaveState }) {
  const cfg = {
    saved:   { icon: CheckCircle,  color: 'var(--success)',  label: 'Saved' },
    saving:  { icon: Loader2,      color: 'var(--muted)',    label: 'Saving…' },
    unsaved: { icon: Clock,        color: 'var(--warning)',  label: 'Unsaved' },
    error:   { icon: AlertCircle,  color: 'var(--error)',    label: 'Save failed' },
  }[state];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: cfg.color }}>
      <Icon size={13} className={state === 'saving' ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{cfg.label}</span>
    </div>
  );
}

function DropdownMenu({
  trigger,
  items,
  onSelect,
}: {
  trigger: React.ReactNode;
  items: { value: string; label: string }[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors"
        style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {trigger}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl overflow-hidden min-w-[180px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {items.map(item => (
              <button
                key={item.value}
                onClick={() => { onSelect(item.value); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  title,
  accent,
}: {
  icon: any;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30 hover:bg-white/5 transition-colors"
      style={{
        color: accent ? 'var(--accent)' : 'var(--muted)',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={14} />
      {label && <span className="hidden md:inline">{label}</span>}
    </button>
  );
}

export function WhiteboardHeader({
  title,
  saveState,
  canUndo,
  canRedo,
  onTitleChange,
  onUndo,
  onRedo,
  onFitCanvas,
  onCleanLayout,
  onExport,
  onOpenCommandPalette,
  onOpenTextToDiagram,
  onOpenValidation,
  selectedCount,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-2 px-4 border-b shrink-0"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        height: 52,
        zIndex: 30,
      }}
    >
      {/* Board title */}
      {editingTitle ? (
        <input
          ref={titleRef}
          defaultValue={title}
          autoFocus
          onBlur={e => { onTitleChange(e.target.value); setEditingTitle(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { onTitleChange((e.target as HTMLInputElement).value); setEditingTitle(false); }
            if (e.key === 'Escape') setEditingTitle(false);
          }}
          className="text-sm font-semibold px-2 py-1 rounded focus:outline-none w-48"
          style={{
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--accent)',
          }}
        />
      ) : (
        <button
          onClick={() => setEditingTitle(true)}
          className="text-sm font-semibold px-2 py-1 rounded hover:bg-white/5 transition-colors max-w-48 truncate"
          style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}
          title="Click to rename"
        >
          {title || 'Untitled Board'}
        </button>
      )}

      {/* Save indicator */}
      <SaveIndicator state={saveState} />

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* History */}
      <HeaderButton icon={Undo2} onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)" />
      <HeaderButton icon={Redo2} onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)" />

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* Fit canvas */}
      <HeaderButton
        icon={Maximize2}
        label="Fit"
        onClick={() => onFitCanvas(selectedCount > 1)}
        title={selectedCount > 1 ? 'Fit selection to view' : 'Fit all to view'}
      />

      {/* Layout */}
      <DropdownMenu
        trigger={<><LayoutDashboard size={14} /><span className="hidden md:inline">Layout</span></>}
        items={LAYOUT_OPTIONS}
        onSelect={v => onCleanLayout(v as LayoutAlgorithm)}
      />

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* Smart features */}
      <HeaderButton
        icon={Terminal}
        label="Command"
        onClick={onOpenCommandPalette}
        title="Open Command Palette (⌘K)"
        accent
      />

      <HeaderButton
        icon={FileText}
        label="Text→Diagram"
        onClick={onOpenTextToDiagram}
        title="Convert text to diagram"
      />

      <HeaderButton
        icon={ShieldCheck}
        label="Validate"
        onClick={onOpenValidation}
        title="Run diagram validation"
      />

      {/* Separator */}
      <div style={{ flex: 1 }} />

      {/* Export */}
      <DropdownMenu
        trigger={<><Download size={14} /><span className="hidden md:inline">Export</span></>}
        items={EXPORT_OPTIONS}
        onSelect={v => onExport(v as 'json' | 'svg' | 'png')}
      />
    </div>
  );
}
