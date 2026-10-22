/**
 * Structured Text-to-Diagram Parser
 *
 * Converts supported text specifications into editable diagram nodes and edges.
 * Deterministic only — no LLMs, no generative AI.
 *
 * Supported input formats:
 *   1. Arrow notation:  "ClientApp -> AuthService : calls"
 *   2. Simple prose (limited grammar): "Client sends request to API"
 *   3. Bullet-list component definitions: "- AuthService (service)"
 *   4. Table: "Source | Relationship | Target"
 *
 * Rules:
 * - Only creates relationships that are explicitly stated.
 * - Ambiguous sentences are added to `unresolved`.
 * - Original text is never overwritten.
 * - No automatic task generation from the diagram.
 */

import type {
  DiagramNodeType,
  RelationshipType,
  TextDiagramParseResult,
  ParsedTextNode,
  ParsedTextEdge,
} from '../types/whiteboard';
import type { CanvasElement } from '../types/whiteboard';

// ─── Type inference keywords ──────────────────────────────────────────────────

const NODE_TYPE_MAP: Array<{ keywords: string[]; type: DiagramNodeType }> = [
  { keywords: ['service', 'svc', 'microservice'], type: 'service' },
  { keywords: ['client', 'browser', 'user', 'frontend', 'ui', 'web app', 'mobile'], type: 'client' },
  { keywords: ['api', 'gateway', 'endpoint', 'rest', 'graphql', 'grpc'], type: 'api' },
  { keywords: ['database', 'db', 'postgres', 'mysql', 'sqlite', 'mongo', 'redis', 'store', 'sql'], type: 'database' },
  { keywords: ['cache', 'memcached'], type: 'cache' },
  { keywords: ['queue', 'kafka', 'rabbitmq', 'pubsub', 'topic', 'bus', 'broker'], type: 'queue' },
  { keywords: ['worker', 'consumer', 'job', 'cron'], type: 'worker' },
  { keywords: ['load balancer', 'lb', 'nginx', 'haproxy', 'proxy', 'ingress'], type: 'gateway' },
  { keywords: ['external', 'third party', 'third-party', 'stripe', 'sendgrid', 'twilio', 'webhook'], type: 'external' },
  { keywords: ['entity', 'table'], type: 'er_entity' },
  { keywords: ['class'], type: 'uml_class' },
  { keywords: ['interface'], type: 'uml_interface' },
  { keywords: ['lifeline', 'participant'], type: 'seq_lifeline' },
  { keywords: ['actor'], type: 'seq_actor' },
  { keywords: ['step', 'activity'], type: 'workflow_step' },
  { keywords: ['decision', 'condition', 'diamond', 'if'], type: 'workflow_decision' },
  { keywords: ['state'], type: 'workflow_state' },
  { keywords: ['container', 'docker', 'pod'], type: 'infra_container' },
  { keywords: ['server', 'machine', 'vm', 'node', 'instance'], type: 'infra_node' },
  { keywords: ['cloud', 'aws', 'gcp', 'azure'], type: 'infra_cloud' },
];

const RELATIONSHIP_MAP: Array<{ patterns: RegExp[]; rel: RelationshipType }> = [
  { patterns: [/\bcall[s]?\b/, /\binvoke[s]?\b/, /\brequest[s]?\b/], rel: 'calls' },
  { patterns: [/\breads?\s+from\b/, /\bqueri(es|y)\b/, /\bfetch(es)?\b/], rel: 'reads_from' },
  { patterns: [/\bwrites?\s+to\b/, /\binserts?\b/, /\bpersists?\b/, /\bstores?\b/, /\bupdates?\b/], rel: 'writes_to' },
  { patterns: [/\bpublish(es)?\b/, /\bproduce[s]?\b/, /\bemits?\b/, /\bsends?\s+to\b/, /\bpushes?\b/], rel: 'publishes' },
  { patterns: [/\bsubscribes?\b/, /\bconsumes?\b/, /\blistens?\b/], rel: 'subscribes' },
  { patterns: [/\bdepends?\s+on\b/, /\buse[s]?\b/, /\brequires?\b/], rel: 'depends_on' },
  { patterns: [/\bcontains?\b/, /\bhas\b/, /\bowns?\b/, /\bincludes?\b/], rel: 'contains' },
  { patterns: [/\binherits?\b/, /\bextends?\b/], rel: 'inherits' },
  { patterns: [/\bimplements?\b/], rel: 'implements' },
  { patterns: [/\btransitions?\s+to\b/, /\bgoes?\s+to\b/, /\bmoves?\s+to\b/], rel: 'transitions_to' },
  { patterns: [/\bsend[s]?\b/, /\bforward[s]?\b/, /\bpass(es)?\b/, /\bproxies\b/], rel: 'calls' },
  { patterns: [/\breturn[s]?\b/, /\brespond[s]?\b/, /\breply\b/], rel: 'return' },
  { patterns: [/\bconnects?\s+to\b/, /\blinks?\s+to\b/, /\btalk[s]?\s+to\b/], rel: 'connects_to' },
  { patterns: [/\b->\b/, /\b→\b/, /\bto\b/], rel: 'calls' },  // generic fallback for "to"
];

