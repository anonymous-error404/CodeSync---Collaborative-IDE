import { useState } from 'react';
import {
  Cpu,
  Play,
  Activity,
  Layers,
  Clock,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
}

export function AIMLPreviewSurface({
  onAddTechnicalAnnotation,
}: Props) {
  const [activeTab, setActiveTab] = useState<'inference' | 'evals' | 'samples'>('inference');
  const [prompt, setPrompt] = useState('Explain why zero-value transactions require strict idempotency handling in distributed payment systems.');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(512);
  const [isRunning, setIsRunning] = useState(false);
  const [completion, setCompletion] = useState(
    `In distributed payment systems, a zero-value transaction represents an edge case that can lead to subtle race conditions and ledger discrepancies if not handled with strict idempotency.\n\nKey reasons include:\n1. Ledger Consistency: Zero-value transfers can artificially trigger state transitions or authorization events without decrementing real account balances.\n2. Fraud Detection Bypasses: Malicious actors often probe authorization channels with \$0.00 micro-authorizations to test card validity without alerting the cardholder.\n3. Idempotency Key Collisions: A zero-value authorization must never share an idempotency key with subsequent positive-value capture requests.`
  );

  const evaluationMetrics = [
    { name: 'Model Accuracy', value: '94.8%', status: 'passing', benchmark: '> 90.0%' },
    { name: 'F1 Score', value: '0.924', status: 'passing', benchmark: '> 0.850' },
    { name: 'Cross-Entropy Loss', value: '0.142', status: 'passing', benchmark: '< 0.200' },
    { name: 'Inference Latency (p95)', value: '184ms', status: 'warning', benchmark: '< 150ms' },
  ];

  const evalSamples = [
    { id: 'sample_01', input: 'Authorize charge $0.00 for user_101', expected: 'REJECT_INVALID_AMOUNT', predicted: 'ACCEPT_PROCESSED', match: false },
    { id: 'sample_02', input: 'Authorize charge $120.00 for user_102', expected: 'ACCEPT_PROCESSED', predicted: 'ACCEPT_PROCESSED', match: true },
    { id: 'sample_03', input: 'Refund charge $50.00 with duplicate token', expected: 'REJECT_DUPLICATE_IDEMPOTENCY', predicted: 'REJECT_DUPLICATE_IDEMPOTENCY', match: true },
  ];

  const handleRunInference = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setCompletion(
        `[Generated Inference Response]\nPrompt: "${prompt}"\nTemperature: ${temperature} · Tokens: 128 · Latency: 142ms\n\nProcessed inference completed with zero hallucination flags.`
      );
    }, 400);
  };

  const handlePinSample = (sample: typeof evalSamples[0]) => {
    onAddTechnicalAnnotation({
      surface: 'ml',
      type: 'bug',
      title: `ML Eval Mismatch on Sample #${sample.id}`,
      comment: `Model failed safety benchmark: Expected ${sample.expected} but predicted ${sample.predicted} for input: "${sample.input}"`,
      severity: 'critical',
      priority: 'urgent',
      technicalContext: {
        sampleId: sample.id,
        expectedOutput: sample.expected,
        predictedOutput: sample.predicted,
        input: sample.input,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-1,#0d1117)] text-[var(--foreground,#c9d1d9)] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('inference')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'inference'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Cpu size={13} />
            <span>Model Inference Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('evals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'evals'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Activity size={13} />
            <span>Evaluation Benchmarks</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'samples'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Layers size={13} />
            <span>Evaluation Dataset Samples</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-600/60 text-[10px] text-white font-mono">
              1 failed
            </span>
          </button>
        </div>

        <button
          onClick={() => handlePinSample(evalSamples[0])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Pin Model Evaluation Defect</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'inference' && (
          <div className="h-full grid grid-cols-2 gap-4">
            {/* Prompt & Hyperparameters */}
            <div className="flex flex-col h-full rounded-2xl border border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] p-4 overflow-hidden shadow-sm">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                Inference Input & Parameters
              </span>

              <div className="flex-1 flex flex-col mb-3">
                <label className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Prompt / Input Payload</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 p-3 rounded-xl border text-xs font-mono resize-none outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: 'var(--muted)' }}>Temperature: {temperature}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-36 accent-[var(--accent)]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: 'var(--muted)' }}>Max Tokens: {maxTokens}</span>
                  <input
                    type="range"
                    min="64"
                    max="2048"
                    step="64"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-36 accent-[var(--accent)]"
                  />
                </div>

                <button
                  onClick={handleRunInference}
                  disabled={isRunning}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold shadow cursor-pointer transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Play size={13} />
                  <span>{isRunning ? 'Running Inference...' : 'Run Model Inference'}</span>
                </button>
              </div>
            </div>

            {/* Completion Output */}
            <div className="flex flex-col h-full rounded-2xl border p-4 overflow-hidden shadow-sm"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Model Output
                </span>
                <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  <Clock size={12} />
                  <span>Latency: 142ms · 78 tokens/sec</span>
                </div>
              </div>

              <div className="flex-1 p-3 rounded-xl border text-xs font-mono overflow-y-auto whitespace-pre-wrap leading-relaxed"
                   style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                {completion}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evals' && (
          <div className="h-full grid grid-cols-2 gap-4">
            {evaluationMetrics.map((metric) => (
              <div key={metric.name} className="p-4 rounded-2xl border flex flex-col justify-between"
                   style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{metric.name}</span>
                  <div className="text-3xl font-black mt-2" style={{ color: 'var(--text)' }}>{metric.value}</div>
                </div>
                <div className="flex items-center justify-between text-xs pt-3 border-t font-mono"
                     style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  <span>Threshold: {metric.benchmark}</span>
                  <span className={`font-bold uppercase px-2 py-0.5 rounded-full text-[10px] ${metric.status === 'passing' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                    {metric.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'samples' && (
          <div className="h-full rounded-2xl border p-4 overflow-y-auto"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <h4 className="font-bold text-xs mb-3" style={{ color: 'var(--text)' }}>Evaluation Dataset Samples</h4>
            <div className="space-y-3">
              {evalSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="p-3.5 rounded-xl border flex items-center justify-between"
                  style={{
                    background: sample.match ? 'var(--surface)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: sample.match ? 'var(--border)' : 'rgba(239, 68, 68, 0.4)',
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{sample.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${sample.match ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                        {sample.match ? 'PASS' : 'FAIL - MISMATCH'}
                      </span>
                    </div>
                    <p className="text-xs font-mono" style={{ color: 'var(--text)' }}>&quot;{sample.input}&quot;</p>
                    <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                      <span>Expected: <strong className="text-emerald-400">{sample.expected}</strong></span>
                      <span>Predicted: <strong className={sample.match ? 'text-emerald-400' : 'text-red-400'}>{sample.predicted}</strong></span>
                    </div>
                  </div>

                  {!sample.match && (
                    <button
                      onClick={() => handlePinSample(sample)}
                      className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow cursor-pointer"
                    >
                      Pin Defect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
