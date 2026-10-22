/**
 * Rule-Based Diagram Validator
 *
 * Validates canvas elements against explicit, deterministic structural rules.
 * No AI inference, no generative recommendations.
 *
 * Rules are keyed to diagram types when applicable; generic rules apply always.
 */

import type {
  CanvasElement,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from '../types/whiteboard';

let _issueCounter = 0;
function issueId(): string { return `issue-${Date.now()}-${_issueCounter++}`; }

function issue(
  severity: ValidationSeverity,
  rule: string,
  message: string,
  elementId?: string,
  elementLabel?: string,
  suggestion?: string,
): ValidationIssue {
  return { id: issueId(), severity, rule, message, elementId, elementLabel, suggestion };
}

// ─── Connector helpers ────────────────────────────────────────────────────────

function getConnectors(elements: CanvasElement[]): CanvasElement[] {
  return elements.filter(el => el.type === 'connector' || el.type === 'arrow');
}

function getNodes(elements: CanvasElement[]): CanvasElement[] {
  return elements.filter(el => el.type !== 'connector' && el.type !== 'arrow' && el.type !== 'stroke');
}

// ─── Generic rules (apply to all boards) ─────────────────────────────────────

function checkMissingConnectorEndpoints(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(elements.map(e => e.id));

  for (const conn of getConnectors(elements)) {
    if (conn.sourceId && !nodeIds.has(conn.sourceId)) {
      issues.push(issue(
        'error', 'broken-connector-source',
        `Connector has a broken source reference (source was deleted or moved).`,
        conn.id, conn.text,
        'Delete this connector and redraw it, or restore the missing source element.',
      ));
    }
    if (conn.targetId && !nodeIds.has(conn.targetId)) {
      issues.push(issue(
        'error', 'broken-connector-target',
        `Connector has a broken target reference (target was deleted or moved).`,
        conn.id, conn.text,
        'Delete this connector and redraw it, or restore the missing target element.',
      ));
    }
    if (!conn.sourceId && !conn.targetId) {
      issues.push(issue(
        'warning', 'unattached-connector',
        `Connector is not attached to any elements.`,
        conn.id, conn.text,
        'Drag the connector endpoints onto nodes, or delete it.',
      ));
    }
  }
  return issues;
}

function checkEmptyLabels(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const LABEL_REQUIRED = new Set(['service', 'client', 'api', 'database', 'queue', 'worker', 'er_entity', 'uml_class', 'uml_interface', 'seq_lifeline', 'seq_actor']);

  for (const el of getNodes(elements)) {
    if (el.diagramType && LABEL_REQUIRED.has(el.diagramType) && !el.text?.trim()) {
      issues.push(issue(
        'warning', 'missing-label',
        `This ${el.diagramType} element has no label.`,
        el.id, undefined,
        'Add a label in the properties panel.',
      ));
    }
  }
  return issues;
}

function checkDuplicateIds(elements: CanvasElement[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  for (const el of elements) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);

  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => issue(
      'error', 'duplicate-id',
      `Element ID "${id}" appears ${seen.get(id)} times. IDs must be unique.`,
      id, undefined,
      'This usually indicates a paste or duplication bug. Remove one copy.',
    ));
}

function checkOverlappingNodes(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = getNodes(elements).filter(el => el.width && el.height);

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (!a.width || !a.height || !b.width || !b.height) continue;
      const overlap =
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;

      if (overlap) {
        issues.push(issue(
          'info', 'overlapping-nodes',
          `"${a.text || a.id}" and "${b.text || b.id}" overlap.`,
          a.id, a.text,
          'Use "Clean Layout" or drag elements apart.',
        ));
        break; // report each element at most once
      }
    }
  }
  return issues;
}

function checkIsolatedNodes(elements: CanvasElement[]): ValidationIssue[] {
  const connectors = getConnectors(elements);
  const connectedIds = new Set<string>();
  for (const c of connectors) {
    if (c.sourceId) connectedIds.add(c.sourceId);
    if (c.targetId) connectedIds.add(c.targetId);
  }

  const issues: ValidationIssue[] = [];
  for (const el of getNodes(elements)) {
    if (!connectedIds.has(el.id) && el.diagramType && el.diagramType !== 'generic') {
      issues.push(issue(
        'info', 'isolated-node',
        `"${el.text || el.id}" (${el.diagramType}) has no connectors.`,
        el.id, el.text,
        'Add a connector to show relationships, or this may be intentional.',
      ));
    }
  }
  return issues;
}

// ─── ER-specific rules ────────────────────────────────────────────────────────

function checkErRules(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entities = elements.filter(el => el.diagramType === 'er_entity' || el.diagramType === 'er_weak_entity');
  const idSet = new Set(elements.map(e => e.id));

  // Check each entity has at least a primary key or fields
  for (const entity of entities) {
    const hasPk = entity.fields?.some(f => f.isPrimaryKey);
    if (!hasPk) {
      issues.push(issue(
        'warning', 'er-missing-pk',
        `Entity "${entity.text || entity.id}" has no primary key defined.`,
        entity.id, entity.text,
        'Add a field with "Primary Key" checked in the properties panel.',
      ));
    }
  }

  // Check foreign keys point to existing entities
  for (const entity of entities) {
    for (const field of entity.fields ?? []) {
      if (field.isForeignKey && field.type && !idSet.has(field.type)) {
        // Only warn if it looks like an ID reference (contains "id" or similar)
        if (field.type.toLowerCase().includes('id') || field.type.toLowerCase().includes('fk')) {
          issues.push(issue(
            'info', 'er-unresolved-fk',
            `Field "${field.name}" in "${entity.text}" references type "${field.type}" which is not a visible entity.`,
            entity.id, entity.text,
            'Add the referenced entity to the diagram or link it explicitly.',
          ));
        }
      }
    }
  }
  return issues;
}