// ─── Utility ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId(prefix = 'parsed'): string {
  return `${prefix}-${Date.now()}-${_idCounter++}`;
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function inferNodeType(label: string): DiagramNodeType {
  const lower = label.toLowerCase();
  for (const entry of NODE_TYPE_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) return entry.type;
  }
  return 'generic';
}

function inferRelationship(verb: string): RelationshipType {
  const lower = verb.toLowerCase();
  for (const entry of RELATIONSHIP_MAP) {
    if (entry.patterns.some(p => p.test(lower))) return entry.rel;
  }
  return 'generic_arrow';
}

/** Deduplicate by label (case-insensitive), return existing id if found. */
function getOrCreateNode(
  label: string,
  nodeMap: Map<string, ParsedTextNode>,
): ParsedTextNode {
  const key = label.toLowerCase();
  if (nodeMap.has(key)) return nodeMap.get(key)!;
  const node: ParsedTextNode = {
    id: genId('node'),
    label: normalize(label),
    diagramType: inferNodeType(label),
  };
  nodeMap.set(key, node);
  return node;
}

// ─── Format parsers ───────────────────────────────────────────────────────────

/**
 * Arrow notation: "Source -> Target : relationship"
 * Also handles "Source -> Target" without label and "Source | rel | Target" tables.
 */
function parseArrowLine(line: string, nodeMap: Map<string, ParsedTextNode>): ParsedTextEdge | null {
  // Table row: Source | Relationship | Target
  const tableParts = line.split('|').map(p => p.trim());
  if (tableParts.length === 3 && !line.includes('->') && !line.includes('→')) {
    const [src, rel, tgt] = tableParts;
    if (!src || !rel || !tgt) return null;
    if (src.toLowerCase() === 'source' || src.toLowerCase() === 'from') return null; // header row
    const sourceNode = getOrCreateNode(src, nodeMap);
    const targetNode = getOrCreateNode(tgt, nodeMap);
    return {
      fromId: sourceNode.id,
      toId: targetNode.id,
      relationship: inferRelationship(rel),
      label: rel,
    };
  }

  // Arrow syntax: "A -> B : calls" or "A -> B"
  const arrowMatch = line.match(/^(.+?)\s*(?:->|→|-->)\s*(.+?)(?:\s*:\s*(.+))?$/);
  if (arrowMatch) {
    const [, srcRaw, tgtRaw, labelRaw] = arrowMatch;
    const src = normalize(srcRaw);
    const tgt = normalize(tgtRaw);
    if (!src || !tgt) return null;
    const sourceNode = getOrCreateNode(src, nodeMap);
    const targetNode = getOrCreateNode(tgt, nodeMap);
    return {
      fromId: sourceNode.id,
      toId: targetNode.id,
      relationship: labelRaw ? inferRelationship(labelRaw) : 'calls',
      label: labelRaw ? normalize(labelRaw) : undefined,
    };
  }

  return null;
}

/**
 * Bullet list: "- ServiceName (type)" or "* ServiceName"
 */
function parseBulletNode(line: string, nodeMap: Map<string, ParsedTextNode>): ParsedTextNode | null {
  const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
  if (!bulletMatch) return null;

  let label = bulletMatch[1].trim();
  let explicitType: DiagramNodeType | undefined;

  // Check for "(type)" annotation
  const typeAnnotation = label.match(/\(([^)]+)\)$/);
  if (typeAnnotation) {
    label = label.replace(typeAnnotation[0], '').trim();
    explicitType = inferNodeType(typeAnnotation[1]);
  }

  const node = getOrCreateNode(label, nodeMap);
  if (explicitType) node.diagramType = explicitType;
  return node;
}

/**
 * Simple prose parser with limited grammar:
 * "Subject verb Object" patterns.
 *
 * Supported verbs are those in RELATIONSHIP_MAP.
 * Subject and Object must be capitalised or quoted to be unambiguous.
 *
 * Returns null if the sentence cannot be reliably parsed.
 */
