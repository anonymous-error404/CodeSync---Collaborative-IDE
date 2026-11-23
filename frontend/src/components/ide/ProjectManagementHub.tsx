import { useState, useEffect } from 'react';
import {
  Briefcase,
  ChevronLeft,
  Target,
  CheckCircle2,
  GitPullRequest,
  Terminal,
  Zap,
  Database,
  Layers,
  LayoutGrid,
  Trophy,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type {
  Workspace,
  WorkspaceRole,
  ProjectTask,
  CodeReview,
} from '../../types';
import { KanbanSprintHub } from '../kanban/KanbanSprintHub';
import { ProfessionalPanel } from './ProfessionalPanel';

export type ProjectManagementTab =
  | 'sprint'
  | 'tasks'
  | 'reviews'
  | 'gateway'
  | 'warmpool'
  | 'database'
  | 'mesh';

interface Props {
  workspace: Workspace;
  workspaceType: 'professional' | 'competitive' | 'educational';
  myRole: WorkspaceRole;
  currentUserId: number;
  token: string | null;
  socket?: Socket | null;
  activeFilePath?: string | null;
  initialTab?: ProjectManagementTab;
  openReviewsCount?: number;
  onOpenFile: (filePath: string) => void;
  onClose: () => void;
  // Socket emit hooks
  onTaskCreated?: (task: ProjectTask) => void;
  onTaskUpdated?: (task: ProjectTask) => void;
  onTaskDeleted?: (taskId: number) => void;
  onReviewCreated?: (review: CodeReview) => void;
  onReviewUpdated?: (review: CodeReview) => void;
}

export function ProjectManagementHub({
  workspace,
  workspaceType,
  myRole,
  currentUserId,
  token,
  socket,
  activeFilePath,
  initialTab = 'sprint',
  openReviewsCount = 0,
  onOpenFile,
  onClose,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onReviewCreated,
  onReviewUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<ProjectManagementTab>(initialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Keyboard shortcuts: Escape to close, Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isProfessional = workspaceType === 'professional';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#090d16] text-gray-100 backdrop-blur-xl animate-fade-in"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ─── Top Global Navigation Bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-[#0d131f] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-gray-700/60 transition-all cursor-pointer"
            title="Return to Code Editor (Esc)"
          >
            <ChevronLeft size={14} />
            <span>Back to Editor</span>
          </button>

          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="flex items-center justify-center p-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-gray-700/60 transition-all cursor-pointer"
            title={isSidebarOpen ? 'Collapse Sidebar (Ctrl+B)' : 'Expand Sidebar (Ctrl+B)'}
          >
            {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>

          <div className="w-[1px] h-5 bg-gray-800" />

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm shadow-blue-500/20">
              {workspaceType === 'competitive' ? (
                <Trophy className="w-4 h-4 text-white" />
              ) : (
                <Briefcase className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">
                  {workspace.name}
                </span>
                <span className="text-gray-500 text-xs">/</span>
                <span className="text-xs font-semibold text-blue-400">
                  Project Management
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {workspaceType} Mode
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-800/80 text-gray-300 border border-gray-700/50">
            Role: <strong className="text-white capitalize">{myRole.replace('_', ' ')}</strong>
          </span>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left Sidebar Navigation (Collapsible) ─────────────────────────── */}
        <aside
          className={`border-r border-gray-800 bg-[#0b101c] flex flex-col shrink-0 select-none overflow-hidden transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 border-r-0'
          }`}
        >
          <div className="w-64 flex flex-col h-full overflow-y-auto">
          <div className="p-3.5 space-y-4">
            {/* SPRINT HUB SECTION */}
            <div>
              <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>Agile Sprint Hub</span>
                <Sparkles size={11} className="text-blue-400" />
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('sprint')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeTab === 'sprint'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Target size={15} className={activeTab === 'sprint' ? 'text-blue-400' : 'text-gray-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold">Sprint Board</div>
                    <div className="text-[10px] text-gray-400 truncate">Kanban, backlog & velocity</div>
                  </div>
                </button>
              </div>
            </div>

            {/* PRO HUB SECTIONS (Only for Professional Workspaces) */}
            {isProfessional && (
              <>
                {/* Engineering & Reviews */}
                <div>
                  <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                    <span>Engineering & Code</span>
                    <LayoutGrid size={11} className="text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'tasks'
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <CheckCircle2 size={15} className={activeTab === 'tasks' ? 'text-purple-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">Tasks List</div>
                        <div className="text-[10px] text-gray-400 truncate">Sprint issues & filters</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('reviews')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'reviews'
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <GitPullRequest size={15} className={activeTab === 'reviews' ? 'text-purple-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-semibold">Code Reviews</span>
                          {openReviewsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                              {openReviewsCount}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">Peer reviews & approvals</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Cloud & Infrastructure */}
                <div>
                  <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                    <span>Cloud & Mesh</span>
                    <Terminal size={11} className="text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setActiveTab('gateway')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'gateway'
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Terminal size={15} className={activeTab === 'gateway' ? 'text-blue-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">BYO Editor (SSH)</div>
                        <div className="text-[10px] text-gray-400 truncate">VS Code, Cursor & dotfiles</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('warmpool')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'warmpool'
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Zap size={15} className={activeTab === 'warmpool' ? 'text-amber-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">CoW Warm-Pools</div>
                        <div className="text-[10px] text-gray-400 truncate">Instant &lt;3s snapshot forks</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('database')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'database'
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Database size={15} className={activeTab === 'database' ? 'text-emerald-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">DB Branching</div>
                        <div className="text-[10px] text-gray-400 truncate">Isolated &amp; masked seed data</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('mesh')}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === 'mesh'
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                    >
                      <Layers size={15} className={activeTab === 'mesh' ? 'text-indigo-400' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">Multi-Repo Mesh</div>
                        <div className="text-[10px] text-gray-400 truncate">Multi-root &amp; type-sync</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto p-3.5 border-t border-gray-800/80 bg-[#080c14]">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-gray-300">Live Workspace Mesh</span>
            </div>
            <div className="text-[11px] text-gray-500 truncate mt-1">
              ID: {workspace.id}
            </div>
          </div>
        </div>
      </aside>

        {/* ─── Main Content Canvas ─────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0e17]">
          {activeTab === 'sprint' ? (
            <KanbanSprintHub
              workspaceId={workspace.id}
              workspaceType={workspaceType as 'competitive' | 'professional'}
              myRole={myRole}
              currentUserId={currentUserId}
              token={token}
              socket={socket}
              activeFilePath={activeFilePath}
              onOpenFile={(filePath) => {
                onOpenFile(filePath);
                onClose();
              }}
              onClose={onClose}
              embedded={true}
            />
          ) : (
            <ProfessionalPanel
              workspaceId={workspace.id}
              myRole={myRole}
              currentUserId={currentUserId}
              token={token}
              activeFilePath={activeFilePath}
              onOpenFile={(filePath) => {
                onOpenFile(filePath);
                onClose();
              }}
              onClose={onClose}
              onTaskCreated={onTaskCreated}
              onTaskUpdated={onTaskUpdated}
              onTaskDeleted={onTaskDeleted}
              onReviewCreated={onReviewCreated}
              onReviewUpdated={onReviewUpdated}
              embedded={true}
              selectedTab={activeTab as any}
              onTabChange={(t) => setActiveTab(t as ProjectManagementTab)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
