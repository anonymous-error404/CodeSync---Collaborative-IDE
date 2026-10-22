/**
 * ValidationPanel — Rule-based diagram validation results.
 *
 * Uses the deterministic diagramValidator.
 * Shows issues grouped by severity with element links.
 * No AI recommendations.
 */
import { useState } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { validateDiagram } from '../../services/diagramValidator';
import type { CanvasElement, ValidationResult, ValidationSeverity } from '../../types/whiteboard';

interface Props {
  elements: CanvasElement[];
  selectedIds: string[];
  onClose: () => void;
  onSelectElement: (id: string) => void;
}

const SEVERITY_CONFIG: Record<ValidationSeverity, { icon: any; color: string; bg: string; label: string }> = {
  error:   { icon: AlertCircle,   color: 'var(--error)',   bg: 'var(--error-bg)',              label: 'Errors' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'rgba(210,153,34,0.1)',         label: 'Warnings' },
  info:    { icon: Info,          color: 'var(--accent)',  bg: 'rgba(47,129,247,0.08)',         label: 'Info' },
};

export function ValidationPanel({ elements, selectedIds, onClose, onSelectElement }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [scope, setScope] = useState<'board' | 'selection'>('board');
  const [collapsed, setCollapsed] = useState<Set<ValidationSeverity>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const runValidation = () => {
    const s = scope === 'selection' && selectedIds.length > 0 ? selectedIds : 'board';
    setResult(validateDiagram(elements, s));
    setDismissed(new Set());
  };

  const toggleCollapse = (sev: ValidationSeverity) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(sev) ? next.delete(sev) : next.add(sev);
      return next;
    });
  };

  const visibleIssues = result?.issues.filter(i => !dismissed.has(i.id)) ?? [];
  const errors   = visibleIssues.filter(i => i.severity === 'error');
  const warnings = visibleIssues.filter(i => i.severity === 'warning');
  const infos    = visibleIssues.filter(i => i.severity === 'info');

  const groups: [ValidationSeverity, typeof errors][] = [
    ['error', errors], ['warning', warnings], ['info', infos],
  ];

  return (
    <div
      className="absolute top-20 right-4 z-40 w-80 flex flex-col rounded-2xl shadow-xl border animate-fade-in overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        maxHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <ShieldCheck size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Validation</span>
        {result && (
          <span
            className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: errors.length > 0 ? 'var(--error-bg)' : warnings.length > 0 ? 'rgba(210,153,34,0.12)' : 'rgba(63,185,80,0.12)',
              color: errors.length > 0 ? 'var(--error)' : warnings.length > 0 ? 'var(--warning)' : 'var(--success)',
            }}
          >
            {visibleIssues.length} issue{visibleIssues.length !== 1 ? 's' : ''}
          </span>
        )}
        <button onClick={onClose} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: result ? 0 : 'auto' }}>
          <X size={14} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex rounded-lg overflow-hidden border text-xs"
          style={{ borderColor: 'var(--border)' }}
        >
          {(['board', 'selection'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                padding: '3px 10px',
                background: scope === s ? 'var(--accent)' : 'transparent',
                color: scope === s ? '#fff' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {s === 'board' ? 'Full board' : `Selection (${selectedIds.length})`}
            </button>
          ))}
        </div>
        <button
          onClick={runValidation}
          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer' }}
        >
          <RefreshCw size={11} />
          Run
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!result && (
          <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--muted)' }}>
            <ShieldCheck size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div className="text-xs text-center">Click Run to validate<br />diagram structure</div>
          </div>
        )}

        {result && visibleIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--success)' }}>
            <ShieldCheck size={28} style={{ marginBottom: 8 }} />
            <div className="text-xs font-semibold">No issues found</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
              {result.elementCount} elements checked
            </div>
          </div>
        )}

        {result && groups.map(([severity, issues]) => {
          if (issues.length === 0) return null;
          const cfg = SEVERITY_CONFIG[severity];
          const Icon = cfg.icon;
          const isCollapsed = collapsed.has(severity);

          return (
            <div key={severity} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              {/* Group header */}
              <button
                onClick={() => toggleCollapse(severity)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold"
                style={{
                  background: cfg.bg,
                  color: cfg.color,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={12} />
                {cfg.label} ({issues.length})
                {isCollapsed ? <ChevronDown size={12} style={{ marginLeft: 'auto' }} /> : <ChevronUp size={12} style={{ marginLeft: 'auto' }} />}
              </button>

              {!isCollapsed && (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {issues.map(issue => (
                    <div key={issue.id} className="px-4 py-3 space-y-1.5">
                      {/* Rule + dismiss */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          {issue.rule}
                        </span>
                        <button
                          onClick={() => setDismissed(prev => new Set([...prev, issue.id]))}
                          style={{ marginLeft: 'auto', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                          title="Dismiss"
                        >
                          <X size={11} />
                        </button>
                      </div>

                      {/* Message */}
                      <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        {issue.message}
                      </p>

                      {/* Suggestion */}
                      {issue.suggestion && (
                        <p className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
                          💡 {issue.suggestion}
                        </p>
                      )}

                      {/* Navigate to element */}
                      {issue.elementId && (
                        <button
                          onClick={() => onSelectElement(issue.elementId!)}
                          className="text-[11px] font-semibold mt-0.5"
                          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          → Locate element
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {result && (
        <div
          className="px-4 py-2 border-t text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}
        >
          Checked {result.elementCount} elements · {new Date(result.checkedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
