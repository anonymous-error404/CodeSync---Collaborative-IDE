import React, { useState } from 'react';
import { MessageSquare, Check, X, Trash2, Send, CornerDownRight } from 'lucide-react';
import type { LineComment } from '../../types';

interface LineCommentThreadProps {
  comment?: LineComment;
  filePath: string;
  lineNumber: number;
  canComment: boolean;
  currentUserId?: number;
  currentUserRole?: string;
  onAddComment: (content: string, parentId?: number) => Promise<void>;
  onResolveToggle?: (commentId: number, currentResolved: boolean) => Promise<void>;
  onDeleteComment?: (commentId: number) => Promise<void>;
  onClose: () => void;
}

export const LineCommentThread: React.FC<LineCommentThreadProps> = ({
  comment,
  lineNumber,
  canComment,
  currentUserId,
  currentUserRole,
  onAddComment,
  onResolveToggle,
  onDeleteComment,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || submitting || !canComment) return;

    try {
      setSubmitting(true);
      await onAddComment(inputText.trim(), comment ? comment.id : undefined);
      setInputText('');
    } finally {
      setSubmitting(false);
    }
  };

  const isElevated = ['owner', 'admin', 'teacher', 'team_leader'].includes(currentUserRole || '');

  return (
    <div
      className="my-1.5 mx-2 rounded-lg border shadow-md text-xs overflow-hidden transition-all"
      style={{
        background: 'var(--surface)',
        borderColor: comment?.resolved ? 'var(--border)' : 'var(--accent)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={13} style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>
            Line {lineNumber}
          </span>
          {comment && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                background: comment.resolved ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: comment.resolved ? '#22c55e' : 'var(--accent)',
              }}
            >
              {comment.resolved ? 'Resolved' : 'Open'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {comment && onResolveToggle && canComment && (
            <button
              onClick={() => onResolveToggle(comment.id, comment.resolved)}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title={comment.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
            >
              <Check size={13} style={{ color: comment.resolved ? '#22c55e' : undefined }} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Close thread"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Existing Comments / Replies */}
      {comment && (
        <div className="p-3 space-y-2.5 max-h-60 overflow-y-auto">
          {/* Main comment */}
          <div className="group relative">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] uppercase"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {comment.author?.username?.[0] ?? 'U'}
                </div>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  {comment.author?.username ?? 'Anonymous'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {onDeleteComment && (comment.userId === currentUserId || isElevated) && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 transition-opacity"
                  title="Delete comment"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <p className="pl-6 text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text)' }}>
              {comment.content}
            </p>
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="pl-4 space-y-2 border-l-2 ml-2" style={{ borderColor: 'var(--border)' }}>
              {comment.replies.map((reply) => (
                <div key={reply.id} className="group relative pt-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <CornerDownRight size={11} style={{ color: 'var(--muted)' }} />
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] uppercase"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      >
                        {reply.author?.username?.[0] ?? 'U'}
                      </div>
                      <span className="font-medium text-[11px]" style={{ color: 'var(--text)' }}>
                        {reply.author?.username ?? 'Anonymous'}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                        {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {onDeleteComment && (reply.userId === currentUserId || isElevated) && (
                      <button
                        onClick={() => onDeleteComment(reply.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-opacity"
                        title="Delete reply"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <p className="pl-6 text-[11px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text)' }}>
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input / Reply box */}
      {canComment ? (
        <form onSubmit={handleSubmit} className="p-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={comment ? 'Reply to comment...' : 'Leave a comment on this line...'}
            disabled={submitting}
            className="flex-1 px-2.5 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || submitting}
            className="px-2.5 py-1.5 rounded flex items-center gap-1 font-medium text-xs disabled:opacity-50 transition-opacity"
            style={{
              background: 'var(--accent)',
              color: '#fff',
            }}
          >
            <Send size={11} />
            <span>{comment ? 'Reply' : 'Post'}</span>
          </button>
        </form>
      ) : (
        <div className="p-2 text-center text-[11px]" style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}>
          View-only mode: You don't have permission to comment.
        </div>
      )}
    </div>
  );
};
