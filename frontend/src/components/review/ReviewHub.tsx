import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Server,
  Smartphone,
  Monitor,
  Database,
  Terminal,
  Cpu,
  Layers,
  Network,
  Plus,
  MapPin,
  FileText,
  Split,
  ShieldCheck,
  Users,
  GitBranch,
  GitPullRequest,
  X,
  Maximize2,
} from 'lucide-react';
import type {
  PreviewEnvironment,
  PreviewAnnotation,
  ReviewMemo,
  PreviewEnvironmentType,
  AnnotationType,
} from '../../types';
import { reviewApi } from '../../services/reviewApi';
import { TechnicalAnnotationPanel } from './TechnicalAnnotationPanel';
import { ReviewMemoModal } from './ReviewMemoModal';
import { EnvironmentComparisonModal } from './EnvironmentComparisonModal';
import { AutomatedTestReportModal } from './AutomatedTestReportModal';

// Dedicated universal review surfaces
import { WebPreviewSurface } from './surfaces/WebPreviewSurface';
import { BackendPreviewSurface } from './surfaces/BackendPreviewSurface';
import { MobilePreviewSurface } from './surfaces/MobilePreviewSurface';
import { DesktopPreviewSurface } from './surfaces/DesktopPreviewSurface';
import { DatabasePreviewSurface } from './surfaces/DatabasePreviewSurface';
import { CliPreviewSurface } from './surfaces/CliPreviewSurface';
import { AIMLPreviewSurface } from './surfaces/AIMLPreviewSurface';
import { DistributedPreviewSurface } from './surfaces/DistributedPreviewSurface';
import { InfrastructurePreviewSurface } from './surfaces/InfrastructurePreviewSurface';

export interface ReviewHubCollaborator {
  id?: string | number;
  username: string;
  color?: string;
  role?: string;
}

interface Props {
  workspaceId: string;
  previewPort: number | null;
  onPortChange?: (port: number) => void;
  onOpenCodeReviews?: () => void;
  onOpenInIDE?: (filePath: string) => void;
  onLaunchDevServer?: () => void;
  openReviewsCount?: number;
  currentUsername?: string;
  currentUserRole?: string;
  collaborators?: ReviewHubCollaborator[];
}

