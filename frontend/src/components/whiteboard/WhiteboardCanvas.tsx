import { useRef, useState, useCallback, useEffect } from 'react';
import type { CanvasElement, RemoteWhiteboardCursor, Anchor, RelationshipType } from '../../types/whiteboard';
import type { ToolType } from './WhiteboardToolbar';
import { CodeCellNode } from './CodeCellNode';
import { DiagramNode } from './DiagramNode';

// ─── Anchor helpers ───────────────────────────────────────────────────────────

function getAnchorPoint(el: CanvasElement, anchor: Anchor = 'right'): { x: number; y: number } {
  const w = el.width ?? 120;
  const h = el.height ?? 60;
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;

  const map: Record<Anchor, { x: number; y: number }> = {
    top:          { x: cx,        y: el.y },
    bottom:       { x: cx,        y: el.y + h },
    left:         { x: el.x,      y: cy },
    right:        { x: el.x + w,  y: cy },
    center:       { x: cx,        y: cy },
    'top-left':   { x: el.x,      y: el.y },
    'top-right':  { x: el.x + w,  y: el.y },
    'bottom-left':{ x: el.x,      y: el.y + h },
    'bottom-right':{ x: el.x + w, y: el.y + h },
  };
  return map[anchor];
}

/** Choose the best anchor for a connector from source to target. */
function chooseAnchors(src: CanvasElement, tgt: CanvasElement): { srcAnchor: Anchor; tgtAnchor: Anchor } {
  const srcCx = src.x + (src.width ?? 120) / 2;
  const srcCy = src.y + (src.height ?? 60) / 2;
  const tgtCx = tgt.x + (tgt.width ?? 120) / 2;
  const tgtCy = tgt.y + (tgt.height ?? 60) / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { srcAnchor: 'right', tgtAnchor: 'left' }
      : { srcAnchor: 'left', tgtAnchor: 'right' };
  } else {
    return dy > 0
      ? { srcAnchor: 'bottom', tgtAnchor: 'top' }
      : { srcAnchor: 'top', tgtAnchor: 'bottom' };
  }
}

// ─── Relationship label/dash style ────────────────────────────────────────────

const REL_STYLES: Partial<Record<RelationshipType, { dash?: string; label?: string }>> = {
  calls:         { label: 'calls' },
  depends_on:    { dash: '6,3', label: 'depends on' },
  reads_from:    { dash: '4,2', label: 'reads' },
  writes_to:     { dash: '4,2', label: 'writes' },
  publishes:     { label: 'publishes' },
  subscribes:    { dash: '3,3', label: 'subscribes' },
  contains:      { dash: '8,4', label: 'contains' },
  inherits:      { label: 'inherits' },
  implements:    { dash: '6,2', label: 'implements' },
  connects_to:   { label: '' },
  transitions_to:{ label: '→' },
  message:       { label: '' },
  async_message: { dash: '4,2', label: '<<async>>' },
  return:        { dash: '4,2', label: 'return' },
  generic_arrow: {},
};

// ─── Connector SVG renderer ───────────────────────────────────────────────────

interface ConnectorProps {
  conn: CanvasElement;
  elements: CanvasElement[];
  isSelected: boolean;
  activeTool: ToolType;
  onSelect: (id: string) => void;
  onErase: (id: string) => void;
}

