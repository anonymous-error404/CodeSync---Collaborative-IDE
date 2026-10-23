/**
 * DiagramNode — Semantic canvas node renderer.
 *
 * Renders typed engineering diagram objects with:
 *   - Correct shape per type (cylinder for DB, hexagon for queue, etc.)
 *   - Status badge (proposed / existing / implemented / etc.)
 *   - Diagram-type icon
 *   - Field list for ER entities and UML classes
 *   - Connection point hints on hover
 */

import type { CanvasElement, DiagramNodeType, ComponentStatus } from '../../types/whiteboard';

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  isHighlighted?: boolean;
  onOpenInIDE?: (filePath: string) => void;
  boardTheme?: 'dark' | 'light';
}

// ─── Node type metadata ───────────────────────────────────────────────────────

const NODE_META: Record<DiagramNodeType, {
  icon: string;
  label: string;
  defaultColor: string;
  shape: 'rect' | 'cylinder' | 'diamond' | 'circle' | 'hexagon' | 'parallelogram' | 'actor';
}> = {
  service:          { icon: '⚙️', label: 'Service',       defaultColor: '#2f81f7', shape: 'rect' },
  client:           { icon: '💻', label: 'Client',        defaultColor: '#58a6ff', shape: 'rect' },
  api:              { icon: '🔌', label: 'API',           defaultColor: '#3fb950', shape: 'rect' },
  database:         { icon: '🛢️', label: 'Database',      defaultColor: '#d29922', shape: 'cylinder' },
  cache:            { icon: '⚡', label: 'Cache',         defaultColor: '#f0883e', shape: 'cylinder' },
  queue:            { icon: '📨', label: 'Queue',         defaultColor: '#a371f7', shape: 'hexagon' },
  worker:           { icon: '⚒️', label: 'Worker',        defaultColor: '#79c0ff', shape: 'rect' },
  external:         { icon: '🌐', label: 'External',      defaultColor: '#7d8590', shape: 'rect' },
  component:        { icon: '🧩', label: 'Component',     defaultColor: '#2f81f7', shape: 'rect' },
  gateway:          { icon: '🔀', label: 'Gateway',       defaultColor: '#2f81f7', shape: 'rect' },
  load_balancer:    { icon: '⚖️', label: 'Load Balancer', defaultColor: '#58a6ff', shape: 'rect' },
  cdn:              { icon: '🌍', label: 'CDN',           defaultColor: '#79c0ff', shape: 'rect' },
  storage:          { icon: '📦', label: 'Storage',       defaultColor: '#d29922', shape: 'cylinder' },
  uml_class:        { icon: '📐', label: 'Class',         defaultColor: '#58a6ff', shape: 'rect' },
  uml_interface:    { icon: '📋', label: 'Interface',     defaultColor: '#3fb950', shape: 'rect' },
  uml_abstract:     { icon: '📐', label: 'Abstract',      defaultColor: '#a371f7', shape: 'rect' },
  er_entity:        { icon: '🗂️', label: 'Entity',        defaultColor: '#a371f7', shape: 'rect' },
  er_weak_entity:   { icon: '🗂️', label: 'Weak Entity',   defaultColor: '#7d8590', shape: 'rect' },
  seq_lifeline:     { icon: '📍', label: 'Lifeline',      defaultColor: '#2f81f7', shape: 'rect' },
  seq_actor:        { icon: '🧍', label: 'Actor',         defaultColor: '#58a6ff', shape: 'actor' },
  workflow_step:    { icon: '▶️', label: 'Step',           defaultColor: '#3fb950', shape: 'rect' },
  workflow_decision:{ icon: '❓', label: 'Decision',       defaultColor: '#f0883e', shape: 'diamond' },
  workflow_state:   { icon: '⬤',  label: 'State',          defaultColor: '#a371f7', shape: 'circle' },
  workflow_start:   { icon: '▶',  label: 'Start',          defaultColor: '#3fb950', shape: 'circle' },
  workflow_end:     { icon: '⏹', label: 'End',            defaultColor: '#f85149', shape: 'circle' },
  infra_node:       { icon: '🖥️', label: 'Server',         defaultColor: '#d29922', shape: 'rect' },
  infra_container:  { icon: '🐋', label: 'Container',      defaultColor: '#58a6ff', shape: 'rect' },
  infra_cloud:      { icon: '☁️', label: 'Cloud',          defaultColor: '#79c0ff', shape: 'rect' },
  generic:          { icon: '□',  label: '',              defaultColor: '#7d8590', shape: 'rect' },
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ComponentStatus, { label: string; color: string; bg: string; border: string }> = {
  proposed:    { label: 'proposed',    color: '#2f81f7', bg: 'rgba(47,129,247,0.12)',  border: '#2f81f7' },
  existing:    { label: 'existing',    color: '#7d8590', bg: 'rgba(125,133,144,0.1)', border: '#30363d' },
  in_progress: { label: 'in progress', color: '#d29922', bg: 'rgba(210,153,34,0.12)', border: '#d29922' },
  implemented: { label: 'implemented', color: '#3fb950', bg: 'rgba(63,185,80,0.12)',  border: '#3fb950' },
  tested:      { label: 'tested',      color: '#58a6ff', bg: 'rgba(88,166,255,0.12)', border: '#58a6ff' },
  deployed:    { label: 'deployed',    color: '#a371f7', bg: 'rgba(163,113,247,0.12)',border: '#a371f7' },
  deprecated:  { label: 'deprecated',  color: '#f85149', bg: 'rgba(248,81,73,0.1)',   border: '#f85149' },
};

// ─── Shape helpers ────────────────────────────────────────────────────────────

function CylinderShape({ w, h, color, fill }: { w: number; h: number; color: string; fill: string }) {
  const rx = w / 2;
  const ry = 12;
  return (
    <svg width={w} height={h} className="absolute inset-0" style={{ overflow: 'visible' }}>
      <ellipse cx={rx} cy={ry} rx={rx - 2} ry={ry - 2} fill={fill} stroke={color} strokeWidth={2} />
      <rect x={2} y={ry} width={w - 4} height={h - ry * 2} fill={fill} stroke="none" />
      <line x1={2} y1={ry} x2={2} y2={h - ry} stroke={color} strokeWidth={2} />
      <line x1={w - 2} y1={ry} x2={w - 2} y2={h - ry} stroke={color} strokeWidth={2} />
      <ellipse cx={rx} cy={h - ry} rx={rx - 2} ry={ry - 2} fill={fill} stroke={color} strokeWidth={2} />
    </svg>
  );
}

function HexagonShape({ w, h, color, fill }: { w: number; h: number; color: string; fill: string }) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 - 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="absolute inset-0">
      <polygon points={pts} fill={fill} stroke={color} strokeWidth={2} />
    </svg>
  );
}

