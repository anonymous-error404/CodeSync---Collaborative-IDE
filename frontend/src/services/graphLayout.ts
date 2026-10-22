/**
 * Deterministic Graph Layout Algorithms
 *
 * Provides layout algorithms for diagram nodes.
 * All computations are local and deterministic — no AI, no external calls.
 *
 * Supported algorithms:
 *   - hierarchical: Top-down layered (Sugiyama-style, simplified)
 *   - force:        Iterative spring force (Fruchterman-Reingold, bounded)
 *   - radial:       Concentric circles from a root
 *   - grid:         Even grid arrangement
 *   - timeline:     Horizontal sequence
 */

import type {
  CanvasElement,
  GraphNode,
  GraphEdge,
  LayoutResult,
  LayoutAlgorithm,
} from '../types/whiteboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_W = 160;
const DEFAULT_H = 70;
const H_GAP = 60;    // horizontal gap between nodes
const V_GAP = 80;    // vertical gap between layers/rows
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

function buildGraph(elements: CanvasElement[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeElements = elements.filter(
    el => el.type !== 'connector' && el.type !== 'arrow' && el.type !== 'stroke'
  );
  const connElements = elements.filter(
    el => el.type === 'connector' || el.type === 'arrow'
  );

  const nodes: GraphNode[] = nodeElements.map(el => ({
    id: el.id,
    width: el.width ?? DEFAULT_W,
    height: el.height ?? DEFAULT_H,
    x: el.x,
    y: el.y,
  }));

  const edges: GraphEdge[] = connElements
    .filter(el => el.sourceId && el.targetId)
    .map(el => ({ sourceId: el.sourceId!, targetId: el.targetId! }));

  return { nodes, edges };
}

// ─── Hierarchical (top-down layered) ─────────────────────────────────────────

function computeInDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of nodes) deg.set(n.id, 0);
  for (const e of edges) deg.set(e.targetId, (deg.get(e.targetId) ?? 0) + 1);
  return deg;
}

function hierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  // Kahn's algorithm to get topological layers
  const inDeg = computeInDegrees(nodes, edges);
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.sourceId)?.push(e.targetId);

  const queue = nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  const layer = new Map<string, number>();
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const succ of adj.get(id) ?? []) {
      const newDeg = (inDeg.get(succ) ?? 1) - 1;
      inDeg.set(succ, newDeg);
      layer.set(succ, Math.max(layer.get(succ) ?? 0, (layer.get(id) ?? 0) + 1));
      if (newDeg === 0) queue.push(succ);
    }
  }

  // Any node not reached (cycle) gets its own layer at the end
  for (const n of nodes) {
    if (!layer.has(n.id)) layer.set(n.id, Math.max(...Array.from(layer.values()), 0) + 1);
  }

  // Collect nodes per layer
  const byLayer = new Map<number, string[]>();
  for (const [id, l] of layer.entries()) {
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(id);
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const positions: Record<string, { x: number; y: number }> = {};

  for (const [layerIdx, ids] of Array.from(byLayer.entries()).sort(([a], [b]) => a - b)) {
    const totalW = ids.reduce((acc, id) => acc + (nodeMap.get(id)?.width ?? DEFAULT_W) + H_GAP, -H_GAP);
    let x = ORIGIN_X - totalW / 2 + 400; // center around x=400

    for (const id of ids) {
      const n = nodeMap.get(id);
      const w = n?.width ?? DEFAULT_W;
      positions[id] = { x, y: ORIGIN_Y + layerIdx * (DEFAULT_H + V_GAP) };
      x += w + H_GAP;
    }
  }

  return positions;
}

// ─── Force-directed (Fruchterman-Reingold, bounded) ──────────────────────────

