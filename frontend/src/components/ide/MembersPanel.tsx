import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Copy, Check, Trash2, Crown, Shield, Eye, EyeOff, Edit3, X,
  GraduationCap, Lock, FileCode
} from 'lucide-react';
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole, WorkspaceType, StudentAccessLevel } from '../../types';
import { collabService } from '../../services/workspaceCollabService';
import { Spinner } from '../ui/Spinner';

interface Props {
  workspaceId: string;
  workspaceType?: WorkspaceType;
  myRole: WorkspaceRole;
  currentUserId: number;
  token: string | null;
  activeMemberFiles?: Record<number, string>;
  onClose: () => void;
  onStudentAccessUpdated?: (userId: number, access: StudentAccessLevel) => void;
}

export function MembersPanel({
  workspaceId,
  workspaceType = 'educational',
  myRole,
  currentUserId,
  token,
  activeMemberFiles,
  onClose,
  onStudentAccessUpdated,
}: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [selectedInviteRole, setSelectedInviteRole] = useState<WorkspaceRole>(
    workspaceType === 'educational' ? 'student' : workspaceType === 'professional' ? 'developer' : 'editor'
  );
  const [updatingAccessUserId, setUpdatingAccessUserId] = useState<number | null>(null);

  const isTeacher = myRole === 'teacher' || myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const isTeamLeader = myRole === 'team_leader';
  const canManageRoles = isOwner || isAdmin || isTeacher || isTeamLeader;
  const canManageInvites = canManageRoles || myRole === 'editor' || myRole === 'developer';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [memRes, invRes] = await Promise.all([
        collabService.getMembers(workspaceId, token),
        canManageInvites ? collabService.getInvites(workspaceId, token) : Promise.resolve({ success: true, invites: [] }),
      ]);

      if (memRes.success) setMembers(memRes.members);
      if (canManageInvites && invRes.success) setInvites(invRes.invites);
    } catch {
      setError('Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, token, canManageInvites]);

  const canChangeMember = (targetMember: WorkspaceMember) => {
    if (targetMember.userId === currentUserId) return false;
    if (isOwner) return true;
    if (isTeacher) return targetMember.role === 'student' || targetMember.role === 'viewer';
    if (isTeamLeader) return targetMember.role === 'developer' || targetMember.role === 'viewer';
    if (isAdmin) {
      return targetMember.role === 'editor' || targetMember.role === 'viewer' || targetMember.role === 'student' || targetMember.role === 'developer';
    }
    return false;
  };

  const canRemove = (targetMember: WorkspaceMember) => {
    if (targetMember.userId === currentUserId) return false;
    if (isOwner) return true;
    if (isTeacher) return targetMember.role === 'student' || targetMember.role === 'viewer';
    if (isTeamLeader) return targetMember.role === 'developer' || targetMember.role === 'viewer';
    if (isAdmin) {
      return targetMember.role === 'editor' || targetMember.role === 'viewer' || targetMember.role === 'student' || targetMember.role === 'developer';
    }
    return false;
  };

  const handleRoleChange = async (userId: number, newRole: WorkspaceRole) => {
    if (!canManageRoles) return;
    try {
      const res = await collabService.updateMemberRole(workspaceId, userId, newRole, token);
      if (res && (res as any).success) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
      } else {
        setError((res as any)?.error || 'Failed to update role');
      }
    } catch {
      setError('Failed to update role');
    }
  };

  const handleAccessChange = async (userId: number, access: StudentAccessLevel) => {
    if (!isTeacher) return;
    setUpdatingAccessUserId(userId);
    try {
      const res = await collabService.updateStudentAccess(workspaceId, userId, access, token);
      if (res && res.success) {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, studentAccess: access } : m));
        onStudentAccessUpdated?.(userId, access);
      } else {
        setError((res as any)?.error || 'Failed to update student access');
      }
    } catch {
      setError('Failed to update student access');
    } finally {
      setUpdatingAccessUserId(null);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!canManageRoles) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await collabService.removeMember(workspaceId, userId, token);
      if (res && (res as any).success) {
        setMembers(prev => prev.filter(m => m.userId !== userId));
      } else {
        setError((res as any)?.error || 'Failed to remove member');
      }
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleGenerateInvite = async () => {
    if (!canManageInvites) return;
    setGeneratingInvite(true);
    try {
      const res = await collabService.createInvite(workspaceId, { role: selectedInviteRole }, token);
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
    if (!canManageRoles) return;
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
    switch (role) {
      case 'owner': return '#e3b341';
      case 'teacher': return '#a855f7';
      case 'team_leader': return '#f59e0b';
      case 'admin': return '#58a6ff';
      case 'editor': return '#3fb950';
      case 'developer': return '#10b981';
      case 'student': return '#38bdf8';
      case 'no-view': return '#ef4444';
      default: return 'var(--muted)';
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown size={12} />;
      case 'teacher': return <GraduationCap size={12} />;
      case 'team_leader': return <Crown size={12} />;
      case 'admin': return <Shield size={12} />;
      case 'editor': return <Edit3 size={12} />;
      case 'developer': return <Edit3 size={12} />;
      case 'student': return <GraduationCap size={12} />;
      case 'no-view': return <EyeOff size={12} />;
      default: return <Eye size={12} />;
    }
  };

  return (
    <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col shadow-2xl animate-fade-in"
      style={{ width: 340, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: 'var(--text)' }} />
          <div>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {workspaceType === 'educational' ? 'Classroom Roster & Access' : 'Members & RBAC'}
            </h2>
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: workspaceType === 'educational' ? '#a855f7' : workspaceType === 'professional' ? '#3b82f6' : '#f59e0b' }}>
              {workspaceType} Mode
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {error && (
          <div className="p-2.5 rounded text-xs" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        ) : (
          <>
            {/* Members List */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Workspace Members ({members.length})
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: roleColor(myRole) }}>
                  You: {myRole}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {members.map(m => (
                  <div key={m.id} className="flex flex-col p-2.5 rounded-lg gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                          style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                          {m.User?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium truncate block" style={{ color: 'var(--text)' }}>
                            {m.User?.username} {m.userId === currentUserId && '(You)'}
                          </span>
                          <span className="text-[11px] truncate block opacity-70" style={{ color: 'var(--muted)' }}>{m.User?.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {canChangeMember(m) ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                            className="text-xs p-1 rounded outline-none cursor-pointer font-medium"
                            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          >
                            {workspaceType === 'educational' ? (
                              <>
                                <option value="student">Student</option>
                                {isOwner && <option value="teacher">Teacher</option>}
                                <option value="viewer">Viewer</option>
                              </>
                            ) : workspaceType === 'professional' ? (
                              <>
                                <option value="developer">Developer</option>
                                {isOwner && <option value="team_leader">Team Leader</option>}
                                <option value="viewer">Viewer</option>
                              </>
                            ) : (
                              <>
                                {isOwner && <option value="owner">Owner</option>}
                                {isOwner && <option value="admin">Admin</option>}
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </>
                            )}
                          </select>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                            style={{ color: roleColor(m.role), border: `1px solid ${roleColor(m.role)}` }}>
                            {roleIcon(m.role)} {m.role}
                          </span>
                        )}

                        {canRemove(m) && (
                          <button onClick={() => handleRemoveMember(m.userId)} className="p-1 rounded hover:opacity-100 opacity-60"
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                            title="Remove member">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Professional Workspace: Active File Focus */}
                    {workspaceType === 'professional' && activeMemberFiles?.[m.userId] && (
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 font-mono">
                        <FileCode size={11} className="shrink-0" />
                        <span className="truncate">Working on: {activeMemberFiles[m.userId]}</span>
                      </div>
                    )}

                    {/* Educational Workspace: Student Access Permissions (no-view, viewer, editor) */}
                    {(m.role === 'student' || workspaceType === 'educational') && m.role !== 'teacher' && (
                      <div className="pt-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                            <GraduationCap size={11} className="text-purple-400" /> Student Access:
                          </span>
                          <span className="text-[10px] font-mono font-bold capitalize"
                            style={{
                              color: (m.studentAccess || 'editor') === 'no-view' ? 'var(--error)' : (m.studentAccess || 'editor') === 'viewer' ? '#38bdf8' : '#3fb950'
                            }}>
                            {m.studentAccess || 'editor'}
                          </span>
                        </div>

                        {isTeacher ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            {(['no-view', 'viewer', 'editor'] as StudentAccessLevel[]).map(lvl => {
                              const currentLvl = m.studentAccess || 'editor';
                              const isActive = currentLvl === lvl;
                              const isPending = updatingAccessUserId === m.userId;
                              return (
                                <button
                                  key={lvl}
                                  disabled={isPending}
                                  onClick={() => handleAccessChange(m.userId, lvl)}
                                  className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                                  style={{
                                    background: isActive
                                      ? lvl === 'no-view'
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : lvl === 'viewer'
                                        ? 'rgba(56, 189, 248, 0.2)'
                                        : 'rgba(63, 185, 80, 0.2)'
                                      : 'var(--bg)',
                                    color: isActive
                                      ? lvl === 'no-view'
                                        ? '#ef4444'
                                        : lvl === 'viewer'
                                        ? '#38bdf8'
                                        : '#3fb950'
                                      : 'var(--muted)',
                                    border: `1px solid ${
                                      isActive
                                        ? lvl === 'no-view'
                                          ? '#ef4444'
                                          : lvl === 'viewer'
                                          ? '#38bdf8'
                                          : '#3fb950'
                                        : 'var(--border)'
                                    }`,
                                    cursor: isPending ? 'not-allowed' : 'pointer',
                                    opacity: isPending ? 0.6 : 1,
                                  }}
                                  title={`Set access to ${lvl}`}
                                >
                                  {lvl === 'no-view' ? (
                                    <>
                                      <EyeOff size={10} /> No-View
                                    </>
                                  ) : lvl === 'viewer' ? (
                                    <>
                                      <Eye size={10} /> Viewer
                                    </>
                                  ) : (
                                    <>
                                      <Edit3 size={10} /> Editor
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                            Current Access: <strong className="capitalize" style={{ color: 'var(--text)' }}>{m.studentAccess || 'editor'}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Session / Education badges */}
                    {(m.sessionRole && m.sessionRole !== 'none') && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border)]">
                        {m.sessionRole === 'teacher' ? (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 font-bold uppercase tracking-wider">
                            <GraduationCap size={10} /> Teacher
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
                            Student {m.editorLocked && <span className="flex items-center text-amber-400 font-bold ml-1"><Lock size={9} /> Locked</span>}
                            {m.handRaised && <span className="ml-1">✋</span>}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Invites Section */}
            {canManageInvites && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Invite Links</h3>
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedInviteRole}
                      onChange={(e) => setSelectedInviteRole(e.target.value as WorkspaceRole)}
                      className="text-xs p-1 rounded outline-none cursor-pointer"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      {workspaceType === 'educational' ? (
                        <>
                          <option value="student">Student</option>
                          {isOwner && <option value="teacher">Teacher</option>}
                          <option value="viewer">Viewer</option>
                        </>
                      ) : workspaceType === 'professional' ? (
                        <>
                          <option value="developer">Developer</option>
                          {isOwner && <option value="team_leader">Team Leader</option>}
                          <option value="viewer">Viewer</option>
                        </>
                      ) : (
                        <>
                          {(isOwner || isAdmin) && <option value="admin">Admin</option>}
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </>
                      )}
                    </select>
                    <button onClick={handleGenerateInvite} disabled={generatingInvite}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                      style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: generatingInvite ? 'not-allowed' : 'pointer', opacity: generatingInvite ? 0.7 : 1 }}>
                      <UserPlus size={12} /> {generatingInvite ? '...' : 'Invite'}
                    </button>
                  </div>
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
                              Role: <strong style={{ color: roleColor(invite.role) }}>{invite.role}</strong>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Used: {invite.usedCount}</span>
                              {canManageRoles && (
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