function DiamondShape({ w, h, color, fill }: { w: number; h: number; color: string; fill: string }) {
  const pts = `${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`;
  return (
    <svg width={w} height={h} className="absolute inset-0">
      <polygon points={pts} fill={fill} stroke={color} strokeWidth={2} />
    </svg>
  );
}

function CircleShape({ w, h, color, fill }: { w: number; h: number; color: string; fill: string }) {
  const r = Math.min(w, h) / 2 - 2;
  return (
    <svg width={w} height={h} className="absolute inset-0">
      <circle cx={w / 2} cy={h / 2} r={r} fill={fill} stroke={color} strokeWidth={2} />
    </svg>
  );
}

function TriangleShape({ w, h, color, fill }: { w: number; h: number; color: string; fill: string }) {
  const pts = `${w / 2},3 ${w - 3},${h - 3} 3,${h - 3}`;
  return (
    <svg width={w} height={h} className="absolute inset-0">
      <polygon points={pts} fill={fill} stroke={color} strokeWidth={2} />
    </svg>
  );
}

function ActorShape({ w, h, color }: { w: number; h: number; color: string }) {
  // Stick figure
  const cx = w / 2;
  const headR = 10;
  const headY = headR + 2;
  const bodyTop = headY + headR;
  const bodyBot = h - 18;
  const legSpread = 12;
  const armY = bodyTop + (bodyBot - bodyTop) * 0.35;
  return (
    <svg width={w} height={h} className="absolute inset-0" style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={headY} r={headR} fill="none" stroke={color} strokeWidth={2} />
      <line x1={cx} y1={bodyTop} x2={cx} y2={bodyBot} stroke={color} strokeWidth={2} />
      <line x1={cx - legSpread} y1={h - 2} x2={cx} y2={bodyBot} stroke={color} strokeWidth={2} />
      <line x1={cx + legSpread} y1={h - 2} x2={cx} y2={bodyBot} stroke={color} strokeWidth={2} />
      <line x1={cx - legSpread} y1={armY} x2={cx + legSpread} y2={armY} stroke={color} strokeWidth={2} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiagramNode({ element: el, isSelected, isHighlighted, onOpenInIDE, boardTheme = 'dark' }: Props) {
  const isLight = boardTheme === 'light';
  const w = el.width ?? 160;
  const h = el.height ?? 70;
  const meta = NODE_META[el.diagramType ?? 'generic'] ?? NODE_META.generic;
  const color = el.strokeColor ?? meta.defaultColor;
  const fill = el.fillColor ?? (isLight ? '#ffffff' : 'var(--surface)');
  const isUml = el.diagramType === 'uml_class' || el.diagramType === 'uml_interface' || el.diagramType === 'uml_abstract';
  const isEr = el.diagramType === 'er_entity' || el.diagramType === 'er_weak_entity';
  const hasSections = (isUml || isEr) && ((el.fields?.length ?? 0) > 0 || (el.methods?.length ?? 0) > 0);

  const boxShadow = isSelected
    ? `0 0 0 2px ${color}, 0 4px 20px rgba(0,0,0,0.4)`
    : isHighlighted
    ? `0 0 0 2px #f0883e, 0 2px 10px rgba(240,136,62,0.3)`
    : 'var(--shadow-md)';

  // Shape resolution: explicit element shape takes precedence over generic diagramType
  const shapeType = ['circle', 'triangle', 'diamond', 'cylinder', 'hexagon', 'rectangle'].includes(el.type)
    ? el.type
    : meta.shape;

  // Shape-specific outer element
  const renderShape = () => {
    switch (shapeType) {
      case 'cylinder':  return <CylinderShape w={w} h={h} color={color} fill={fill} />;
      case 'hexagon':   return <HexagonShape w={w} h={h} color={color} fill={fill} />;
      case 'diamond':   return <DiamondShape w={w} h={h} color={color} fill={fill} />;
      case 'circle':    return <CircleShape w={w} h={h} color={color} fill={fill} />;
      case 'triangle':  return <TriangleShape w={w} h={h} color={color} fill={fill} />;
      case 'actor':     return <ActorShape w={w} h={h} color={color} />;
      default: return null;
    }
  };

  const usesvgShape = ['cylinder', 'hexagon', 'diamond', 'circle', 'triangle', 'actor'].includes(shapeType);

  // Frame node
  if (el.type === 'frame') {
    return (
      <div
        style={{
          width: w, height: h,
          border: `2px dashed ${color}`,
          borderRadius: 8,
          background: 'transparent',
          boxShadow: isSelected ? `0 0 0 2px ${color}` : undefined,
          display: 'flex',
          alignItems: 'flex-start',
          padding: '6px 10px',
        }}
      >
        <span style={{ fontSize: 11, color, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          {el.text || 'Frame'}
        </span>
      </div>
    );
  }

  // Sticky note
  if (el.type === 'sticky') {
    return (
      <div
        style={{
          width: w, height: h,
          background: el.fillColor ?? (isLight ? '#fff8c5' : '#21262d'),
          border: `1px solid ${isLight ? '#d4a72c' : color}`,
          borderRadius: 4,
          borderTopRightRadius: 20,
          boxShadow,
          padding: 10,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: isLight ? '#1f2328' : 'var(--text)',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {el.text}
      </div>
    );
  }

  // Text block
  if (el.type === 'text') {
    return (
      <div
        style={{
          width: w, minHeight: 24,
          fontFamily: 'var(--font-sans)',
          fontSize: el.fontSize ?? 14,
          fontWeight: el.fontWeight ?? 'normal',
          color: el.strokeColor ?? (isLight ? '#1f2328' : 'var(--text)'),
          padding: '2px 4px',
          outline: isSelected ? `2px solid ${color}` : undefined,
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {el.text || 'Text'}
      </div>
    );
  }

  const isGenericShape = (!el.diagramType || el.diagramType === 'generic') && !hasSections;

  return (
    <div
      style={{
        width: w,
        minHeight: h,
        position: 'relative',
        borderRadius: (shapeType === 'rect' || shapeType === 'rectangle') ? 8 : 0,
        border: !usesvgShape ? `2px solid ${color}` : 'none',
        background: !usesvgShape ? fill : 'transparent',
        boxShadow,
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* SVG shape overlay */}
      {usesvgShape && renderShape()}

      {/* Content layer: clean centered text for generic shapes, semantic layout for architecture nodes */}
      {isGenericShape ? (
        <div
          className="absolute inset-0 flex items-center justify-center p-2 text-center pointer-events-none select-none"
          style={{ zIndex: 2 }}
        >
          {el.text ? (
            <span
              style={{
                fontSize: el.fontSize ?? 13,
                fontWeight: el.fontWeight ?? 600,
                color: el.strokeColor ?? (isLight ? '#1f2328' : 'var(--text)'),
                wordBreak: 'break-word',
                maxWidth: shapeType === 'triangle' ? '65%' : '85%',
                marginTop: shapeType === 'triangle' ? (h * 0.22) : 0,
              }}
            >
              {el.text}
            </span>
          ) : null}
        </div>
      ) : (
      <div
        className="absolute inset-0 flex flex-col"
        style={{ zIndex: 2 }}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0"
          style={{
            borderBottom: hasSections ? `1px solid ${color}30` : undefined,
            minHeight: 36,
          }}
        >
          {/* Type icon */}
          {meta.icon && el.diagramType !== 'generic' && (
            <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.icon}</span>
          )}

          {/* Label */}
          <span
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {el.text || meta.label}
          </span>

          {/* Status badge */}
          {el.status && el.status !== 'existing' && (() => {
            const s = STATUS_STYLE[el.status];
            return (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 10,
                  color: s.color,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {s.label}
              </span>
            );
          })()}
        </div>

        {/* Type label sub-header for semantic types */}
        {el.diagramType && el.diagramType !== 'generic' && !hasSections && (
          <div
            style={{
              fontSize: 10,
              color: color,
              padding: '0 10px 4px',
              fontFamily: 'var(--font-mono)',
              opacity: 0.8,
            }}
          >
            «{meta.label.toLowerCase()}»
          </div>
        )}

        {/* Fields (ER / UML) */}
        {hasSections && (
          <>
            {(el.fields ?? []).map(field => (
              <div
                key={field.id}
                style={{
                  fontSize: 11,
                  padding: '1px 10px',
                  color: field.isPrimaryKey ? '#d29922' : field.isForeignKey ? '#a371f7' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  borderBottom: `1px solid ${color}10`,
                  display: 'flex',
                  gap: 4,
                }}
              >
                <span>{field.isPrimaryKey ? '🔑' : field.isForeignKey ? '🔗' : '·'}</span>
                <span style={{ fontWeight: field.isPrimaryKey ? 600 : 400 }}>{field.name}</span>
                <span style={{ opacity: 0.55 }}>: {field.type}</span>
              </div>
            ))}

            {isUml && (el.fields ?? []).length > 0 && (el.methods ?? []).length > 0 && (
              <div style={{ height: 1, background: `${color}40`, margin: '0 0' }} />
            )}

            {(el.methods ?? []).map(method => (
              <div
                key={method.id}
                style={{
                  fontSize: 11,
                  padding: '1px 10px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  gap: 4,
                }}
              >
                <span style={{ opacity: 0.5 }}>
                  {method.visibility === 'private' ? '—' : method.visibility === 'protected' ? '#' : '+'}
                </span>
                <span>{method.name}({method.parameters ?? ''})</span>
                {method.returnType && <span style={{ opacity: 0.5 }}>: {method.returnType}</span>}
              </div>
            ))}
          </>
        )}

        {/* Linked file indicator */}
        {el.linkedFilePath && (
          <div
            className="flex items-center gap-1 px-2.5 pb-1.5 mt-auto"
            style={{ fontSize: 10, color: 'var(--muted)', marginTop: 'auto' }}
          >
            <span>📄</span>
            <span
              style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: w - 40, fontFamily: 'var(--font-mono)', fontSize: 10,
              }}
            >
              {el.linkedFilePath}
            </span>
            {onOpenInIDE && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenInIDE(el.linkedFilePath!); }}
                style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}
              >
                ↗
              </button>
            )}
          </div>
        )}

        {/* Task link badge */}
        {el.linkedTaskId && (
          <div
            style={{
              position: 'absolute', bottom: 4, right: 6,
              fontSize: 9, color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(47,129,247,0.1)',
              border: '1px solid rgba(47,129,247,0.3)',
              borderRadius: 4, padding: '0 4px',
            }}
          >
            #{el.linkedTaskId.slice(0, 8)}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
