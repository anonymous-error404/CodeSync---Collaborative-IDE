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
  embedded?: boolean;
}

const COLUMNS: Array<{ id: TaskStatus; label: string; icon: string; accent: string; accentBg: string }> = [
  { id: 'todo',        label: 'Backlog',     icon: '▣', accent: '#64748b', accentBg: 'rgba(100,116,139,0.1)' },
  { id: 'in_progress', label: 'In Progress', icon: '◈', accent: '#3b82f6', accentBg: 'rgba(59,130,246,0.1)'  },
  { id: 'in_review',   label: 'In Review',   icon: '◉', accent: '#8b5cf6', accentBg: 'rgba(139,92,246,0.1)' },
  { id: 'done',        label: 'Done',        icon: '✓', accent: '#10b981', accentBg: 'rgba(16,185,129,0.1)'  },
];

const PRIORITY_THEMES: Record<TaskPriority, { bg: string; text: string; border: string; label: string }> = {
  urgent: { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)',   label: 'Urgent' },
  high:   { bg: 'rgba(232,66,12,0.1)',   text: '#E8420C', border: 'rgba(232,66,12,0.3)',   label: 'High'   },
  medium: { bg: 'rgba(234,179,8,0.1)',   text: '#ca8a04', border: 'rgba(234,179,8,0.3)',   label: 'Medium' },
  low:    { bg: 'rgba(100,116,139,0.1)', text: '#64748b', border: 'rgba(100,116,139,0.3)', label: 'Low'    },
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
  embedded = false,
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, membersRes] = await Promise.all([
        collabService.getTasks(workspaceId, token),
        collabService.getMembers(workspaceId, token),
      ]);
      if (tasksRes.success) setTasks(tasksRes.tasks || []);
      if (membersRes.success) setMembers(membersRes.members || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sprint tasks');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const handleCreated = ({ task }: { task: ProjectTask }) =>
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]));
    const handleUpdated = ({ task }: { task: ProjectTask }) =>
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    const handleDeleted = ({ taskId }: { taskId: number }) =>
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    socket.on('task:created', handleCreated);
    socket.on('task:updated', handleUpdated);
    socket.on('task:deleted', handleDeleted);
    return () => {
      socket.off('task:created', handleCreated);
      socket.off('task:updated', handleUpdated);
      socket.off('task:deleted', handleDeleted);
    };
  }, [socket]);

  const availableSprints = useMemo(() => {
    const set = new Set<string>(['Sprint 1']);
    tasks.forEach((t) => { if (t.sprint && t.sprint.trim()) set.add(t.sprint.trim()); });
    return Array.from(set);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedSprint !== 'All Sprints' && (task.sprint || 'Sprint 1') !== selectedSprint) return false;
      if (assigneeFilter === 'mine' && task.assignedTo !== currentUserId) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
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

  const sprintStats = useMemo(() => {
    const currentTasks = selectedSprint === 'All Sprints'
      ? tasks
      : tasks.filter((t) => (t.sprint || 'Sprint 1') === selectedSprint);
    const total = currentTasks.length;
    const done = currentTasks.filter((t) => t.status === 'done').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalPoints = currentTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const donePoints = currentTasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    return { total, done, percent, totalPoints, donePoints };
  }, [tasks, selectedSprint]);

  const handleMoveTaskStatus = async (task: ProjectTask, newStatus: TaskStatus) => {
    if (task.status === newStatus) return;
    const updated = { ...task, status: newStatus };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    try {
      const res = await collabService.updateTask(workspaceId, task.id, { status: newStatus }, token);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
        socket?.emit('task:update', { workspaceId, task: res.task });
      }
    } catch {
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
    if (task) handleMoveTaskStatus(task, targetStatus);
    setDraggingTaskId(null);
  };

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
      className={embedded ? "flex flex-col w-full h-full overflow-hidden" : "fixed inset-0 z-50 flex flex-col"}
      style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <div
        className="card-header-tab flex items-center justify-between px-6 shrink-0"
        style={{ height: 52 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}
          >
            {workspaceType === 'competitive'
              ? <Trophy className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              : <Briefcase className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--text)' }}>
                Kanban Sprint Hub
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider font-mono"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
              >
                {workspaceType}
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {isLeader
                ? 'Lead planning, backlog management & team task assignments'
                : 'Collaborative agile task execution and sprint tracking'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLeader && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold btn-physical-primary cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg btn-physical-surface cursor-pointer"
            title="Close Sprint Hub"
          >
            <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </div>

      {/* ── Sprint Controls Bar ─────────────────────────────────────────────── */}
      <div
        className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sprint selector */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <Target className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <select
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              className="bg-transparent text-xs outline-none cursor-pointer font-mono"
              style={{ color: 'var(--text)' }}
            >
              <option value="All Sprints" style={{ background: 'var(--surface)' }}>All Sprints</option>
              {availableSprints.map((s) => (
                <option key={s} value={s} style={{ background: 'var(--surface)' }}>{s}</option>
              ))}
            </select>
          </div>

          {/* Assignee toggle pills */}
          <div
            className="flex items-center rounded-lg p-0.5 text-xs"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            {(['all', 'mine'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setAssigneeFilter(v)}
                className="px-2.5 py-1 rounded-md transition-all cursor-pointer"
                style={{
                  background: assigneeFilter === v ? 'var(--accent)' : 'transparent',
                  color: assigneeFilter === v ? '#fff' : 'var(--muted)',
                  fontWeight: assigneeFilter === v ? 600 : 400,
                  border: 'none',
                }}
              >
                {v === 'all' ? 'All Tasks' : 'My Tasks'}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer font-mono"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="input-well pl-8 pr-3 py-1.5 text-xs w-40 transition-all font-mono"
              style={{ outline: 'none' }}
              onFocus={e => { e.currentTarget.style.width = '220px'; }}
              onBlur={e => { e.currentTarget.style.width = '160px'; }}
            />
          </div>
        </div>

        {/* Sprint velocity */}
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        >
          <Flame className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
          <span className="text-xs font-mono">
            <span className="font-bold" style={{ color: 'var(--text)' }}>{sprintStats.donePoints}</span>
            <span style={{ color: 'var(--muted)' }}>/{sprintStats.totalPoints} pts</span>
          </span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${sprintStats.percent}%`, background: 'var(--success)' }}
            />
          </div>
          <span className="text-xs font-bold font-mono" style={{ color: 'var(--success)' }}>
            {sprintStats.percent}%
          </span>
        </div>
      </div>

      {/* ── Kanban Board ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-5 flex gap-4" style={{ background: 'var(--bg)' }}>
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ color: 'var(--muted)' }}>
            <Spinner size={28} />
            <p className="text-xs font-mono">Loading sprint board…</p>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--error)' }}>
            {error}
          </div>
        ) : (
          COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDropOnColumn(col.id)}
                className="flex-1 min-w-[268px] max-w-[340px] flex flex-col rounded-xl transition-all duration-200"
                style={{
                  background: isTarget ? col.accentBg : 'var(--surface)',
                  border: `1px solid ${isTarget ? col.accent : 'var(--border)'}`,
                  boxShadow: isTarget
                    ? `0 0 0 2px ${col.accent}33, 0 2px 8px rgba(15,23,42,0.08)`
                    : '0 1px 4px rgba(15,23,42,0.06)',
                }}
              >
                {/* Column Header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 shrink-0"
                  style={{ borderBottom: `2px solid ${col.accent}30` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: col.accent }}>{col.icon}</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest font-mono" style={{ color: 'var(--text)' }}>
                      {col.label}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono"
                      style={{ background: col.accentBg, color: col.accent }}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center justify-center w-5 h-5 rounded transition-all cursor-pointer"
                    style={{ background: 'transparent', border: `1px dashed ${col.accent}60`, color: col.accent, opacity: 0.6 }}
                    title="Add task to column"
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = col.accentBg; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Task Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {colTasks.length === 0 ? (
                    <div
                      className="h-28 flex flex-col items-center justify-center rounded-xl text-[11px] font-mono"
                      style={{ border: '1.5px dashed var(--border)', color: 'var(--muted)' }}
                    >
                      <span style={{ color: col.accent, opacity: 0.4, fontSize: 18 }}>{col.icon}</span>
                      <span className="mt-1.5">Drop tasks here</span>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const pt = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className="group flex flex-col gap-2.5 p-3 rounded-lg transition-all duration-150 cursor-grab active:cursor-grabbing"
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(15,23,42,0.1)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = '';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(15,23,42,0.05)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                          }}
                        >
                          {/* Priority + points + sprint + delete */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono"
                                style={{ background: pt.bg, color: pt.text, border: `1px solid ${pt.border}` }}
                              >
                                {pt.label}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                                style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                              >
                                ⚡ {task.storyPoints ?? 3}pt
                              </span>
                              {task.sprint && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                                  style={{ color: 'var(--muted)', background: 'var(--surface)' }}
                                >
                                  {task.sprint}
                                </span>
                              )}
                            </div>
                            {(isLeader || task.createdBy === currentUserId) && (
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded transition-all cursor-pointer"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                                title="Delete Task"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-xs font-semibold leading-snug break-words" style={{ color: 'var(--text)' }}>
                            {task.title}
                          </h3>

                          {/* Description */}
                          {task.description && (
                            <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                              {task.description}
                            </p>
                          )}

                          {/* File link */}
                          {task.filePath && (
                            <button
                              onClick={() => onOpenFile(task.filePath!)}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded w-fit text-left cursor-pointer"
                              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                              title="Open in editor"
                            >
                              <FileCode className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[180px] font-mono">{task.filePath}</span>
                            </button>
                          )}

                          {/* Footer */}
                          <div
                            className="flex items-center justify-between pt-2"
                            style={{ borderTop: '1px solid var(--border)' }}
                          >
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
                              >
                                {task.assignee?.username?.charAt(0) ?? '?'}
                              </div>
                              <span className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                                {task.assignee?.username ?? 'Unassigned'}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5">
                              {col.id !== 'todo' && (
                                <button
                                  onClick={() => {
                                    const prevStatus: Record<TaskStatus, TaskStatus> = {
                                      todo: 'todo', in_progress: 'todo', in_review: 'in_progress', done: 'in_review',
                                    };
                                    handleMoveTaskStatus(task, prevStatus[col.id]);
                                  }}
                                  className="flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                                  title="Move back"
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {col.id !== 'done' && (
                                <button
                                  onClick={() => {
                                    const nextStatus: Record<TaskStatus, TaskStatus> = {
                                      todo: 'in_progress', in_progress: 'in_review', in_review: 'done', done: 'done',
                                    };
                                    handleMoveTaskStatus(task, nextStatus[col.id]);
                                  }}
                                  className="flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                                  title="Advance"
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = col.accent; (e.currentTarget as HTMLElement).style.borderColor = col.accent; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div
            className="w-full max-w-lg flex flex-col rounded-2xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="card-header-tab flex items-center justify-between px-5 shrink-0"
              style={{ height: 48, borderRadius: '1rem 1rem 0 0' }}
            >
              <span className="text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                New Sprint Task
              </span>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Task Title <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement JWT authentication middleware"
                  className="input-well w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Details, acceptance criteria, or technical constraints…"
                  className="input-well w-full px-3 py-2 text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Sprint</label>
                  <input
                    type="text"
                    value={newSprint}
                    onChange={(e) => setNewSprint(e.target.value)}
                    placeholder="Sprint 1"
                    className="input-well w-full px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Story Points</label>
                  <select
                    value={newStoryPoints}
                    onChange={(e) => setNewStoryPoints(Number(e.target.value))}
                    className="input-well w-full px-3 py-2 text-xs font-mono cursor-pointer"
                  >
                    {[1, 2, 3, 5, 8, 13].map((pt) => (
                      <option key={pt} value={pt} style={{ background: 'var(--surface)' }}>{pt} pts</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="input-well w-full px-3 py-2 text-xs font-mono cursor-pointer"
                  >
                    <option value="low" style={{ background: 'var(--surface)' }}>Low</option>
                    <option value="medium" style={{ background: 'var(--surface)' }}>Medium</option>
                    <option value="high" style={{ background: 'var(--surface)' }}>High</option>
                    <option value="urgent" style={{ background: 'var(--surface)' }}>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Assignee</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-well w-full px-3 py-2 text-xs cursor-pointer"
                  >
                    <option value="" style={{ background: 'var(--surface)' }}>Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId} style={{ background: 'var(--surface)' }}>
                        {m.User?.username ?? (m as any).user?.username ?? `User #${m.userId}`} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 font-mono uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Attached File <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="e.g. backend/src/middleware/auth.js"
                  className="input-well w-full px-3 py-2 text-xs font-mono"
                />
              </div>

              <div
                className="flex items-center justify-end gap-2 pt-3"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-physical-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim()}
                  className="px-5 py-2 rounded-lg text-xs font-semibold btn-physical-primary disabled:opacity-40 cursor-pointer"
                >
                  {submitting ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
