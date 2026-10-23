// ─── Whiteboard type system ───────────────────────────────────────────────────
// Single engineering canvas mode (Teach Mode removed per spec §3 out-of-scope).

// ─── Diagram Semantic Types ───────────────────────────────────────────────────

/** Semantic category assigned by the user to a diagram node. */
export type DiagramNodeType =
  // Architecture / service layer
  | 'service'
  | 'client'
  | 'api'
  | 'database'
  | 'cache'
  | 'queue'
  | 'worker'
  | 'external'
  | 'component'
  | 'gateway'
  | 'load_balancer'
  | 'cdn'
  | 'storage'
  // UML
  | 'uml_class'
  | 'uml_interface'
  | 'uml_abstract'
  // ER
  | 'er_entity'
  | 'er_weak_entity'
  // Sequence diagrams
  | 'seq_lifeline'
  | 'seq_actor'
  // Workflow / state machine
  | 'workflow_step'
  | 'workflow_decision'
  | 'workflow_state'
  | 'workflow_start'
  | 'workflow_end'
  // Infrastructure
  | 'infra_node'
  | 'infra_container'
  | 'infra_cloud'
  // Generic (un-typed)
  | 'generic';

/** Semantic type for connector / relationship. */
export type RelationshipType =
  | 'calls'
  | 'depends_on'
  | 'reads_from'
  | 'writes_to'
  | 'publishes'
  | 'subscribes'
  | 'contains'
  | 'inherits'
  | 'implements'
  | 'connects_to'
  | 'transitions_to'
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'message'          // sequence diagram
  | 'async_message'    // sequence diagram
  | 'return'           // sequence diagram
  | 'generic_arrow';

/** Visual shape rendered on canvas. */
export type ElementType =
  | 'stroke'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'parallelogram'
  | 'cylinder'
  | 'hexagon'
  | 'arrow'
  | 'connector'
  | 'text'
  | 'sticky'
  | 'image'
  | 'code_cell'
  | 'frame'
  | 'group';

/** How a code block relates to the repository. */
export type CodeBlockType = 'static' | 'snapshot' | 'reference' | 'proposed';

/** Lifecycle status visible on canvas nodes. */
export type ComponentStatus =
  | 'proposed'
  | 'existing'
  | 'in_progress'
  | 'implemented'
  | 'tested'
  | 'deployed'
  | 'deprecated';

// ─── Core element model ───────────────────────────────────────────────────────

/** A field definition inside an ER entity or UML class. */
export interface ObjectField {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
}

/** A method definition inside a UML class. */
export interface ObjectMethod {
  id: string;
  name: string;
  returnType?: string;
  parameters?: string;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * A single element on the canvas. Strokes, shapes, code cells, and connectors
 * are all represented here. Connectors use `sourceId`/`targetId` for semantic
 * attachment so they follow moved objects.
 */
export interface CanvasElement {
  id: string;
  type: ElementType;

  // Position and size
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;

  // Appearance
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeDash?: number[];
  opacity?: number;
  zIndex?: number;

  // Freehand strokes
  points?: Array<{ x: number; y: number }>;

  // Text
  text?: string;
  latex?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';

  // Code cell
  codeLanguage?: string;
  codeContent?: string;
  codeLinkType?: CodeBlockType;
  linkedFilePath?: string;
  linkedRevision?: string;
  snapshotAt?: string;        // ISO timestamp
  isStale?: boolean;

  // Image
  imageUrl?: string;

  // Connector / relationship – semantic fields
  sourceId?: string;          // ID of source canvas element
  targetId?: string;          // ID of target canvas element
  sourceAnchor?: Anchor;
  targetAnchor?: Anchor;
  relationship?: RelationshipType;
  waypoints?: Array<{ x: number; y: number }>; // user-adjusted routing points

  // Semantic diagram node fields
  diagramType?: DiagramNodeType;
  fields?: ObjectField[];     // ER/UML fields
  methods?: ObjectMethod[];   // UML class methods
  label?: string;

  // Component status and project links
  status?: ComponentStatus;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
  linkedTaskStatus?: string;
  linkedPRId?: string;
  linkedPRStatus?: string;
  linkedCommit?: string;

  // Grouping / layering
  groupId?: string;
  frameId?: string;
  locked?: boolean;
  hidden?: boolean;

  // Recognition metadata
  confidence?: number;
  originalPoints?: Array<{ x: number; y: number }>;

  // Comments count (actual comments are stored server-side)
  commentCount?: number;

  // Freshness
  metadataFetchedAt?: string;
}

/** Named anchor positions on a shape's edge. */
export type Anchor = 'top' | 'right' | 'bottom' | 'left' | 'center'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// ─── Board model ──────────────────────────────────────────────────────────────

export interface WhiteboardData {
  id: string;
  workspaceId: string;
  title: string;
  elements: CanvasElement[];
  viewport: { x: number; y: number; zoom: number };
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export interface RemoteWhiteboardCursor {
  socketId: string;
  username: string;
  cursor: { x: number; y: number };
  color: string;
  selectedIds?: string[];
}

// ─── Task proposals ───────────────────────────────────────────────────────────

export interface TaskProposal {
  id: string;
  title: string;
  description: string;
  status: 'proposed';
  sourceElementId: string;
  acceptanceCriteria: string[];
  priority?: 'low' | 'medium' | 'high';
  linkedFilePath?: string;
}

// ─── NLP Command system ───────────────────────────────────────────────────────

export type CommandIntent =
  | 'align'
  | 'arrange'
  | 'connect'
  | 'group'
  | 'ungroup'
  | 'find'
  | 'filter'
  | 'show_dependencies'
  | 'create_node'
  | 'change_relationship'
  | 'fit_canvas'
  | 'validate'
  | 'select'
  | 'delete'
  | 'layout'
  | 'unknown';

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';
export type ArrangeDirection = 'horizontal' | 'vertical' | 'grid';
export type LayoutAlgorithm = 'hierarchical' | 'force' | 'radial' | 'grid' | 'timeline';

export interface ParsedCommand {
  raw: string;
  intent: CommandIntent;
  confident: boolean;
  /** IDs of elements referenced explicitly or by selection */
  targetIds: string[];
  /** Generic named parameters extracted from the command */
  params: Record<string, string | number | boolean | string[]>;
  /** Text shown to user to explain what will happen */
  preview: string;
  /** Ambiguities requiring user clarification */
  ambiguities?: string[];
  error?: string;
}

// ─── Text-to-diagram conversion ───────────────────────────────────────────────

export interface ParsedTextNode {
  id: string;
  label: string;
  diagramType: DiagramNodeType;
}

export interface ParsedTextEdge {
  fromId: string;
  toId: string;
  relationship: RelationshipType;
  label?: string;
}

export interface TextDiagramParseResult {
  nodes: ParsedTextNode[];
  edges: ParsedTextEdge[];
  unresolved: string[];    // sentences/fragments the parser could not map
  inputText: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  elementId?: string;
  elementLabel?: string;
  severity: ValidationSeverity;
  rule: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  checkedAt: string;
  elementCount: number;
}

// ─── Graph layout ─────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  algorithm: LayoutAlgorithm;
}