// ─── UML-specific rules ───────────────────────────────────────────────────────

function checkUmlRules(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const classes = elements.filter(el => el.diagramType === 'uml_class' || el.diagramType === 'uml_abstract');

  for (const cls of classes) {
    if (!cls.text?.trim()) {
      issues.push(issue('warning', 'uml-unnamed-class', 'UML class has no name.', cls.id, undefined, 'Add a class name in the properties panel.'));
    }
    // Check for obvious duplicate class names
  }

  const classNames = classes.map(c => c.text?.toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  for (const name of classNames) {
    if (seen.has(name!)) {
      issues.push(issue('warning', 'uml-duplicate-class-name', `Duplicate class name "${name}" detected.`, undefined, name!, 'Class names should be unique in a UML diagram.'));
    }
    seen.add(name!);
  }

  return issues;
}

// ─── Sequence diagram rules ───────────────────────────────────────────────────

function checkSequenceRules(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lifelines = elements.filter(el => el.diagramType === 'seq_lifeline' || el.diagramType === 'seq_actor');
  const connectors = getConnectors(elements);
  const lifelineIds = new Set(lifelines.map(l => l.id));

  for (const conn of connectors) {
    if (conn.relationship === 'message' || conn.relationship === 'async_message' || conn.relationship === 'return') {
      if (conn.sourceId && !lifelineIds.has(conn.sourceId)) {
        issues.push(issue(
          'error', 'seq-invalid-message-source',
          `Sequence message does not originate from a lifeline.`,
          conn.id, conn.text,
          'Attach the source end to a lifeline or actor.',
        ));
      }
      if (conn.targetId && !lifelineIds.has(conn.targetId)) {
        issues.push(issue(
          'error', 'seq-invalid-message-target',
          `Sequence message does not point to a lifeline.`,
          conn.id, conn.text,
          'Attach the target end to a lifeline or actor.',
        ));
      }
    }
  }
  return issues;
}

// ─── Architecture / service rules ─────────────────────────────────────────────

function checkArchRules(elements: CanvasElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Detect services directly accessing databases (bypassing API/gateway)
  const connectors = getConnectors(elements);
  const databases = new Set(elements.filter(el => el.diagramType === 'database').map(e => e.id));

  for (const conn of connectors) {
    const src = conn.sourceId ? elements.find(e => e.id === conn.sourceId) : undefined;
    if (src && src.diagramType === 'client' && conn.targetId && databases.has(conn.targetId)) {
      issues.push(issue(
        'warning', 'arch-client-direct-db',
        `Client "${src.text || src.id}" connects directly to a database. This may bypass authentication and authorization.`,
        conn.id, conn.text,
        'Route database access through an API or service layer.',
      ));
    }
  }

  // Check for database without any incoming connections
  for (const db of elements.filter(el => el.diagramType === 'database')) {
    const hasIncoming = connectors.some(c => c.targetId === db.id);
    if (!hasIncoming) {
      issues.push(issue(
        'info', 'arch-orphan-database',
        `Database "${db.text || db.id}" has no incoming connections.`,
        db.id, db.text,
        'Connect a service or API to this database.',
      ));
    }
  }

  return issues;
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Run all applicable validation rules against the provided elements.
 * @param elements - Canvas elements to validate.
 * @param scope - 'board' to validate all, or array of element IDs.
 */
export function validateDiagram(
  elements: CanvasElement[],
  scope: 'board' | string[] = 'board',
): ValidationResult {
  _issueCounter = 0;
  const targetElements = scope === 'board'
    ? elements
    : elements.filter(el => (scope as string[]).includes(el.id));

  // Detect active diagram types in scope
  const types = new Set(targetElements.map(el => el.diagramType).filter(Boolean));
  const hasEr = types.has('er_entity') || types.has('er_weak_entity');
  const hasUml = types.has('uml_class') || types.has('uml_abstract') || types.has('uml_interface');
  const hasSeq = types.has('seq_lifeline') || types.has('seq_actor');
  const hasArch = types.has('service') || types.has('client') || types.has('api') ||
    types.has('database') || types.has('gateway');

  const allIssues: ValidationIssue[] = [
    ...checkDuplicateIds(targetElements),
    ...checkMissingConnectorEndpoints(targetElements),
    ...checkEmptyLabels(targetElements),
    ...checkOverlappingNodes(targetElements),
    ...checkIsolatedNodes(targetElements),
    ...(hasEr ? checkErRules(targetElements) : []),
    ...(hasUml ? checkUmlRules(targetElements) : []),
    ...(hasSeq ? checkSequenceRules(targetElements) : []),
    ...(hasArch ? checkArchRules(targetElements) : []),
  ];

  // Deduplicate by rule+elementId
  const seen = new Set<string>();
  const deduped = allIssues.filter(iss => {
    const key = `${iss.rule}::${iss.elementId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    issues: deduped.sort((a, b) => {
      const order: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    checkedAt: new Date().toISOString(),
    elementCount: targetElements.length,
  };
}

export default { validateDiagram };