export function ReviewHub({
  workspaceId,
  previewPort,
  onPortChange,
  onOpenCodeReviews,
  onOpenInIDE,
  onLaunchDevServer,
  openReviewsCount,
  currentUsername,
  currentUserRole,
  collaborators = [],
}: Props) {
  const [previews, setPreviews] = useState<PreviewEnvironment[]>([]);
  const [activePreview, setActivePreview] = useState<PreviewEnvironment | null>(null);
  const [annotations, setAnnotations] = useState<PreviewAnnotation[]>([]);
  const [memo, setMemo] = useState<ReviewMemo | null>(null);
  const [loading, setLoading] = useState(true);

  // Interaction State
  const [pinModeActive, setPinModeActive] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeSurfaceTab, setActiveSurfaceTab] = useState<'visual' | 'technical'>('visual');
  const [syncNavEnabled, setSyncNavEnabled] = useState(true);

  // Inspector Drawer (Flaw 1 resolved: Non-blocking side panel)
  const [inspectorMode, setInspectorMode] = useState<'tests' | 'compare' | 'memo' | null>(null);
  const [isModalView, setIsModalView] = useState(false);

  // Modals
  const [showNewPreviewModal, setShowNewPreviewModal] = useState(false);

  // New Preview Form State
  const [newPreviewType, setNewPreviewType] = useState<PreviewEnvironmentType>('web');
  const [newPreviewName, setNewPreviewName] = useState('');

  // Active production presence: authenticated user + real online peers
  const activeReviewers = useMemo(() => {
    const list = [
      {
        id: 'me',
        name: currentUsername || 'You',
        role: currentUserRole || 'Developer',
        color: '#e8420c',
      },
    ];

    if (collaborators && collaborators.length > 0) {
      collaborators.forEach((c, idx) => {
        if (c.username && c.username !== currentUsername && !list.some(l => l.name === c.username)) {
          list.push({
            id: String(c.id || idx),
            name: c.username,
            role: c.role || 'Reviewer',
            color: c.color || '#3b82f6',
          });
        }
      });
    }

    return list;
  }, [currentUsername, currentUserRole, collaborators]);

  useEffect(() => {
    loadPreviews();
  }, [workspaceId]);

  useEffect(() => {
    if (activePreview) {
      loadPreviewDetails(activePreview.id);
    }
  }, [activePreview?.id]);

  const loadPreviews = async () => {
    setLoading(true);
    try {
      const list = await reviewApi.getPreviews(workspaceId);
      setPreviews(list);
      if (list.length > 0) {
        setActivePreview(list[0]);
      } else {
        // Auto-provision initial web preview if none exists
        const initial = await reviewApi.createPreview(workspaceId, {
          name: 'Primary Web Application Preview',
          type: 'web',
          port: previewPort || 5173,
        });
        setPreviews([initial]);
        setActivePreview(initial);
      }
    } catch (err) {
      console.error('Failed to load previews:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreviewDetails = async (previewId: string) => {
    try {
      const [annList, memoData] = await Promise.all([
        reviewApi.getAnnotations(previewId),
        reviewApi.getMemo(previewId),
      ]);
      setAnnotations(annList);
      setMemo(memoData);
    } catch (err) {
      console.error('Failed to load preview details:', err);
    }
  };

  const handleCreatePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await reviewApi.createPreview(workspaceId, {
        name: newPreviewName.trim() || `${newPreviewType.toUpperCase()} Preview`,
        type: newPreviewType,
        port: previewPort || 5173,
      });
      setPreviews([created, ...previews]);
      setActivePreview(created);
      setShowNewPreviewModal(false);
      setNewPreviewName('');
    } catch (err: any) {
      alert(`Provisioning error: ${err.message}`);
    }
  };

  const handleAddPin = async (
    coords: { x: number; y: number },
    payload: { title: string; comment: string; type: AnnotationType; priority: string; severity: string }
  ) => {
    if (!activePreview) return;
    try {
      const annotation = await reviewApi.createAnnotation(activePreview.id, {
        surface: activePreview.type === 'web' || activePreview.type === 'mobile' ? 'web' : 'desktop',
        title: payload.title,
        comment: payload.comment,
        type: payload.type,
        priority: payload.priority as any,
        severity: payload.severity as any,
        coordinates: {
          x: coords.x,
          y: coords.y,
        },
      });
      setAnnotations([...annotations, annotation]);
      setPinModeActive(false);
    } catch (err: any) {
      alert(`Failed to add pin: ${err.message}`);
    }
  };

  const handleUpdateAnnotation = async (id: string, payload: Partial<PreviewAnnotation>) => {
    try {
      const updated = await reviewApi.updateAnnotation(id, payload);
      setAnnotations(annotations.map((a) => (a.id === id ? updated : a)));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleAddReply = async (annotationId: string, comment: string) => {
    try {
      const res = await reviewApi.addReply(annotationId, comment);
      setAnnotations(annotations.map((a) => (a.id === annotationId ? res.annotation : a)));
    } catch (err: any) {
      alert(`Reply error: ${err.message}`);
    }
  };

  const handleAddTechnicalAnnotation = async (payload: Partial<PreviewAnnotation>) => {
    if (!activePreview) return;
    try {
      const annotation = await reviewApi.createAnnotation(activePreview.id, payload);
      setAnnotations([...annotations, annotation]);
    } catch (err: any) {
      alert(`Failed to attach technical finding: ${err.message}`);
    }
  };

  const handleUpdateMemo = async (payload: Partial<ReviewMemo>) => {
    if (!activePreview) return;
    try {
      const updated = await reviewApi.updateMemo(activePreview.id, payload);
      setMemo(updated);
    } catch (err: any) {
      alert(`Memo update error: ${err.message}`);
    }
  };

  const getTypeIcon = (type: PreviewEnvironmentType) => {
    switch (type) {
      case 'web':
        return Globe;
      case 'backend':
        return Server;
      case 'mobile':
        return Smartphone;
      case 'desktop':
        return Monitor;
      case 'database':
        return Database;
      case 'cli':
        return Terminal;
      case 'ml':
        return Cpu;
      case 'distributed':
        return Network;
      case 'infrastructure':
        return Layers;
      default:
        return Layers;
    }
  };

  const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';
  const previewProxyUrl = `${BASE_URL}/api/preview/${workspaceId}/${previewPort ? `?_port=${previewPort}` : ''}`;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Top Environment Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0 transition-colors"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--muted)' }}>
            Previews:
          </span>

          {previews.map((prev) => {
            const Icon = getTypeIcon(prev.type);
            const isActive = prev.id === activePreview?.id;
            return (
              <button
                key={prev.id}
                onClick={() => setActivePreview(prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                  borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                  color: isActive ? 'var(--accent-fg)' : 'var(--text)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Icon size={14} />
                <span>{prev.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({prev.revisionId})</span>
              </button>
            );
          })}

          <button
            onClick={() => setShowNewPreviewModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-dashed"
            style={{
              background: 'transparent',
              borderColor: 'var(--border)',
              color: 'var(--muted)',
            }}
          >
            <Plus size={14} />
            <span>New Environment</span>
          </button>
        </div>

        {/* Global Review Actions & Presence */}
        <div className="flex items-center gap-2.5">
          {/* Active Reviewers Presence Avatars */}
          <div
            className="flex items-center -space-x-1.5 px-2 py-1 rounded-xl border"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          >
            {activeReviewers.map((rev) => (
              <div
                key={rev.id}
                title={`${rev.name} (${rev.role}) - Online`}
                className="w-5 h-5 rounded-full ring-2 flex items-center justify-center text-[10px] font-bold text-white uppercase select-none relative"
                style={{
                  backgroundColor: rev.color,
                  borderColor: 'var(--surface-2)',
                }}
              >
                {rev.name[0]}
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-white" />
              </div>
            ))}
          </div>

          {/* Synchronized Navigation Toggle */}
          <button
            onClick={() => setSyncNavEnabled(!syncNavEnabled)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
            style={{
              background: syncNavEnabled ? 'var(--accent-subtle)' : 'var(--surface-2)',
              borderColor: syncNavEnabled ? 'var(--accent-border)' : 'var(--border)',
              color: syncNavEnabled ? 'var(--accent)' : 'var(--muted)',
            }}
            title="When active, all reviewers navigate the application in synchronized lockstep"
          >
            <Users size={13} />
            <span>Sync Nav {syncNavEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Compare Revisions */}
          <button
            onClick={() => {
              setInspectorMode(m => m === 'compare' ? null : 'compare');
              setIsModalView(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              inspectorMode === 'compare' ? 'btn-physical-primary' : ''
            }`}
            style={{
              background: inspectorMode === 'compare' ? undefined : 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: inspectorMode === 'compare' ? '#fff' : 'var(--text)',
            }}
          >
            <Split size={14} />
            <span>Compare</span>
          </button>

          {/* Testing Suite & Contract Runner */}
          <button
            onClick={() => {
              setInspectorMode(m => m === 'tests' ? null : 'tests');
              setIsModalView(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              inspectorMode === 'tests' ? 'btn-physical-primary' : ''
            }`}
            style={{
              background: inspectorMode === 'tests' ? undefined : 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: inspectorMode === 'tests' ? '#fff' : 'var(--text)',
            }}
          >
            <ShieldCheck size={14} />
            <span>Test Suite</span>
          </button>

          {/* Integrated Code & PR Reviews */}
          {onOpenCodeReviews && (
            <button
              onClick={onOpenCodeReviews}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              title="Open Code & Pull Request Reviews"
            >
              <GitPullRequest size={14} className="text-purple-400" />
              <span>Code Reviews</span>
              {(openReviewsCount ?? 0) > 0 && (
                <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-black font-mono">
                  {openReviewsCount}
                </span>
              )}
            </button>
          )}

          {/* Structured Review Memo */}
          <button
            onClick={() => {
              setInspectorMode(m => m === 'memo' ? null : 'memo');
              setIsModalView(false);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow transition-all cursor-pointer ${
              inspectorMode === 'memo' ? 'btn-physical-primary ring-2 ring-[var(--accent)]' : ''
            }`}
            style={{
              background: inspectorMode === 'memo' ? undefined : 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <FileText size={14} />
            <span>Review Memo</span>
            {memo && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Revision-Aware Banner (Feature 5.7) */}
      {activePreview && (
        <div
          className="flex items-center justify-between px-4 py-1.5 border-b text-[11px] font-mono shrink-0"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        >
          <div className="flex items-center gap-2">
            <GitBranch size={13} style={{ color: 'var(--accent)' }} />
            <span>Reviewing Immutable Snapshot: <strong>{activePreview.revisionId}</strong></span>
            <span style={{ color: 'var(--muted)' }}>|</span>
            <span style={{ color: 'var(--text-secondary)' }}>Target Workspace: {workspaceId}</span>
            <span style={{ color: 'var(--muted)' }}>|</span>
            <span style={{ color: 'var(--success)' }}>Environment Ready</span>
          </div>
          <button
            onClick={() => {
              setInspectorMode('compare');
              setIsModalView(false);
            }}
            className="text-xs underline cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            Check for Unreviewed Commits
          </button>
        </div>
      )}

      {/* Surface Sub-Header & Pin Drop Controls */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Surface View Switcher */}
          <div
            className="flex items-center p-0.5 rounded-xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setActiveSurfaceTab('visual')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={{
                background: activeSurfaceTab === 'visual' ? 'var(--surface-2)' : 'transparent',
                color: activeSurfaceTab === 'visual' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              <Globe size={13} />
              <span>Interactive {activePreview?.type?.toUpperCase() || 'UI'} Surface</span>
            </button>

            <button
              onClick={() => setActiveSurfaceTab('technical')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={{
                background: activeSurfaceTab === 'technical' ? 'var(--surface-2)' : 'transparent',
                color: activeSurfaceTab === 'technical' ? 'var(--text)' : 'var(--muted)',
              }}
            >
              <Server size={13} />
              <span>Technical Findings</span>
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-mono text-white"
                style={{ background: 'var(--accent)' }}
              >
                {annotations.length}
              </span>
            </button>
          </div>

          {/* Figma-Style Pin Mode Button */}
          {activeSurfaceTab === 'visual' && (activePreview?.type === 'web' || activePreview?.type === 'mobile' || activePreview?.type === 'desktop') && (
            <button
              onClick={() => setPinModeActive(!pinModeActive)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border"
              style={{
                background: pinModeActive ? 'var(--error)' : 'var(--surface)',
                color: pinModeActive ? '#fff' : 'var(--text)',
                borderColor: pinModeActive ? 'var(--error)' : 'var(--border)',
              }}
            >
              <MapPin size={13} />
              <span>{pinModeActive ? 'Drop Pin Active (Click UI)' : 'Drop Figma Pin'}</span>
            </button>
          )}
        </div>

        {/* Viewport Resizer Controls */}
        {activeSurfaceTab === 'visual' && activePreview?.type === 'web' && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center p-0.5 rounded-lg border text-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => setViewportMode('desktop')}
                className="p-1 rounded cursor-pointer"
                style={{
                  background: viewportMode === 'desktop' ? 'var(--surface-2)' : 'transparent',
                  color: viewportMode === 'desktop' ? 'var(--text)' : 'var(--muted)',
                }}
                title="Desktop 100% View"
              >
                <Monitor size={14} />
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className="p-1 rounded cursor-pointer"
                style={{
                  background: viewportMode === 'tablet' ? 'var(--surface-2)' : 'transparent',
                  color: viewportMode === 'tablet' ? 'var(--text)' : 'var(--muted)',
                }}
                title="Tablet 768px View"
              >
                <Smartphone size={14} className="rotate-90" />
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className="p-1 rounded cursor-pointer"
                style={{
                  background: viewportMode === 'mobile' ? 'var(--surface-2)' : 'transparent',
                  color: viewportMode === 'mobile' ? 'var(--text)' : 'var(--muted)',
                }}
                title="Mobile 375px View"
              >
                <Smartphone size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Review Surface Area with Non-blocking Split Inspector Pane (Flaw 1 resolved) */}
      <div className="flex-1 relative overflow-hidden flex flex-row w-full h-full" style={{ background: 'var(--bg)' }}>
        {/* Left: Active Review Surface */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0 h-full">
          {loading && previews.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted)' }}>
              Provisioning isolated review environment...
            </div>
          ) : activeSurfaceTab === 'technical' ? (
            <TechnicalAnnotationPanel
              annotations={annotations}
              previewType={activePreview?.type || 'backend'}
              onAddAnnotation={handleAddTechnicalAnnotation}
              onUpdateAnnotation={handleUpdateAnnotation}
              onAddReply={handleAddReply}
            />
          ) : (
            (() => {
              switch (activePreview?.type) {
                case 'web':
                  return (
                    <WebPreviewSurface
                      previewUrl={previewProxyUrl}
                      previewPort={previewPort}
                      onPortChange={onPortChange}
                      onLaunchDevServer={onLaunchDevServer}
                      viewportMode={viewportMode}
                      pinModeActive={pinModeActive}
                      annotations={annotations}
                      onAddPin={handleAddPin}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onAddReply={handleAddReply}
                    />
                  );
                case 'backend':
                  return (
                    <BackendPreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                      onAddReply={handleAddReply}
                    />
                  );
                case 'mobile':
                  return (
                    <MobilePreviewSurface
                      previewUrl={previewProxyUrl}
                      pinModeActive={pinModeActive}
                      annotations={annotations}
                      onAddPin={handleAddPin}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onAddReply={handleAddReply}
                    />
                  );
                case 'desktop':
                  return (
                    <DesktopPreviewSurface
                      previewUrl={previewProxyUrl}
                      pinModeActive={pinModeActive}
                      annotations={annotations}
                      onAddPin={handleAddPin}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onAddReply={handleAddReply}
                    />
                  );
                case 'database':
                  return (
                    <DatabasePreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                    />
                  );
                case 'cli':
                  return (
                    <CliPreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                    />
                  );
                case 'ml':
                  return (
                    <AIMLPreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                    />
                  );
                case 'distributed':
                  return (
                    <DistributedPreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                    />
                  );
                case 'infrastructure':
                  return (
                    <InfrastructurePreviewSurface
                      annotations={annotations}
                      onAddTechnicalAnnotation={handleAddTechnicalAnnotation}
                    />
                  );
                default:
                  return (
                    <WebPreviewSurface
                      previewUrl={previewProxyUrl}
                      previewPort={previewPort}
                      onPortChange={onPortChange}
                      onLaunchDevServer={onLaunchDevServer}
                      viewportMode={viewportMode}
                      pinModeActive={pinModeActive}
                      annotations={annotations}
                      onAddPin={handleAddPin}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onAddReply={handleAddReply}
                    />
                  );
              }
            })()
          )}
        </div>

        {/* Right: Non-blocking Review Inspector Pane */}
        {inspectorMode && !isModalView && (
          <div
            className="w-[480px] xl:w-[540px] h-full border-l flex flex-col shrink-0 animate-fadeIn z-30"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b shrink-0"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setInspectorMode('tests')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inspectorMode === 'tests' ? 'btn-physical-primary' : 'btn-physical-surface'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span>Test Suite</span>
                </button>
                <button
                  onClick={() => setInspectorMode('compare')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inspectorMode === 'compare' ? 'btn-physical-primary' : 'btn-physical-surface'
                  }`}
                >
                  <Split size={13} />
                  <span>Compare</span>
                </button>
                <button
                  onClick={() => setInspectorMode('memo')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inspectorMode === 'memo' ? 'btn-physical-primary' : 'btn-physical-surface'
                  }`}
                >
                  <FileText size={13} />
                  <span>Review Memo</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsModalView(true)}
                  className="p-1 rounded-lg btn-physical-surface cursor-pointer text-[var(--muted)]"
                  title="Expand to Fullscreen Modal"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => setInspectorMode(null)}
                  className="p-1 rounded-lg btn-physical-surface cursor-pointer text-[var(--muted)]"
                  title="Close Inspector"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {inspectorMode === 'tests' && activePreview && (
                <AutomatedTestReportModal
                  previewId={activePreview.id}
                  isEmbedded={true}
                  onOpenInIDE={onOpenInIDE}
                />
              )}
              {inspectorMode === 'compare' && (
                <div className="flex-1 overflow-y-auto">
                  <EnvironmentComparisonModal
                    workspaceId={workspaceId}
                    onClose={() => setInspectorMode(null)}
                  />
                </div>
              )}
              {inspectorMode === 'memo' && (
                <div className="flex-1 overflow-y-auto">
                  <ReviewMemoModal
                    memo={memo}
                    annotations={annotations}
                    onClose={() => setInspectorMode(null)}
                    onUpdateMemo={handleUpdateMemo}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Modals when explicitly requested via expand */}
      {isModalView && (
        <>
          {inspectorMode === 'tests' && activePreview && (
            <AutomatedTestReportModal
              previewId={activePreview.id}
              onClose={() => { setInspectorMode(null); setIsModalView(false); }}
              onOpenInIDE={onOpenInIDE}
            />
          )}
          {inspectorMode === 'compare' && (
            <EnvironmentComparisonModal
              workspaceId={workspaceId}
              onClose={() => { setInspectorMode(null); setIsModalView(false); }}
            />
          )}
          {inspectorMode === 'memo' && (
            <ReviewMemoModal
              memo={memo}
              annotations={annotations}
              onClose={() => { setInspectorMode(null); setIsModalView(false); }}
              onUpdateMemo={handleUpdateMemo}
            />
          )}
        </>
      )}

      {/* New Preview Provision Modal (Styled after Web Preview schematic & skeuo system) */}
      {showNewPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg p-6 rounded-2xl border shadow-2xl skeuo-card select-text"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 border shrink-0"
              style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
            >
              <Globe size={22} />
            </div>

            <h3 className="text-base font-extrabold text-[var(--text)] mb-1 tracking-tight">
              Provision Preview Environment
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">
              Spin up an isolated, reviewable environment representing workspace revision <code className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{activePreview?.revisionId || 'HEAD'}</code>.
            </p>

            <form onSubmit={handleCreatePreview} className="space-y-4">
              <div className="p-3.5 rounded-xl border skeuo-card" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                  Environment Identifier / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging QA Preview"
                  value={newPreviewName}
                  onChange={(e) => setNewPreviewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border outline-none font-mono"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text)' }}>
                  Target Runtime Architecture
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'web', label: 'Web App', icon: Globe },
                    { id: 'backend', label: 'Backend API', icon: Server },
                    { id: 'mobile', label: 'Mobile Device', icon: Smartphone },
                    { id: 'desktop', label: 'Desktop Remote', icon: Monitor },
                    { id: 'database', label: 'Database Sandbox', icon: Database },
                    { id: 'cli', label: 'CLI & Terminal', icon: Terminal },
                    { id: 'ml', label: 'AI/ML Model', icon: Cpu },
                    { id: 'distributed', label: 'Distributed Mesh', icon: Network },
                    { id: 'infrastructure', label: 'Infra (IaC)', icon: Layers },
                  ].map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = newPreviewType === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewPreviewType(cat.id as PreviewEnvironmentType)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected ? 'btn-physical-primary' : 'btn-physical-surface'
                        }`}
                        style={{
                          background: isSelected ? 'var(--accent-subtle)' : 'var(--surface-2)',
                          borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                          color: isSelected ? 'var(--accent)' : 'var(--muted)',
                        }}
                      >
                        <CatIcon size={16} style={{ color: isSelected ? 'var(--accent)' : 'var(--muted)' }} />
                        <span className="text-[11px] font-bold mt-2">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowNewPreviewModal(false)}
                  className="btn-physical-surface text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-physical-primary text-xs px-4 py-2"
                >
                  Provision Environment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