function ConnectorSVG({ conn, elements, isSelected, activeTool, onSelect, onErase }: ConnectorProps) {
  let startPt: { x: number; y: number };
  let endPt: { x: number; y: number };

  if (conn.sourceId && conn.targetId) {
    const src = elements.find(e => e.id === conn.sourceId);
    const tgt = elements.find(e => e.id === conn.targetId);
    if (!src || !tgt) {
      return null;
    }
    const { srcAnchor, tgtAnchor } = conn.sourceAnchor && conn.targetAnchor
      ? { srcAnchor: conn.sourceAnchor, tgtAnchor: conn.targetAnchor }
      : chooseAnchors(src, tgt);
    startPt = getAnchorPoint(src, srcAnchor);
    endPt = getAnchorPoint(tgt, tgtAnchor);
  } else if (conn.points && conn.points.length >= 2) {
    startPt = conn.points[0];
    endPt = conn.points[conn.points.length - 1];
  } else {
    return null;
  }

  const style = REL_STYLES[conn.relationship ?? 'generic_arrow'] ?? {};
  const color = isSelected ? 'var(--accent)' : (conn.strokeColor ?? '#7d8590');
  const strokeWidth = conn.strokeWidth ?? 2;
  const dash = style.dash ?? (conn.strokeDash ? conn.strokeDash.join(',') : undefined);
  const markerId = `arrow-${conn.id}`;
  const labelText = conn.text || style.label;

  // Midpoint for label
  const midX = (startPt.x + endPt.x) / 2;
  const midY = (startPt.y + endPt.y) / 2;

  // Hit-test path (wider hit path for clicking or erasing)
  const pathD = `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`;

  return (
    <svg
      key={conn.id}
      className="absolute inset-0 overflow-visible pointer-events-none"
      style={{ zIndex: isSelected ? 20 : 10 }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      {/* Invisible wide hit area */}
      <path
        d={pathD}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
        style={{ pointerEvents: 'auto', cursor: activeTool === 'eraser' ? 'cell' : 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          if (activeTool === 'eraser') {
            onErase(conn.id);
          } else {
            onSelect(conn.id);
          }
        }}
      />

      {/* Visible line */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
        fill="none"
        strokeDasharray={dash}
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
      />

      {/* Relationship label */}
      {labelText && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontFamily="var(--font-sans)"
          className="pointer-events-none select-none"
        >
          {labelText}
        </text>
      )}
    </svg>
  );
}

// ─── Stroke freehand renderer ─────────────────────────────────────────────────

function FreehandSVG({ el, isSelected, activeTool, onSelect, onErase }: {
  el: CanvasElement;
  isSelected: boolean;
  activeTool: string;
  onSelect: (id: string) => void;
  onErase: (id: string) => void;
}) {
  if (!el.points || el.points.length < 2) return null;
  const d = el.points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
  const hitWidth = Math.max((el.strokeWidth ?? 3) + 12, 16);
  return (
    <svg className="absolute inset-0 overflow-visible" style={{ zIndex: 5, pointerEvents: 'none' }}>
      {/* Wide invisible hit-target so eraser/select can interact */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={hitWidth}
        fill="none"
        strokeLinecap="round"
        style={{ pointerEvents: 'auto', cursor: activeTool === 'eraser' ? 'cell' : 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          if (activeTool === 'eraser') { onErase(el.id); return; }
          onSelect(el.id);
        }}
      />
      {/* Visible stroke */}
      <path
        d={d}
        stroke={isSelected ? 'var(--accent)' : (el.strokeColor ?? '#2f81f7')}
        strokeWidth={el.strokeWidth ?? 3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={el.opacity ?? 1}
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  );
}

// ─── Main canvas props ────────────────────────────────────────────────────────

interface Props {
  elements: CanvasElement[];
  activeTool: ToolType;
  selectedIds: string[];
  highlightIds?: string[];
  onSelect: (ids: string[]) => void;
  onAddElement: (el: CanvasElement) => void;
  onUpdateElement: (el: CanvasElement) => void;
  onDeleteElement?: (id: string) => void;
  onStrokeComplete?: (points: Array<{ x: number; y: number }>, strokeId?: string) => void;
  onOpenInIDE?: (filePath: string) => void;
  remoteCursors?: RemoteWhiteboardCursor[];
  onCursorMove?: (pos: { x: number; y: number }) => void;
  viewport?: { x: number; y: number; zoom: number };
  onViewportChange?: (vp: { x: number; y: number; zoom: number }) => void;
  pendingConnectorSourceId?: string | null;
  onConnectorTargetPicked?: (targetId: string) => void;
  boardTheme?: 'dark' | 'light';
}

export function WhiteboardCanvas({
  elements,
  activeTool,
  selectedIds,
  highlightIds = [],
  onSelect,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onStrokeComplete,
  onOpenInIDE,
  remoteCursors = [],
  onCursorMove,
  viewport: controlledViewport,
  onViewportChange,
  pendingConnectorSourceId,
  onConnectorTargetPicked,
  boardTheme = 'dark',
}: Props) {
  const isLight = boardTheme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalViewport, setInternalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const viewport = controlledViewport ?? internalViewport;

  const setViewport = useCallback((vp: { x: number; y: number; zoom: number }) => {
    setInternalViewport(vp);
    onViewportChange?.(vp);
  }, [onViewportChange]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Continuous erasing state
  const [isErasing, setIsErasing] = useState(false);

  // Inline text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [inlineTextValue, setInlineTextValue] = useState<string>('');

  // Panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({});

  // Multi-select rubber band
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  // ─── Native Wheel Listener (passive: false) ───────────────────────────────
  // Crucial: Must be native with { passive: false } so e.preventDefault() stops
  // browser zoom from zooming the entire webpage.

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom whiteboard canvas centered at mouse coordinates
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        const newZoom = Math.min(Math.max(viewport.zoom * factor, 0.1), 5);
        setViewport({
          zoom: newZoom,
          x: mx - (mx - viewport.x) * (newZoom / viewport.zoom),
          y: my - (my - viewport.y) * (newZoom / viewport.zoom),
        });
      } else {
        // Regular wheel pans the canvas
        setViewport({
          ...viewport,
          x: viewport.x - e.deltaX,
          y: viewport.y - e.deltaY,
        });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [viewport, setViewport]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        for (const id of selectedIds) onDeleteElement?.(id);
      }
      if (e.key === 'Escape') {
        onSelect([]);
      }
      // Nudge with arrow keys
      const NUDGE = e.shiftKey ? 10 : 2;
      const nudge = { ArrowLeft: { x: -NUDGE, y: 0 }, ArrowRight: { x: NUDGE, y: 0 }, ArrowUp: { x: 0, y: -NUDGE }, ArrowDown: { x: 0, y: NUDGE } }[e.key];
      if (nudge) {
        e.preventDefault();
        for (const id of selectedIds) {
          const el = elements.find(el => el.id === id);
          if (el) onUpdateElement({ ...el, x: el.x + nudge.x, y: el.y + nudge.y });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, elements, onDeleteElement, onSelect, onUpdateElement]);

  // ─── Hit testing (Handles ALL element types) ──────────────────────────────

  function ptSegDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
  }

  const hitTest = useCallback((el: CanvasElement, pos: { x: number; y: number }, margin = 14): boolean => {
    // 1. Freehand strokes
    if (el.type === 'stroke') {
      if (!el.points || el.points.length < 2) return false;
      const threshold = Math.max((el.strokeWidth ?? 3) / 2 + margin, 14);
      for (let i = 0; i < el.points.length - 1; i++) {
        const a = el.points[i], b = el.points[i + 1];
        if (ptSegDistSq(pos.x, pos.y, a.x, a.y, b.x, b.y) <= threshold * threshold) return true;
      }
      return false;
    }

    // 2. Connectors & Arrows
    if (el.type === 'connector' || el.type === 'arrow') {
      const threshold = 16;
      if (el.sourceId && el.targetId) {
        const src = elements.find(e => e.id === el.sourceId);
        const tgt = elements.find(e => e.id === el.targetId);
        if (!src || !tgt) return false;
        const { srcAnchor, tgtAnchor } = el.sourceAnchor && el.targetAnchor
          ? { srcAnchor: el.sourceAnchor, tgtAnchor: el.targetAnchor }
          : chooseAnchors(src, tgt);
        const startPt = getAnchorPoint(src, srcAnchor);
        const endPt = getAnchorPoint(tgt, tgtAnchor);
        return ptSegDistSq(pos.x, pos.y, startPt.x, startPt.y, endPt.x, endPt.y) <= threshold * threshold;
      } else if (el.points && el.points.length >= 2) {
        for (let i = 0; i < el.points.length - 1; i++) {
          const a = el.points[i], b = el.points[i + 1];
          if (ptSegDistSq(pos.x, pos.y, a.x, a.y, b.x, b.y) <= threshold * threshold) return true;
        }
      }
      return false;
    }

    // 3. Rectangles, circles, triangles, diamonds, texts, stickies, frames, code cells
    const w = el.width ?? (el.type === 'circle' ? 100 : el.type === 'code_cell' ? 280 : 160);
    const h = el.height ?? (el.type === 'circle' ? 100 : el.type === 'text' ? 36 : el.type === 'code_cell' ? 140 : 70);

    if (el.type === 'circle') {
      const cx = el.x + w / 2;
      const cy = el.y + h / 2;
      const r = Math.max(w, h) / 2 + margin;
      return Math.hypot(pos.x - cx, pos.y - cy) <= r;
    }

    return (
      pos.x >= el.x - margin &&
      pos.x <= el.x + w + margin &&
      pos.y >= el.y - margin &&
      pos.y <= el.y + h + margin
    );
  }, [elements]);

  // ─── Eraser action helper ─────────────────────────────────────────────────

  const eraseAt = useCallback((pos: { x: number; y: number }) => {
    const hits = elements.filter(el => hitTest(el, pos, 14));
    if (hits.length > 0) {
      hits.forEach(hit => onDeleteElement?.(hit.id));
      const hitIds = hits.map(h => h.id);
      onSelect(selectedIds.filter(id => !hitIds.includes(id)));
    }
  }, [elements, hitTest, onDeleteElement, onSelect, selectedIds]);

  // ─── Finish inline text editing ───────────────────────────────────────────

  const finishEditingText = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onDeleteElement?.(id);
    } else {
      const el = elements.find(e => e.id === id);
      if (el) {
        onUpdateElement({ ...el, text: trimmed });
      }
    }
    setEditingTextId(null);
    setInlineTextValue('');
  }, [elements, onDeleteElement, onUpdateElement]);

  // ─── Mouse down ───────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = screenToWorld(e.clientX, e.clientY);

    // If currently editing text and clicked elsewhere, commit the text
    if (editingTextId) {
      finishEditingText(editingTextId, inlineTextValue);
    }

    if (activeTool === 'hand' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (activeTool === 'eraser') {
      setIsErasing(true);
      eraseAt(pos);
      return;
    }

    // Direct normal text box creation: click to place an active editable text box
    if (activeTool === 'text') {
      const textId = `text-${Date.now()}`;
      const newEl: CanvasElement = {
        id: textId,
        type: 'text',
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: 180,
        height: 36,
        text: '',
        strokeColor: isLight ? '#1f2328' : '#e6edf3',
        fontSize: 14,
        diagramType: 'generic',
      };
      onAddElement(newEl);
      setEditingTextId(textId);
      setInlineTextValue('');
      onSelect([]);
      return;
    }

    if (activeTool === 'select') {
      const hit = [...elements].reverse().find(el => hitTest(el, pos, 6));
      if (hit) {
        if (e.shiftKey) {
          const already = selectedIds.includes(hit.id);
          onSelect(already ? selectedIds.filter(id => id !== hit.id) : [...selectedIds, hit.id]);
        } else {
          if (!selectedIds.includes(hit.id)) onSelect([hit.id]);
        }

        // Start drag
        const ids = e.shiftKey && selectedIds.includes(hit.id) ? selectedIds : (selectedIds.includes(hit.id) ? selectedIds : [hit.id]);
        const offsets: Record<string, { dx: number; dy: number }> = {};
        for (const id of ids) {
          const el = elements.find(el => el.id === id);
          if (el) offsets[id] = { dx: pos.x - el.x, dy: pos.y - el.y };
        }
        setDraggingIds(ids);
        setDragOffsets(offsets);
      } else {
        // Start rubber band
        onSelect([]);
        setRubberBand({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      }
      return;
    }

    if (['pen', 'highlighter', 'smart_pen'].includes(activeTool)) {
      setIsDrawing(true);
      setCurrentStroke([pos]);
      return;
    }

    // Shape creation tools — start draw
    setIsDrawing(true);
    setDrawStart(pos);
  }, [activeTool, elements, screenToWorld, viewport, selectedIds, onSelect, eraseAt, editingTextId, inlineTextValue, finishEditingText, onAddElement, hitTest]);

  // ─── Mouse move ───────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = screenToWorld(e.clientX, e.clientY);
    onCursorMove?.(pos);

    if (isErasing && activeTool === 'eraser') {
      eraseAt(pos);
      return;
    }

    if (isPanning) {
      setViewport({ ...viewport, x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingIds.length > 0) {
      for (const id of draggingIds) {
        const el = elements.find(el => el.id === id);
        const off = dragOffsets[id];
        if (el && off) {
          onUpdateElement({ ...el, x: Math.round(pos.x - off.dx), y: Math.round(pos.y - off.dy) });
        }
      }
      return;
    }

    if (rubberBand) {
      setRubberBand(rb => rb ? { ...rb, endX: pos.x, endY: pos.y } : null);
      return;
    }

    if (isDrawing && ['pen', 'highlighter', 'smart_pen'].includes(activeTool)) {
      setCurrentStroke(prev => [...prev, pos]);
    }
  }, [isPanning, isErasing, activeTool, draggingIds, rubberBand, isDrawing, screenToWorld, viewport, panStart, elements, dragOffsets, onUpdateElement, onCursorMove, setViewport, eraseAt]);

  // ─── Mouse up ─────────────────────────────────────────────────────────────

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isErasing) {
      setIsErasing(false);
      return;
    }

    if (isPanning) { setIsPanning(false); return; }

    if (draggingIds.length > 0) {
      setDraggingIds([]);
      setDragOffsets({});
      return;
    }

    if (rubberBand) {
      const { startX, startY, endX, endY } = rubberBand;
      const minX = Math.min(startX, endX);
      const minY = Math.min(startY, endY);
      const maxX = Math.max(startX, endX);
      const maxY = Math.max(startY, endY);

      if (maxX - minX > 4 || maxY - minY > 4) {
        const selected = elements.filter(el => {
          if (!el.width || !el.height) return false;
          return el.x >= minX && el.y >= minY && el.x + el.width <= maxX && el.y + el.height <= maxY;
        });
        onSelect(selected.map(e => e.id));
      }
      setRubberBand(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    const pos = screenToWorld(e.clientX, e.clientY);

    if (['pen', 'highlighter', 'smart_pen'].includes(activeTool)) {
      if (currentStroke.length > 1) {
        const strokeId = `stroke-${Date.now()}`;
        const newEl: CanvasElement = {
          id: strokeId,
          type: 'stroke',
          x: currentStroke[0].x,
          y: currentStroke[0].y,
          points: currentStroke,
          strokeColor: activeTool === 'highlighter' ? (isLight ? 'rgba(234,88,12,0.4)' : 'rgba(240,136,62,0.5)') : (isLight ? '#0969da' : '#2f81f7'),
          strokeWidth: activeTool === 'highlighter' ? 14 : 3,
          opacity: activeTool === 'highlighter' ? 0.5 : 1,
        };
        onAddElement(newEl);
        if (activeTool === 'smart_pen') {
          onStrokeComplete?.(currentStroke, strokeId);
        }
      }
      setCurrentStroke([]);
      return;
    }

    if (drawStart) {
      const rawW = pos.x - drawStart.x;
      const rawH = pos.y - drawStart.y;
      const width = Math.max(Math.abs(rawW), 60);
      const height = Math.max(Math.abs(rawH), 40);
      const x = rawW >= 0 ? drawStart.x : drawStart.x - width;
      const y = rawH >= 0 ? drawStart.y : drawStart.y - height;

      // Dimension normalization for geometric shapes
      const isCircle = activeTool === 'circle';
      const finalW = isCircle ? Math.max(width, height) : width;
      const finalH = isCircle ? Math.max(width, height) : height;

      const newEl: CanvasElement = {
        id: `${activeTool}-${Date.now()}`,
        type: activeTool as any,
        x,
        y,
        width: finalW,
        height: finalH,
        strokeColor: isLight ? '#0969da' : '#2f81f7',
        fillColor: activeTool === 'sticky' ? (isLight ? '#fff8c5' : '#21262d') : 'transparent',
        strokeWidth: 2,
        text: activeTool === 'sticky' ? '📝 Note' : '',
        codeLanguage: activeTool === 'code_cell' ? 'javascript' : undefined,
        codeContent: activeTool === 'code_cell' ? '// code snippet' : undefined,
        codeLinkType: activeTool === 'code_cell' ? 'static' : undefined,
        status: 'proposed',
        diagramType: 'generic',
      };
      onAddElement(newEl);
      onSelect([newEl.id]);
      setDrawStart(null);
    }
  }, [isErasing, isPanning, draggingIds, rubberBand, isDrawing, activeTool, currentStroke, drawStart, screenToWorld, elements, onAddElement, onSelect, onStrokeComplete]);

  // ─── Cursor indicator ─────────────────────────────────────────────────────

  const cursorStyle = pendingConnectorSourceId
    ? 'cursor-crosshair'
    : activeTool === 'hand' ? 'cursor-grab'
    : activeTool === 'eraser' ? 'cursor-cell'
    : activeTool === 'select' ? 'cursor-default'
    : activeTool === 'text' ? 'cursor-text'
    : 'cursor-crosshair';

  // ─── Rubber band rect in world space ──────────────────────────────────────

  const rubberBandRect = rubberBand ? {
    x: Math.min(rubberBand.startX, rubberBand.endX),
    y: Math.min(rubberBand.startY, rubberBand.endY),
    w: Math.abs(rubberBand.endX - rubberBand.startX),
    h: Math.abs(rubberBand.endY - rubberBand.startY),
  } : null;

  // ─── Element layering ─────────────────────────────────────────────────────

  const connectorEls = elements.filter(el => el.type === 'connector' || el.type === 'arrow');
  const strokeEls = elements.filter(el => el.type === 'stroke');
  const nodeEls = elements.filter(el => el.type !== 'connector' && el.type !== 'arrow' && el.type !== 'stroke');

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-full h-full overflow-hidden select-none ${cursorStyle}`}
      style={{
        background: isLight ? '#fcfcfd' : 'var(--bg)',
        backgroundImage: isLight
          ? 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)'
          : 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      <div
        className="absolute top-0 left-0 w-0 h-0 origin-top-left"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        {/* ── Strokes (bottom layer) ───────────────────────────────────── */}
        {strokeEls.map(el => (
          <FreehandSVG
            key={el.id}
            el={el}
            isSelected={selectedIds.includes(el.id)}
            activeTool={activeTool}
            onSelect={(id) => onSelect(selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id])}
            onErase={(id) => { onDeleteElement?.(id); onSelect(selectedIds.filter(s => s !== id)); }}
          />
        ))}

        {/* ── Connectors (above strokes, below nodes) ──────────────────── */}
        {connectorEls.map(conn => (
          <ConnectorSVG
            key={conn.id}
            conn={conn}
            elements={elements}
            isSelected={selectedIds.includes(conn.id)}
            activeTool={activeTool}
            onSelect={id => onSelect([id])}
            onErase={id => { onDeleteElement?.(id); onSelect(selectedIds.filter(s => s !== id)); }}
          />
        ))}

        {/* ── Nodes & Shapes ───────────────────────────────────────────── */}
        {nodeEls.map(el => {
          const isSelected = selectedIds.includes(el.id);
          const isHighlighted = highlightIds.includes(el.id);
          const isPendingTarget = !!pendingConnectorSourceId && el.id !== pendingConnectorSourceId;

          // Inline text editing mode for this element
          if (editingTextId === el.id) {
            return (
              <div
                key={el.id}
                className="absolute z-50"
                style={{ left: el.x, top: el.y }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  value={inlineTextValue}
                  onChange={e => {
                    const val = e.target.value;
                    setInlineTextValue(val);
                    const lines = val.split('\n');
                    const maxLen = Math.max(...lines.map(l => l.length), 10);
                    const newW = Math.max(160, maxLen * 9 + 20);
                    const newH = Math.max(36, lines.length * 22 + 16);
                    onUpdateElement({ ...el, text: val, width: newW, height: newH });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                      e.preventDefault();
                      finishEditingText(el.id, inlineTextValue);
                    }
                  }}
                  onBlur={() => {
                    finishEditingText(el.id, inlineTextValue);
                  }}
                  placeholder="Type text here..."
                  rows={Math.max(1, inlineTextValue.split('\n').length)}
                  className={`p-1.5 rounded border ${isLight ? 'border-blue-600 bg-white text-[#1f2328]' : 'border-blue-500 bg-[#161b22] text-[#e6edf3]'} text-sm font-sans focus:outline-none resize-none shadow-2xl`}
                  style={{
                    minWidth: 160,
                    fontSize: el.fontSize ?? 14,
                    lineHeight: 1.4,
                  }}
                />
              </div>
            );
          }

          if (el.type === 'code_cell') {
            return (
              <div
                key={el.id}
                className={`absolute ${isPendingTarget ? 'cursor-crosshair' : ''}`}
                style={{ left: el.x, top: el.y, zIndex: isSelected ? 30 : 20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteElement?.(el.id);
                    onSelect(selectedIds.filter(i => i !== el.id));
                    return;
                  }
                  if (pendingConnectorSourceId) { onConnectorTargetPicked?.(el.id); return; }
                  onSelect(e.shiftKey ? (selectedIds.includes(el.id) ? selectedIds.filter(i => i !== el.id) : [...selectedIds, el.id]) : [el.id]);
                }}
              >
                <CodeCellNode element={el} isSelected={isSelected} onOpenInIDE={onOpenInIDE} />
              </div>
            );
          }

          return (
            <div
              key={el.id}
              className={`absolute ${isPendingTarget ? 'cursor-crosshair ring-2 ring-green-400/60' : ''}`}
              style={{ left: el.x, top: el.y, zIndex: isSelected ? 30 : 20 }}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'eraser') {
                  onDeleteElement?.(el.id);
                  onSelect(selectedIds.filter(i => i !== el.id));
                  return;
                }
                if (pendingConnectorSourceId) { onConnectorTargetPicked?.(el.id); return; }
                onSelect(e.shiftKey ? (selectedIds.includes(el.id) ? selectedIds.filter(i => i !== el.id) : [...selectedIds, el.id]) : [el.id]);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (el.type === 'text' || el.type === 'sticky') {
                  setEditingTextId(el.id);
                  setInlineTextValue(el.text ?? '');
                }
              }}
              onMouseDown={(e) => {
                if (pendingConnectorSourceId) return;
                if (activeTool !== 'select') return;
                e.stopPropagation();
                if (!selectedIds.includes(el.id)) onSelect([el.id]);
                const pos = screenToWorld(e.clientX, e.clientY);
                setDraggingIds(selectedIds.includes(el.id) ? selectedIds : [el.id]);
                const offs: Record<string, { dx: number; dy: number }> = {};
                (selectedIds.includes(el.id) ? selectedIds : [el.id]).forEach(id => {
                  const found = elements.find(e => e.id === id);
                  if (found) offs[id] = { dx: pos.x - found.x, dy: pos.y - found.y };
                });
                setDragOffsets(offs);
              }}
            >
              <DiagramNode
                element={el}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
                onOpenInIDE={onOpenInIDE}
                boardTheme={boardTheme}
              />
            </div>
          );
        })}

        {/* ── Live drawing stroke preview ───────────────────────────────── */}
        {isDrawing && currentStroke.length > 1 && (
          <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ zIndex: 50 }}>
            <path
              d={currentStroke.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')}
              stroke={activeTool === 'highlighter' ? 'rgba(240,136,62,0.5)' : '#2f81f7'}
              strokeWidth={activeTool === 'highlighter' ? 14 : 3}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* ── Drawing preview ghost ─────────────────────────────────────── */}
        {isDrawing && drawStart && (
          <div
            className="absolute border-2 border-dashed rounded"
            style={{
              left: drawStart.x, top: drawStart.y,
              width: 60, height: 40,
              borderColor: 'var(--accent)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Rubber band selection ─────────────────────────────────────── */}
        {rubberBandRect && (
          <div
            className="absolute border rounded"
            style={{
              left: rubberBandRect.x, top: rubberBandRect.y,
              width: rubberBandRect.w, height: rubberBandRect.h,
              border: '1.5px solid var(--accent)',
              background: 'rgba(47,129,247,0.07)',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          />
        )}

        {/* ── Pending connector source indicator ───────────────────────── */}
        {pendingConnectorSourceId && (() => {
          const src = elements.find(e => e.id === pendingConnectorSourceId);
          if (!src || !src.width || !src.height) return null;
          return (
            <div
              className="absolute pointer-events-none rounded animate-pulse"
              style={{
                left: src.x - 4, top: src.y - 4,
                width: (src.width ?? 120) + 8,
                height: (src.height ?? 60) + 8,
                border: '2px solid #3fb950',
                zIndex: 40,
              }}
            />
          );
        })()}

        {/* ── Remote collaborator cursors ───────────────────────────────── */}
        {remoteCursors.map(rc => (
          <div
            key={rc.socketId}
            className="absolute z-50 pointer-events-none flex items-center gap-1.5"
            style={{ left: rc.cursor.x, top: rc.cursor.y, transform: 'translate(-2px, -2px)' }}
          >
            {(rc.selectedIds ?? []).map(id => {
              const el = elements.find(e => e.id === id);
              if (!el || !el.width || !el.height) return null;
              return (
                <div
                  key={`${rc.socketId}-sel-${id}`}
                  className="absolute rounded"
                  style={{
                    left: el.x - 2, top: el.y - 2,
                    width: el.width + 4, height: el.height + 4,
                    border: `2px solid ${rc.color}`,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
            <div className="w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: rc.color }} />
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white whitespace-nowrap shadow"
              style={{ background: rc.color }}
            >
              {rc.username}
            </span>
          </div>
        ))}
      </div>

      {/* ── Zoom Controls (Bottom Right) ─────────────────────────────── */}
      <div
        className="absolute bottom-4 right-4 flex items-center gap-1 p-1 rounded-xl shadow-lg border text-xs font-mono select-none z-30"
        style={{
          background: isLight ? '#ffffff' : 'var(--surface)',
          borderColor: isLight ? '#d0d7de' : 'var(--border)',
          color: isLight ? '#1f2328' : 'var(--text)',
        }}
      >
        <button
          onClick={() => {
            const newZoom = Math.max(viewport.zoom * 0.85, 0.1);
            if (containerRef.current) {
              const { clientWidth: cw, clientHeight: ch } = containerRef.current;
              setViewport({
                zoom: newZoom,
                x: cw / 2 - (cw / 2 - viewport.x) * (newZoom / viewport.zoom),
                y: ch / 2 - (ch / 2 - viewport.y) * (newZoom / viewport.zoom),
              });
            }
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors cursor-pointer text-sm font-bold"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={() => {
            if (containerRef.current) {
              const { clientWidth: cw, clientHeight: ch } = containerRef.current;
              setViewport({
                zoom: 1,
                x: cw / 2 - (cw / 2 - viewport.x) / viewport.zoom,
                y: ch / 2 - (ch / 2 - viewport.y) / viewport.zoom,
              });
            }
          }}
          className="px-2 py-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] text-[11px] transition-colors cursor-pointer"
          title="Reset Zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          onClick={() => {
            const newZoom = Math.min(viewport.zoom * 1.15, 5);
            if (containerRef.current) {
              const { clientWidth: cw, clientHeight: ch } = containerRef.current;
              setViewport({
                zoom: newZoom,
                x: cw / 2 - (cw / 2 - viewport.x) * (newZoom / viewport.zoom),
                y: ch / 2 - (ch / 2 - viewport.y) * (newZoom / viewport.zoom),
              });
            }
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors cursor-pointer text-sm font-bold"
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
}
