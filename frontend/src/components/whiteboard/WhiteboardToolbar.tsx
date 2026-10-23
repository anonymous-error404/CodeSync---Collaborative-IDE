import {
  MousePointer2, Hand, PenTool, Highlighter, Sparkles, Eraser,
  Type, Square, Circle, Triangle, Diamond, ArrowRight, StickyNote, Code2,
  LayoutTemplate, Server, Database, Layers, Network, Box,
  GitBranch, Cpu, Cloud, ZapIcon, Users, Globe,
} from 'lucide-react';
import type { DiagramNodeType } from '../../types/whiteboard';

// All tools available in the engineering canvas (Teach Mode removed)
export type ToolType =
  | 'select' | 'hand' | 'pen' | 'highlighter' | 'smart_pen' | 'eraser'
  | 'text' | 'sticky' | 'frame'
  | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'arrow' | 'connector'
  | 'code_cell'
  // Semantic typed-node tools
  | `node:${DiagramNodeType}`;

interface Props {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  boardTheme?: 'dark' | 'light';
  readOnly?: boolean;
}

// ─── Tool groups ──────────────────────────────────────────────────────────────

const INTERACTION_TOOLS: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'select',     icon: MousePointer2, label: 'Select / Move (V)' },
  { id: 'hand',       icon: Hand,          label: 'Pan Canvas (H)' },
  { id: 'pen',        icon: PenTool,       label: 'Freehand Pen (P)' },
  { id: 'highlighter',icon: Highlighter,  label: 'Highlighter' },
  { id: 'smart_pen',  icon: Sparkles,      label: 'Smart Shape Recognition' },
  { id: 'eraser',     icon: Eraser,        label: 'Eraser (E)' },
];

const SHAPE_TOOLS: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'text',       icon: Type,          label: 'Text Block' },
  { id: 'sticky',     icon: StickyNote,    label: 'Sticky Note' },
  { id: 'rectangle',  icon: Square,        label: 'Rectangle' },
  { id: 'circle',     icon: Circle,        label: 'Circle / Ellipse' },
  { id: 'triangle',   icon: Triangle,      label: 'Triangle' },
  { id: 'diamond',    icon: Diamond,       label: 'Diamond / Decision' },
  { id: 'arrow',      icon: ArrowRight,    label: 'Arrow' },
  { id: 'connector',  icon: GitBranch,     label: 'Semantic Connector' },
  { id: 'code_cell',  icon: Code2,         label: 'Code Cell' },
  { id: 'frame',      icon: LayoutTemplate,label: 'Section Frame' },
];

// Architecture / service nodes
const ARCH_NODES: Array<{ id: ToolType; icon: any; label: string; color: string }> = [
  { id: 'node:service',         icon: Server,   label: 'Service',         color: '#2f81f7' },
  { id: 'node:client',          icon: Users,    label: 'Client / UI',     color: '#58a6ff' },
  { id: 'node:api',             icon: Network,  label: 'API / Endpoint',  color: '#3fb950' },
  { id: 'node:database',        icon: Database, label: 'Database',        color: '#d29922' },
  { id: 'node:cache',           icon: ZapIcon,  label: 'Cache',           color: '#f0883e' },
  { id: 'node:queue',           icon: Layers,   label: 'Queue / Topic',   color: '#a371f7' },
  { id: 'node:worker',          icon: Cpu,      label: 'Worker / Job',    color: '#79c0ff' },
  { id: 'node:gateway',         icon: Globe,    label: 'Gateway / Proxy', color: '#2f81f7' },
  { id: 'node:external',        icon: Cloud,    label: 'External System', color: '#7d8590' },
  { id: 'node:infra_container', icon: Box,      label: 'Container',       color: '#58a6ff' },
];

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider({ isLight }: { isLight?: boolean }) {
  return <div className="col-span-2 my-0.5 h-px w-full" style={{ background: isLight ? '#e1e4e8' : 'var(--border)' }} />;
}

// ─── Tool button ──────────────────────────────────────────────────────────────

function ToolButton({
  tool, activeTool, onSelectTool, color, isLight, disabled,
}: {
  tool: { id: ToolType; icon: any; label: string };
  activeTool: ToolType;
  onSelectTool: (t: ToolType) => void;
  color?: string;
  isLight?: boolean;
  disabled?: boolean;
}) {
  const Icon = tool.icon;
  const isActive = activeTool === tool.id;
  const activeBg = color ?? (isLight ? '#0969da' : 'var(--accent)');
  const inactiveColor = color ?? (isLight ? '#57606a' : 'var(--muted)');
  return (
    <button
      key={tool.id}
      onClick={() => {
        if (!disabled) onSelectTool(tool.id);
      }}
      disabled={disabled}
      title={disabled ? `${tool.label} (Disabled in Read-Only mode)` : tool.label}
      aria-label={tool.label}
      style={{
        width: 31,
        height: 31,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        background: isActive ? activeBg : 'transparent',
        color: isActive ? '#fff' : inactiveColor,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'background 0.15s, color 0.15s, transform 0.1s',
        flexShrink: 0,
      }}
      className={disabled ? '' : 'hover:scale-105 active:scale-95'}
    >
      <Icon size={15} />
    </button>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

export function WhiteboardToolbar({ activeTool, onSelectTool, boardTheme = 'dark', readOnly = false }: Props) {
  const isLight = boardTheme === 'light';
  return (
    <div
      className="absolute top-3 left-3 z-40 rounded-xl shadow-2xl border animate-fade-in flex flex-col items-center"
      style={{
        background: isLight ? '#ffffff' : 'var(--surface)',
        borderColor: isLight ? '#d0d7de' : 'var(--border)',
        backdropFilter: 'blur(16px)',
        width: 74,
        maxHeight: 'calc(100vh - 90px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        padding: '6px 4px',
      }}
    >
      <div className="grid grid-cols-2 gap-1 w-full justify-items-center">
        {/* Interaction & Drawing */}
        {INTERACTION_TOOLS.map(t => {
          const isDrawTool = t.id !== 'select' && t.id !== 'hand';
          return (
            <ToolButton
              key={t.id}
              tool={t}
              activeTool={activeTool}
              onSelectTool={onSelectTool}
              isLight={isLight}
              disabled={readOnly && isDrawTool}
            />
          );
        })}

        <Divider isLight={isLight} />

        {/* Shapes & Content */}
        {SHAPE_TOOLS.map(t => (
          <ToolButton
            key={t.id}
            tool={t}
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            isLight={isLight}
            disabled={readOnly}
          />
        ))}

        <Divider isLight={isLight} />

        {/* Semantic architecture nodes header */}
        <div
          className="col-span-2 text-center select-none"
          style={{
            fontSize: 9,
            color: isLight ? '#8c959f' : 'var(--muted)',
            letterSpacing: 1,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            padding: '2px 0',
          }}
        >
          ARCH
        </div>

        {ARCH_NODES.map(t => (
          <ToolButton
            key={t.id}
            tool={t}
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            color={t.color}
            isLight={isLight}
            disabled={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
