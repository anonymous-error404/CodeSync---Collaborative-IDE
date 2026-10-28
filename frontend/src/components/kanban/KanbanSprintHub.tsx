import { useState, useEffect, useMemo, useCallback, type DragEvent, type FormEvent } from 'react';
import {
  Trophy,
  Briefcase,
  Plus,
  Search,
  FileCode,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Target,
  Flame,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type {
  ProjectTask,
  TaskStatus,
  TaskPriority,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types';
import { collabService } from '../../services/workspaceCollabService';
import { Spinner } from '../ui/Spinner';

interface Props {
  workspaceId: string;
  workspaceType: 'competitive' | 'professional';
  myRole: WorkspaceRole;
  currentUserId: number;
  token: string | null;
  socket?: Socket | null;
  activeFilePath?: string | null;
  onOpenFile: (filePath: string) => void;
  onClose: () => void;
}

const COLUMNS: Array<{ id: TaskStatus; label: string; icon: string; color: string; border: string }> = [
  { id: 'todo', label: 'To Do / Backlog', icon: '📋', color: '#94a3b8', border: '#475569' },
  { id: 'in_progress', label: 'In Progress', icon: '⚡', color: '#38bdf8', border: '#0284c7' },
  { id: 'in_review', label: 'In Review', icon: '🔍', color: '#c084fc', border: '#9333ea' },
  { id: 'done', label: 'Done', icon: '✅', color: '#4ade80', border: '#16a34a' },
];

const PRIORITY_THEMES: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: 'Urgent' },
  high: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', label: 'High' },
  medium: { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15', label: 'Medium' },
  low: { bg: 'rgba(148, 163, 184, 0.2)', text: '#cbd5e1', label: 'Low' },
};

export function KanbanSprintHub({
  workspaceId,
  workspaceType,
  myRole,
  currentUserId,
  token,
  socket,
  activeFilePath,
  onOpenFile,
  onClose,
}: Props) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sprint & Filters
  const [selectedSprint, setSelectedSprint] = useState<string>('All Sprints');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Drag and drop state
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // New Task Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSprint, setNewSprint] = useState('Sprint 1');
  const [newStoryPoints, setNewStoryPoints] = useState<number>(3);
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssignee, setNewAssignee] = useState<number | ''>('');
  const [newFilePath, setNewFilePath] = useState(activeFilePath || '');
  const [submitting, setSubmitting] = useState(false);

  const isLeader =
    myRole === 'team_leader' ||
    myRole === 'owner' ||
    myRole === 'admin';

  // Fetch initial tasks & members
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, membersRes] = await Promise.all([
        collabService.getTasks(workspaceId, token),
        collabService.getMembers(workspaceId, token),
      ]);
      if (tasksRes.success) {
        setTasks(tasksRes.tasks || []);
      }
      if (membersRes.success) {
        setMembers(membersRes.members || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sprint tasks');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;

    const handleCreated = ({ task }: { task: ProjectTask }) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]));
    };

    const handleUpdated = ({ task }: { task: ProjectTask }) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    };

    const handleDeleted = ({ taskId }: { taskId: number }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    socket.on('task:created', handleCreated);
    socket.on('task:updated', handleUpdated);
    socket.on('task:deleted', handleDeleted);

    return () => {
      socket.off('task:created', handleCreated);
      socket.off('task:updated', handleUpdated);
      socket.off('task:deleted', handleDeleted);
    };
  }, [socket]);

  // Unique list of sprints extracted from tasks
  const availableSprints = useMemo(() => {
    const set = new Set<string>(['Sprint 1']);
    tasks.forEach((t) => {
      if (t.sprint && t.sprint.trim()) set.add(t.sprint.trim());
    });
    return Array.from(set);
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedSprint !== 'All Sprints' && (task.sprint || 'Sprint 1') !== selectedSprint) {
        return false;
      }
      if (assigneeFilter === 'mine' && task.assignedTo !== currentUserId) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q) ?? false;
        const matchAssignee = task.assignee?.username?.toLowerCase().includes(q) ?? false;
        const matchFile = task.filePath?.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchDesc && !matchAssignee && !matchFile) return false;
      }
      return true;
    });
  }, [tasks, selectedSprint, assigneeFilter, priorityFilter, searchQuery, currentUserId]);

  // Sprint Velocity & Metrics
  const sprintStats = useMemo(() => {
    const currentTasks =
      selectedSprint === 'All Sprints'
        ? tasks
        : tasks.filter((t) => (t.sprint || 'Sprint 1') === selectedSprint);

    const total = currentTasks.length;
    const done = currentTasks.filter((t) => t.status === 'done').length;
    const inProgress = currentTasks.filter((t) => t.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const totalPoints = currentTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const donePoints = currentTasks
      .filter((t) => t.status === 'done')
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    return { total, done, inProgress, percent, totalPoints, donePoints };
  }, [tasks, selectedSprint]);

  // Status Change Handlers (Drag & Drop or Button Click)
  const handleMoveTaskStatus = async (task: ProjectTask, newStatus: TaskStatus) => {
    if (task.status === newStatus) return;

    // Optimistic local update
    const updated = { ...task, status: newStatus };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

    try {
      const res = await collabService.updateTask(workspaceId, task.id, { status: newStatus }, token);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
        socket?.emit('task:update', { workspaceId, task: res.task });
      }
    } catch {
      // Revert on error
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  const handleDragStart = (e: DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', String(taskId));
    setDraggingTaskId(taskId);
  };

  const handleDropOnColumn = (targetStatus: TaskStatus) => {
    setDragOverColumn(null);
    if (!draggingTaskId) return;
    const task = tasks.find((t) => t.id === draggingTaskId);
    if (task) {
      handleMoveTaskStatus(task, targetStatus);
    }
    setDraggingTaskId(null);
  };

  // Delete task
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await collabService.deleteTask(workspaceId, taskId, token);
      socket?.emit('task:delete', { workspaceId, taskId });
    } catch (err) {
      console.error('Failed to delete task', err);
      fetchData();
    }
  };

  // Create Task
  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);

    try {
      const res = await collabService.createTask(
        workspaceId,
        {
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          priority: newPriority,
          sprint: newSprint.trim() || 'Sprint 1',
          storyPoints: newStoryPoints,
          assignedTo: newAssignee !== '' ? Number(newAssignee) : null,
          filePath: newFilePath.trim() || null,
        },
        token
      );

      if (res.success && res.task) {
        setTasks((prev) => [res.task, ...prev]);
        socket?.emit('task:create', { workspaceId, task: res.task });
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewAssignee('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0f17] text-gray-100 backdrop-blur-md"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-800 bg-[#0d131f] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20">
            {workspaceType === 'competitive' ? <Trophy className="w-5 h-5 text-white" /> : <Briefcase className="w-5 h-5 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Kanban Sprint Hub</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {workspaceType} Mode
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {isLeader ? 'Lead planning, backlog management & team task assignments' : 'Collaborative agile task execution and sprint tracking'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLeader && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Close Sprint Hub"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Sprint Controls & Velocity Summary ─────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-800/80 bg-[#090d15] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sprint Selector */}
          <div className="flex items-center gap-2 bg-[#131b29] border border-gray-800 rounded-lg px-2.5 py-1">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer pr-1"
            >
              <option value="All Sprints" className="bg-[#131b29] text-gray-200">
                All Sprints
              </option>
              {availableSprints.map((s) => (
                <option key={s} value={s} className="bg-[#131b29] text-gray-200">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center rounded-lg border border-gray-800 bg-[#131b29] p-0.5 text-xs">
            <button
              onClick={() => setAssigneeFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                assigneeFilter === 'all' ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setAssigneeFilter('mine')}
              className={`px-2.5 py-1 rounded transition-colors ${
                assigneeFilter === 'mine' ? 'bg-blue-600 text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              My Tasks
            </button>
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="bg-[#131b29] border border-gray-800 text-xs text-gray-300 rounded-lg px-2.5 py-1 outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="bg-[#131b29] border border-gray-800 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 outline-none w-44 focus:w-60 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Sprint Progress Gauge */}
        <div className="flex items-center gap-4 bg-[#131b29] border border-gray-800/80 rounded-xl px-4 py-1.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="font-semibold text-white">{sprintStats.donePoints}</span>
              <span className="text-gray-400"> / {sprintStats.totalPoints} pts</span>
            </div>
          </div>

          <div className="w-28 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${sprintStats.percent}%` }}
            />
          </div>

          <span className="text-xs font-bold text-emerald-400">{sprintStats.percent}% Done</span>
        </div>
      </div>

      {/* ── Kanban Columns Board ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-6 flex gap-5">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Spinner size={32} />
            <p className="text-xs">Loading sprint board...</p>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-red-400 text-xs">
            {error}
          </div>
        ) : (
          COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.id);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDropOnColumn(col.id)}
                className={`flex-1 min-w-[280px] max-w-[360px] flex flex-col rounded-2xl border transition-all duration-200 ${
                  isTarget ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10' : 'border-gray-800 bg-[#0d131f]'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/70">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{col.icon}</span>
                    <h2 className="text-xs font-bold text-gray-200 tracking-wide">{col.label}</h2>
                    <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-gray-800 text-gray-300">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(true);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                    title="Add task to this column"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column Task Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-800/80 rounded-xl text-gray-500 text-[11px]">
                      <span>Drop tasks here</span>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const priorityTheme = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="bg-[#131b29] hover:bg-[#182234] border border-gray-800/80 hover:border-gray-700 rounded-xl p-3.5 shadow-sm transition-all group flex flex-col gap-2.5 cursor-grab active:cursor-grabbing"
                        >
                          {/* Tags & Priority */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: priorityTheme.bg, color: priorityTheme.text }}
                              >
                                {priorityTheme.label}
                              </span>

                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800/80 text-gray-300 border border-gray-700/50">
                                ⚡ {task.storyPoints ?? 3} pts
                              </span>

                              {task.sprint && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 bg-gray-900 border border-gray-800">
                                  {task.sprint}
                                </span>
                              )}
                            </div>

                            {(isLeader || task.createdBy === currentUserId) && (
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-opacity"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Task Title */}
                          <h3 className="text-xs font-semibold text-white leading-snug break-words">
                            {task.title}
                          </h3>

                          {/* Task Description */}
                          {task.description && (
                            <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Attached File Link */}
                          {task.filePath && (
                            <button
                              onClick={() => onOpenFile(task.filePath!)}
                              className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline bg-blue-950/40 border border-blue-900/40 px-2 py-0.5 rounded w-fit text-left"
                              title="Open attached file in editor"
                            >
                              <FileCode className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[200px]">{task.filePath}</span>
                            </button>
                          )}

                          {/* Footer: Assignee & Column Move Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 mt-0.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-300 uppercase">
                                {task.assignee?.username?.charAt(0) ?? '?'}
                              </div>
                              <span className="text-[11px] text-gray-300 font-medium">
                                {task.assignee?.username ?? 'Unassigned'}
                              </span>
                            </div>

                            {/* Quick status cycle buttons */}
                            <div className="flex items-center gap-1">
                              {col.id !== 'todo' && (
                                <button
                                  onClick={() => {
                                    const prevStatus: Record<TaskStatus, TaskStatus> = {
                                      todo: 'todo',
                                      in_progress: 'todo',
                                      in_review: 'in_progress',
                                      done: 'in_review',
                                    };
                                    handleMoveTaskStatus(task, prevStatus[col.id]);
                                  }}
                                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800"
                                  title="Move to previous status"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {col.id !== 'done' && (
                                <button
                                  onClick={() => {
                                    const nextStatus: Record<TaskStatus, TaskStatus> = {
                                      todo: 'in_progress',
                                      in_progress: 'in_review',
                                      in_review: 'done',
                                      done: 'done',
                                    };
                                    handleMoveTaskStatus(task, nextStatus[col.id]);
                                  }}
                                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800"
                                  title="Advance to next status"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create Task Modal ──────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#0f1724] border border-gray-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Create New Sprint Task</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement JWT authentication middleware"
                  className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Description (Optional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Details, acceptance criteria, or technical constraints..."
                  className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Sprint Name</label>
                  <input
                    type="text"
                    value={newSprint}
                    onChange={(e) => setNewSprint(e.target.value)}
                    placeholder="e.g. Sprint 1"
                    className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Story Points</label>
                  <select
                    value={newStoryPoints}
                    onChange={(e) => setNewStoryPoints(Number(e.target.value))}
                    className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {[1, 2, 3, 5, 8, 13].map((pt) => (
                      <option key={pt} value={pt}>
                        {pt} Points
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Assignee</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.User?.username ?? (m as any).user?.username ?? `User #${m.userId}`} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Attached Code File (Optional)</label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="e.g. backend/src/middleware/authMiddleware.js"
                  className="w-full bg-[#162133] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-md transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}