function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  const ITERATIONS = 150;
  const k = Math.sqrt((1200 * 800) / Math.max(nodes.length, 1));
  const COOLING = 0.95;
  let temp = 100;

  // Initialize positions from current
  const pos = new Map<string, { x: number; y: number; dx: number; dy: number }>();
  nodes.forEach((n, i) => {
    pos.set(n.id, {
      x: n.x || (100 + (i % 6) * 200),
      y: n.y || (100 + Math.floor(i / 6) * 150),
      dx: 0, dy: 0,
    });
  });

  const repulsion = (d: number) => (k * k) / Math.max(d, 1);
  const attraction = (d: number) => (d * d) / k;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsive forces
    for (const u of nodes) {
      const pu = pos.get(u.id)!;
      pu.dx = 0; pu.dy = 0;
      for (const v of nodes) {
        if (u.id === v.id) continue;
        const pv = pos.get(v.id)!;
        const dx = pu.x - pv.x;
        const dy = pu.y - pv.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const rep = repulsion(dist);
        pu.dx += (dx / dist) * rep;
        pu.dy += (dy / dist) * rep;
      }
    }

    // Attractive forces (edges)
    for (const e of edges) {
      const pu = pos.get(e.sourceId);
      const pv = pos.get(e.targetId);
      if (!pu || !pv) continue;
      const dx = pu.x - pv.x;
      const dy = pu.y - pv.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const att = attraction(dist);
      pu.dx -= (dx / dist) * att;
      pu.dy -= (dy / dist) * att;
      pv.dx += (dx / dist) * att;
      pv.dy += (dy / dist) * att;
    }

    // Apply displacements with temperature limit
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const disp = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 1;
      p.x += (p.dx / disp) * Math.min(Math.abs(p.dx), temp);
      p.y += (p.dy / disp) * Math.min(Math.abs(p.dy), temp);
      // Clamp to canvas
      p.x = Math.max(ORIGIN_X, Math.min(2000, p.x));
      p.y = Math.max(ORIGIN_Y, Math.min(1500, p.y));
    }

    temp *= COOLING;
  }

  const result: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of pos.entries()) result[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  return result;
}

// ─── Radial ───────────────────────────────────────────────────────────────────

function radialLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  // Find root (most outgoing edges)
  const outDeg = new Map<string, number>();
  for (const n of nodes) outDeg.set(n.id, 0);
  for (const e of edges) outDeg.set(e.sourceId, (outDeg.get(e.sourceId) ?? 0) + 1);

  const sorted = [...nodes].sort((a, b) => (outDeg.get(b.id) ?? 0) - (outDeg.get(a.id) ?? 0));
  const root = sorted[0];
  const cx = 600, cy = 400;
  const positions: Record<string, { x: number; y: number }> = {};
  positions[root.id] = { x: cx, y: cy };

  const ring = sorted.slice(1);
  const radii = [200, 380];
  const innerCount = Math.min(Math.ceil(ring.length / 2), 8);

  ring.forEach((n, i) => {
    const ringIdx = i < innerCount ? 0 : 1;
    const angle = (2 * Math.PI * (i - (ringIdx === 0 ? 0 : innerCount))) / (ringIdx === 0 ? innerCount : ring.length - innerCount);
    const r = radii[ringIdx] ?? radii[radii.length - 1];
    positions[n.id] = {
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    };
  });

  return positions;
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function gridLayout(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[n.id] = {
      x: ORIGIN_X + col * (DEFAULT_W + H_GAP),
      y: ORIGIN_Y + row * (DEFAULT_H + V_GAP),
    };
  });
  return positions;
}

// ─── Timeline (horizontal sequence) ──────────────────────────────────────────

function timelineLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<string, { x: number; y: number }> {
  // Use topological order for timeline
  const hierPos = hierarchicalLayout(nodes, edges);
  // Rotate 90° — swap x layers to horizontal
  const layerByNode = new Map<string, number>();
  for (const n of nodes) {
    const y = hierPos[n.id]?.y ?? ORIGIN_Y;
    const layer = Math.round((y - ORIGIN_Y) / (DEFAULT_H + V_GAP));
    layerByNode.set(n.id, layer);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, layer] of layerByNode.entries()) {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(id);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [layerIdx, ids] of Array.from(byLayer.entries()).sort(([a], [b]) => a - b)) {
    ids.forEach((id, i) => {
      positions[id] = {
        x: ORIGIN_X + layerIdx * (DEFAULT_W + H_GAP),
        y: ORIGIN_Y + i * (DEFAULT_H + V_GAP),
      };
    });
  }
  return positions;
}

// ─── Main layout entry point ──────────────────────────────────────────────────

/**
 * Apply a layout algorithm to a set of canvas elements.
 * Returns new positions keyed by element ID.
 * Connectors (sourceId/targetId) are not repositioned — they follow their endpoints.
 *
 * @param elements - Full set of canvas elements.
 * @param algorithm - Which layout algorithm to use.
 * @param targetIds - If provided, only layout these node IDs (others keep position).
 */
export function applyLayout(
  elements: CanvasElement[],
  algorithm: LayoutAlgorithm = 'hierarchical',
  targetIds?: string[],
): LayoutResult {
  const { nodes: allNodes, edges } = buildGraph(elements);
  const nodes = targetIds && targetIds.length > 0
    ? allNodes.filter(n => targetIds.includes(n.id))
    : allNodes;

  // Edges among the target nodes only
  const targetSet = new Set(nodes.map(n => n.id));
  const filteredEdges = edges.filter(e => targetSet.has(e.sourceId) && targetSet.has(e.targetId));

  let positions: Record<string, { x: number; y: number }>;
  switch (algorithm) {
    case 'hierarchical': positions = hierarchicalLayout(nodes, filteredEdges); break;
    case 'force':        positions = forceLayout(nodes, filteredEdges);        break;
    case 'radial':       positions = radialLayout(nodes, filteredEdges);       break;
    case 'grid':         positions = gridLayout(nodes);                        break;
    case 'timeline':     positions = timelineLayout(nodes, filteredEdges);     break;
    default:             positions = gridLayout(nodes);
  }

  return { positions, algorithm };
}

/**
 * Apply a layout result back to a set of canvas elements.
 * Only moves nodes; connector positions are recalculated by the canvas renderer.
 */
export function applyLayoutToElements(
  elements: CanvasElement[],
  result: LayoutResult,
): CanvasElement[] {
  return elements.map(el => {
    const newPos = result.positions[el.id];
    if (!newPos) return el;
    return { ...el, x: newPos.x, y: newPos.y };
  });
}

/**
 * Grid-snap elements to a 20px grid (existing clean-layout behaviour).
 */
export function snapToGrid(elements: CanvasElement[], gridSize = 20): CanvasElement[] {
  return elements.map(el => {
    if (el.type === 'connector' || el.type === 'arrow' || el.type === 'stroke') return el;
    return {
      ...el,
      x: Math.round(el.x / gridSize) * gridSize,
      y: Math.round(el.y / gridSize) * gridSize,
      width: el.width ? Math.max(gridSize, Math.round(el.width / gridSize) * gridSize) : el.width,
      height: el.height ? Math.max(gridSize, Math.round(el.height / gridSize) * gridSize) : el.height,
    };
  });
}

/**
 * Compute the geometric center of a set of elements.
 */
export function computeBoundingBox(elements: CanvasElement[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; centerX: number; centerY: number } {
  const nodes = elements.filter(el => el.type !== 'stroke' && el.width && el.height);
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, centerX: 400, centerY: 300 };

  const minX = Math.min(...nodes.map(el => el.x));
  const minY = Math.min(...nodes.map(el => el.y));
  const maxX = Math.max(...nodes.map(el => el.x + (el.width ?? 0)));
  const maxY = Math.max(...nodes.map(el => el.y + (el.height ?? 0)));

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

export default { applyLayout, applyLayoutToElements, snapToGrid, computeBoundingBox };
