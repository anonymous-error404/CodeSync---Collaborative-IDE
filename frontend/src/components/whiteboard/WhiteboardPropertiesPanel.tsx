/**
 * WhiteboardPropertiesPanel — Contextual properties for selected elements.
 *
 * Adapts to the selected object's explicit type:
 *   - Generic: stroke color, fill, width, opacity
 *   - Semantic node: type selector, status, project links
 *   - ER entity / UML class: field + method editor
 *   - Connector: relationship type, label, direction
 *   - Code cell: language, link type, file path
 */
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type {
  CanvasElement, DiagramNodeType, RelationshipType,
  ComponentStatus, CodeBlockType, ObjectField, ObjectMethod,
} from '../../types/whiteboard';

interface Props {
  elements: CanvasElement[];
  selectedIds: string[];
  onUpdate: (el: CanvasElement) => void;
  onOpenInIDE?: (path: string) => void;
}

// ─── Options lists ────────────────────────────────────────────────────────────

const DIAGRAM_TYPE_OPTIONS: { value: DiagramNodeType; label: string; group: string }[] = [
  { value: 'generic',    label: 'Generic',          group: 'Untyped' },
  { value: 'service',    label: 'Service',           group: 'Architecture' },
  { value: 'client',     label: 'Client / UI',       group: 'Architecture' },
  { value: 'api',        label: 'API / Endpoint',    group: 'Architecture' },
  { value: 'database',   label: 'Database',          group: 'Architecture' },
  { value: 'cache',      label: 'Cache',             group: 'Architecture' },
  { value: 'queue',      label: 'Queue / Topic',     group: 'Architecture' },
  { value: 'worker',     label: 'Worker / Job',      group: 'Architecture' },
  { value: 'gateway',    label: 'Gateway / Proxy',   group: 'Architecture' },
  { value: 'external',   label: 'External System',   group: 'Architecture' },
  { value: 'uml_class',  label: 'Class',             group: 'UML' },
  { value: 'uml_interface', label: 'Interface',      group: 'UML' },
  { value: 'uml_abstract',  label: 'Abstract',       group: 'UML' },
  { value: 'er_entity',  label: 'Entity',            group: 'ER Diagram' },
  { value: 'er_weak_entity', label: 'Weak Entity',   group: 'ER Diagram' },
  { value: 'seq_lifeline', label: 'Lifeline',        group: 'Sequence' },
  { value: 'seq_actor',    label: 'Actor',           group: 'Sequence' },
  { value: 'workflow_step',    label: 'Step',        group: 'Workflow' },
  { value: 'workflow_decision',label: 'Decision',    group: 'Workflow' },
  { value: 'workflow_state',   label: 'State',       group: 'Workflow' },
  { value: 'infra_node',       label: 'Server',      group: 'Infrastructure' },
  { value: 'infra_container',  label: 'Container',   group: 'Infrastructure' },
  { value: 'infra_cloud',      label: 'Cloud',       group: 'Infrastructure' },
];

const STATUS_OPTIONS: ComponentStatus[] = ['proposed', 'existing', 'in_progress', 'implemented', 'tested', 'deployed', 'deprecated'];

const REL_OPTIONS: RelationshipType[] = [
  'calls', 'depends_on', 'reads_from', 'writes_to', 'publishes', 'subscribes',
  'contains', 'inherits', 'implements', 'connects_to', 'transitions_to',
  'association', 'aggregation', 'composition', 'generalization', 'realization',
  'message', 'async_message', 'return', 'generic_arrow',
];

const CODE_LINK_TYPES: CodeBlockType[] = ['static', 'snapshot', 'reference', 'proposed'];

// ─── Utility ──────────────────────────────────────────────────────────────────

function genFieldId() { return `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function genMethodId() { return `method-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] w-20 shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1 rounded text-xs focus:outline-none"
      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
    />
  );
}

