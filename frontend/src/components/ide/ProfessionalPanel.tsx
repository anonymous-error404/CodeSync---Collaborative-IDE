import { useState, useEffect } from 'react';
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileCode,
  Check,
  X,
  User as UserIcon,
  ChevronRight,
  GitPullRequest,
} from 'lucide-react';
import type {
  ProjectTask,
  CodeReview,
  TaskStatus,
  TaskPriority,
  ReviewStatus,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types';
import { collabService } from '../../services/workspaceCollabService';
import { Spinner } from '../ui/Spinner';

interface Props {
  workspaceId: string;
  myRole: WorkspaceRole;
  currentUserId: number;
  token: string | null;
  activeFilePath?: string | null;
  onOpenFile: (filePath: string) => void;
  onClose: () => void;
  // Socket emit hooks
  onTaskCreated?: (task: ProjectTask) => void;
  onTaskUpdated?: (task: ProjectTask) => void;
  onTaskDeleted?: (taskId: number) => void;
  onReviewCreated?: (review: CodeReview) => void;
  onReviewUpdated?: (review: CodeReview) => void;
}

export function ProfessionalPanel({
  workspaceId,
  myRole,
  currentUserId,
  token,
  activeFilePath,
  onOpenFile,
  onClose,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onReviewCreated,
  onReviewUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'reviews'>('tasks');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Task creation state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskAssignee, setTaskAssignee] = useState<number | ''>('');
  const [taskFilePath, setTaskFilePath] = useState(activeFilePath || '');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Review creation state
  const [showNewReviewForm, setShowNewReviewForm] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewFilePath, setReviewFilePath] = useState(activeFilePath || '');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Review response state
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [actionLoadingReviewId, setActionLoadingReviewId] = useState<number | null>(null);

  // Filter state
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');

  const isTeamLeader = myRole === 'team_leader' || myRole === 'owner' || myRole === 'admin';
  const isDeveloper = myRole === 'developer' || isTeamLeader;

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, reviewsRes, membersRes] = await Promise.all([
        collabService.getTasks(workspaceId, token),
        collabService.getReviews(workspaceId, token),
        collabService.getMembers(workspaceId, token),
      ]);

      if (tasksRes.success) setTasks(tasksRes.tasks || []);
      if (reviewsRes.success) setReviews(reviewsRes.reviews || []);
      if (membersRes.success) setMembers(membersRes.members || []);
    } catch {
      setError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, token]);

  // Keep taskFilePath and reviewFilePath updated if user opens form while viewing a file
  useEffect(() => {
    if (activeFilePath) {
      if (!taskFilePath) setTaskFilePath(activeFilePath);
      if (!reviewFilePath) setReviewFilePath(activeFilePath);
    }
  }, [activeFilePath]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setSubmittingTask(true);
    setError('');
    try {
      const res = await collabService.createTask(
        workspaceId,
        {
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          assignedTo: taskAssignee ? Number(taskAssignee) : null,
          filePath: taskFilePath.trim() || null,
        },
        token
      );

      if (res.success && res.task) {
        setTasks((prev) => [res.task, ...prev]);
        onTaskCreated?.(res.task);
        setTaskTitle('');
        setTaskDescription('');
        setShowNewTaskForm(false);
      } else {
        setError((res as any)?.error || 'Failed to create task');
      }
    } catch {
      setError('Failed to create task');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: TaskStatus) => {
    try {
      const res = await collabService.updateTask(workspaceId, taskId, { status: newStatus }, token);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));
        onTaskUpdated?.(res.task);
      }
    } catch {
      setError('Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await collabService.deleteTask(workspaceId, taskId, token);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        onTaskDeleted?.(taskId);
      }
    } catch {
      setError('Failed to delete task');
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTitle.trim() || !reviewFilePath.trim()) return;

    setSubmittingReview(true);
    setError('');
    try {
      const res = await collabService.createReview(
        workspaceId,
        {
          title: reviewTitle.trim(),
          description: reviewDescription.trim() || undefined,
          filePath: reviewFilePath.trim(),
        },
        token
      );

      if (res.success && res.review) {
        setReviews((prev) => [res.review, ...prev]);
        onReviewCreated?.(res.review);
        setReviewTitle('');
        setReviewDescription('');
        setShowNewReviewForm(false);
      } else {
        setError((res as any)?.error || 'Failed to submit review request');
      }
    } catch {
      setError('Failed to submit review request');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUpdateReviewStatus = async (reviewId: number, status: ReviewStatus) => {
    setActionLoadingReviewId(reviewId);
    try {
      const note = reviewNotes[reviewId];
      const res = await collabService.updateReviewStatus(
        workspaceId,
        reviewId,
        { status, reviewNote: note },
        token
      );
      if (res.success && res.review) {
        setReviews((prev) => prev.map((r) => (r.id === reviewId ? res.review : r)));
        onReviewUpdated?.(res.review);
      } else {
        setError((res as any)?.error || 'Failed to update review status');
      }
    } catch {
      setError('Failed to update review status');
    } finally {
      setActionLoadingReviewId(null);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('Are you sure you want to cancel this review request?')) return;
    try {
      const res = await collabService.deleteReview(workspaceId, reviewId, token);
      if (res.success) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      }
    } catch {
      setError('Failed to delete review');
    }
  };

  const priorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">Urgent</span>;
      case 'high':
        return <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">High</span>;
      case 'medium':
        return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">Medium</span>;
      case 'low':
        return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider bg-gray-500/15 text-gray-400 border border-gray-500/30">Low</span>;
    }
  };

  const reviewStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'open':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">Open Review</span>;
      case 'approved':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Approved</span>;
      case 'changes_requested':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">Changes Requested</span>;
      case 'closed':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-gray-500/15 text-gray-400 border border-gray-500/30">Closed</span>;
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === 'mine' && task.assignedTo !== currentUserId) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    return true;
  });

  const openReviewsCount = reviews.filter((r) => r.status === 'open').length;

  return (
    <div
      className="fixed top-0 bottom-0 right-0 z-50 flex flex-col shadow-2xl animate-fade-in"
      style={{
        width: 380,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Briefcase size={18} className="text-blue-400" />
          <div>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Project & Sprint Hub
            </h2>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">
              Professional Workspace
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center px-4 pt-2 gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('tasks')}
          className="pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 transition-colors relative"
          style={{
            color: activeTab === 'tasks' ? 'var(--accent)' : 'var(--muted)',
            borderBottom: activeTab === 'tasks' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
          }}
        >
          <CheckCircle2 size={14} />
          Tasks ({tasks.length})
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className="pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 transition-colors relative"
          style={{
            color: activeTab === 'reviews' ? 'var(--accent)' : 'var(--muted)',
            borderBottom: activeTab === 'reviews' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
          }}
        >
          <GitPullRequest size={14} />
          Code Reviews
          {openReviewsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black">
              {openReviewsCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {error && (
          <div
            className="p-2.5 rounded text-xs"
            style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : activeTab === 'tasks' ? (
          /* ─── TASKS VIEW ────────────────────────────────────────── */
          <>
            {/* Filter and New Task Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTaskFilter(taskFilter === 'all' ? 'mine' : 'all')}
                  className="text-[11px] px-2 py-1 rounded font-medium transition-colors"
                  style={{
                    background: taskFilter === 'mine' ? 'var(--accent)' : 'var(--surface-2)',
                    color: taskFilter === 'mine' ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  {taskFilter === 'mine' ? 'My Assigned' : 'All Tasks'}
                </button>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-[11px] p-1 rounded outline-none cursor-pointer"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <option value="all">All Status</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {isDeveloper && (
                <button
                  onClick={() => setShowNewTaskForm((prev) => !prev)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors font-medium"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> {showNewTaskForm ? 'Cancel' : 'New Task'}
                </button>
              )}
            </div>

            {/* New Task Inline Form */}
            {showNewTaskForm && (
              <form
                onSubmit={handleCreateTask}
                className="p-3 rounded-lg flex flex-col gap-2.5 animate-fade-in"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}
              >
                <div className="font-semibold text-xs text-[var(--text)]">Create Sprint Task</div>
                <input
                  type="text"
                  placeholder="Task title (e.g. Implement OAuth Flow)"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  required
                />
                <textarea
                  placeholder="Description or acceptance criteria..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded outline-none resize-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[var(--muted)] block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="w-full text-xs p-1.5 rounded outline-none"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] text-[var(--muted)] block mb-1">Assignee</label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value ? Number(e.target.value) : '')}
                      className="w-full text-xs p-1.5 rounded outline-none"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.User?.username} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[var(--muted)]">Linked File Path (optional)</label>
                    {activeFilePath && (
                      <button
                        type="button"
                        onClick={() => setTaskFilePath(activeFilePath)}
                        className="text-[10px] text-[var(--accent)] hover:underline"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Use open file
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="src/controllers/auth.ts"
                    value={taskFilePath}
                    onChange={(e) => setTaskFilePath(e.target.value)}
                    className="w-full text-xs p-2 rounded outline-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewTaskForm(false)}
                    className="px-2 py-1 text-xs rounded"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask}
                    className="px-3 py-1 text-xs rounded font-medium"
                    style={{
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: submittingTask ? 'not-allowed' : 'pointer',
                      opacity: submittingTask ? 0.7 : 1,
                    }}
                  >
                    {submittingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            )}

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--muted)]">
                No tasks found. Create a task to start tracking work!
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg flex flex-col gap-2 transition-all hover:border-[var(--accent)]"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[var(--text)]">{task.title}</span>
                        {task.description && (
                          <span className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2">
                            {task.description}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0">{priorityBadge(task.priority)}</div>
                    </div>

                    {/* Linked File Jump */}
                    {task.filePath && (
                      <button
                        onClick={() => onOpenFile(task.filePath!)}
                        className="flex items-center gap-1.5 text-[11px] py-1 px-2 rounded w-fit transition-colors"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                        }}
                        title="Open linked file in IDE"
                      >
                        <FileCode size={12} />
                        <span className="truncate max-w-[200px]">{task.filePath}</span>
                        <ChevronRight size={10} />
                      </button>
                    )}

                    {/* Assignee & Status Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[11px]">
                      <div className="flex items-center gap-1 text-[var(--muted)]">
                        <UserIcon size={12} />
                        <span>{task.assignee ? task.assignee.username : 'Unassigned'}</span>
                      </div>

                      {/* Status Selector */}
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                        className="text-[10px] font-semibold py-0.5 px-1.5 rounded outline-none cursor-pointer"
                        style={{
                          background:
                            task.status === 'done'
                              ? 'rgba(63, 185, 80, 0.15)'
                              : task.status === 'in_review'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : task.status === 'in_progress'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'var(--bg)',
                          color:
                            task.status === 'done'
                              ? '#3fb950'
                              : task.status === 'in_review'
                              ? '#c084fc'
                              : task.status === 'in_progress'
                              ? '#38bdf8'
                              : 'var(--muted)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="done">Done</option>
                      </select>

                      {(isTeamLeader || task.createdBy === currentUserId) && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 rounded text-red-400 hover:text-red-300 transition-colors"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ─── CODE REVIEWS / PR VIEW ────────────────────────────── */
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Review Requests ({reviews.length})
              </span>
              <button
                onClick={() => setShowNewReviewForm((prev) => !prev)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors font-medium"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> {showNewReviewForm ? 'Cancel' : 'Request Review'}
              </button>
            </div>

            {/* New Review Request Form */}
            {showNewReviewForm && (
              <form
                onSubmit={handleCreateReview}
                className="p-3 rounded-lg flex flex-col gap-2.5 animate-fade-in"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}
              >
                <div className="font-semibold text-xs text-[var(--text)]">Submit Code for Review</div>
                <input
                  type="text"
                  placeholder="Review title (e.g. Refactored WebSocket sync logic)"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  required
                />
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] text-[var(--muted)]">Target File Path</label>
                  {activeFilePath && (
                    <button
                      type="button"
                      onClick={() => setReviewFilePath(activeFilePath)}
                      className="text-[10px] text-[var(--accent)] hover:underline"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Use open file
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. src/sockets/workspaceSocket.js"
                  value={reviewFilePath}
                  onChange={(e) => setReviewFilePath(e.target.value)}
                  className="w-full text-xs p-2 rounded outline-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  required
                />
                <textarea
                  placeholder="Context, changes made, or questions for reviewer..."
                  value={reviewDescription}
                  onChange={(e) => setReviewDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded outline-none resize-none"
                  style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewReviewForm(false)}
                    className="px-2 py-1 text-xs rounded"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-3 py-1 text-xs rounded font-medium"
                    style={{
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: submittingReview ? 'not-allowed' : 'pointer',
                      opacity: submittingReview ? 0.7 : 1,
                    }}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}

            {/* Review List */}
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--muted)]">
                No code review requests yet. Submit a file to get feedback from your Team Leader!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-lg flex flex-col gap-2.5 transition-all"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-xs text-[var(--text)] block">{rev.title}</span>
                        <span className="text-[10px] text-[var(--muted)]">
                          Requested by <strong>{rev.author?.username}</strong>
                        </span>
                      </div>
                      <div className="shrink-0">{reviewStatusBadge(rev.status)}</div>
                    </div>

                    {/* File Path Jump */}
                    <button
                      onClick={() => onOpenFile(rev.filePath)}
                      className="flex items-center gap-1.5 text-[11px] py-1 px-2 rounded w-fit transition-colors"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                      title="Inspect file in IDE"
                    >
                      <FileCode size={12} />
                      <span className="truncate max-w-[220px]">{rev.filePath}</span>
                      <ChevronRight size={10} />
                    </button>

                    {rev.description && (
                      <p className="text-[11px] text-[var(--muted)] bg-[var(--bg)] p-2 rounded border border-[var(--border)]">
                        {rev.description}
                      </p>
                    )}

                    {/* Reviewer Note Display */}
                    {rev.reviewNote && (
                      <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-[11px]">
                        <span className="font-semibold text-purple-400 block mb-0.5">
                          Reviewer Feedback ({rev.reviewer?.username || 'Team Leader'}):
                        </span>
                        <span className="text-[var(--text)]">{rev.reviewNote}</span>
                      </div>
                    )}

                    {/* Team Leader Review Actions */}
                    {isTeamLeader && rev.status !== 'approved' && (
                      <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Feedback / review note..."
                          value={reviewNotes[rev.id] ?? ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [rev.id]: e.target.value }))
                          }
                          className="w-full text-xs p-1.5 rounded outline-none"
                          style={{
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                          }}
                        />

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateReviewStatus(rev.id, 'approved')}
                            disabled={actionLoadingReviewId === rev.id}
                            className="flex-1 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer"
                          >
                            <Check size={11} /> Approve
                          </button>
                          <button
                            onClick={() => handleUpdateReviewStatus(rev.id, 'changes_requested')}
                            disabled={actionLoadingReviewId === rev.id}
                            className="flex-1 py-1 px-2 rounded text-[10px] font-semibold flex items-center justify-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer"
                          >
                            <AlertCircle size={11} /> Request Changes
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delete / Cancel Review */}
                    {(isTeamLeader || rev.authorId === currentUserId) && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="text-[10px] text-red-400 hover:underline"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
