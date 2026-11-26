import { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  RotateCw,
  GitBranch,
  ShieldCheck,
  Activity,
  Play,
  Server,
} from 'lucide-react';
import type { GoldenPathBlueprint, IDPExecution, IDPPolicy } from '../../types';
import { goldenPathApi } from '../../services/goldenPathApi';
import { ProvisioningWizardModal } from './ProvisioningWizardModal';
import { DependencyGraphVisualizer } from './DependencyGraphVisualizer';

interface Props {
  workspaceId: string;
}

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'backend', label: 'Backend' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'ai_ml', label: 'AI/ML' },
  { id: 'distributed', label: 'Distributed' },
];

export function GoldenPathHub({ workspaceId }: Props) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'active_dag' | 'drift' | 'governance' | 'analytics'>('catalog');
  const [blueprints, setBlueprints] = useState<GoldenPathBlueprint[]>([]);
  const [executions, setExecutions] = useState<IDPExecution[]>([]);
  const [activeExecution, setActiveExecution] = useState<IDPExecution | null>(null);
  const [policies, setPolicies] = useState<IDPPolicy[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Wizard Modal
  const [selectedBlueprintForWizard, setSelectedBlueprintForWizard] = useState<GoldenPathBlueprint | null>(null);

  useEffect(() => {
    loadAll();
  }, [workspaceId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bpList, execList, polList, analyticsData] = await Promise.all([
        goldenPathApi.getBlueprints(),
        goldenPathApi.getWorkspaceExecutions(workspaceId),
        goldenPathApi.getPolicies(),
        goldenPathApi.getPlatformAnalytics(),
      ]);
      setBlueprints(bpList);
      setExecutions(execList);
      if (execList.length > 0) {
        setActiveExecution(execList[0]);
      }
      setPolicies(polList);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to load IDP Golden Paths:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckDrift = async (executionId: string) => {
    try {
      const result = await goldenPathApi.checkDrift(executionId);
      const updated = await goldenPathApi.getExecutionById(executionId);
      setActiveExecution(updated);
      setExecutions(executions.map((e) => (e.id === executionId ? updated : e)));
      alert(
        result.hasDrift
          ? `DRIFT DETECTED: Found ${result.driftStatus?.driftDetails?.length || 0} deviations from upstream blueprint.`
          : 'NO DRIFT: Project configuration matches expected blueprint specifications.'
      );
    } catch (err: any) {
      alert(`Drift check failed: ${err.message}`);
    }
  };

  const handleApplyUpdate = async (executionId: string) => {
    try {
      const updated = await goldenPathApi.applyUpstreamUpdate(executionId);
      setActiveExecution(updated);
      setExecutions(executions.map((e) => (e.id === executionId ? updated : e)));
      alert(`SUCCESS: Upstream update applied. Version is now v${updated.blueprintVersion}.`);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const filteredBlueprints = blueprints.filter((b) => {
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchDesc = b.description.toLowerCase().includes(q);
      const matchTag = b.tags.some((t) => t.toLowerCase().includes(q));
      return matchName || matchDesc || matchTag;
    }
    return true;
  });

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Top Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0 transition-colors"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl border"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              borderColor: 'var(--accent-border)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                Internal Developer Platform (IDP) &amp; Golden Paths
              </h2>
              <span
                className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border font-mono"
                style={{
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                Proprietary Orchestrator
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Enterprise engineering standardization, Backstage/Copier/Terraform/Helm orchestration &amp; lifecycle governance.
            </p>
          </div>
        </div>

        {activeExecution && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCheckDrift(activeExecution.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <RotateCw size={13} style={{ color: 'var(--accent)' }} />
              <span>Check Config Drift</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div
        className="flex items-center gap-2 px-6 py-2.5 border-b text-xs font-semibold shrink-0"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        {[
          { id: 'catalog', label: `Golden Path Catalog (${blueprints.length})`, icon: Layers },
          { id: 'active_dag', label: `Service Provisioning DAG (${activeExecution ? activeExecution.projectName : 'None'})`, icon: Server },
          { id: 'drift', label: 'Project Evolution & Drift', icon: GitBranch },
          { id: 'governance', label: `Governance Rules (${policies.length})`, icon: ShieldCheck },
          { id: 'analytics', label: 'Platform Analytics', icon: Activity },
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
            Loading Golden Path Platform State...
          </div>
        ) : (
          <>
            {/* TAB 1: BLUEPRINT CATALOG */}
            {activeTab === 'catalog' && (
              <div className="space-y-5">
                {/* Search & Category Filter Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search
                      size={14}
                      className="absolute left-3 top-2.5"
                      style={{ color: 'var(--muted)' }}
                    />
                    <input
                      type="text"
                      placeholder="Search blueprints by name, tech stack, or tags (e.g. Go, Next.js, Kafka)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    {CATEGORIES.map((cat) => {
                      const isSelected = categoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.id)}
                          className="px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border"
                          style={{
                            background: isSelected ? 'var(--accent)' : 'var(--surface)',
                            borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                            color: isSelected ? 'var(--accent-fg)' : 'var(--muted)',
                          }}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Blueprint Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBlueprints.map((bp) => (
                    <div
                      key={bp.id}
                      className="p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border"
                                style={{
                                  background: 'var(--accent-subtle)',
                                  color: 'var(--accent)',
                                  borderColor: 'var(--accent-border)',
                                }}
                              >
                                {bp.sourceProvider}
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                                v{bp.version}
                              </span>
                              {bp.approved && (
                                <span
                                  className="flex items-center gap-1 text-[10px] font-semibold"
                                  style={{ color: 'var(--success)' }}
                                >
                                  <CheckCircle2 size={12} /> Approved
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold mt-1.5" style={{ color: 'var(--text)' }}>
                              {bp.name}
                            </h3>
                          </div>

                          <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                            {bp.ownerTeam}
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {bp.description}
                        </p>

                        {/* Tags */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {bp.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[10px] border font-mono"
                              style={{
                                background: 'var(--surface-2)',
                                borderColor: 'var(--border)',
                                color: 'var(--muted)',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div
                        className="pt-3 border-t flex items-center justify-between"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                          <strong style={{ color: 'var(--text)' }}>{bp.dependencyGraph.length}</strong> supporting services
                        </span>

                        <button
                          onClick={() => setSelectedBlueprintForWizard(bp)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow cursor-pointer transition-all"
                          style={{
                            background: 'var(--accent)',
                            color: 'var(--accent-fg)',
                          }}
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Scaffold with Golden Path</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ACTIVE SERVICE PROVISIONING DAG */}
            {activeTab === 'active_dag' && (
              <div className="h-[600px]">
                {activeExecution ? (
                  <DependencyGraphVisualizer
                    graphStatus={activeExecution.dependencyGraphStatus || {}}
                    dependencyGraph={activeExecution.blueprint?.dependencyGraph || []}
                    logs={activeExecution.logs || []}
                  />
                ) : (
                  <div className="text-center py-20 text-xs" style={{ color: 'var(--muted)' }}>
                    <Layers size={28} className="mx-auto mb-2 opacity-40" />
                    <p>No active Golden Path execution in this workspace.</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                      Select a blueprint from the catalog to launch multi-tier service provisioning.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PROJECT EVOLUTION & DRIFT */}
            {activeTab === 'drift' && (
              <div className="space-y-4 max-w-2xl">
                {activeExecution ? (
                  <>
                    <div
                      className="p-4 rounded-2xl border space-y-2"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                          Project Provenance &amp; Versioning
                        </h4>
                        <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>
                          v{activeExecution.blueprintVersion}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        Originating Blueprint: <strong>{activeExecution.blueprint?.name}</strong> via{' '}
                        <strong>{activeExecution.blueprint?.sourceProvider}</strong>.
                      </p>
                    </div>

                    {/* Upstream Updates Available */}
                    {activeExecution.upstreamUpdatesAvailable && (
                      <div
                        className="p-4 rounded-xl border space-y-3"
                        style={{
                          background: 'var(--accent-subtle)',
                          borderColor: 'var(--accent-border)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                            Upstream Update Available: v{activeExecution.upstreamUpdatesAvailable.latestVersion}
                          </span>
                          <button
                            onClick={() => handleApplyUpdate(activeExecution.id)}
                            className="px-3 py-1 text-xs font-bold rounded-lg cursor-pointer"
                            style={{
                              background: 'var(--accent)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            Apply Upstream Update
                          </button>
                        </div>
                        <ul className="list-disc pl-4 text-xs space-y-1" style={{ color: 'var(--text)' }}>
                          {activeExecution.upstreamUpdatesAvailable.changelog.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Drift status */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                        Configuration Drift Analysis
                      </span>
                      {activeExecution.driftStatus?.hasDrift ? (
                        activeExecution.driftStatus.driftDetails?.map((drift: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl border text-xs space-y-1"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--warning)',
                            }}
                          >
                            <span className="font-bold" style={{ color: 'var(--warning)' }}>
                              {drift.component}
                            </span>
                            <p className="text-[11px]" style={{ color: 'var(--text)' }}>
                              {drift.remediation}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div
                          className="p-4 rounded-xl border text-xs flex items-center gap-2"
                          style={{
                            background: 'var(--success-bg)',
                            borderColor: 'var(--success)',
                            color: 'var(--success)',
                          }}
                        >
                          <CheckCircle2 size={16} /> Zero configuration drift detected. Workspace conforms to standards.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-xs" style={{ color: 'var(--muted)' }}>
                    No active project execution to evaluate drift.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: GOVERNANCE RULES */}
            {activeTab === 'governance' && (
              <div className="space-y-3 max-w-2xl">
                {policies.map((pol) => (
                  <div
                    key={pol.id}
                    className="p-4 rounded-xl border space-y-1 text-xs"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold" style={{ color: 'var(--text)' }}>
                        {pol.name}
                      </h4>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--muted)',
                        }}
                      >
                        {pol.enforcement}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {pol.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 5: PLATFORM ANALYTICS */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div
                    className="p-4 rounded-xl border text-center"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                      Total Blueprints
                    </span>
                    <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>
                      {analytics.stats?.totalBlueprints}
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl border text-center"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                      Projects Scaffolded
                    </span>
                    <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--accent)' }}>
                      {analytics.stats?.totalExecutions}
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl border text-center"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                      Orchestration Success
                    </span>
                    <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--success)' }}>
                      {analytics.stats?.successRate}%
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl border text-center"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--muted)' }}>
                      Avg Duration
                    </span>
                    <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>
                      {analytics.stats?.avgProvisioningTimeSeconds}s
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Provisioning Wizard Modal */}
      {selectedBlueprintForWizard && (
        <ProvisioningWizardModal
          blueprint={selectedBlueprintForWizard}
          workspaceId={workspaceId}
          onClose={() => setSelectedBlueprintForWizard(null)}
          onSuccess={(execution) => {
            setActiveExecution(execution);
            setExecutions([execution, ...executions]);
            setSelectedBlueprintForWizard(null);
            setActiveTab('active_dag');
          }}
        />
      )}
    </div>
  );
}
