/**
 * Deterministic NLP Command Parser
 *
 * Parses supported canvas commands from natural language using a fixed intent
 * registry and pattern matching. No LLM, no generative AI, no external APIs.
 *
 * Supported intents:
 *   align, arrange, connect, group, ungroup, find, filter,
 *   show_dependencies, create_node, change_relationship,
 *   fit_canvas, validate, select, layout, delete
 */

import type {
  CanvasElement,
  ParsedCommand,
  AlignDirection,
  ArrangeDirection,
  DiagramNodeType,
  RelationshipType,
  LayoutAlgorithm,
} from '../types/whiteboard';

// ─── Pattern registry ─────────────────────────────────────────────────────────

const ALIGN_PATTERN = /\b(align|snap)\b/i;
const ARRANGE_PATTERN = /\b(arrange|sort|order|distribute|spread)\b/i;
const CONNECT_PATTERN = /\b(connect|link|attach|join|wire)\b/i;
const GROUP_PATTERN = /\bgroup\b/i;
const UNGROUP_PATTERN = /\bungroup\b/i;
const FIND_PATTERN = /\b(find|search|show|highlight|where)\b/i;
const FILTER_PATTERN = /\b(filter|hide|only show)\b/i;
const DEPS_PATTERN = /\b(dependenc(y|ies)|linked to|connections of|neighbors of)\b/i;
const CREATE_PATTERN = /\b(create|add|new|make|insert)\b/i;
const CHANGE_REL_PATTERN = /\b(change|set|update|convert) .*(connector|relationship|relation|link type)\b/i;
const FIT_PATTERN = /\b(fit|reset view|zoom to fit|fit all|center)\b/i;
const VALIDATE_PATTERN = /\b(validate|check|verify|diagnose|lint)\b/i;
const SELECT_PATTERN = /\b(select|pick)\b/i;
const LAYOUT_PATTERN = /\b(layout|arrange layout|apply layout)\b/i;
const DELETE_PATTERN = /\b(delete|remove|clear|erase)\b/i;

// ─── Direction keywords ───────────────────────────────────────────────────────

const ALIGN_DIRECTIONS: Record<string, AlignDirection> = {
  left: 'left', right: 'right', top: 'top', bottom: 'bottom',
  horizontal: 'center-h', vertical: 'center-v',
  'center horizontally': 'center-h', 'center vertically': 'center-v',
  center: 'center-h',
  'left to right': 'left', 'top to bottom': 'top',
};

const ARRANGE_DIRECTIONS: Record<string, ArrangeDirection> = {
  'left to right': 'horizontal', horizontal: 'horizontal',
  'right to left': 'horizontal',
  vertical: 'vertical', 'top to bottom': 'vertical', 'bottom to top': 'vertical',
  grid: 'grid',
};

const LAYOUT_ALGORITHMS: Record<string, LayoutAlgorithm> = {
  hierarchical: 'hierarchical', tree: 'hierarchical', 'top-down': 'hierarchical',
  force: 'force', 'force-directed': 'force', organic: 'force',
  radial: 'radial', circular: 'radial',
  grid: 'grid', matrix: 'grid',
  timeline: 'timeline', sequence: 'timeline',
};

// ─── Semantic node type keywords ──────────────────────────────────────────────

const NODE_TYPE_KEYWORDS: Array<{ keywords: string[]; type: DiagramNodeType }> = [
  { keywords: ['service', 'microservice', 'svc'], type: 'service' },
  { keywords: ['client', 'browser', 'user', 'frontend', 'ui', 'app'], type: 'client' },
  { keywords: ['api', 'endpoint', 'rest', 'graphql', 'grpc'], type: 'api' },
  { keywords: ['database', 'db', 'postgres', 'mysql', 'sqlite', 'mongo', 'store', 'sql'], type: 'database' },
  { keywords: ['cache', 'redis', 'memcached'], type: 'cache' },
  { keywords: ['queue', 'kafka', 'rabbitmq', 'pubsub', 'topic', 'bus', 'message'], type: 'queue' },
  { keywords: ['worker', 'consumer', 'job', 'cron', 'background'], type: 'worker' },
  { keywords: ['gateway', 'proxy', 'ingress', 'nginx', 'load balancer', 'lb'], type: 'gateway' },
  { keywords: ['external', 'third party', 'third-party', 'webhook', 'saas'], type: 'external' },
  { keywords: ['entity', 'er entity', 'table'], type: 'er_entity' },
  { keywords: ['class', 'uml class'], type: 'uml_class' },
  { keywords: ['interface'], type: 'uml_interface' },
  { keywords: ['lifeline', 'participant'], type: 'seq_lifeline' },
  { keywords: ['actor'], type: 'seq_actor' },
  { keywords: ['step', 'task', 'activity'], type: 'workflow_step' },
  { keywords: ['decision', 'condition', 'branch', 'if', 'gateway'], type: 'workflow_decision' },
  { keywords: ['state'], type: 'workflow_state' },
  { keywords: ['container', 'docker', 'pod', 'k8s', 'kubernetes'], type: 'infra_container' },
  { keywords: ['server', 'node', 'machine', 'vm', 'instance'], type: 'infra_node' },
];

