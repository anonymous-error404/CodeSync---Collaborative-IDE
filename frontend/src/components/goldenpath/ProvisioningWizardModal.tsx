import { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
} from 'lucide-react';
import type { GoldenPathBlueprint, IDPExecution } from '../../types';
import { goldenPathApi } from '../../services/goldenPathApi';

interface Props {
  blueprint: GoldenPathBlueprint;
  workspaceId: string;
  onClose: () => void;
  onSuccess: (execution: IDPExecution) => void;
}

export function ProvisioningWizardModal({ blueprint, workspaceId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [projectName, setProjectName] = useState(`${blueprint.id}-${Date.now().toString(36).slice(-4)}`);
  const [parameters, setParameters] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    blueprint.inputsSchema.forEach((f) => {
      defaults[f.id] = f.default !== undefined ? f.default : '';
    });
    return defaults;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);
    try {
      const execution = await goldenPathApi.initiateProvisioning({
        blueprintId: blueprint.id,
        workspaceId,
        projectName,
        parameters,
      });
      onSuccess(execution);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="flex flex-col w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border,#30363d)]"
        style={{
          background: 'var(--surface-1, #0f141c)',
          color: 'var(--foreground, #e6edf3)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Golden Path Scaffolding Wizard</h3>
              <p className="text-xs text-neutral-400">
                Blueprint: <strong className="text-white">{blueprint.name}</strong> (v{blueprint.version})
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Steps Progress Header */}
        <div className="grid grid-cols-4 border-b border-[var(--border,#30363d)] bg-neutral-900/40 text-center text-xs">
          {[
            { num: 1, label: '1. Parameters' },
            { num: 2, label: '2. Dependencies' },
            { num: 3, label: '3. Governance' },
            { num: 4, label: '4. Preview Plan' },
          ].map((s) => (
            <div
              key={s.num}
              className={`py-2.5 font-bold transition-all border-b-2 ${
                step === s.num
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                  : 'border-transparent text-neutral-500'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* STEP 1: PARAMETERS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Service / Project Name</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white font-mono"
                />
              </div>

              {blueprint.inputsSchema.map((field) => (
                <div key={field.id}>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={parameters[field.id]}
                      onChange={(e) => setParameters({ ...parameters, [field.id]: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white"
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={!!parameters[field.id]}
                        onChange={(e) => setParameters({ ...parameters, [field.id]: e.target.checked })}
                        className="w-4 h-4 accent-indigo-500 rounded"
                      />
                      <span className="text-xs text-neutral-300">Enabled</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={parameters[field.id] || ''}
                      onChange={(e) => setParameters({ ...parameters, [field.id]: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP 2: DEPENDENCY GRAPH */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400">
                The orchestration layer coordinates provisioning of all required services in their mathematical dependency order:
              </p>

              <div className="space-y-2">
                {blueprint.dependencyGraph.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px]">
                        Phase {dep.order}
                      </span>
                      <span className="font-bold text-white">{dep.name}</span>
                    </div>

                    <span className="text-[10px] text-neutral-400 font-mono">
                      Type: {dep.type} {dep.dependsOn ? `| Depends on: [${dep.dependsOn.join(', ')}]` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: GOVERNANCE & POLICIES */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Mandatory enterprise architecture and security policies validated prior to provisioning:
              </p>

              <div className="p-3.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 size={16} /> Continuous Secret Scanning Enforced
                </div>
                <p className="text-neutral-300 text-[11px]">
                  All project files are bound to the Zero-Trust Broker. No plaintext secrets permitted in .env files.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 size={16} /> Container Security & Health-Check Hooks
                </div>
                <p className="text-neutral-300 text-[11px]">
                  Docker multi-stage builds and OpenTelemetry agents injected automatically.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW PLAN */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-indigo-800/40 bg-indigo-950/20 space-y-2 text-xs">
                <h4 className="font-bold text-indigo-300">Ready to Orchestrate Provisioning Plan:</h4>
                <ul className="list-disc pl-4 space-y-1 text-neutral-300 text-[11px]">
                  <li>Initialize source structure from <strong>{blueprint.sourceProvider}</strong> template</li>
                  <li>Provision <strong>{blueprint.dependencyGraph.length}</strong> multi-tier services and databases</li>
                  <li>Link CodeSync Zero-Trust Credential Broker & Workload Identity</li>
                  <li>Configure preview environment with Figma-style pin support</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)]">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 text-xs rounded-xl text-neutral-400 hover:text-white"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg cursor-pointer"
            >
              <Play size={14} />
              <span>{loading ? 'Orchestrating...' : 'Launch Provisioning'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
