import { useState } from 'react';
import { Check, X, Sparkles, FileText, ListChecks } from 'lucide-react';
import type { TaskProposal } from '../../types/whiteboard';

interface Props {
  proposals: TaskProposal[];
  onClose: () => void;
  onConfirm: (approvedTasks: TaskProposal[]) => void;
}

export function TaskProposalModal({ proposals, onClose, onConfirm }: Props) {
  const [tasks, setTasks] = useState<TaskProposal[]>(proposals);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTitle = (id: string, newTitle: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, title: newTitle } : t)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
              Contextual Task Proposals
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--muted)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Review and edit the tasks generated from your selected whiteboard components before adding them to your project workflow.
          </p>

          {tasks.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--muted)' }}>
              No tasks selected for creation.
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className="p-4 rounded-xl border flex flex-col gap-2"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={task.title}
                    onChange={e => updateTitle(task.id, e.target.value)}
                    className="flex-1 font-semibold text-sm px-2 py-1 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                    style={{ color: 'var(--text)', border: '1px solid transparent' }}
                  />
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--error-bg)', color: 'var(--error)', border: 'none', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <FileText size={12} />
                  <span>{task.description}</span>
                </div>

                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    <ListChecks size={12} />
                    <span>Acceptance Criteria</span>
                  </div>
                  {task.acceptanceCriteria.map((criterion, idx) => (
                    <div key={idx} className="text-xs pl-4" style={{ color: 'var(--text-secondary)' }}>
                      • {criterion}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            {tasks.length} task(s) ready to create
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'transparent', color: 'var(--muted)', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(tasks)}
              disabled={tasks.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)', border: 'none', cursor: tasks.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              <Check size={14} /> Create Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
