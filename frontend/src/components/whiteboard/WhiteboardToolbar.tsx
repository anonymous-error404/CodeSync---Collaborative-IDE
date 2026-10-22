import {
  MousePointer2, Hand, PenTool, Highlighter, Sparkles, Eraser,
  Type, Square, Circle, Diamond, ArrowRight, StickyNote, Code2,
  LayoutTemplate, Server, Database, Layers, Network, Box,
  GitBranch, Cpu, Cloud, ZapIcon, Users, Globe,
} from 'lucide-react';
import type { DiagramNodeType } from '../../types/whiteboard';

// All tools available in the engineering canvas (Teach Mode removed)
export type ToolType =
  | 'select' | 'hand' | 'pen' | 'highlighter' | 'smart_pen' | 'eraser'
  | 'text' | 'sticky' | 'frame'
  | 'rectangle' | 'circle' | 'diamond' | 'arrow' | 'connector'
  | 'code_cell'
  // Semantic typed-node tools
  | `node:${DiagramNodeType}`;

interface Props {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

// ─── Tool groups ──────────────────────────────────────────────────────────────

const INTERACTION_TOOLS: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'select',    icon: MousePointer2, label: 'Select / Move (V)' },
  { id: 'hand',      icon: Hand,          label: 'Pan Canvas (H)' },
];

const DRAWING_TOOLS: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'pen',       icon: PenTool,       label: 'Freehand Pen' },
  { id: 'highlighter',icon: Highlighter,  label: 'Highlighter' },
  { id: 'smart_pen', icon: Sparkles,      label: 'Smart Shape Recognition' },
  { id: 'eraser',    icon: Eraser,        label: 'Eraser' },
];

const SHAPE_TOOLS: Array<{ id: ToolType; icon: any; label: string }> = [
  { id: 'text',      icon: Type,          label: 'Text Block' },
  { id: 'rectangle', icon: Square,        label: 'Rectangle' },
  { id: 'circle',    icon: Circle,        label: 'Circle / Ellipse' },
  { id: 'diamond',   icon: Diamond,       label: 'Diamond / Decision' },
  { id: 'arrow',     icon: ArrowRight,    label: 'Arrow' },
  { id: 'connector', icon: GitBranch,     label: 'Semantic Connector' },
  { id: 'sticky',    icon: StickyNote,    label: 'Sticky Note' },
  { id: 'frame',     icon: LayoutTemplate,label: 'Section Frame' },
  { id: 'code_cell', icon: Code2,         label: 'Code Cell' },
];

// Architecture / service nodes
const ARCH_NODES: Array<{ id: ToolType; icon: any; label: string; color: string }> = [
  { id: 'node:service',      icon: Server,   label: 'Service',       color: '#2f81f7' },
  { id: 'node:client',       icon: Users,    label: 'Client / UI',   color: '#58a6ff' },
  { id: 'node:api',          icon: Network,  label: 'API / Endpoint', color: '#3fb950' },
  { id: 'node:database',     icon: Database, label: 'Database',      color: '#d29922' },
  { id: 'node:cache',        icon: ZapIcon,  label: 'Cache',         color: '#f0883e' },
  { id: 'node:queue',        icon: Layers,   label: 'Queue / Topic', color: '#a371f7' },
  { id: 'node:worker',       icon: Cpu,      label: 'Worker / Job',  color: '#79c0ff' },
  { id: 'node:gateway',      icon: Globe,    label: 'Gateway / Proxy', color: '#2f81f7' },
  { id: 'node:external',     icon: Cloud,    label: 'External System', color: '#7d8590' },
  { id: 'node:infra_container', icon: Box,   label: 'Container',     color: '#58a6ff' },
];

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />;
}

// ─── Tool button ──────────────────────────────────────────────────────────────

function ToolButton({
  tool, activeTool, onSelectTool, color,
}: {
  tool: { id: ToolType; icon: any; label: string };
  activeTool: ToolType;
  onSelectTool: (t: ToolType) => void;
  color?: string;
}) {
  const Icon = tool.icon;
  const isActive = activeTool === tool.id;
  return (
    <button
      key={tool.id}
      onClick={() => onSelectTool(tool.id)}
      title={tool.label}
      style={{
        width: 34, height: 34,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        background: isActive ? (color ?? 'var(--accent)') : 'transparent',
        color: isActive ? '#fff' : (color ?? 'var(--muted)'),
        border: 'none', cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        position: 'relative',
        flexShrink: 0,
      }}
      className="group"
    >
      <Icon size={15} />
      {/* Tooltip */}
      <div
        style={{
          position: 'absolute',
          left: 42, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          zIndex: 100,
        }}
        className="group-hover:opacity-100"
      >
        {tool.label}
      </div>
    </button>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

export function WhiteboardToolbar({ activeTool, onSelectTool }: Props) {
  return (
    <div
      className="absolute top-20 left-4 z-40 flex flex-col gap-0.5 p-1.5 rounded-2xl shadow-xl border animate-fade-in"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      {/* Interaction */}
      {INTERACTION_TOOLS.map(t => (
        <ToolButton key={t.id} tool={t} activeTool={activeTool} onSelectTool={onSelectTool} />
      ))}

      <Divider />

      {/* Drawing */}
      {DRAWING_TOOLS.map(t => (
        <ToolButton key={t.id} tool={t} activeTool={activeTool} onSelectTool={onSelectTool} />
      ))}

      <Divider />

      {/* Shapes & content */}
      {SHAPE_TOOLS.map(t => (
        <ToolButton key={t.id} tool={t} activeTool={activeTool} onSelectTool={onSelectTool} />
      ))}

      <Divider />

      {/* Semantic architecture nodes */}
      <div
        style={{
          fontSize: 9,
          color: 'var(--muted)',
          textAlign: 'center',
          padding: '2px 0',
          letterSpacing: 0.8,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
        }}
      >
        ARCH
      </div>

      {ARCH_NODES.map(t => (
        <ToolButton key={t.id} tool={t} activeTool={activeTool} onSelectTool={onSelectTool} color={t.color} />
      ))}
    </div>
  );
}
