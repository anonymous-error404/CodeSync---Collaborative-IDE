/**
 * IntelligentWhiteboard — Main engineering canvas orchestrator.
 *
 * Teach Mode removed (§3 out-of-scope).
 * No LLMs, no generative AI, no external AI APIs.
 *
 * Features wired:
 *   - Deterministic graph layout (hierarchical, force, radial, grid, timeline)
 *   - Constrained NLP command palette
 *   - Structured text-to-diagram conversion
 *   - Rule-based diagram validation panel
 *   - Proper connector attachment (sourceId/targetId follow moved nodes)
 *   - PNG, SVG, and JSON export
 *   - Fit-to-canvas / fit-to-selection
 *   - Real-time collaboration (Socket.IO)
 *   - Undo/redo
 *   - Autosave
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  CanvasElement, WhiteboardData, RemoteWhiteboardCursor,
  ParsedCommand, LayoutAlgorithm,
} from '../../types/whiteboard';
import type { ToolType } from './WhiteboardToolbar';

import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardHeader, type SaveState } from './WhiteboardHeader';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WhiteboardPropertiesPanel } from './WhiteboardPropertiesPanel';
import { CommandPalette } from './CommandPalette';
import { TextToDiagramModal } from './TextToDiagramModal';
import { ValidationPanel } from './ValidationPanel';
import { TaskProposalModal } from './TaskProposalModal';

import { updateWhiteboard, recognizeStroke, generateTaskProposals } from '../../services/whiteboardApi';
import { applyLayout, applyLayoutToElements, computeBoundingBox } from '../../services/graphLayout';
import type { DiagramNodeType } from '../../types/whiteboard';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY = 2500;  // ms
const HISTORY_LIMIT = 80;

const NODE_TYPE_DEFAULTS: Partial<Record<DiagramNodeType, Partial<CanvasElement>>> = {
  service:       { strokeColor: '#2f81f7', width: 160, height: 70 },
  client:        { strokeColor: '#58a6ff', width: 160, height: 70 },
  api:           { strokeColor: '#3fb950', width: 160, height: 70 },
  database:      { strokeColor: '#d29922', width: 140, height: 90 },
  cache:         { strokeColor: '#f0883e', width: 140, height: 80 },
  queue:         { strokeColor: '#a371f7', width: 150, height: 70 },
  worker:        { strokeColor: '#79c0ff', width: 160, height: 70 },
  gateway:       { strokeColor: '#2f81f7', width: 150, height: 70 },
  external:      { strokeColor: '#7d8590', width: 150, height: 70 },
  er_entity:     { strokeColor: '#a371f7', width: 180, height: 120 },
  uml_class:     { strokeColor: '#58a6ff', width: 200, height: 140 },
  uml_interface: { strokeColor: '#3fb950', width: 180, height: 100 },
  seq_lifeline:  { strokeColor: '#2f81f7', width: 120, height: 300 },
  workflow_step:      { strokeColor: '#3fb950', width: 150, height: 70 },
  workflow_decision:  { strokeColor: '#f0883e', width: 110, height: 110 },
  infra_container:    { strokeColor: '#58a6ff', width: 160, height: 80 },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  boardId?: string;
  workspace?: { id: string; name?: string };
  initialData?: WhiteboardData;
  socket?: Socket | null;
  userId?: string;
  username?: string;
  onOpenFile?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onTaskCreated?: (task: Record<string, unknown>) => void;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function genId(prefix = 'el'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function exportSVG(elements: CanvasElement[]): void {
  const bb = computeBoundingBox(elements);
  const pad = 40;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', String(bb.width + pad * 2));
  svg.setAttribute('height', String(bb.height + pad * 2));
  svg.setAttribute('viewBox', `${bb.minX - pad} ${bb.minY - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
  svg.setAttribute('style', 'background:#0d1117;font-family:Inter,sans-serif');

  for (const el of elements) {
    if (el.type === 'stroke' && el.points && el.points.length > 1) {
      const path = document.createElementNS(ns, 'path');
      const d = el.points.reduce((acc, p, i) => i === 0 ? `M${p.x} ${p.y}` : `${acc} L${p.x} ${p.y}`, '');
      path.setAttribute('d', d);
      path.setAttribute('stroke', el.strokeColor ?? '#2f81f7');
      path.setAttribute('stroke-width', String(el.strokeWidth ?? 2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    } else if (el.type !== 'connector' && el.type !== 'arrow' && el.width && el.height) {
      const g = document.createElementNS(ns, 'g');
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(el.x));
      rect.setAttribute('y', String(el.y));
      rect.setAttribute('width', String(el.width));
      rect.setAttribute('height', String(el.height));
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', el.fillColor ?? '#161b22');
      rect.setAttribute('stroke', el.strokeColor ?? '#30363d');
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);

      if (el.text) {
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', String(el.x + (el.width / 2)));
        text.setAttribute('y', String(el.y + el.height / 2 + 4));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#e6edf3');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.textContent = el.text;
        g.appendChild(text);
      }
      svg.appendChild(g);
    }
  }

  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'whiteboard.svg';
  a.click();
}

function exportJSON(elements: CanvasElement[], title: string): void {
  const blob = new Blob([JSON.stringify({ title, elements, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, '_')}.json`;
  a.click();
}

function exportPNG(canvasRef: React.RefObject<HTMLElement | null>): void {
  const el = canvasRef.current;
  if (!el) return;

  // Use the Canvas API to render the SVG elements to a canvas
  // For a full implementation html2canvas would be ideal, but we use a native
  // approach: serialize visible SVG content to a data URL.
  const svgEls = el.querySelectorAll('svg');
  const bounds = el.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = bounds.width * 2;
  canvas.height = bounds.height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) { alert('PNG export: Canvas context not available.'); return; }

  ctx.scale(2, 2);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, bounds.width, bounds.height);

  // Draw each SVG
  const promises: Promise<void>[] = [];
  svgEls.forEach(svgEl => {
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    promises.push(new Promise<void>((res) => {
      img.onload = () => {
        const svgRect = svgEl.getBoundingClientRect();
        ctx.drawImage(img, svgRect.left - bounds.left, svgRect.top - bounds.top);
        URL.revokeObjectURL(url);
        res();
      };
      img.onerror = () => res();
      img.src = url;
    }));
  });

  Promise.all(promises).then(() => {
    const a = document.createElement('a');
    a.download = 'whiteboard.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntelligentWhiteboard({
  boardId: propBoardId,
  workspace,
  initialData,
  socket,
  userId,
  username = 'User',
  onOpenFile,
  onOpenInIDE,
  onTaskCreated,
}: Props) {
  const boardId = propBoardId || workspace?.id || 'default-board';
  const effectiveInitialData: WhiteboardData = initialData ?? {
    id: boardId,
    workspaceId: workspace?.id ?? '',
    title: 'Untitled Diagram',
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {},
  };
  const effectiveOnOpenFile = onOpenFile || onOpenInIDE;
  void userId;
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────

  const [elements, setElements] = useState<CanvasElement[]>(effectiveInitialData.elements ?? []);
  const [history, setHistory] = useState<CanvasElement[][]>([effectiveInitialData.elements ?? []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [viewport, setViewport] = useState(effectiveInitialData.viewport ?? { x: 0, y: 0, zoom: 1 });

  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [remoteCursors, setRemoteCursors] = useState<RemoteWhiteboardCursor[]>([]);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTextToDiagram, setShowTextToDiagram] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskProposals, setTaskProposals] = useState<any[]>([]);

  // Pending connector: user chose connector tool, clicked source
  const [pendingConnectorSourceId, setPendingConnectorSourceId] = useState<string | null>(null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── History helpers ───────────────────────────────────────────────────────

  const pushHistory = useCallback((newElements: CanvasElement[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, newElements].slice(-HISTORY_LIMIT);
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, HISTORY_LIMIT - 1));
  }, [historyIndex]);

  const commit = useCallback((newElements: CanvasElement[]) => {
    setElements(newElements);
    pushHistory(newElements);
    setSaveState('unsaved');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      const ok = await updateWhiteboard(boardId, { elements: newElements, viewport });
      setSaveState(ok ? 'saved' : 'error');
    }, AUTOSAVE_DELAY);
  }, [boardId, pushHistory, viewport]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setElements(prev);
    setHistoryIndex(i => i - 1);
    setSaveState('unsaved');
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setElements(next);
    setHistoryIndex(i => i + 1);
    setSaveState('unsaved');
  }, [history, historyIndex]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCommandPalette(true); }
      if (e.key === 'v') setActiveTool('select');
      if (e.key === 'h') setActiveTool('hand');
      if (e.key === 'p') setActiveTool('pen');
      if (e.key === 'e') setActiveTool('eraser');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Socket.IO collaboration ───────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;
    socket.emit('whiteboard:join', { boardId, username });

    socket.on('whiteboard:element_update', (el: CanvasElement) => {
      setElements(prev => {
        const idx = prev.findIndex(e => e.id === el.id);
        return idx >= 0 ? prev.map((e, i) => i === idx ? el : e) : [...prev, el];
      });
    });

    socket.on('whiteboard:element_delete', (id: string) => {
      setElements(prev => prev.filter(e => e.id !== id));
    });

    socket.on('whiteboard:cursor', (cursor: RemoteWhiteboardCursor) => {
      setRemoteCursors(prev => {
        const next = prev.filter(c => c.socketId !== cursor.socketId);
        return [...next, cursor];
      });
    });

    socket.on('whiteboard:user_left', (socketId: string) => {
      setRemoteCursors(prev => prev.filter(c => c.socketId !== socketId));
    });

    return () => {
      socket.off('whiteboard:element_update');
      socket.off('whiteboard:element_delete');
      socket.off('whiteboard:cursor');
      socket.off('whiteboard:user_left');
    };
  }, [socket, boardId, username]);

  // ── Element CRUD ──────────────────────────────────────────────────────────

  const addElement = useCallback((el: CanvasElement) => {
    const newEls = [...elements, el];
    commit(newEls);
    socket?.emit('whiteboard:element_update', { boardId, element: el });
  }, [elements, commit, socket, boardId]);

  const updateElement = useCallback((el: CanvasElement) => {
    const newEls = elements.map(e => e.id === el.id ? el : e);
    setElements(newEls); // immediate UI update without full commit to debounce
    setSaveState('unsaved');
    socket?.emit('whiteboard:element_update', { boardId, element: el });
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      const ok = await updateWhiteboard(boardId, { elements: newEls, viewport });
      setSaveState(ok ? 'saved' : 'error');
    }, AUTOSAVE_DELAY);
  }, [elements, socket, boardId, viewport]);

  const deleteElement = useCallback((id: string) => {
    const newEls = elements.filter(e => e.id !== id);
    commit(newEls);
    socket?.emit('whiteboard:element_delete', { boardId, elementId: id });
  }, [elements, commit, socket, boardId]);

  // ── Tool selection — handle semantic node tools ───────────────────────────

  const handleSelectTool = useCallback((tool: ToolType) => {
    if (tool.startsWith('node:')) {
      const nodeType = tool.slice(5) as DiagramNodeType;
      const defaults = NODE_TYPE_DEFAULTS[nodeType] ?? {};
      const bb = computeBoundingBox(elements);
      const newEl: CanvasElement = {
        id: genId('node'),
        type: 'rectangle',
        x: (bb.centerX - 80) + (Math.random() * 60 - 30),
        y: (bb.centerY - 35) + (Math.random() * 40 - 20),
        width: defaults.width ?? 160,
        height: defaults.height ?? 70,
        diagramType: nodeType,
        text: nodeType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        strokeColor: defaults.strokeColor ?? '#2f81f7',
        fillColor: 'var(--surface)',
        strokeWidth: 2,
        status: 'proposed',
      };
      addElement(newEl);
      setSelectedIds([newEl.id]);
      setActiveTool('select');
    } else if (tool === 'connector') {
      setActiveTool(tool);
      setPendingConnectorSourceId(null);
    } else {
      setActiveTool(tool);
      setPendingConnectorSourceId(null);
    }
  }, [elements, addElement]);

  // ── Canvas click on connector tool ───────────────────────────────────────

  const handleConnectorTargetPicked = useCallback((targetId: string) => {
    if (!pendingConnectorSourceId) return;
    const conn: CanvasElement = {
      id: genId('conn'),
      type: 'connector',
      x: 0, y: 0,
      sourceId: pendingConnectorSourceId,
      targetId,
      relationship: 'calls',
      strokeColor: '#7d8590',
      strokeWidth: 2,
    };
    addElement(conn);
    setPendingConnectorSourceId(null);
    setActiveTool('select');
  }, [pendingConnectorSourceId, addElement]);

  const handleCanvasSelect = useCallback((ids: string[]) => {
    if (activeTool === 'connector' && ids.length === 1) {
      if (!pendingConnectorSourceId) {
        setPendingConnectorSourceId(ids[0]);
      } else {
        handleConnectorTargetPicked(ids[0]);
      }
      return;
    }
    setSelectedIds(ids);
    setHighlightIds([]);
  }, [activeTool, pendingConnectorSourceId, handleConnectorTargetPicked]);

  // ── Smart stroke recognition ──────────────────────────────────────────────

  const handleStrokeComplete = useCallback(async (points: Array<{ x: number; y: number }>) => {
    const candidate = await recognizeStroke(points);
    if (!candidate || !candidate.type) return;

    // Show recognition banner: the canvas keeps original, user can accept/reject
    // For now: show a temporary overlay (handled in canvas via onStrokeComplete callback)
    // The accepted shape replaces the stroke:
    if (candidate.type === 'rectangle' || candidate.type === 'circle' || candidate.type === 'arrow') {
      const newEl: CanvasElement = {
        id: genId(candidate.type),
        type: candidate.type as any,
        x: candidate.x ?? points[0].x,
        y: candidate.y ?? points[0].y,
        width: candidate.width ?? 100,
        height: candidate.height ?? 60,
        strokeColor: '#2f81f7',
        strokeWidth: 2,
        fillColor: 'transparent',
        status: 'proposed',
        confidence: candidate.confidence,
        originalPoints: points,
        points: candidate.points,
        diagramType: 'generic',
      };
      // Add shape without deleting stroke — user manually accepts via properties
      addElement(newEl);
    }
  }, [elements, addElement]);

  // ── Layout ────────────────────────────────────────────────────────────────

  const handleCleanLayout = useCallback((algorithm: LayoutAlgorithm) => {
    const targetIds = selectedIds.length > 1 ? selectedIds : undefined;
    const result = applyLayout(elements, algorithm, targetIds);
    const laid = applyLayoutToElements(elements, result);
    commit(laid);
  }, [elements, selectedIds, commit]);

  // ── Fit to canvas ─────────────────────────────────────────────────────────

  const handleFitCanvas = useCallback((selectionOnly = false) => {
    const targetEls = selectionOnly && selectedIds.length > 0
      ? elements.filter(e => selectedIds.includes(e.id))
      : elements;

    const bb = computeBoundingBox(targetEls);
    if (!canvasRef.current) return;
    const { clientWidth: cw, clientHeight: ch } = canvasRef.current;
    const pad = 60;
    const zoom = Math.min((cw - pad * 2) / Math.max(bb.width, 1), (ch - pad * 2) / Math.max(bb.height, 1), 2);
    setViewport({
      zoom,
      x: cw / 2 - bb.centerX * zoom,
      y: ch / 2 - bb.centerY * zoom,
    });
  }, [elements, selectedIds]);

  // ── NLP command execution ─────────────────────────────────────────────────

  const executeCommand = useCallback((cmd: ParsedCommand) => {
    switch (cmd.intent) {
      case 'align': {
        const dir = cmd.params.direction as string ?? 'left';
        const ids = cmd.targetIds;
        if (ids.length < 2) break;
        const targets = elements.filter(e => ids.includes(e.id));
        let anchor: number;
        if (dir === 'left')     anchor = Math.min(...targets.map(e => e.x));
        else if (dir === 'right') anchor = Math.max(...targets.map(e => e.x + (e.width ?? 0)));
        else if (dir === 'top')   anchor = Math.min(...targets.map(e => e.y));
        else if (dir === 'bottom') anchor = Math.max(...targets.map(e => e.y + (e.height ?? 0)));
        else if (dir === 'center-h') anchor = targets.reduce((acc, e) => acc + e.x + (e.width ?? 0) / 2, 0) / targets.length;
        else anchor = targets.reduce((acc, e) => acc + e.y + (e.height ?? 0) / 2, 0) / targets.length;

        const aligned = elements.map(e => {
          if (!ids.includes(e.id)) return e;
          if (dir === 'left')    return { ...e, x: anchor };
          if (dir === 'right')   return { ...e, x: anchor - (e.width ?? 0) };
          if (dir === 'top')     return { ...e, y: anchor };
          if (dir === 'bottom')  return { ...e, y: anchor - (e.height ?? 0) };
          if (dir === 'center-h') return { ...e, x: anchor - (e.width ?? 0) / 2 };
          return { ...e, y: anchor - (e.height ?? 0) / 2 };
        });
        commit(aligned);
        break;
      }

      case 'arrange': {
        const dir = cmd.params.direction as string ?? 'horizontal';
        const spacing = Number(cmd.params.spacing ?? 40);
        const ids = cmd.targetIds;
        const targets = [...elements.filter(e => ids.includes(e.id))];
        if (targets.length < 2) break;

        const sorted = dir === 'horizontal'
          ? [...targets].sort((a, b) => a.x - b.x)
          : [...targets].sort((a, b) => a.y - b.y);

        let cursor = dir === 'horizontal' ? sorted[0].x : sorted[0].y;
        const arranged = sorted.map(t => {
          const next = { ...t };
          if (dir === 'horizontal') { next.x = cursor; cursor += (t.width ?? 160) + spacing; }
          else { next.y = cursor; cursor += (t.height ?? 70) + spacing; }
          return next;
        });
        commit(elements.map(e => arranged.find(a => a.id === e.id) ?? e));
        break;
      }

      case 'connect': {
        const srcId = cmd.params.sourceId as string;
        const tgtId = cmd.params.targetId as string;
        if (!srcId || !tgtId) break;
        const conn: CanvasElement = {
          id: genId('conn'),
          type: 'connector',
          x: 0, y: 0,
          sourceId: srcId,
          targetId: tgtId,
          relationship: cmd.params.relationship as any ?? 'calls',
          strokeColor: '#7d8590',
          strokeWidth: 2,
        };
        addElement(conn);
        break;
      }

      case 'group': {
        const groupId = genId('grp');
        const ids = cmd.targetIds;
        commit(elements.map(e => ids.includes(e.id) ? { ...e, groupId } : e));
        break;
      }

      case 'ungroup': {
        const ids = cmd.targetIds;
        commit(elements.map(e => ids.includes(e.id) ? { ...e, groupId: undefined } : e));
        break;
      }

      case 'find':
      case 'select': {
        setSelectedIds(cmd.targetIds);
        setHighlightIds(cmd.targetIds);
        break;
      }

      case 'show_dependencies': {
        const targetId = cmd.targetIds[0];
        if (!targetId) break;
        const connected = elements
          .filter(e => (e.type === 'connector' || e.type === 'arrow') &&
            (e.sourceId === targetId || e.targetId === targetId))
          .flatMap(e => [e.sourceId, e.targetId, e.id])
          .filter(Boolean) as string[];
        setHighlightIds([...new Set([targetId, ...connected])]);
        break;
      }

      case 'create_node': {
        const nodeType = (cmd.params.diagramType ?? 'generic') as DiagramNodeType;
        const label = cmd.params.label as string ?? 'New Node';
        const defaults = NODE_TYPE_DEFAULTS[nodeType] ?? {};
        const newEl: CanvasElement = {
          id: genId('node'),
          type: 'rectangle',
          x: 200, y: 200,
          width: defaults.width ?? 160,
          height: defaults.height ?? 70,
          diagramType: nodeType,
          text: label,
          strokeColor: defaults.strokeColor ?? '#2f81f7',
          fillColor: 'var(--surface)',
          strokeWidth: 2,
          status: 'proposed',
        };
        addElement(newEl);
        setSelectedIds([newEl.id]);
        break;
      }

      case 'change_relationship': {
        const rel = cmd.params.relationship as any;
        const updated = elements.map(e =>
          cmd.targetIds.includes(e.id) && (e.type === 'connector' || e.type === 'arrow')
            ? { ...e, relationship: rel }
            : e
        );
        commit(updated);
        break;
      }

      case 'fit_canvas': {
        handleFitCanvas(cmd.params.selection as boolean);
        break;
      }

      case 'validate': {
        setShowValidation(true);
        break;
      }

      case 'layout': {
        handleCleanLayout((cmd.params.algorithm as LayoutAlgorithm) ?? 'hierarchical');
        break;
      }

      case 'delete': {
        const newEls = elements.filter(e => !cmd.targetIds.includes(e.id));
        commit(newEls);
        setSelectedIds([]);
        break;
      }
    }
  }, [elements, selectedIds, commit, addElement, handleFitCanvas, handleCleanLayout]);

  // ── Text → diagram ────────────────────────────────────────────────────────

  const handleTextToDiagramConfirm = useCallback((newEls: CanvasElement[], originalText: string) => {
    // Add original text as a locked text node
    const textNode: CanvasElement = {
      id: genId('txt'),
      type: 'text',
      x: 20, y: 20,
      text: `[Source text]\n${originalText}`,
      fontSize: 11,
      locked: true,
      strokeColor: '#7d8590',
      opacity: 0.6,
    };
    commit([...elements, textNode, ...newEls]);
    // Run hierarchical layout on the new nodes only
    setTimeout(() => handleCleanLayout('hierarchical'), 100);
  }, [elements, commit, handleCleanLayout]);

  // ── Task generation ───────────────────────────────────────────────────────

  const handleGenerateTasks = useCallback(async () => {
    const selected = elements.filter(e => selectedIds.includes(e.id));
    const tasks = await generateTaskProposals(selected.length > 0 ? selected : elements);
    setTaskProposals(tasks);
    setShowTaskModal(true);
  }, [elements, selectedIds]);
  void handleGenerateTasks;

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback((format: 'json' | 'svg' | 'png') => {
    if (format === 'json') exportJSON(elements, effectiveInitialData.title);
    else if (format === 'svg') exportSVG(elements);
    else if (format === 'png') exportPNG(canvasRef);
  }, [elements, effectiveInitialData.title]);

  // ── Title change ──────────────────────────────────────────────────────────

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setSaveState('saving');
    const ok = await updateWhiteboard(boardId, { title: newTitle });
    setSaveState(ok ? 'saved' : 'error');
  }, [boardId]);

  // ── Cursor broadcast ──────────────────────────────────────────────────────

  const handleCursorMove = useCallback((pos: { x: number; y: number }) => {
    socket?.emit('whiteboard:cursor', { boardId, cursor: pos, username });
  }, [socket, boardId, username]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-full" style={{ background: 'var(--bg)' }}>
      <WhiteboardHeader
        title={initialData.title}
        saveState={saveState}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onTitleChange={handleTitleChange}
        onUndo={undo}
        onRedo={redo}
        onFitCanvas={handleFitCanvas}
        onCleanLayout={handleCleanLayout}
        onExport={handleExport}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenTextToDiagram={() => setShowTextToDiagram(true)}
        onOpenValidation={() => setShowValidation(true)}
        selectedCount={selectedIds.length}
      />

      <div className="relative flex-1 overflow-hidden" ref={canvasRef as any}>
        <WhiteboardToolbar activeTool={activeTool} onSelectTool={handleSelectTool} />

        <WhiteboardCanvas
          elements={elements}
          activeTool={activeTool}
          selectedIds={selectedIds}
          highlightIds={highlightIds}
          onSelect={handleCanvasSelect}
          onAddElement={addElement}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onStrokeComplete={handleStrokeComplete}
          onOpenInIDE={effectiveOnOpenFile}
          remoteCursors={remoteCursors}
          onCursorMove={handleCursorMove}
          viewport={viewport}
          onViewportChange={setViewport}
          pendingConnectorSourceId={pendingConnectorSourceId}
          onConnectorTargetPicked={handleConnectorTargetPicked}
        />

        {/* Properties panel — only when no validation panel is open */}
        {!showValidation && (
          <WhiteboardPropertiesPanel
            elements={elements}
            selectedIds={selectedIds}
            onUpdate={updateElement}
            onOpenInIDE={effectiveOnOpenFile}
          />
        )}

        {/* Validation panel */}
        {showValidation && (
          <ValidationPanel
            elements={elements}
            selectedIds={selectedIds}
            onClose={() => setShowValidation(false)}
            onSelectElement={id => { setSelectedIds([id]); setHighlightIds([id]); }}
          />
        )}

        {/* Connector instruction bar */}
        {pendingConnectorSourceId && (
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-semibold border shadow-lg"
            style={{
              background: 'rgba(63,185,80,0.12)',
              borderColor: '#3fb950',
              color: '#3fb950',
              zIndex: 50,
              pointerEvents: 'none',
            }}
          >
            🔗 Click a target node to create the connector — Esc to cancel
          </div>
        )}
      </div>

      {/* Modals */}
      {showCommandPalette && (
        <CommandPalette
          elements={elements}
          selectedIds={selectedIds}
          onClose={() => setShowCommandPalette(false)}
          onExecute={(cmd) => { executeCommand(cmd); setShowCommandPalette(false); }}
        />
      )}

      {showTextToDiagram && (
        <TextToDiagramModal
          existingElements={elements}
          onClose={() => setShowTextToDiagram(false)}
          onConfirm={handleTextToDiagramConfirm}
        />
      )}

      {showTaskModal && (
        <TaskProposalModal
          proposals={taskProposals}
          onClose={() => setShowTaskModal(false)}
          onConfirm={(tasks) => {
            tasks.forEach(t => onTaskCreated?.(t as any));
            setShowTaskModal(false);
          }}
        />
      )}
    </div>
  );
}
