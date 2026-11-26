import { useState } from 'react';
import {
  ShieldCheck,
  FileCode,
  Layers,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
}

export function InfrastructurePreviewSurface({
  onAddTechnicalAnnotation,
}: Props) {
  const [activeTab, setActiveTab] = useState<'plan' | 'manifest' | 'policy'>('plan');

  const plannedChanges = [
    { action: 'create', type: 'aws_s3_bucket', name: 'payment-audit-records-dev', cost: '+$0.023/GB', status: 'compliant' },
    { action: 'create', type: 'aws_sqs_queue', name: 'payment-dead-letter-queue', cost: '+$0.00', status: 'compliant' },
    { action: 'modify', type: 'aws_security_group_rule', name: 'ingress-allow-443', cost: '+$0.00', status: 'flagged' },
  ];

  const terraformManifest = `resource "aws_s3_bucket" "audit" {
  bucket        = "payment-audit-records-dev"
  force_destroy = false

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  tags = {
    Environment = "development"
    ManagedBy   = "CodeSync-IDP"
    Workspace   = "ws_102"
  }
}`;

  const handlePinInfrastructure = (change: typeof plannedChanges[0]) => {
    onAddTechnicalAnnotation({
      surface: 'logs',
      type: 'change_request',
      title: `Infrastructure Policy Violation on ${change.name}`,
      comment: `Security Group ingress rule specifies 0.0.0.0/0 open CIDR block. Must restrict to VPC subnet range.`,
      severity: 'high',
      priority: 'high',
      technicalContext: {
        resourceType: change.type,
        resourceName: change.name,
        action: change.action,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-1,#0d1117)] text-[var(--foreground,#c9d1d9)] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'plan'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Layers size={13} />
            <span>Deployment Plan (Terraform / K8s)</span>
          </button>

          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'manifest'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FileCode size={13} />
            <span>Infrastructure Manifests</span>
          </button>

          <button
            onClick={() => setActiveTab('policy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'policy'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <ShieldCheck size={13} />
            <span>Policy Compliance Scorecard</span>
          </button>
        </div>

        <button
          onClick={() => handlePinInfrastructure(plannedChanges[2])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Pin IaC Finding</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'plan' && (
          <div className="h-full rounded-2xl border p-4 overflow-y-auto"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <h4 className="font-bold text-xs mb-3" style={{ color: 'var(--text)' }}>Planned Infrastructure Modifications</h4>
            <div className="space-y-3">
              {plannedChanges.map((change) => (
                <div key={change.name} className="p-3.5 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        change.action === 'create' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                      }`}>
                        +{change.action}
                      </span>
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--text)' }}>{change.type}</span>
                    </div>
                    <p className="text-xs font-mono" style={{ color: 'var(--text)' }}>{change.name}</p>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>Cost Delta: {change.cost}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      change.status === 'compliant' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                    }`}>
                      {change.status}
                    </span>
                    {change.status === 'flagged' && (
                      <button
                        onClick={() => handlePinInfrastructure(change)}
                        className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow cursor-pointer transition-all"
                      >
                        Pin Violation
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'manifest' && (
          <div className="h-full rounded-2xl border p-4 flex flex-col"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              Generated main.tf Manifest
            </span>
            <pre className="flex-1 w-full p-3 rounded-xl border text-xs font-mono text-emerald-300 overflow-y-auto leading-relaxed"
                 style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {terraformManifest}
            </pre>
          </div>
        )}

        {activeTab === 'policy' && (
          <div className="h-full rounded-2xl border p-4 overflow-y-auto"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <h4 className="font-bold text-xs mb-3" style={{ color: 'var(--text)' }}>Open Policy Agent (OPA) Infrastructure Compliance</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-xl border flex items-center justify-between"
                   style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <h5 className="text-xs font-bold" style={{ color: 'var(--text)' }}>Rule #1: S3 Bucket Encryption at Rest</h5>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>All buckets must configure AES256 or KMS encryption.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400">PASS</span>
              </div>

              <div className="p-3 rounded-xl border flex items-center justify-between"
                   style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <h5 className="text-xs font-bold" style={{ color: 'var(--text)' }}>Rule #2: No Unrestricted 0.0.0.0/0 Security Group Ingress</h5>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Ingress must be restricted to internal corporate or VPC CIDR.</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-400">FAIL (FLAGGED)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
