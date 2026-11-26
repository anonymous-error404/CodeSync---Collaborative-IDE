import { useState } from 'react';
import {
  Network,
  Server,
  Layers,
  Database,
  Radio,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
}

export function DistributedPreviewSurface({
  onAddTechnicalAnnotation,
}: Props) {
  const [selectedService, setSelectedService] = useState('billing-worker');

  const nodes = [
    { id: 'api-gateway', name: 'API Gateway', type: 'gateway', status: 'healthy', rps: 340, latency: '8ms', icon: Network },
    { id: 'auth-service', name: 'Auth Service', type: 'service', status: 'healthy', rps: 180, latency: '12ms', icon: Server },
    { id: 'billing-worker', name: 'Billing Worker', type: 'service', status: 'degraded', rps: 84, latency: '44ms', icon: Server },
    { id: 'redis-cache', name: 'Redis Cache', type: 'cache', status: 'healthy', rps: 420, latency: '1ms', icon: Layers },
    { id: 'postgres-db', name: 'PostgreSQL Primary', type: 'database', status: 'healthy', rps: 95, latency: '4ms', icon: Database },
    { id: 'kafka-events', name: 'Kafka Event Mesh', type: 'broker', status: 'healthy', rps: 520, latency: '2ms', icon: Radio },
  ];

  const handlePinService = (node: typeof nodes[0]) => {
    onAddTechnicalAnnotation({
      surface: 'logs',
      type: 'bug',
      title: `Distributed Topology Defect: ${node.name}`,
      comment: `Service ${node.name} status is ${node.status.toUpperCase()} with high p95 latency (${node.latency}). Inter-service bottleneck detected.`,
      severity: node.status === 'degraded' ? 'high' : 'medium',
      priority: 'high',
      technicalContext: {
        service: node.id,
        status: node.status,
        latency: node.latency,
        rps: node.rps,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-1,#0d1117)] text-[var(--foreground,#c9d1d9)] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shrink-0">
        <div className="flex items-center gap-2">
          <Network size={15} className="text-indigo-400" />
          <span className="text-xs font-bold text-white">Distributed Multi-Service Cluster Mesh</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 text-[10px] font-bold border border-amber-800/40">
            1 Service Degraded
          </span>
        </div>

        <button
          onClick={() => {
            const node = nodes.find((n) => n.id === selectedService) || nodes[0];
            handlePinService(node);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Pin Cluster Finding</span>
        </button>
      </div>

      {/* Main Cluster Topology */}
      <div className="flex-1 p-4 grid grid-cols-3 gap-4 overflow-y-auto">
        {nodes.map((node) => {
          const Icon = node.icon;
          const isSelected = selectedService === node.id;
          return (
            <div
              key={node.id}
              onClick={() => setSelectedService(node.id)}
              className="p-4 rounded-2xl border transition-all cursor-pointer"
              style={{
                background: isSelected ? 'var(--accent-subtle)' : 'var(--surface-2)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl border"
                       style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--accent)' }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>{node.name}</h4>
                    <span className="text-[10px] font-mono capitalize" style={{ color: 'var(--muted)' }}>{node.type}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    node.status === 'healthy'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      : 'bg-amber-950 text-amber-400 border border-amber-800/40'
                  }`}
                >
                  {node.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t"
                   style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                <div>
                  <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>Traffic</span>
                  <span className="font-bold">{node.rps} req/s</span>
                </div>
                <div>
                  <span className="text-[10px] block" style={{ color: 'var(--muted)' }}>p95 Latency</span>
                  <span className={`font-bold ${node.status === 'degraded' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {node.latency}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