function parseProseSentence(
  sentence: string,
  nodeMap: Map<string, ParsedTextNode>,
): ParsedTextEdge | null {
  // Try each relationship pattern as a verb pivot
  for (const entry of RELATIONSHIP_MAP) {
    for (const pattern of entry.patterns) {
      const match = sentence.match(new RegExp(`^(.+?)\\s+${pattern.source}\\s+(.+)$`, 'i'));
      if (match) {
        const [, subjectRaw, objectRaw] = match;
        const subject = normalize(subjectRaw.replace(/^(the|a|an)\s+/i, ''));
        const object = normalize(objectRaw.replace(/^(the|a|an)\s+/i, '').replace(/\.$/, ''));

        // Reject if subject/object look like noise (single common words that aren't names)
        const STOP_WORDS = new Set(['it', 'this', 'that', 'he', 'she', 'they', 'we', 'response', 'request', 'data']);
        if (STOP_WORDS.has(subject.toLowerCase()) || STOP_WORDS.has(object.toLowerCase())) return null;
        if (subject.length < 2 || object.length < 2) return null;

        const sourceNode = getOrCreateNode(subject, nodeMap);
        const targetNode = getOrCreateNode(object, nodeMap);
        return {
          fromId: sourceNode.id,
          toId: targetNode.id,
          relationship: entry.rel,
        };
      }
    }
  }
  return null;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse supported text specifications into diagram nodes and edges.
 *
 * @param text - Raw input text from the user.
 * @param existingElements - Current canvas elements for deduplication.
 * @returns `TextDiagramParseResult` with nodes, edges, and unresolved fragments.
 */
export function parseTextToDiagram(
  text: string,
  existingElements: CanvasElement[] = [],
): TextDiagramParseResult {
  _idCounter = 0;
  const nodeMap = new Map<string, ParsedTextNode>();
  const edges: ParsedTextEdge[] = [];
  const unresolved: string[] = [];

  // Pre-populate node map with existing canvas elements so we link to them
  for (const el of existingElements) {
    if (el.text && !el.type.includes('stroke') && !el.type.includes('arrow')) {
      const existing: ParsedTextNode = {
        id: el.id,
        label: el.text,
        diagramType: el.diagramType ?? 'generic',
      };
      nodeMap.set(el.text.toLowerCase(), existing);
    }
  }

  // Split into lines, then into sentences within lines
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip comment-style lines and table headers
    if (line.startsWith('#') || line.startsWith('//')) continue;

    // Attempt arrow notation first (most reliable)
    const arrowEdge = parseArrowLine(line, nodeMap);
    if (arrowEdge) {
      edges.push(arrowEdge);
      continue;
    }

    // Bullet node definition
    const bulletNode = parseBulletNode(line, nodeMap);
    if (bulletNode) continue; // node added to map, no edge needed

    // Prose sentences — split on ". " and "and" between clauses carefully
    const sentences = line
      .split(/\.\s+|\s+and\s+(?=[A-Z])/g)
      .map(s => s.trim())
      .filter(Boolean);

    let parsedAny = false;
    for (const sentence of sentences) {
      const edge = parseProseSentence(sentence, nodeMap);
      if (edge) {
        edges.push(edge);
        parsedAny = true;
      }
    }

    if (!parsedAny && !line.startsWith('|') && !line.includes('->') && !line.includes('→')) {
      unresolved.push(line);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    unresolved,
    inputText: text,
  };
}

/**
 * Convert a `TextDiagramParseResult` into canvas elements ready to place.
 * Nodes get default positions arranged in rows; caller should run layout afterwards.
 */
export function buildCanvasElements(
  result: TextDiagramParseResult,
  startX = 100,
  startY = 100,
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const NODE_W = 160;
  const NODE_H = 70;
  const COL_GAP = 60;
  const ROW_GAP = 80;
  const MAX_COLS = 5;

  // Build node elements
  const nodeIdToElId = new Map<string, string>();

  result.nodes.forEach((node, idx) => {
    const col = idx % MAX_COLS;
    const row = Math.floor(idx / MAX_COLS);
    const x = startX + col * (NODE_W + COL_GAP);
    const y = startY + row * (NODE_H + ROW_GAP);

    const elId = `txt-node-${node.id}`;
    nodeIdToElId.set(node.id, elId);

    elements.push({
      id: elId,
      type: 'rectangle',
      x,
      y,
      width: NODE_W,
      height: NODE_H,
      text: node.label,
      diagramType: node.diagramType,
      strokeColor: getNodeColor(node.diagramType),
      fillColor: 'var(--surface)',
      strokeWidth: 2,
      status: 'proposed',
    });
  });

  // Build connector elements
  result.edges.forEach((edge, idx) => {
    const sourceElId = nodeIdToElId.get(edge.fromId) ?? edge.fromId;
    const targetElId = nodeIdToElId.get(edge.toId) ?? edge.toId;

    elements.push({
      id: `txt-edge-${idx}-${Date.now()}`,
      type: 'connector',
      x: 0,
      y: 0,
      sourceId: sourceElId,
      targetId: targetElId,
      relationship: edge.relationship,
      text: edge.label,
      strokeColor: '#7d8590',
      strokeWidth: 2,
    });
  });

  return elements;
}

function getNodeColor(type: DiagramNodeType): string {
  const colorMap: Partial<Record<DiagramNodeType, string>> = {
    service: '#2f81f7',
    client: '#58a6ff',
    api: '#3fb950',
    database: '#d29922',
    cache: '#f0883e',
    queue: '#a371f7',
    worker: '#79c0ff',
    gateway: '#2f81f7',
    external: '#7d8590',
    er_entity: '#a371f7',
    uml_class: '#58a6ff',
    uml_interface: '#3fb950',
    seq_lifeline: '#2f81f7',
    seq_actor: '#58a6ff',
    workflow_step: '#3fb950',
    workflow_decision: '#f0883e',
    workflow_state: '#a371f7',
    infra_node: '#d29922',
    infra_container: '#58a6ff',
    infra_cloud: '#79c0ff',
    generic: '#7d8590',
  };
  return colorMap[type] ?? '#7d8590';
}

export { getNodeColor };
export default { parseTextToDiagram, buildCanvasElements };
