import React, { useState } from 'react';
import {
  MapPin,
  X,
  Send,
  User as UserIcon,
  Check,
  Sparkles,
} from 'lucide-react';
import type { PreviewAnnotation, AnnotationType, AnnotationStatus } from '../../types';

interface Props {
  annotations: PreviewAnnotation[];
  pinModeActive: boolean;
  onAddPin: (coords: { x: number; y: number }, payload: { title: string; comment: string; type: AnnotationType; priority: string; severity: string }) => void;
  onUpdateAnnotation: (id: string, payload: Partial<PreviewAnnotation>) => void;
  onAddReply: (id: string, comment: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function FigmaPinOverlay({
  annotations,
  pinModeActive,
  onAddPin,
  onUpdateAnnotation,
  onAddReply,
  containerRef,
}: Props) {
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [newPinDraft, setNewPinDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [draftType, setDraftType] = useState<AnnotationType>('bug');
  const [draftSeverity, setDraftSeverity] = useState('medium');
  const [draftPriority, setDraftPriority] = useState('medium');
  const [replyInput, setReplyInput] = useState('');

  const selectedPin = annotations.find((a) => a.id === selectedPinId);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinModeActive || !containerRef.current) return;

    // Check if clicked directly on an existing pin or popover
    if ((e.target as HTMLElement).closest('.figma-pin-node') || (e.target as HTMLElement).closest('.figma-popover')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    setNewPinDraft({ x, y });
    setSelectedPinId(null);
  };

  const handleCreatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinDraft || !draftTitle.trim() || !draftComment.trim()) return;

    onAddPin(newPinDraft, {
      title: draftTitle.trim(),
      comment: draftComment.trim(),
      type: draftType,
      priority: draftPriority,
      severity: draftSeverity,
    });

    setNewPinDraft(null);
    setDraftTitle('');
    setDraftComment('');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPinId || !replyInput.trim()) return;
    onAddReply(selectedPinId, replyInput.trim());
    setReplyInput('');
  };

  const getTypeColor = (type: AnnotationType) => {
    switch (type) {
      case 'bug':
        return '#ef4444'; // Red
      case 'suggestion':
        return '#3b82f6'; // Blue
      case 'change_request':
        return '#f59e0b'; // Amber
      default:
        return '#8b5cf6'; // Purple
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`absolute inset-0 z-20 pointer-events-auto ${pinModeActive ? 'cursor-crosshair' : 'pointer-events-none'}`}
      style={{ overflow: 'hidden' }}
    >
      {/* Existing Figma Pins */}
      {annotations.map((pin, index) => {
        if (!pin.coordinates) return null;
        const isSelected = pin.id === selectedPinId;
        const color = getTypeColor(pin.type);
        const isResolved = pin.status === 'resolved' || pin.status === 'verified';

        return (
          <div
            key={pin.id}
            className="absolute figma-pin-node pointer-events-auto transition-transform duration-150 select-none cursor-pointer"
            style={{
              left: `${pin.coordinates.x}%`,
              top: `${pin.coordinates.y}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: isSelected ? 40 : 25,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPinId(isSelected ? null : pin.id);
              setNewPinDraft(null);
            }}
          >
            <div
              className={`flex items-center justify-center rounded-full font-bold shadow-lg transition-all ${
                isSelected ? 'scale-125 ring-4 ring-white/40' : 'hover:scale-110'
              }`}
              style={{
                width: 28,
                height: 28,
                backgroundColor: isResolved ? '#10b981' : color,
                color: '#fff',
                fontSize: 12,
                border: '2px solid #ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
              title={`#${index + 1}: ${pin.title} (${pin.status})`}
            >
              {isResolved ? <Check size={14} /> : index + 1}
            </div>

            {/* Pin pointer stem */}
            <div
              className="mx-auto"
              style={{
                width: 2,
                height: 6,
                backgroundColor: isResolved ? '#10b981' : color,
              }}
            />
          </div>
        );
      })}

      {/* Draft Pin Indicator */}
      {newPinDraft && (
        <div
          className="absolute pointer-events-auto z-40 select-none animate-bounce"
          style={{
            left: `${newPinDraft.x}%`,
            top: `${newPinDraft.y}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white font-bold border-2 border-white shadow-xl text-xs">
            +
          </div>
          <div className="w-0.5 h-1.5 bg-indigo-600 mx-auto" />
        </div>
      )}

      {/* New Pin Creation Popover */}
      {newPinDraft && (
        <div
          className="absolute figma-popover pointer-events-auto z-50 p-4 rounded-2xl shadow-2xl backdrop-blur-md skeuo-card"
          style={{
            left: `${Math.min(newPinDraft.x, 70)}%`,
            top: `${Math.min(newPinDraft.y + 4, 60)}%`,
            width: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--accent)' }}>
              <MapPin size={14} /> Drop Review Pin ({newPinDraft.x}%, {newPinDraft.y}%)
            </span>
            <button
              onClick={() => setNewPinDraft(null)}
              className="p-1 rounded-lg cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleCreatePin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Feedback Title</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Broken checkout button layout"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Type</label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as AnnotationType)}
                  className="w-full px-2 py-1 text-xs rounded-lg border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="bug">Bug</option>
                  <option value="suggestion">Suggestion</option>
                  <option value="change_request">Change Request</option>
                  <option value="observation">Observation</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Severity</label>
                <select
                  value={draftSeverity}
                  onChange={(e) => setDraftSeverity(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Priority</label>
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border outline-none"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="low">P3 Low</option>
                  <option value="medium">P2 Medium</option>
                  <option value="high">P1 High</option>
                  <option value="urgent">P0 Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Details & Reproduction</label>
              <textarea
                rows={3}
                required
                placeholder="Describe expected vs actual behavior..."
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none resize-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setNewPinDraft(null)}
                className="btn-physical-surface text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-physical-primary text-xs px-3.5 py-1.5"
              >
                Save Pin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Selected Pin Thread Popover */}
      {selectedPin && !newPinDraft && (
        <div
          className="absolute figma-popover pointer-events-auto z-50 p-4 rounded-2xl shadow-2xl backdrop-blur-md skeuo-card"
          style={{
            left: `${Math.min(selectedPin.coordinates?.x || 50, 68)}%`,
            top: `${Math.min((selectedPin.coordinates?.y || 50) + 4, 55)}%`,
            width: 350,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between pb-2 mb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide text-white"
                  style={{ backgroundColor: getTypeColor(selectedPin.type) }}
                >
                  {selectedPin.type}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold font-mono"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                  {selectedPin.severity} severity
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold font-mono"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                  {selectedPin.status}
                </span>
              </div>
              <h4 className="font-bold text-sm mt-1.5" style={{ color: 'var(--text)' }}>{selectedPin.title}</h4>
            </div>
            <button
              onClick={() => setSelectedPinId(null)}
              className="p-1 rounded-lg cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Comment description */}
          <div className="p-2.5 rounded-xl border text-xs mb-3 leading-relaxed"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            {selectedPin.comment}
            <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]"
                 style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <span className="flex items-center gap-1">
                <UserIcon size={11} /> {selectedPin.author?.username || 'Reviewer'}
              </span>
              <span>{new Date(selectedPin.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Decision Outcome if attached */}
          {selectedPin.decision && (
            <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs mb-3">
              <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                <Sparkles size={12} /> Decision: {selectedPin.decision.outcome.toUpperCase()}
              </div>
              <p className="text-[11px] text-purple-200 mt-0.5">{selectedPin.decision.reasoning}</p>
            </div>
          )}

          {/* Threaded Discussion */}
          <div className="max-h-36 overflow-y-auto space-y-2 mb-3 pr-1">
            {(selectedPin.replies || []).map((reply) => (
              <div key={reply.id} className="p-2 rounded-lg text-xs"
                   style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center justify-between text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{reply.username}</span>
                  <span>{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text)' }}>{reply.comment}</p>
              </div>
            ))}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendReply} className="flex items-center gap-1.5 mb-3">
            <input
              type="text"
              placeholder="Reply to this pin..."
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border outline-none font-mono"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <button
              type="submit"
              disabled={!replyInput.trim()}
              className="p-1.5 rounded-lg btn-physical-primary cursor-pointer shrink-0 disabled:opacity-40"
              title="Send Reply"
            >
              <Send size={13} />
            </button>
          </form>

          {/* Resolution Lifecycle Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <select
              value={selectedPin.status}
              onChange={(e) => onUpdateAnnotation(selectedPin.id, { status: e.target.value as AnnotationStatus })}
              className="px-2 py-1 text-[11px] rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-medium"
            >
              <option value="open">Status: Open</option>
              <option value="in_progress">Status: In Progress</option>
              <option value="resolved">Status: Resolved</option>
              <option value="verified">Status: Verified</option>
              <option value="reopened">Status: Reopened</option>
              <option value="closed">Status: Closed</option>
            </select>

            <button
              onClick={() => {
                const outcome = selectedPin.decision ? null : {
                  outcome: 'accepted' as const,
                  reasoning: 'Verified and agreed during collaborative QA review.',
                  decidedAt: new Date().toISOString(),
                };
                onUpdateAnnotation(selectedPin.id, { decision: outcome });
              }}
              className="px-2.5 py-1 text-[10px] font-bold rounded bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50"
            >
              {selectedPin.decision ? 'Clear Decision' : '+ Record Decision'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
