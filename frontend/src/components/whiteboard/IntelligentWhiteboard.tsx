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
import { Lock, GitBranch } from 'lucide-react';
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
import { AiDiagramHubModal } from './AiDiagramHubModal';

import { updateWhiteboard, recognizeStroke, generateTaskProposals, fetchWhiteboard } from '../../services/whiteboardApi';
import { recognizeStrokeLocally } from '../../services/strokeRecognition';
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
  workspace?: { id: string; name?: string; type?: 'educational' | 'professional' | 'competitive' };
  initialData?: WhiteboardData;
  socket?: Socket | null;
  userId?: string;
  username?: string;
  userRole?: string;
  sessionRole?: string;
  onOpenFile?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onTaskCreated?: (task: Record<string, unknown>) => void;
  readOnly?: boolean;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function genId(prefix = 'el'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function exportSVG(elements: CanvasElement[], boardTheme: 'dark' | 'light' = 'dark'): void {
  if (elements.length === 0) {
    alert('No drawings or elements to export.');
    return;
  }
  const bb = computeBoundingBox(elements);
  const pad = 48;
  const isLight = boardTheme === 'light';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', String(bb.width + pad * 2));
  svg.setAttribute('height', String(bb.height + pad * 2));
  svg.setAttribute('viewBox', `${bb.minX - pad} ${bb.minY - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
  svg.setAttribute('style', `background:${isLight ? '#ffffff' : '#0d1117'};font-family:Inter,sans-serif`);

  for (const el of elements) {
    if (el.type === 'stroke' && el.points && el.points.length > 1) {
      const path = document.createElementNS(ns, 'path');
      const d = el.points.reduce((acc, p, i) => i === 0 ? `M${p.x} ${p.y}` : `${acc} L${p.x} ${p.y}`, '');
      path.setAttribute('d', d);
      path.setAttribute('stroke', el.strokeColor ?? (isLight ? '#0969da' : '#2f81f7'));
      path.setAttribute('stroke-width', String(el.strokeWidth ?? 2));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    } else if (el.type === 'circle' && el.width && el.height) {
      const g = document.createElementNS(ns, 'g');
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(el.x + el.width / 2));
      circle.setAttribute('cy', String(el.y + el.height / 2));
      circle.setAttribute('r', String(Math.min(el.width, el.height) / 2 - 2));
      circle.setAttribute('fill', el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : (isLight ? '#ffffff' : '#161b22'));
      circle.setAttribute('stroke', el.strokeColor ?? (isLight ? '#0969da' : '#30363d'));
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
      if (el.text) {
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', String(el.x + (el.width / 2)));
        text.setAttribute('y', String(el.y + el.height / 2 + 4));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', isLight ? '#1f2328' : '#e6edf3');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.textContent = el.text;
        g.appendChild(text);
      }
      svg.appendChild(g);
    } else if (el.type !== 'connector' && el.type !== 'arrow' && el.width && el.height) {
      const g = document.createElementNS(ns, 'g');
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(el.x));
      rect.setAttribute('y', String(el.y));
      rect.setAttribute('width', String(el.width));
      rect.setAttribute('height', String(el.height));
      rect.setAttribute('rx', el.type === 'sticky' ? '4' : '8');
      rect.setAttribute('fill', el.type === 'sticky' ? (el.fillColor ?? (isLight ? '#fff8c5' : '#21262d')) : (el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : (isLight ? '#ffffff' : '#161b22')));
      rect.setAttribute('stroke', el.type === 'sticky' ? (isLight ? '#d4a72c' : (el.strokeColor ?? '#30363d')) : (el.strokeColor ?? (isLight ? '#0969da' : '#30363d')));
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);

      if (el.text) {
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', String(el.x + (el.width / 2)));
        text.setAttribute('y', String(el.y + el.height / 2 + 4));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', isLight ? '#1f2328' : '#e6edf3');
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

function exportCroppedPNG(elements: CanvasElement[], title: string, boardTheme: 'dark' | 'light' = 'dark'): void {
  if (!elements || elements.length === 0) {
    alert('No drawings or elements to export.');
    return;
  }

  // Calculate true drawing bounding box across all elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const elMap = new Map<string, CanvasElement>();
  for (const el of elements) {
    elMap.set(el.id, el);
  }

  for (const el of elements) {
    if (el.type === 'stroke' && el.points && el.points.length > 0) {
      const sw = (el.strokeWidth ?? 3) / 2;
      for (const p of el.points) {
        if (p.x - sw < minX) minX = p.x - sw;
        if (p.y - sw < minY) minY = p.y - sw;
        if (p.x + sw > maxX) maxX = p.x + sw;
        if (p.y + sw > maxY) maxY = p.y + sw;
      }
    } else if (el.type === 'connector' || el.type === 'arrow') {
      const src = el.sourceId ? elMap.get(el.sourceId) : undefined;
      const tgt = el.targetId ? elMap.get(el.targetId) : undefined;
      if (src && tgt) {
        const sx = src.x + (src.width ?? 160) / 2;
        const sy = src.y + (src.height ?? 70) / 2;
        const tx = tgt.x + (tgt.width ?? 160) / 2;
        const ty = tgt.y + (tgt.height ?? 70) / 2;
        minX = Math.min(minX, sx, tx);
        minY = Math.min(minY, sy, ty);
        maxX = Math.max(maxX, sx, tx);
        maxY = Math.max(maxY, sy, ty);
      } else if (el.points && el.points.length > 0) {
        for (const p of el.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    } else {
      const w = el.width ?? 140;
      const h = el.height ?? (el.type === 'text' ? 32 : 70);
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + w);
      maxY = Math.max(maxY, el.y + h);
    }
  }

  if (minX === Infinity || maxX === -Infinity) {
    minX = 0;
    minY = 0;
    maxX = 600;
    maxY = 400;
  }

  const pad = 48;
  const cropX = minX - pad;
  const cropY = minY - pad;
  const cropW = Math.max((maxX - minX) + pad * 2, 80);
  const cropH = Math.max((maxY - minY) + pad * 2, 80);

  const scale = 2; // High-resolution Retina export
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    alert('PNG export: Canvas context not available.');
    return;
  }

  ctx.scale(scale, scale);
  ctx.translate(-cropX, -cropY);

  const isLight = boardTheme === 'light';

  // Fill canvas background
  ctx.fillStyle = isLight ? '#ffffff' : '#0d1117';
  ctx.fillRect(cropX, cropY, cropW, cropH);

  const roundRect = (rx: number, ry: number, rw: number, rh: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
  };

  const drawWrappedText = (
    text: string,
    tx: number,
    ty: number,
    maxWidth: number,
    lineHeight: number,
    align: 'left' | 'center' = 'left'
  ) => {
    const paragraphs = text.split('\n');
    let currentY = ty;
    ctx.textAlign = align;
    for (const para of paragraphs) {
      const words = para.split(' ');
      let currentLine = '';
      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(currentLine, tx, currentY);
          currentLine = words[n];
          currentY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        ctx.fillText(currentLine, tx, currentY);
        currentY += lineHeight;
      }
    }
  };

  // 1. Draw Connectors underneath nodes
  for (const el of elements) {
    if (el.type !== 'connector' && el.type !== 'arrow') continue;

    let startPt: { x: number; y: number } | null = null;
    let endPt: { x: number; y: number } | null = null;

    if (el.sourceId && el.targetId) {
      const src = elMap.get(el.sourceId);
      const tgt = elMap.get(el.targetId);
      if (src && tgt) {
        const getAnchor = (node: CanvasElement, anchor?: string) => {
          const w = node.width ?? 160;
          const h = node.height ?? 70;
          switch (anchor) {
            case 'top': return { x: node.x + w / 2, y: node.y };
            case 'bottom': return { x: node.x + w / 2, y: node.y + h };
            case 'left': return { x: node.x, y: node.y + h / 2 };
            case 'right': return { x: node.x + w, y: node.y + h / 2 };
            default: return { x: node.x + w / 2, y: node.y + h / 2 };
          }
        };
        startPt = getAnchor(src, el.sourceAnchor);
        endPt = getAnchor(tgt, el.targetAnchor);
      }
    } else if (el.points && el.points.length >= 2) {
      startPt = el.points[0];
      endPt = el.points[el.points.length - 1];
    }

    if (!startPt || !endPt) continue;

    ctx.save();
    const connColor = el.strokeColor ?? (isLight ? '#57606a' : '#7d8590');
    ctx.strokeStyle = connColor;
    ctx.lineWidth = el.strokeWidth ?? 2;
    if (el.relationship === 'depends_on') {
      ctx.setLineDash([6, 4]);
    }

    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
    const arrowLen = 12;
    ctx.setLineDash([]);
    ctx.fillStyle = connColor;
    ctx.beginPath();
    ctx.moveTo(endPt.x, endPt.y);
    ctx.lineTo(
      endPt.x - arrowLen * Math.cos(angle - Math.PI / 6),
      endPt.y - arrowLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endPt.x - arrowLen * Math.cos(angle + Math.PI / 6),
      endPt.y - arrowLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // Label
    const label = el.label || el.relationship || el.text;
    if (label) {
      const midX = (startPt.x + endPt.x) / 2;
      const midY = (startPt.y + endPt.y) / 2;
      ctx.font = '10px monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = isLight ? '#ffffff' : '#161b22';
      ctx.strokeStyle = isLight ? '#d0d7de' : '#30363d';
      ctx.lineWidth = 1;
      roundRect(midX - textWidth / 2 - 5, midY - 9, textWidth + 10, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isLight ? '#57606a' : '#8b949e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
    }
    ctx.restore();
  }

  // 2. Draw Shapes & Nodes
  for (const el of elements) {
    if (el.type === 'stroke' || el.type === 'connector' || el.type === 'arrow') continue;

    const x = el.x;
    const y = el.y;
    const w = el.width ?? 160;
    const h = el.height ?? 70;
    const strokeColor = el.strokeColor ?? (isLight ? '#0969da' : '#2f81f7');
    const fillColor = el.fillColor && el.fillColor !== 'transparent'
      ? el.fillColor
      : (isLight ? '#ffffff' : '#161b22');

    ctx.save();

    if (el.type === 'sticky') {
      const stickyBg = el.fillColor ?? (isLight ? '#fff8c5' : '#21262d');
      const stickyBorder = isLight ? '#d4a72c' : strokeColor;
      ctx.fillStyle = stickyBg;
      ctx.strokeStyle = stickyBorder;
      ctx.lineWidth = 1.5;
      roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();

      if (el.text) {
        ctx.fillStyle = isLight ? '#1f2328' : '#e6edf3';
        ctx.font = '13px sans-serif';
        ctx.textBaseline = 'top';
        drawWrappedText(el.text, x + 10, y + 10, w - 20, 18, 'left');
      }
    } else if (el.type === 'text') {
      ctx.fillStyle = el.strokeColor ?? (isLight ? '#1f2328' : '#e6edf3');
      const fontSize = el.fontSize ?? 14;
      ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      drawWrappedText(el.text ?? '', x + 4, y + 4, w - 8, fontSize * 1.35, 'left');
    } else if (el.type === 'circle') {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = el.strokeWidth ?? 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (el.text) {
        ctx.fillStyle = el.strokeColor ?? (isLight ? '#1f2328' : '#e6edf3');
        ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawWrappedText(el.text, x + w / 2, y + h / 2 - 6, w * 0.75, 16, 'center');
      }
    } else if (el.type === 'triangle') {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = el.strokeWidth ?? 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 2);
      ctx.lineTo(x + w - 2, y + h - 2);
      ctx.lineTo(x + 2, y + h - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (el.text) {
        ctx.fillStyle = el.strokeColor ?? (isLight ? '#1f2328' : '#e6edf3');
        ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawWrappedText(el.text, x + w / 2, y + h * 0.62, w * 0.6, 16, 'center');
      }
    } else if (el.type === 'diamond') {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = el.strokeWidth ?? 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 2);
      ctx.lineTo(x + w - 2, y + h / 2);
      ctx.lineTo(x + w / 2, y + h - 2);
      ctx.lineTo(x + 2, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (el.text) {
        ctx.fillStyle = el.strokeColor ?? (isLight ? '#1f2328' : '#e6edf3');
        ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawWrappedText(el.text, x + w / 2, y + h / 2 - 6, w * 0.65, 16, 'center');
      }
    } else if (el.type === 'frame') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      roundRect(x, y, w, h, 8);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = strokeColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(el.text || 'Frame', x + 10, y + 8);
    } else {
      // Default rectangle / semantic node
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = el.strokeWidth ?? 2;
      roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      if (el.text) {
        ctx.fillStyle = isLight ? '#1f2328' : '#e6edf3';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        drawWrappedText(el.text, x + w / 2, y + h / 2 - 4, w - 16, 16, 'center');
      }
    }

    ctx.restore();
  }

  // 3. Draw Freehand Strokes on top
  for (const el of elements) {
    if (el.type !== 'stroke' || !el.points || el.points.length < 2) continue;

    ctx.save();
    ctx.strokeStyle = el.strokeColor ?? (isLight ? '#0969da' : '#2f81f7');
    ctx.lineWidth = el.strokeWidth ?? 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Trigger download of cropped PNG
  const safeTitle = (title || 'whiteboard').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const a = document.createElement('a');
  a.download = `${safeTitle}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
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
  readOnly = false,
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

  // ── Board Theme (light / dark) ──────────────────────────────────────────
  const [boardTheme, setBoardTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('codesync_whiteboard_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleBoardTheme = useCallback(() => {
    setBoardTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('codesync_whiteboard_theme', next);
      } catch {}
      return next;
    });
  }, []);

  // ── State with localStorage persistence ──────────────────────────────────
  const [boardTitle, setBoardTitle] = useState(() => {
    try {
      const cached = localStorage.getItem(`codesync_whiteboard_title_${boardId}`);
      if (cached) return cached;
    } catch {}
    return effectiveInitialData.title;
  });

  const [elements, setElements] = useState<CanvasElement[]>(() => {
    if (effectiveInitialData.elements && effectiveInitialData.elements.length > 0) {
      return effectiveInitialData.elements;
    }
    try {
      const cached = localStorage.getItem(`codesync_whiteboard_${boardId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [history, setHistory] = useState<CanvasElement[][]>(() => [elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [viewport, setViewport] = useState(effectiveInitialData.viewport ?? { x: 0, y: 0, zoom: 1 });

  // Load persisted whiteboard data from backend or sync localStorage
  useEffect(() => {
    let active = true;
    if (boardId) {
      try {
        const cached = localStorage.getItem(`codesync_whiteboard_${boardId}`);
        const cachedTitle = localStorage.getItem(`codesync_whiteboard_title_${boardId}`);
        if (cachedTitle) setBoardTitle(cachedTitle);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setElements(prev => prev.length === 0 ? parsed : prev);
            setHistory(prev => prev[0].length === 0 ? [parsed] : prev);
          }
        }
      } catch {}

      fetchWhiteboard(boardId).then(data => {
        if (!active || !data) return;
        if (data.title) {
          setBoardTitle(data.title);
          try { localStorage.setItem(`codesync_whiteboard_title_${boardId}`, data.title); } catch {}
        }
        if (data.elements && data.elements.length > 0) {
          setElements(data.elements);
          setHistory([data.elements]);
          setHistoryIndex(0);
          try { localStorage.setItem(`codesync_whiteboard_${boardId}`, JSON.stringify(data.elements)); } catch {}
        }
        if (data.viewport) setViewport(data.viewport);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [boardId]);

  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [remoteCursors, setRemoteCursors] = useState<RemoteWhiteboardCursor[]>([]);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTextToDiagram, setShowTextToDiagram] = useState(false);
  const [showAiHub, setShowAiHub] = useState(false);
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
    try {
      localStorage.setItem(`codesync_whiteboard_${boardId}`, JSON.stringify(newElements));
    } catch {}
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
    if (readOnly) return;
    const newEls = [...elements, el];
    commit(newEls);
    socket?.emit('whiteboard:element_update', { boardId, element: el });
  }, [elements, commit, socket, boardId, readOnly]);

  const updateElement = useCallback((el: CanvasElement) => {
    if (readOnly) return;
    const newEls = elements.map(e => e.id === el.id ? el : e);
    setElements(newEls); // immediate UI update without full commit to debounce
    setSaveState('unsaved');
    try {
      localStorage.setItem(`codesync_whiteboard_${boardId}`, JSON.stringify(newEls));
    } catch {}
    socket?.emit('whiteboard:element_update', { boardId, element: el });
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      const ok = await updateWhiteboard(boardId, { elements: newEls, viewport });
      setSaveState(ok ? 'saved' : 'error');
    }, AUTOSAVE_DELAY);
  }, [elements, socket, boardId, viewport, readOnly]);

  const deleteElement = useCallback((id: string) => {
    if (readOnly) return;
    const newEls = elements.filter(e => e.id !== id && e.sourceId !== id && e.targetId !== id);
    commit(newEls);
    socket?.emit('whiteboard:element_delete', { boardId, elementId: id });
  }, [elements, commit, socket, boardId, readOnly]);

  // ── Tool selection — handle semantic node tools ───────────────────────────

  const handleSelectTool = useCallback((tool: ToolType) => {
    if (readOnly && tool !== 'select' && tool !== 'hand') return;
    setActiveTool(tool);
    setPendingConnectorSourceId(null);
  }, [readOnly]);

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

  const handleStrokeComplete = useCallback(async (points: Array<{ x: number; y: number }>, strokeId?: string) => {
    if (readOnly) return;
    let candidate = await recognizeStroke(points).catch(() => null);
    if (!candidate || !candidate.type) {
      candidate = recognizeStrokeLocally(points);
    }
    if (!candidate || !candidate.type) return;

    const supportedShapes = ['rectangle', 'circle', 'triangle', 'diamond', 'arrow'];
    if (supportedShapes.includes(candidate.type)) {
      const isCircle = candidate.type === 'circle';
      const defaultWidth = candidate.width ?? (isCircle ? 100 : 120);
      const defaultHeight = candidate.height ?? (isCircle ? 100 : candidate.type === 'triangle' ? 90 : 70);

      const newEl: CanvasElement = {
        id: genId(candidate.type),
        type: candidate.type as any,
        x: candidate.x ?? points[0].x,
        y: candidate.y ?? points[0].y,
        width: defaultWidth,
        height: defaultHeight,
        strokeColor: '#2f81f7',
        strokeWidth: 2,
        fillColor: 'transparent',
        status: 'proposed',
        confidence: candidate.confidence,
        originalPoints: points,
        points: candidate.points,
        diagramType: 'generic',
      };

      if (strokeId) {
        const filtered = elements.filter(e => e.id !== strokeId);
        commit([...filtered, newEl]);
        socket?.emit('whiteboard:element_delete', { boardId, elementId: strokeId });
        socket?.emit('whiteboard:element_update', { boardId, element: newEl });
      } else {
        addElement(newEl);
      }
      setSelectedIds([newEl.id]);
    }
  }, [elements, commit, socket, boardId, addElement]);

  // ── Layout ────────────────────────────────────────────────────────────────

  const handleCleanLayout = useCallback((algorithm: LayoutAlgorithm) => {
    if (readOnly) return;
    const targetIds = selectedIds.length > 1 ? selectedIds : undefined;
    const result = applyLayout(elements, algorithm, targetIds);
    const laid = applyLayoutToElements(elements, result);
    commit(laid);
  }, [elements, selectedIds, commit, readOnly]);

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
    if (format === 'json') exportJSON(elements, boardTitle);
    else if (format === 'svg') exportSVG(elements, boardTheme);
    else if (format === 'png') exportCroppedPNG(elements, boardTitle, boardTheme);
  }, [elements, boardTitle, boardTheme]);

  // ── Title change ──────────────────────────────────────────────────────────

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setBoardTitle(newTitle);
    try {
      localStorage.setItem(`codesync_whiteboard_title_${boardId}`, newTitle);
    } catch {}
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
    <div
      className="flex flex-col w-full h-full"
      style={{
        background: boardTheme === 'light' ? '#f6f8fa' : 'var(--bg)',
        color: boardTheme === 'light' ? '#1f2328' : 'var(--text)',
      }}
    >
      <WhiteboardHeader
        title={boardTitle}
        saveState={saveState}
        canUndo={!readOnly && historyIndex > 0}
        canRedo={!readOnly && historyIndex < history.length - 1}
        onTitleChange={readOnly ? () => {} : handleTitleChange}
        onUndo={readOnly ? () => {} : undo}
        onRedo={readOnly ? () => {} : redo}
        onFitCanvas={handleFitCanvas}
        onCleanLayout={readOnly ? () => {} : handleCleanLayout}
        onExport={handleExport}
        onOpenCommandPalette={() => { if (!readOnly) setShowCommandPalette(true); }}
        onOpenTextToDiagram={() => { if (!readOnly) setShowTextToDiagram(true); }}
        onOpenAiHub={() => { if (!readOnly) setShowAiHub(true); }}
        onOpenValidation={() => setShowValidation(true)}
        selectedCount={selectedIds.length}
        boardTheme={boardTheme}
        onToggleTheme={toggleBoardTheme}
      />

      <div className="relative flex-1 overflow-hidden" ref={canvasRef as any}>
        {readOnly && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full text-xs font-semibold shadow flex items-center gap-2 pointer-events-none"
            style={{
              background: 'rgba(210, 153, 34, 0.9)',
              color: '#0d1117',
              border: '1px solid rgba(210, 153, 34, 0.4)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Lock size={14} /><span>Whiteboard is in Read-Only Mode</span>
          </div>
        )}

        <WhiteboardToolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          boardTheme={boardTheme}
          readOnly={readOnly}
        />

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
          onToolReset={() => setActiveTool('select')}
          boardTheme={boardTheme}
        />

        {/* Properties panel — only when editable and no validation panel is open */}
        {!readOnly && !showValidation && (
          <WhiteboardPropertiesPanel
            elements={elements}
            selectedIds={selectedIds}
            onUpdate={updateElement}
            onOpenInIDE={effectiveOnOpenFile}
            boardTheme={boardTheme}
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
            <GitBranch size={14} style={{ display: 'inline', marginRight: 4 }} /> Click a target node to create the connector — Esc to cancel
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

      {showAiHub && (
        <AiDiagramHubModal
          workspaceId={workspace?.id || boardId || ''}
          workspaceType={workspace?.type || 'professional'}
          userRole={userRole || 'developer'}
          sessionRole={sessionRole}
          currentElements={elements}
          onAddElements={handleAiElementsAdded}
          onOpenFileInIDE={onOpenFile || onOpenInIDE}
          onClose={() => setShowAiHub(false)}
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