// ─── Relationship type keywords ───────────────────────────────────────────────

const RELATIONSHIP_KEYWORDS: Array<{ keywords: string[]; rel: RelationshipType }> = [
  { keywords: ['calls', 'call', 'invoke', 'invokes', 'requests', 'request'], rel: 'calls' },
  { keywords: ['depends on', 'depends', 'uses', 'requires'], rel: 'depends_on' },
  { keywords: ['reads from', 'reads', 'queries', 'query', 'fetches', 'gets from'], rel: 'reads_from' },
  { keywords: ['writes to', 'writes', 'inserts', 'updates', 'persists', 'stores'], rel: 'writes_to' },
  { keywords: ['publishes', 'publish', 'produces', 'emits', 'sends to'], rel: 'publishes' },
  { keywords: ['subscribes', 'subscribe', 'consumes', 'listens'], rel: 'subscribes' },
  { keywords: ['contains', 'include', 'has', 'owns', 'belongs to'], rel: 'contains' },
  { keywords: ['inherits', 'extends', 'inherit from'], rel: 'inherits' },
  { keywords: ['implements', 'implement'], rel: 'implements' },
  { keywords: ['connects to', 'connect', 'linked to', 'links to'], rel: 'connects_to' },
  { keywords: ['transitions to', 'transition', 'goes to', 'moves to'], rel: 'transitions_to' },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-_']/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractQuotedNames(text: string): string[] {
  const matches = text.match(/["']([^"']+)["']/g) || [];
  return matches.map(m => m.replace(/["']/g, '').trim());
}

function matchKeywords<T>(text: string, map: Array<{ keywords: string[]; [k: string]: unknown }>, resultKey: string): T | undefined {
  const lower = normalize(text);
  for (const entry of map) {
    if ((entry.keywords as string[]).some(kw => lower.includes(kw))) {
      return entry[resultKey] as T;
    }
  }
  return undefined;
}

/** Find elements by label substring (case-insensitive). */
function findByLabel(name: string, elements: CanvasElement[]): CanvasElement[] {
  const lower = name.toLowerCase();
  return elements.filter(el =>
    (el.text || '').toLowerCase().includes(lower)
  );
}

/** Resolve element references from a parsed name against the canvas. */
function resolveElements(names: string[], elements: CanvasElement[], selectedIds: string[]): {
  resolved: CanvasElement[];
  ambiguities: string[];
} {
  const resolved: CanvasElement[] = [];
  const ambiguities: string[] = [];

  if (names.length === 0) {
    // Default to selection
    const sel = elements.filter(el => selectedIds.includes(el.id));
    return { resolved: sel, ambiguities: [] };
  }

  for (const name of names) {
    const matches = findByLabel(name, elements);
    if (matches.length === 0) {
      ambiguities.push(`No element found matching "${name}"`);
    } else if (matches.length > 1) {
      ambiguities.push(`"${name}" matches ${matches.length} elements — be more specific`);
    } else {
      resolved.push(matches[0]);
    }
  }

  return { resolved, ambiguities };
}

// ─── Intent parsers ───────────────────────────────────────────────────────────

function parseAlign(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  let direction: AlignDirection = 'left';

  for (const [key, val] of Object.entries(ALIGN_DIRECTIONS)) {
    if (lower.includes(key)) { direction = val; break; }
  }

  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const count = resolved.length || selectedIds.length;

  return {
    raw: text, intent: 'align', confident: true,
    targetIds: resolved.map(e => e.id).length > 0 ? resolved.map(e => e.id) : selectedIds,
    params: { direction },
    preview: `Align ${count} element(s) ${direction}`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseArrange(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  let direction: ArrangeDirection = 'horizontal';
  let spacing = 40;

  for (const [key, val] of Object.entries(ARRANGE_DIRECTIONS)) {
    if (lower.includes(key)) { direction = val; break; }
  }

  const spacingMatch = text.match(/(\d+)\s*(px|pixels|units|gap)/i);
  if (spacingMatch) spacing = parseInt(spacingMatch[1], 10);

  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;

  return {
    raw: text, intent: 'arrange', confident: true,
    targetIds: ids,
    params: { direction, spacing },
    preview: `Arrange ${ids.length} element(s) ${direction} with ${spacing}px gap`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseConnect(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  const relationship: RelationshipType =
    matchKeywords<RelationshipType>(lower, RELATIONSHIP_KEYWORDS, 'rel') ?? 'generic_arrow';

  // Try to extract source and target names: "connect X to Y"
  const connectToMatch = text.match(/connect\s+(.+?)\s+to\s+(.+)/i);
  let sourceNames: string[] = [];
  let targetNames: string[] = [];

  if (connectToMatch) {
    sourceNames = [connectToMatch[1].trim()];
    targetNames = [connectToMatch[2].trim()];
  } else {
    const quoted = extractQuotedNames(text);
    if (quoted.length >= 2) {
      sourceNames = [quoted[0]];
      targetNames = [quoted[1]];
    }
  }

  const { resolved: sources, ambiguities: srcAmb } = resolveElements(sourceNames, elements, []);
  const { resolved: targets, ambiguities: tgtAmb } = resolveElements(targetNames, elements, []);
  const ambiguities = [...srcAmb, ...tgtAmb];

  if (sources.length === 0 || targets.length === 0) {
    return {
      raw: text, intent: 'connect', confident: false,
      targetIds: selectedIds,
      params: { relationship },
      preview: 'Could not identify source and target. Select them and try again.',
      ambiguities: ambiguities.length ? ambiguities : ['Specify source and target: "connect X to Y"'],
    };
  }

  return {
    raw: text, intent: 'connect', confident: true,
    targetIds: [sources[0].id, targets[0].id],
    params: { sourceId: sources[0].id, targetId: targets[0].id, relationship },
    preview: `Connect "${sources[0].text}" → "${targets[0].text}" as "${relationship}"`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseGroup(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;

  const labelMatch = text.match(/(?:called|named|label)\s+"?([^"]+)"?/i);
  const groupLabel = labelMatch ? labelMatch[1].trim() : undefined;

  return {
    raw: text, intent: 'group', confident: ids.length > 0,
    targetIds: ids,
    params: { ...(groupLabel ? { label: groupLabel } : {}) },
    preview: `Group ${ids.length} element(s)${groupLabel ? ` as "${groupLabel}"` : ''}`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseFind(text: string, elements: CanvasElement[], _selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);

  // "find all nodes linked to open tasks"
  if (lower.includes('linked to') && lower.includes('task')) {
    const openOnly = lower.includes('open');
    return {
      raw: text, intent: 'find', confident: true,
      targetIds: [],
      params: { filter: 'linked_tasks', openOnly },
      preview: `Highlight elements linked to ${openOnly ? 'open ' : ''}tasks`,
    };
  }

  // "find all objects containing X"
  const containingMatch = text.match(/containing\s+"?([^"]+)"?/i) ||
    text.match(/with\s+(?:text|label|name)\s+"?([^"]+)"?/i) ||
    text.match(/(?:find|search for)\s+["']([^"']+)["']/i);

  if (containingMatch) {
    const term = containingMatch[1].trim();
    const found = elements.filter(el =>
      (el.text || '').toLowerCase().includes(term.toLowerCase()) ||
      (el.codeContent || '').toLowerCase().includes(term.toLowerCase())
    );
    return {
      raw: text, intent: 'find', confident: true,
      targetIds: found.map(e => e.id),
      params: { searchTerm: term },
      preview: `Found ${found.length} element(s) containing "${term}"`,
    };
  }

  // "find all services with linked PRs"
  const nodeType = matchKeywords<DiagramNodeType>(lower, NODE_TYPE_KEYWORDS, 'type');
  if (nodeType) {
    const found = elements.filter(el => el.diagramType === nodeType);
    return {
      raw: text, intent: 'find', confident: true,
      targetIds: found.map(e => e.id),
      params: { diagramType: nodeType },
      preview: `Highlight ${found.length} element(s) of type "${nodeType}"`,
    };
  }

  const names = extractQuotedNames(text);
  if (names.length > 0) {
    const found = findByLabel(names[0], elements);
    return {
      raw: text, intent: 'find', confident: true,
      targetIds: found.map(e => e.id),
      params: { searchTerm: names[0] },
      preview: found.length > 0
        ? `Found ${found.length} element(s) matching "${names[0]}"`
        : `No elements found matching "${names[0]}"`,
    };
  }

  return {
    raw: text, intent: 'find', confident: false,
    targetIds: [],
    params: {},
    preview: 'Could not determine what to search for.',
    error: 'Specify a search term: e.g. "find all nodes containing payment"',
  };
}

function parseShowDependencies(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;

  return {
    raw: text, intent: 'show_dependencies', confident: ids.length > 0,
    targetIds: ids,
    params: {},
    preview: ids.length > 0
      ? `Show connections for ${ids.length} element(s)`
      : 'Select an element and retry',
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseCreateNode(text: string, _elements: CanvasElement[], _selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  const diagramType: DiagramNodeType =
    matchKeywords<DiagramNodeType>(lower, NODE_TYPE_KEYWORDS, 'type') ?? 'generic';

  // Extract name: "create an entity named Customer" or "create a service called Auth"
  const namedMatch = text.match(/(?:named|called|with name)\s+"?([^"]+)"?/i);
  const label = namedMatch
    ? namedMatch[1].trim()
    : text
      .replace(/^(create|add|new|make|insert)\s+(an?\s+)?/i, '')
      .replace(/(?:named|called).*/i, '')
      .trim();

  return {
    raw: text, intent: 'create_node', confident: label.length > 0,
    targetIds: [],
    params: { diagramType, label },
    preview: label
      ? `Create ${diagramType} node "${label}"`
      : 'Specify a label: e.g. "create a service named Auth"',
    error: label ? undefined : 'Could not extract a node name from the command.',
  };
}

function parseChangeRelationship(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  const relationship: RelationshipType =
    matchKeywords<RelationshipType>(lower, RELATIONSHIP_KEYWORDS, 'rel') ?? 'generic_arrow';

  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const ids = resolved.map(e => e.id).length > 0 ? resolved.map(e => e.id) : selectedIds;

  return {
    raw: text, intent: 'change_relationship', confident: true,
    targetIds: ids,
    params: { relationship },
    preview: `Change selected connector(s) to "${relationship}"`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

function parseFitCanvas(text: string): ParsedCommand {
  const lower = normalize(text);
  const selection = lower.includes('selection') || lower.includes('selected');
  return {
    raw: text, intent: 'fit_canvas', confident: true,
    targetIds: [],
    params: { selection },
    preview: selection ? 'Fit selected elements to view' : 'Fit entire board to view',
  };
}

function parseValidate(text: string, _elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  const all = lower.includes('all') || lower.includes('board') || lower.includes('everything') || lower.includes('diagram');
  const ids = all ? [] : selectedIds;

  return {
    raw: text, intent: 'validate', confident: true,
    targetIds: ids,
    params: { scope: all ? 'board' : 'selection' },
    preview: all ? 'Validate entire board' : `Validate ${ids.length} selected element(s)`,
  };
}

function parseLayout(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const lower = normalize(text);
  const algorithm: LayoutAlgorithm =
    matchKeywords<LayoutAlgorithm>(lower, Object.entries(LAYOUT_ALGORITHMS).map(([k, v]) => ({ keywords: [k], algorithm: v })), 'algorithm')
    ?? 'hierarchical';

  const names = extractQuotedNames(text);
  const { resolved } = resolveElements(names, elements, selectedIds);
  const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;

  return {
    raw: text, intent: 'layout', confident: true,
    targetIds: ids,
    params: { algorithm },
    preview: `Apply ${algorithm} layout to ${ids.length || elements.length} elements`,
  };
}

function parseDelete(text: string, elements: CanvasElement[], selectedIds: string[]): ParsedCommand {
  const names = extractQuotedNames(text);
  const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
  const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;

  return {
    raw: text, intent: 'delete', confident: ids.length > 0,
    targetIds: ids,
    params: {},
    preview: `Delete ${ids.length} element(s) — this can be undone`,
    ambiguities: ambiguities.length ? ambiguities : undefined,
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a natural language command string deterministically.
 * Returns a `ParsedCommand` describing the resolved intent and parameters.
 * Never calls an LLM or external API.
 */
export function parseCommand(
  rawText: string,
  elements: CanvasElement[],
  selectedIds: string[],
): ParsedCommand {
  const text = rawText.trim();
  if (!text) {
    return {
      raw: text, intent: 'unknown', confident: false,
      targetIds: [], params: {},
      preview: '',
      error: 'Empty command.',
    };
  }

  // Intent classification in priority order
  if (FIT_PATTERN.test(text)) return parseFitCanvas(text);
  if (VALIDATE_PATTERN.test(text)) return parseValidate(text, elements, selectedIds);
  if (UNGROUP_PATTERN.test(text)) {
    const names = extractQuotedNames(text);
    const { resolved } = resolveElements(names, elements, selectedIds);
    const ids = resolved.length > 0 ? resolved.map(e => e.id) : selectedIds;
    return { raw: text, intent: 'ungroup', confident: true, targetIds: ids, params: {}, preview: `Ungroup ${ids.length} element(s)` };
  }
  if (GROUP_PATTERN.test(text) && !UNGROUP_PATTERN.test(text)) return parseGroup(text, elements, selectedIds);
  if (CHANGE_REL_PATTERN.test(text)) return parseChangeRelationship(text, elements, selectedIds);
  if (CONNECT_PATTERN.test(text)) return parseConnect(text, elements, selectedIds);
  if (DEPS_PATTERN.test(text)) return parseShowDependencies(text, elements, selectedIds);
  if (LAYOUT_PATTERN.test(text)) return parseLayout(text, elements, selectedIds);
  if (ARRANGE_PATTERN.test(text)) return parseArrange(text, elements, selectedIds);
  if (ALIGN_PATTERN.test(text)) return parseAlign(text, elements, selectedIds);
  if (CREATE_PATTERN.test(text)) return parseCreateNode(text, elements, selectedIds);
  if (FIND_PATTERN.test(text)) return parseFind(text, elements, selectedIds);
  if (FILTER_PATTERN.test(text)) return parseFind(text, elements, selectedIds);
  if (DELETE_PATTERN.test(text)) return parseDelete(text, elements, selectedIds);
  if (SELECT_PATTERN.test(text)) {
    const names = extractQuotedNames(text);
    const { resolved, ambiguities } = resolveElements(names, elements, selectedIds);
    return {
      raw: text, intent: 'select', confident: resolved.length > 0,
      targetIds: resolved.map(e => e.id),
      params: {},
      preview: resolved.length > 0 ? `Select ${resolved.length} element(s)` : 'No matching elements found',
      ambiguities: ambiguities.length ? ambiguities : undefined,
    };
  }

  return {
    raw: text, intent: 'unknown', confident: false,
    targetIds: [], params: {},
    preview: '',
    error: `Command not recognised. Try: "align left", "connect X to Y", "find nodes containing payment", "fit canvas", "validate".`,
  };
}

/** Suggest autocomplete completions for a partial command string. */
export function suggestCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  const suggestions = [
    'align left', 'align right', 'align top', 'align bottom',
    'arrange horizontal', 'arrange vertical', 'arrange grid',
    'connect … to …',
    'group selected',
    'ungroup selected',
    'find all nodes containing …',
    'find all services',
    'find all elements linked to open tasks',
    'show dependencies of selected',
    'create service named …',
    'create database named …',
    'create entity named …',
    'change connector to depends_on',
    'fit canvas',
    'fit selection',
    'validate board',
    'validate selection',
    'apply hierarchical layout',
    'apply force layout',
    'apply grid layout',
    'delete selected',
  ];
  return suggestions.filter(s => s.includes(lower) || lower.length < 2);
}

export default { parseCommand, suggestCompletions };
