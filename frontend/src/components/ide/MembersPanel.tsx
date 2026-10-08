import { useState, useEffect } from 'react';
import { Users, UserPlus, Copy, Check, Trash2, Crown, Eye, Edit3, X } from 'lucide-react';
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '../../types';
import { collabService } from '../../services/workspaceCollabService';
import { Spinner } from '../ui/Spinner';

interface Props {
  workspaceId: string;
  myRole: WorkspaceRole;
  currentUserId: number;
  token: string | null;
  onClose: () => void;
}

export function MembersPanel({ workspaceId, myRole, currentUserId, token, onClose }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const canManage = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [memRes, invRes] = await Promise.all([
        collabService.getMembers(workspaceId, token),
        canManage ? collabService.getInvites(workspaceId, token) : Promise.resolve({ success: true, invites: [] })
      ]);
      
      if (memRes.success) setMembers(memRes.members);
      if (canManage && invRes.success) setInvites(invRes.invites);
    } catch (e) {
      setError('Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, token, canManage]);

  const handleRoleChange = async (userId: number, newRole: WorkspaceRole) => {
    if (!isOwner) return;
    try {
      const res = await collabService.updateMemberRole(workspaceId, userId, newRole, token);
      if (res && (res as any).success) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
      } else {
        setError('Failed to update role');
      }
    } catch {
      setError('Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!isOwner) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await collabService.removeMember(workspaceId, userId, token);
      if (res && (res as any).success) {
        setMembers(prev => prev.filter(m => m.userId !== userId));
      } else {
        setError('Failed to remove member');
      }
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleGenerateInvite = async () => {
    if (!canManage) return;
    setGeneratingInvite(true);
    try {
      const res = await collabService.createInvite(workspaceId, { role: 'editor' }, token);
      if (res.success && res.invite) {
        setInvites(prev => [res.invite, ...prev]);
      } else {
        setError('Failed to generate invite');
      }
    } catch {
      setError('Failed to generate invite');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!isOwner) return;
    try {
      const res = await collabService.revokeInvite(workspaceId, inviteId, token);
      if (res && (res as any).success) {
        setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, active: false } : inv));
      }
    } catch {
      setError('Failed to revoke invite');
    }
  };

  const handleCopyInvite = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const handleLeave = async () => {
    if (isOwner) {
      const otherOwners = members.filter(m => m.role === 'owner' && m.userId !== currentUserId);
      if (otherOwners.length === 0) {
        setError('You are the only owner. Transfer ownership or delete the workspace instead.');
        return;
      }
    }
    if (!confirm('Are you sure you want to leave this workspace?')) return;
    try {
      const res = await collabService.leaveWorkspace(workspaceId, token);
      if (res && (res as any).success) {
        window.location.href = '/';
      } else {
        setError('Failed to leave workspace');
      }
    } catch {
      setError('Failed to leave workspace');
    }
  };

  const roleColor = (role: string) => {
    switch(role) {
      case 'owner': return 'var(--accent)';
      case 'editor': return 'var(--warning)';
      default: return 'var(--muted)';
    }
  };
  
  const roleIcon = (role: string) => {
    switch(role) {
      case 'owner': return <Crown size={12} />;
      case 'editor': return <Edit3 size={12} />;
      default: return <Eye size={12} />;
    }
  };

  return (
    <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col shadow-2xl animate-fade-in"
      style={{ width: 320, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: 'var(--text)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Members & Invites</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {error && <div className="p-2.5 rounded text-xs" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>{error}</div>}
        
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        ) : (
          <>
            {/* Members List */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Workspace Members ({members.length})</h3>
              <div className="flex flex-col gap-3">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                        {m.User?.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate block" style={{ color: 'var(--text)' }}>
                          {m.User?.username} {m.userId === currentUserId && '(You)'}
                        </span>
                        <span className="text-xs truncate block" style={{ color: 'var(--muted)' }}>{m.User?.email}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && m.userId !== currentUserId ? (
                        <select 
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                          className="text-xs p-1 rounded outline-none cursor-pointer"
                          style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                          style={{ color: roleColor(m.role), border: `1px solid ${roleColor(m.role)}` }}>
                          {roleIcon(m.role)} {m.role}
                        </span>
                      )}
                      
                      {isOwner && m.userId !== currentUserId && (
                        <button onClick={() => handleRemoveMember(m.userId)} className="p-1 rounded"
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                          title="Remove member">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Invites Section */}
            {canManage && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Active Invites</h3>
                  <button onClick={handleGenerateInvite} disabled={generatingInvite}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: generatingInvite ? 'not-allowed' : 'pointer', opacity: generatingInvite ? 0.7 : 1 }}>
                    <UserPlus size={12} /> {generatingInvite ? 'Generating...' : 'New Link'}
                  </button>
                </div>
                
                {invites.filter(i => i.active).length === 0 ? (
                  <p className="text-xs italic" style={{ color: 'var(--muted)' }}>No active invite links.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {invites.filter(i => i.active).map(invite => {
                      const url = invite.inviteUrl || `${window.location.origin}/?join=${invite.id}`;
                      return (
                        <div key={invite.id} className="flex flex-col p-2.5 rounded-lg gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]">
                              Role: {invite.role}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Used: {invite.usedCount}</span>
                              {isOwner && (
                                <button onClick={() => handleRevokeInvite(invite.id)} className="text-[10px] text-[var(--error)] hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Revoke</button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input readOnly value={url} className="flex-1 text-xs p-1.5 rounded outline-none" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }} />
                            <button onClick={() => handleCopyInvite(url, invite.id)} className="p-1.5 rounded transition-colors"
                              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: copiedInviteId === invite.id ? 'var(--success)' : 'var(--text)', cursor: 'pointer' }}>
                              {copiedInviteId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleLeave} className="w-full py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer' }}>
          Leave Workspace
        </button>
      </div>
    </div>
  );
}
