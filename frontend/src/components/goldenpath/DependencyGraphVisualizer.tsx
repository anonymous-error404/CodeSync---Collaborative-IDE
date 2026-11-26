import React from 'react';
import {
  Database,
  Layers,
  Server,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  Activity,
} from 'lucide-react';

interface Props {
  graphStatus: Record<string, any>;
  dependencyGraph: Array<{ id: string; name: string; type: string; order: number; dependsOn?: string[] }>;
  logs: Array<{ timestamp: string; stage: string; message: string; level: string }>;
}

export function DependencyGraphVisualizer({ graphStatus, dependencyGraph, logs }: Props) {
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'database':
        return Database;
      case 'cache':
        return Zap;
      case 'application':
        return Server;
      case 'observability':
        return Activity;
      default:
        return Layers;
    }
  };

  // Group by execution order (phases)
  const phases: Record<number, typeof dependencyGraph> = {};
  dependencyGraph.forEach((node) => {
    phases[node.order] = phases[node.order] || [];
    phases[node.order].push(node);
  });

  const sortedPhases = Object.keys(phases).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Visual DAG Stream */}
      <div className="p-4 rounded-2xl border border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shadow-sm">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Layers size={14} className="text-indigo-400" /> Multi-Service Orchestration DAG
        </h4>

        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          {sortedPhases.map((phaseNum, pIdx) => (
            <React.Fragment key={phaseNum}>
              <div className="flex flex-col gap-2 min-w-[200px]">
                <span className="text-[10px] font-bold uppercase text-neutral-400">
                  Phase {phaseNum} (Parallel Execution)
                </span>

                <div className="space-y-2">
                  {phases[phaseNum].map((node) => {
                    const statusInfo = graphStatus[node.id] || { status: 'pending' };
                    const isHealthy = statusInfo.status === 'healthy';
                    const isProvisioning = statusInfo.status === 'provisioning';
                    const Icon = getNodeIcon(node.type);

                    return (
                      <div
                        key={node.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isHealthy
                            ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300'
                            : isProvisioning
                            ? 'border-indigo-500 bg-indigo-950/30 text-indigo-200 animate-pulse'
                            : 'border-neutral-800 bg-neutral-900/60 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                            <Icon size={14} /> {node.name}
                          </span>
                          {isHealthy ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : isProvisioning ? (
                            <Clock size={14} className="text-indigo-400 animate-spin" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-neutral-600" />
                          )}
                        </div>

                        <div className="text-[10px] font-mono text-neutral-400">
                          {statusInfo.endpoint ? (
                            <span className="text-emerald-400">{statusInfo.endpoint}</span>
                          ) : (
                            <span>Status: {statusInfo.status}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {pIdx < sortedPhases.length - 1 && (
                <div className="flex items-center text-neutral-600 pt-6">
                  <ArrowRight size={18} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Realtime Provisioning Logs */}
      <div className="flex-1 flex flex-col p-4 rounded-2xl border border-[var(--border,#30363d)] bg-neutral-950 shadow-inner overflow-hidden">
        <h4 className="text-xs font-bold text-neutral-400 mb-2 font-mono flex items-center justify-between">
          <span>Orchestration Execution Logs</span>
          <span className="text-[10px] text-emerald-400">Streaming Live</span>
        </h4>

        <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-1">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-neutral-300">
              <span className="text-neutral-500 text-[10px] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span
                className={`text-[10px] uppercase font-bold shrink-0 ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'success'
                    ? 'text-emerald-400'
                    : 'text-indigo-400'
                }`}
              >
                [{log.stage}]
              </span>
              <span className={log.level === 'error' ? 'text-red-300' : 'text-neutral-200'}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
