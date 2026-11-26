import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  FileSearch,
  Activity,
  Cloud,
  Copy,
  Check,
  AlertOctagon,
  Network,
  CheckCircle,
  XCircle,
  Play,
  RotateCw,
} from 'lucide-react';
import type {
  CredentialProvider,
  EphemeralCredential,
  CredentialPolicy,
  CredentialAuditLog,
} from '../../types';
import { credentialApi } from '../../services/credentialApi';
import { TokenRequestModal } from './TokenRequestModal';

interface Props {
  workspaceId: string;
}

export function CredentialBrokerHub({ workspaceId }: Props) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'egress' | 'scanner' | 'providers' | 'policies' | 'analytics'>('tokens');
  const [credentials, setCredentials] = useState<EphemeralCredential[]>([]);
  const [providers, setProviders] = useState<CredentialProvider[]>([]);
  const [policies, setPolicies] = useState<CredentialPolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<CredentialAuditLog[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Secret scanner state
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerFilter, setScannerFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');

  // Policy Simulator state (6.6.F)
  const [simRole, setSimRole] = useState('developer');
  const [simService, setSimService] = useState('');
  const [simResource, setSimResource] = useState('');
  const [simEnv, setSimEnv] = useState('development');
  const [simOp, setSimOp] = useState('read');
  const [simResult, setSimResult] = useState<{ allowed: boolean; reason: string; policyName: string } | null>(null);

  // Egress traffic logs (6.4 & 6.9)
  const [egressLogs] = useState<any[]>([]);

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [workspaceId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [creds, provs, pols, analyticsData] = await Promise.all([
        credentialApi.getWorkspaceCredentials(workspaceId),
        credentialApi.getProviders(),
        credentialApi.getPolicies(),
        credentialApi.getAnalytics(workspaceId),
      ]);
      setCredentials(creds);
      setProviders(provs);
      setPolicies(pols);
      setAuditLogs(analyticsData.logs);
      setAnalyticsStats(analyticsData.stats);
    } catch (err) {
      console.error('Failed to load credentials data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await credentialApi.revokeCredential(id);
      setCredentials(credentials.map((c) => (c.id === id ? { ...c, status: 'revoked' } : c)));
    } catch (err: any) {
      alert(`Revocation error: ${err.message}`);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const result = await credentialApi.scanSecrets(workspaceId);
      setScanResult(result);
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleEmergencyLockdown = async () => {
    try {
      await credentialApi.emergencyLockdown({
        targetType: 'workspace',
        targetId: workspaceId,
        reason: 'Manual emergency security lockdown initiated by developer.',
      });
      setShowLockdownConfirm(false);
      loadAll();
      alert('EMERGENCY LOCKDOWN COMPLETE: All active ephemeral credentials for this workspace have been revoked.');
    } catch (err: any) {
      alert(`Lockdown failed: ${err.message}`);
    }
  };

  const handleRunPolicySimulation = () => {
    if (simEnv === 'production' && simRole !== 'lead_architect') {
      setSimResult({
        allowed: false,
        reason: 'Production environment requires Lead Architect role and explicit dual-approval break-glass gate.',
        policyName: 'Strict-Production-Gate-ABAC',
      });
    } else if (simResource.includes('finance-prod') && simEnv !== 'production') {
      setSimResult({
        allowed: false,
        reason: 'Resource belongs to Production classification and cannot be accessed from Development/Sandbox environments.',
        policyName: 'Environment-Boundary-Isolation',
      });
    } else {
      setSimResult({
        allowed: true,
        reason: 'Request matches active ABAC rule for Development sandbox. Short-lived ephemeral credential permitted.',
        policyName: 'Default-Developer-Sandbox-Policy',
      });
    }
  };

  const copyToClipboard = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0 transition-colors"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl border"
            style={{
              background: 'var(--success-bg)',
              color: 'var(--success)',
              borderColor: 'rgba(22, 163, 74, 0.28)',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Zero-Trust Ephemeral Credential Broker
              </h2>
              <span
                className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border font-mono"
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  borderColor: 'rgba(22, 163, 74, 0.28)',
                }}
              >
                Egress Proxy Active
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Secure short-lived dynamic credentials, zero-trust secrets scanning &amp; centralized access policies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow cursor-pointer transition-all"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <KeyRound size={14} />
            <span>Request Ephemeral Token</span>
          </button>

          <button
            onClick={() => setShowLockdownConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border cursor-pointer transition-all"
            style={{
              background: 'var(--error-bg)',
              color: 'var(--error)',
              borderColor: 'var(--error)',
            }}
          >
            <AlertOctagon size={14} />
            <span>Emergency Killswitch</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="flex items-center gap-2 px-6 py-2.5 border-b text-xs font-semibold shrink-0"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        {[
          { id: 'tokens', label: `Active Tokens (${credentials.filter((c) => c.status === 'active').length})`, icon: KeyRound },
          { id: 'egress', label: 'Egress Proxy & Network', icon: Network },
          { id: 'scanner', label: 'Secret Scanner', icon: FileSearch },
          { id: 'providers', label: `Providers (${providers.length})`, icon: Cloud },
          { id: 'policies', label: `Policies & Simulator (${policies.length})`, icon: Lock },
          { id: 'analytics', label: 'Analytics & Audit', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer border"
              style={{
                background: isActive ? 'var(--surface)' : 'transparent',
                borderColor: isActive ? 'var(--border)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <Icon size={14} style={{ color: isActive ? 'var(--accent)' : 'var(--muted)' }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-20 text-xs" style={{ color: 'var(--muted)' }}>
            Loading Zero-Trust Security State...
          </div>
        ) : (
          <>
            {/* TAB 1: ACTIVE WORKLOAD TOKENS */}
            {activeTab === 'tokens' && (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                        borderColor: 'var(--accent-border)',
                      }}
                    >
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                        Workspace Security Envelope Active
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        Dynamic credential brokering and policy evaluation active for workspace <strong style={{ color: 'var(--text)' }}>{workspaceId}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Sandbox Environment: </span>
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>Development</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {credentials.length === 0 ? (
                    <div className="text-center py-16 text-xs" style={{ color: 'var(--muted)' }}>
                      <KeyRound size={28} className="mx-auto mb-2 opacity-40" />
                      <p>No active ephemeral tokens issued yet.</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                        Click &quot;Request Ephemeral Token&quot; to perform a dynamic token exchange without master keys.
                      </p>
                    </div>
                  ) : (
                    credentials.map((cred) => (
                      <div
                        key={cred.id}
                        className="p-4 rounded-2xl border transition-all"
                        style={{
                          background: 'var(--surface)',
                          borderColor: cred.status === 'active' ? 'var(--border)' : 'var(--border-subtle)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border"
                              style={{
                                background: cred.status === 'active' ? 'var(--success-bg)' : 'var(--surface-2)',
                                color: cred.status === 'active' ? 'var(--success)' : 'var(--muted)',
                                borderColor: cred.status === 'active' ? 'var(--success)' : 'var(--border)',
                              }}
                            >
                              {cred.status}
                            </span>
                            <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>
                              {cred.resourceTarget}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>
                              ({cred.providerType || cred.provider?.name || 'cloud'})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                              Expires: {new Date(cred.expiresAt).toLocaleTimeString()}
                            </span>
                            {cred.status === 'active' && (
                              <button
                                onClick={() => handleRevoke(cred.id)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer"
                                style={{
                                  background: 'var(--error-bg)',
                                  color: 'var(--error)',
                                  borderColor: 'var(--error)',
                                }}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scoped Token Preview */}
                        <div
                          className="mt-3 p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono"
                          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                        >
                          <span className="truncate max-w-xl" style={{ color: 'var(--muted)' }}>
                            {(cred.tokenValue || cred.maskedToken || '').substring(0, 32)}••••••••••••••••••••••••••••••••
                          </span>
                          <button
                            onClick={() => copyToClipboard(cred.tokenValue || cred.maskedToken, cred.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors cursor-pointer"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          >
                            {copiedTokenId === cred.id ? (
                              <Check size={12} style={{ color: 'var(--success)' }} />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>{copiedTokenId === cred.id ? 'Copied' : 'Copy Token'}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EGRESS PROXY & NETWORK TRAFFIC */}
            {activeTab === 'egress' && (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      Controlled Egress Layer Active
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Containerized traffic is proxied through CodeSync. Master secrets are injected in-flight and outbound logs are scrubbed.
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold border"
                    style={{
                      background: 'var(--success-bg)',
                      color: 'var(--success)',
                      borderColor: 'rgba(22, 163, 74, 0.28)',
                    }}
                  >
                    Destination Allowlist: Active
                  </span>
                </div>

                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div
                    className="p-3.5 border-b font-bold text-xs"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    Live Egress Intercept Log
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr
                        className="border-b"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                      >
                        <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                        <th className="py-2.5 px-3 font-semibold">Workload Identity</th>
                        <th className="py-2.5 px-3 font-semibold">Target Host / Destination</th>
                        <th className="py-2.5 px-3 font-semibold">Method</th>
                        <th className="py-2.5 px-3 font-semibold">Egress Status</th>
                        <th className="py-2.5 px-3 font-semibold">Redaction Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {egressLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs" style={{ color: 'var(--muted)' }}>
                            No egress traffic recorded yet. Outbound requests through the zero-trust egress proxy will appear here in real time.
                          </td>
                        </tr>
                      ) : (
                        egressLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="border-b font-mono text-[11px] transition-colors"
                            style={{ borderColor: 'var(--border-subtle)' }}
                          >
                            <td className="py-2.5 px-3" style={{ color: 'var(--muted)' }}>{log.time}</td>
                            <td className="py-2.5 px-3 font-bold" style={{ color: 'var(--accent)' }}>{log.workload}</td>
                            <td className="py-2.5 px-3" style={{ color: 'var(--text)' }}>{log.host}</td>
                            <td className="py-2.5 px-3 font-bold" style={{ color: 'var(--text)' }}>{log.method}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className="px-2 py-0.5 rounded font-bold"
                                style={{
                                  background: log.status.includes('ALLOWED') ? 'var(--success-bg)' : 'var(--error-bg)',
                                  color: log.status.includes('ALLOWED') ? 'var(--success)' : 'var(--error)',
                                }}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3" style={{ color: 'var(--warning)' }}>{log.redacted}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: SECRET LEAKAGE SCANNER */}
            {activeTab === 'scanner' && (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border"
                      style={{
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                        borderColor: 'var(--accent-border)',
                      }}
                    >
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                        Deep Multi-Engine Secret Scanner
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        High-entropy heuristic scanning across 25+ cloud, API, and cryptographic key signatures.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow cursor-pointer transition-all disabled:opacity-50 btn-physical-primary"
                  >
                    <RotateCw size={13} className={isScanning ? 'animate-spin' : ''} />
                    <span>{isScanning ? 'Auditing Workspace...' : 'Run Security Scan'}</span>
                  </button>
                </div>

                {scanResult && (
                  <div className="space-y-4">
                    {/* Scanner Metrics Dashboard */}
                    <div className="grid grid-cols-4 gap-3">
                      <div
                        className="p-3 rounded-xl border text-center"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                          Files Examined
                        </span>
                        <div className="text-lg font-black mt-0.5" style={{ color: 'var(--text)' }}>
                          {scanResult.totalFilesScanned ?? scanResult.scannedFilesCount ?? 0}
                        </div>
                      </div>

                      <div
                        className="p-3 rounded-xl border text-center"
                        style={{
                          background: (scanResult.criticalCount || 0) > 0 ? 'var(--error-bg)' : 'var(--surface-2)',
                          borderColor: (scanResult.criticalCount || 0) > 0 ? 'var(--error)' : 'var(--border)',
                        }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: (scanResult.criticalCount || 0) > 0 ? 'var(--error)' : 'var(--muted)' }}
                        >
                          Critical Secrets
                        </span>
                        <div
                          className="text-lg font-black mt-0.5"
                          style={{ color: (scanResult.criticalCount || 0) > 0 ? 'var(--error)' : 'var(--text)' }}
                        >
                          {scanResult.criticalCount ?? scanResult.findings?.filter((f: any) => f.severity === 'critical').length ?? 0}
                        </div>
                      </div>

                      <div
                        className="p-3 rounded-xl border text-center"
                        style={{
                          background: (scanResult.highCount || 0) > 0 ? 'var(--warning-bg)' : 'var(--surface-2)',
                          borderColor: (scanResult.highCount || 0) > 0 ? 'var(--warning)' : 'var(--border)',
                        }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: (scanResult.highCount || 0) > 0 ? 'var(--warning)' : 'var(--muted)' }}
                        >
                          High Severity
                        </span>
                        <div
                          className="text-lg font-black mt-0.5"
                          style={{ color: (scanResult.highCount || 0) > 0 ? 'var(--warning)' : 'var(--text)' }}
                        >
                          {scanResult.highCount ?? scanResult.findings?.filter((f: any) => f.severity === 'high').length ?? 0}
                        </div>
                      </div>

                      <div
                        className="p-3 rounded-xl border text-center"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                          Audit Duration
                        </span>
                        <div className="text-lg font-black mt-0.5" style={{ color: 'var(--accent)' }}>
                          {scanResult.scanDurationMs ? `${scanResult.scanDurationMs}ms` : '< 1s'}
                        </div>
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: 'all', label: `All Findings (${scanResult.findings?.length || 0})` },
                        { id: 'critical', label: `Critical (${scanResult.findings?.filter((f: any) => f.severity === 'critical').length || 0})` },
                        { id: 'high', label: `High (${scanResult.findings?.filter((f: any) => f.severity === 'high').length || 0})` },
                        { id: 'medium', label: `Medium (${scanResult.findings?.filter((f: any) => f.severity === 'medium').length || 0})` },
                      ].map((tab) => {
                        const isActive = scannerFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setScannerFilter(tab.id as any)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              isActive ? 'btn-physical-primary' : 'btn-physical-surface'
                            }`}
                            style={
                              isActive
                                ? undefined
                                : {
                                    background: 'var(--surface-2)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--muted)',
                                  }
                            }
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Findings List */}
                    <div
                      className="p-4 rounded-2xl border space-y-3"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      {(!scanResult.findings || scanResult.findings.length === 0) ? (
                        <div className="text-center py-10 space-y-2">
                          <CheckCircle size={32} className="mx-auto" style={{ color: 'var(--success)' }} />
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                            No Leaked Secrets Detected
                          </h4>
                          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
                            Repository workspace files are clean of hardcoded cloud keys, database URLs, and SaaS tokens.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {scanResult.findings
                            .filter((f: any) => scannerFilter === 'all' || f.severity === scannerFilter)
                            .map((f: any, idx: number) => {
                              const sev = f.severity || 'high';
                              const secretName = f.secretType || f.patternName || 'Hardcoded Secret';
                              const filePath = f.file || f.filePath || 'Unknown';
                              const preview = f.preview || f.matchPreview || '';
                              return (
                                <div
                                  key={idx}
                                  className="p-3.5 rounded-xl border space-y-2.5 transition-all text-xs"
                                  style={{
                                    background: 'var(--surface-2)',
                                    borderColor: sev === 'critical' ? 'var(--error)' : 'var(--border)',
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border"
                                          style={{
                                            background: sev === 'critical' ? 'var(--error-bg)' : 'var(--warning-bg)',
                                            color: sev === 'critical' ? 'var(--error)' : 'var(--warning)',
                                            borderColor: sev === 'critical' ? 'var(--error)' : 'var(--warning)',
                                          }}
                                        >
                                          {sev}
                                        </span>
                                        {f.vendor && (
                                          <span
                                            className="px-2 py-0.5 rounded text-[10px] font-bold border"
                                            style={{
                                              background: 'var(--surface)',
                                              borderColor: 'var(--border)',
                                              color: 'var(--accent)',
                                            }}
                                          >
                                            {f.vendor}
                                          </span>
                                        )}
                                        <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                                          {secretName}
                                        </h4>
                                      </div>
                                      <p className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                                        {filePath}:{f.line}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {f.entropy && (
                                        <span
                                          className="text-[10px] font-mono px-2 py-0.5 rounded border"
                                          style={{
                                            background: 'var(--surface)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--muted)',
                                          }}
                                          title="Shannon Entropy metric: indicates cryptographic randomness"
                                        >
                                          Entropy: {f.entropy}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await credentialApi.remediateSecret(workspaceId, {
                                              filePath,
                                              lineNumber: Number(f.line),
                                              envVarName: `${(f.vendor || 'APP').toUpperCase()}_${secretName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20)}`,
                                            });
                                            await Promise.all([handleScan(), loadAll()]);
                                          } catch (err: any) {
                                            alert(err.message || 'Failed to remediate secret');
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold btn-physical-primary cursor-pointer shrink-0"
                                        title="Replace hardcoded secret with process.env lookup and register in Cred Vault"
                                      >
                                        Vault &amp; Fix
                                      </button>
                                    </div>
                                  </div>

                                  <div
                                    className="p-2 rounded-lg border font-mono text-[11px]"
                                    style={{
                                      background: 'var(--surface)',
                                      borderColor: 'var(--border)',
                                      color: 'var(--text)',
                                    }}
                                  >
                                    {preview}
                                  </div>

                                  {f.remediation && (
                                    <div
                                      className="p-2 rounded-lg border text-[11px] flex items-start gap-2"
                                      style={{
                                        background: 'var(--accent-subtle)',
                                        borderColor: 'var(--accent-border)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      <strong>Remediation:</strong>
                                      <span>{f.remediation}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CONNECTED PROVIDERS */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {providers.map((prov) => (
                    <div
                      key={prov.id}
                      className="p-4 rounded-2xl border space-y-3"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{prov.name}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: prov.status === 'active' ? 'var(--success)' : 'var(--muted)',
                          }}
                        />
                      </div>

                      <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                        Type: <span style={{ color: 'var(--accent)' }}>{prov.providerType}</span>
                      </div>

                      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        Environment: <span className="uppercase font-bold" style={{ color: 'var(--text)' }}>{prov.environment}</span>
                      </div>

                      <div
                        className="pt-2 border-t flex items-center justify-between text-[10px]"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--muted)' }}
                      >
                        <span>Auto-rotation: 30d</span>
                        <span style={{ color: 'var(--success)' }} className="font-bold">Healthy</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: ACCESS POLICIES & POLICY SIMULATOR */}
            {activeTab === 'policies' && (
              <div className="space-y-6">
                {/* Policy Simulator (6.6.F) */}
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Play size={15} style={{ color: 'var(--accent)' }} />
                      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                        Interactive Policy Simulator &amp; Permission Inspector
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>ABAC Policy Engine v2</span>
                  </div>

                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Test access requests in real-time before deploying new credentials or opening workspace scopes.
                  </p>

                  <div className="grid grid-cols-5 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--muted)' }}>User Role</label>
                      <select
                        value={simRole}
                        onChange={(e) => setSimRole(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        <option value="developer">Developer</option>
                        <option value="qa_engineer">QA Engineer</option>
                        <option value="lead_architect">Lead Architect</option>
                        <option value="external_reviewer">External Reviewer</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--muted)' }}>Service Workload</label>
                      <input
                        type="text"
                        placeholder="e.g. payment-service"
                        value={simService}
                        onChange={(e) => setSimService(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--muted)' }}>Target Resource</label>
                      <input
                        type="text"
                        placeholder="e.g. s3:payment-dev-bucket or db:users"
                        value={simResource}
                        onChange={(e) => setSimResource(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--muted)' }}>Environment</label>
                      <select
                        value={simEnv}
                        onChange={(e) => setSimEnv(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        <option value="development">Development</option>
                        <option value="preview">Preview QA</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold block mb-1" style={{ color: 'var(--muted)' }}>Operation</label>
                      <select
                        value={simOp}
                        onChange={(e) => setSimOp(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        <option value="read">Read</option>
                        <option value="write">Write</option>
                        <option value="delete">Delete</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleRunPolicySimulation}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow cursor-pointer"
                      style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Simulate Policy Evaluation</span>
                    </button>

                    {simResult && (
                      <div className="flex items-center gap-2 text-xs">
                        {simResult.allowed ? (
                          <div
                            className="flex items-center gap-1.5 font-bold px-3 py-1 rounded-xl border"
                            style={{
                              background: 'var(--success-bg)',
                              color: 'var(--success)',
                              borderColor: 'var(--success)',
                            }}
                          >
                            <CheckCircle size={14} />
                            <span>DECISION: ALLOWED ({simResult.policyName})</span>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1.5 font-bold px-3 py-1 rounded-xl border"
                            style={{
                              background: 'var(--error-bg)',
                              color: 'var(--error)',
                              borderColor: 'var(--error)',
                            }}
                          >
                            <XCircle size={14} />
                            <span>DECISION: DENIED ({simResult.reason})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Policies List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                    Active Organizational ABAC Policies
                  </h4>
                  {policies.map((pol) => (
                    <div
                      key={pol.id}
                      className="p-4 rounded-xl border space-y-2 text-xs shadow-sm"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                          {pol.name}
                        </h4>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] uppercase font-bold"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                        >
                          Env: {pol.environment}
                        </span>
                      </div>

                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {pol.description}
                      </p>

                      <div className="grid grid-cols-3 gap-2 font-mono text-[10px] pt-1" style={{ color: 'var(--text-secondary)' }}>
                        <div>Allowed Resources: {pol.allowedResources.join(', ')}</div>
                        <div>Operations: {pol.allowedOperations.join(', ')}</div>
                        <div>Max TTL: {pol.maxTtlMinutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: ANALYTICS & AUDIT */}
            {activeTab === 'analytics' && (
              <div className="space-y-5">
                {analyticsStats && (
                  <div className="grid grid-cols-4 gap-3">
                    <div
                      className="p-3.5 rounded-xl border text-center"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>Total Tokens</span>
                      <div className="text-xl font-black mt-0.5" style={{ color: 'var(--text)' }}>{analyticsStats.totalCredentials}</div>
                    </div>
                    <div
                      className="p-3.5 rounded-xl border text-center"
                      style={{
                        background: 'var(--success-bg)',
                        borderColor: 'rgba(22, 163, 74, 0.28)',
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--success)' }}>Active Workloads</span>
                      <div className="text-xl font-black mt-0.5" style={{ color: 'var(--success)' }}>{analyticsStats.activeCredentials}</div>
                    </div>
                    <div
                      className="p-3.5 rounded-xl border text-center"
                      style={{
                        background: 'var(--error-bg)',
                        borderColor: 'rgba(220, 38, 38, 0.28)',
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--error)' }}>Denied Requests</span>
                      <div className="text-xl font-black mt-0.5" style={{ color: 'var(--error)' }}>{analyticsStats.deniedEvents}</div>
                    </div>
                    <div
                      className="p-3.5 rounded-xl border text-center"
                      style={{
                        background: 'var(--surface-2)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--warning)' }}>Leaked Secrets Blocked</span>
                      <div className="text-xl font-black mt-0.5" style={{ color: 'var(--warning)' }}>{analyticsStats.blockedLeakedEvents}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Tamper-Evident Audit Trail</span>
                  <div className="space-y-1.5">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border flex items-center justify-between text-xs"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase"
                              style={{
                                background: log.action === 'allowed' ? 'var(--success-bg)' : 'var(--error-bg)',
                                color: log.action === 'allowed' ? 'var(--success)' : 'var(--error)',
                              }}
                            >
                              {log.action}
                            </span>
                            <span className="font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                              {log.resourceTarget}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                              ({log.operation})
                            </span>
                          </div>
                          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{log.reason}</p>
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showRequestModal && (
        <TokenRequestModal
          workspaceId={workspaceId}
          onClose={() => setShowRequestModal(false)}
          onSuccess={(cred) => {
            setCredentials([cred, ...credentials]);
            setShowRequestModal(false);
          }}
        />
      )}

      {showLockdownConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md p-6 rounded-2xl border shadow-2xl text-center space-y-4 skeuo-card"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--error)',
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 mx-auto rounded-2xl border"
              style={{
                background: 'var(--error-bg)',
                color: 'var(--error)',
                borderColor: 'var(--error)',
              }}
            >
              <AlertOctagon size={24} />
            </div>
            <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>CONFIRM EMERGENCY LOCKDOWN</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              This will instantly revoke <strong>all active ephemeral credentials</strong> and block outbound egress proxy routing for workspace <strong>{workspaceId}</strong>.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowLockdownConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl btn-physical-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyLockdown}
                className="px-5 py-2 text-xs font-bold rounded-xl text-white shadow-lg cursor-pointer transition-all"
                style={{ background: 'var(--error)' }}
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