function Select<T extends string>({
  value, options, onChange, formatLabel,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="w-full px-2 py-1 rounded text-xs focus:outline-none"
      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{formatLabel ? formatLabel(opt) : opt}</option>
      ))}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WhiteboardPropertiesPanel({ elements, selectedIds, onUpdate, onOpenInIDE }: Props) {
  if (selectedIds.length === 0) {
    return (
      <div
        className="absolute top-20 right-4 z-30 w-64 rounded-2xl border p-4 shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Select an element to edit its properties
        </div>
      </div>
    );
  }

  // Multi-selection: only show shared properties
  if (selectedIds.length > 1) {
    return <MultiSelectPanel count={selectedIds.length} />;
  }

  const el = elements.find(e => e.id === selectedIds[0]);
  if (!el) return null;

  return (
    <div
      className="absolute top-20 right-4 z-30 w-72 rounded-2xl border shadow-xl flex flex-col overflow-hidden animate-fade-in"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: 'calc(100vh - 140px)' }}
    >
      <div
        className="px-4 py-3 border-b text-xs font-semibold"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Properties
        <span
          className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
        >
          {el.type}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connector properties */}
        {(el.type === 'connector' || el.type === 'arrow') && (
          <ConnectorProps el={el} onUpdate={onUpdate} />
        )}

        {/* Code cell properties */}
        {el.type === 'code_cell' && (
          <CodeCellProps el={el} onUpdate={onUpdate} onOpenInIDE={onOpenInIDE} />
        )}

        {/* Semantic node properties (everything that isn't a connector/code/stroke) */}
        {el.type !== 'connector' && el.type !== 'arrow' && el.type !== 'stroke' && el.type !== 'code_cell' && (
          <SemanticNodeProps el={el} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

// ─── Connector sub-panel ──────────────────────────────────────────────────────

function ConnectorProps({ el, onUpdate }: { el: CanvasElement; onUpdate: (e: CanvasElement) => void }) {
  return (
    <>
      <Section title="Relationship">
        <Row label="Type">
          <Select<RelationshipType>
            value={el.relationship ?? 'generic_arrow'}
            options={REL_OPTIONS}
            onChange={v => onUpdate({ ...el, relationship: v })}
            formatLabel={v => v.replace(/_/g, ' ')}
          />
        </Row>
        <Row label="Label">
          <TextInput value={el.text ?? ''} onChange={v => onUpdate({ ...el, text: v })} placeholder="Optional label" />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Color">
          <input
            type="color"
            value={el.strokeColor ?? '#7d8590'}
            onChange={e => onUpdate({ ...el, strokeColor: e.target.value })}
            className="w-8 h-7 rounded cursor-pointer border"
            style={{ padding: 2, borderColor: 'var(--border)', background: 'none' }}
          />
        </Row>
        <Row label="Width">
          <input
            type="range" min={1} max={8} value={el.strokeWidth ?? 2}
            onChange={e => onUpdate({ ...el, strokeWidth: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
      </Section>

      {(el.sourceId || el.targetId) && (
        <Section title="Endpoints">
          <div className="text-[11px] space-y-1" style={{ color: 'var(--muted)' }}>
            <div>Source: <span style={{ color: 'var(--text)' }}>{el.sourceId ?? '—'}</span></div>
            <div>Target: <span style={{ color: 'var(--text)' }}>{el.targetId ?? '—'}</span></div>
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Code cell sub-panel ──────────────────────────────────────────────────────

function CodeCellProps({ el, onUpdate, onOpenInIDE }: { el: CanvasElement; onUpdate: (e: CanvasElement) => void; onOpenInIDE?: (p: string) => void }) {
  return (
    <>
      <Section title="Code">
        <Row label="Language">
          <TextInput value={el.codeLanguage ?? 'javascript'} onChange={v => onUpdate({ ...el, codeLanguage: v })} />
        </Row>
        <Row label="Link type">
          <Select<CodeBlockType>
            value={el.codeLinkType ?? 'static'}
            options={CODE_LINK_TYPES}
            onChange={v => onUpdate({ ...el, codeLinkType: v })}
          />
        </Row>
      </Section>

      <Section title="Source File">
        <Row label="Path">
          <div className="flex gap-1">
            <TextInput
              value={el.linkedFilePath ?? ''}
              onChange={v => onUpdate({ ...el, linkedFilePath: v })}
              placeholder="src/..."
            />
            {el.linkedFilePath && onOpenInIDE && (
              <button
                onClick={() => onOpenInIDE(el.linkedFilePath!)}
                style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Open in IDE"
              >
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        </Row>
        {el.codeLinkType !== 'static' && (
          <Row label="Revision">
            <TextInput value={el.linkedRevision ?? ''} onChange={v => onUpdate({ ...el, linkedRevision: v })} placeholder="commit SHA" />
          </Row>
        )}
      </Section>
    </>
  );
}

// ─── Semantic node sub-panel ──────────────────────────────────────────────────

function SemanticNodeProps({ el, onUpdate }: { el: CanvasElement; onUpdate: (e: CanvasElement) => void }) {
  const isUml = el.diagramType === 'uml_class' || el.diagramType === 'uml_interface' || el.diagramType === 'uml_abstract';
  const isEr = el.diagramType === 'er_entity' || el.diagramType === 'er_weak_entity';

  return (
    <>
      <Section title="Node">
        <Row label="Label">
          <TextInput value={el.text ?? ''} onChange={v => onUpdate({ ...el, text: v })} />
        </Row>
        <Row label="Type">
          <select
            value={el.diagramType ?? 'generic'}
            onChange={e => onUpdate({ ...el, diagramType: e.target.value as DiagramNodeType })}
            className="w-full px-2 py-1 rounded text-xs focus:outline-none"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            {Object.entries(
              DIAGRAM_TYPE_OPTIONS.reduce<Record<string, typeof DIAGRAM_TYPE_OPTIONS>>((acc, opt) => {
                acc[opt.group] = [...(acc[opt.group] ?? []), opt];
                return acc;
              }, {})
            ).map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Row>
        <Row label="Status">
          <Select<ComponentStatus>
            value={el.status ?? 'existing'}
            options={STATUS_OPTIONS}
            onChange={v => onUpdate({ ...el, status: v })}
            formatLabel={v => v.replace(/_/g, ' ')}
          />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Stroke">
          <input
            type="color"
            value={el.strokeColor ?? '#2f81f7'}
            onChange={e => onUpdate({ ...el, strokeColor: e.target.value })}
            className="w-8 h-7 rounded cursor-pointer border"
            style={{ padding: 2, borderColor: 'var(--border)', background: 'none' }}
          />
        </Row>
        <Row label="Fill">
          <input
            type="color"
            value={el.fillColor ?? '#161b22'}
            onChange={e => onUpdate({ ...el, fillColor: e.target.value })}
            className="w-8 h-7 rounded cursor-pointer border"
            style={{ padding: 2, borderColor: 'var(--border)', background: 'none' }}
          />
        </Row>
        <Row label="Opacity">
          <input
            type="range" min={10} max={100} value={Math.round((el.opacity ?? 1) * 100)}
            onChange={e => onUpdate({ ...el, opacity: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </Row>
      </Section>

      {/* ER / UML fields editor */}
      {(isEr || isUml) && (
        <FieldsEditor el={el} onUpdate={onUpdate} showMethods={isUml} />
      )}

      <Section title="Project Links">
        <Row label="File">
          <TextInput value={el.linkedFilePath ?? ''} onChange={v => onUpdate({ ...el, linkedFilePath: v })} placeholder="src/..." />
        </Row>
        <Row label="Task ID">
          <TextInput value={el.linkedTaskId ?? ''} onChange={v => onUpdate({ ...el, linkedTaskId: v })} placeholder="task ID" />
        </Row>
        <Row label="PR">
          <TextInput value={el.linkedPRId ?? ''} onChange={v => onUpdate({ ...el, linkedPRId: v })} placeholder="PR # or URL" />
        </Row>
        <Row label="Commit">
          <TextInput value={el.linkedCommit ?? ''} onChange={v => onUpdate({ ...el, linkedCommit: v })} placeholder="SHA" />
        </Row>
      </Section>
    </>
  );
}

// ─── Fields editor (ER + UML) ─────────────────────────────────────────────────

function FieldsEditor({ el, onUpdate, showMethods }: { el: CanvasElement; onUpdate: (e: CanvasElement) => void; showMethods: boolean }) {
  const fields: ObjectField[] = el.fields ?? [];
  const methods: ObjectMethod[] = el.methods ?? [];

  const addField = () => {
    onUpdate({ ...el, fields: [...fields, { id: genFieldId(), name: 'field', type: 'String' }] });
  };

  const updateField = (id: string, patch: Partial<ObjectField>) => {
    onUpdate({ ...el, fields: fields.map(f => f.id === id ? { ...f, ...patch } : f) });
  };

  const removeField = (id: string) => {
    onUpdate({ ...el, fields: fields.filter(f => f.id !== id) });
  };

  const addMethod = () => {
    onUpdate({ ...el, methods: [...methods, { id: genMethodId(), name: 'method', visibility: 'public' }] });
  };

  const updateMethod = (id: string, patch: Partial<ObjectMethod>) => {
    onUpdate({ ...el, methods: methods.map(m => m.id === id ? { ...m, ...patch } : m) });
  };

  const removeMethod = (id: string) => {
    onUpdate({ ...el, methods: methods.filter(m => m.id !== id) });
  };

  return (
    <>
      <Section title="Fields">
        {fields.map(field => (
          <div key={field.id} className="flex items-center gap-1">
            <input
              type="checkbox"
              title="Primary Key"
              checked={!!field.isPrimaryKey}
              onChange={e => updateField(field.id, { isPrimaryKey: e.target.checked, isForeignKey: e.target.checked ? false : field.isForeignKey })}
              style={{ accentColor: '#d29922', flexShrink: 0 }}
            />
            <input
              value={field.name}
              onChange={e => updateField(field.id, { name: e.target.value })}
              className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[11px] focus:outline-none"
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}
              placeholder="name"
            />
            <input
              value={field.type}
              onChange={e => updateField(field.id, { type: e.target.value })}
              className="w-16 px-1.5 py-0.5 rounded text-[11px] focus:outline-none"
              style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}
              placeholder="type"
            />
            <button onClick={() => removeField(field.id)} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={addField}
          className="flex items-center gap-1 text-[11px] mt-1"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Plus size={11} /> Add field
        </button>
      </Section>

      {showMethods && (
        <Section title="Methods">
          {methods.map(method => (
            <div key={method.id} className="flex items-center gap-1">
              <select
                value={method.visibility ?? 'public'}
                onChange={e => updateMethod(method.id, { visibility: e.target.value as any })}
                className="w-8 px-0.5 py-0.5 rounded text-[11px] focus:outline-none"
                style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <option value="public">+</option>
                <option value="private">-</option>
                <option value="protected">#</option>
              </select>
              <input
                value={method.name}
                onChange={e => updateMethod(method.id, { name: e.target.value })}
                className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[11px] focus:outline-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}
                placeholder="methodName()"
              />
              <button onClick={() => removeMethod(method.id)} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={addMethod}
            className="flex items-center gap-1 text-[11px] mt-1"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Plus size={11} /> Add method
          </button>
        </Section>
      )}
    </>
  );
}

// ─── Multi-selection placeholder ──────────────────────────────────────────────

function MultiSelectPanel({ count }: { count: number }) {
  return (
    <div
      className="absolute top-20 right-4 z-30 w-64 rounded-2xl border p-4 shadow-xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
        {count} elements selected
      </div>
      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
        Use the command palette (⌘K) to align, arrange, group, or run layout on the selection.
      </div>
    </div>
  );
}
