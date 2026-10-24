import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Copy, Check, Trash2, Crown, Shield, Eye, EyeOff, Edit3, X,
  GraduationCap, Lock, FileCode, Hand, Search, CheckSquare, Square, MinusSquare,
  MessageSquare, Plus
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
  socket?: any;
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
  socket,
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
    workspaceType === 'educational' ? 'student' : workspaceType === 'professional' ? 'developer' : workspaceType === 'competitive' ? 'team_member' : 'editor'
  );
  const [updatingAccessUserId, setUpdatingAccessUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const isEducational = workspaceType === 'educational';
  const isProfessional = workspaceType === 'professional';
  const isCompetitive = workspaceType === 'competitive';

  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);

  const isTeacherMember = (role?: string) =>
    role === 'teacher' || role === 'owner' || role === 'admin';
  const isTeacher = isTeacherMember(myRole);
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const isTeamLeader = myRole === 'team_leader';
  const canManageRoles = isEducational
    ? isTeacher
    : isProfessional
    ? (isOwner || isAdmin || isTeamLeader)
    : isCompetitive
    ? (isOwner || isAdmin)
    : (isOwner || isAdmin || isTeacher || isTeamLeader);
  const canManageInvites = canManageRoles || myRole === 'editor' || myRole === 'developer';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [memRes, invRes, allowRes] = await Promise.all([
        collabService.getMembers(workspaceId, token),
        canManageInvites ? collabService.getInvites(workspaceId, token) : Promise.resolve({ success: true, invites: [] }),
        isCompetitive ? collabService.getAllowlist(workspaceId, token) : Promise.resolve({ success: true, allowedEmails: [] }),
      ]);

      if (memRes.success) setMembers(memRes.members);
      if (canManageInvites && invRes.success) setInvites(invRes.invites);
      if (isCompetitive && allowRes.success && allowRes.allowedEmails) setAllowedEmails(allowRes.allowedEmails);
    } catch {
      setError('Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  };

  // Search registered CodeSync users as admin types
  useEffect(() => {
    const q = newEmailInput.trim();
    if (!q) {
      setEmailSuggestions([]);
      setShowEmailDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingEmail(true);
      try {
        const res = await collabService.searchUsers(q, token);
        if (res.success && res.users) {
          const filtered = res.users.filter(u => !allowedEmails.map(e => e.toLowerCase()).includes(u.email.toLowerCase()));
          setEmailSuggestions(filtered);
          setShowEmailDropdown(true);
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingEmail(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [newEmailInput, token, allowedEmails]);

  const handleAddAllowedEmail = async (overrideEmail?: string) => {
    const email = (overrideEmail || newEmailInput).trim().toLowerCase();
    setAllowlistError(null);
    if (!email || addingEmail) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAllowlistError('Please enter a valid email address.');
      return;
    }

    if (allowedEmails.some(e => e.toLowerCase() === email)) {
      setAllowlistError('This email is already added to the allowlist.');
      return;
    }

    setAddingEmail(true);
    try {
      const res = await collabService.addAllowedEmails(workspaceId, [email], token);
      if (res.success && res.allowedEmails) {
        setAllowedEmails(res.allowedEmails);
        setNewEmailInput('');
        setShowEmailDropdown(false);
        setEmailSuggestions([]);
      } else {
        setAllowlistError((res as any)?.error || 'Failed to add email to allowlist');
      }
    } catch (err: any) {
      setAllowlistError(err?.message || 'Failed to add email to allowlist');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleRemoveAllowedEmail = async (email: string) => {
    try {
      const res = await collabService.removeAllowedEmail(workspaceId, email, token);
      if (res.success && res.allowedEmails) {
        setAllowedEmails(res.allowedEmails);
      } else {
        setError((res as any)?.error || 'Failed to remove email from allowlist');
      }
    } catch {
      setError('Failed to remove email from allowlist');
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, token, canManageInvites, isCompetitive]);

  useEffect(() => {
    if (!socket) return;
    const handleAccessChanged = (data: { userId: number; studentAccess: StudentAccessLevel }) => {
      setMembers(prev => prev.map(m => Number(m.userId) === Number(data.userId) ? {
        ...m,
        studentAccess: data.studentAccess
      } : m));
    };
    socket.on('member:access_changed', handleAccessChanged);
    return () => {
      socket.off('member:access_changed', handleAccessChanged);
    };
  }, [socket]);

  useEffect(() => {
    setSelectedUserIds(prev => prev.filter(id => members.some(m => m.userId === id)));
  }, [members]);

  const isMemberAccessModifiable = (targetMember: WorkspaceMember) => {
    if (targetMember.userId === currentUserId) return false;
    if (isCompetitive) return false; // Roles in competitive are strictly Admin (view & comment) and Team Member (edit)
    const isTargetOwner = targetMember.role === 'owner';
    const isTargetAdmin = targetMember.role === 'owner' || targetMember.role === 'admin' || targetMember.role === 'team_leader';
    const isTargetTeacher = targetMember.role === 'teacher' || targetMember.role === 'admin';
    const isTargetStudent = !isTargetOwner && !isTargetTeacher;
    const isCurrentUserOwner = myRole === 'owner';
    const isCurrentUserAdmin = isOwner || isAdmin || isTeamLeader;
    const isCurrentUserTeacher = isCurrentUserOwner || myRole === 'teacher' || myRole === 'admin';

    if (isEducational) {
      return (
        (isCurrentUserOwner && !isTargetOwner) ||
        (isCurrentUserTeacher && isTargetStudent)
      );
    }
    if (isProfessional) {
      return isCurrentUserAdmin && !isTargetAdmin;
    }
    return (isOwner || isAdmin) && !isTargetOwner;
  };

  const filteredMembers = members.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const username = (m.User?.username || (m as any).username || '').toLowerCase();
    return username.includes(q);
  });

  const eligibleFilteredMembers = filteredMembers.filter(isMemberAccessModifiable);
  const eligibleFilteredIds = eligibleFilteredMembers.map(m => m.userId);
  const isAllEligibleSelected =
    eligibleFilteredIds.length > 0 && eligibleFilteredIds.every(id => selectedUserIds.includes(id));
  const isSomeEligibleSelected =
    !isAllEligibleSelected && eligibleFilteredIds.some(id => selectedUserIds.includes(id));

  const handleToggleSelectAll = () => {
    if (isAllEligibleSelected) {
      setSelectedUserIds(prev => prev.filter(id => !eligibleFilteredIds.includes(id)));
    } else {
      setSelectedUserIds(prev => {
        const next = new Set([...prev, ...eligibleFilteredIds]);
        return Array.from(next);
      });
    }
  };

  const handleToggleSelectUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const canChangeMember = (targetMember: WorkspaceMember) => {
    if (isEducational || isCompetitive) return false;
    if (targetMember.userId === currentUserId) return false;
    if (isProfessional) {
      if (isOwner || isAdmin || isTeamLeader) {
        return targetMember.role === 'developer' || targetMember.role === 'tester';
      }
      return false;
    }
    if (isOwner) return true;
    if (isTeacher) return targetMember.role === 'student' || targetMember.role === 'viewer';
    if (isTeamLeader) return targetMember.role === 'developer' || targetMember.role === 'viewer' || targetMember.role === 'tester';
    if (isAdmin) {
      return targetMember.role === 'editor' || targetMember.role === 'viewer' || targetMember.role === 'student' || targetMember.role === 'developer' || targetMember.role === 'tester';
    }
    return false;
  };

  const canRemove = (targetMember: WorkspaceMember) => {
    if (targetMember.userId === currentUserId) return false;
    if (isCompetitive) {
      if (isOwner || isAdmin) {
        return targetMember.role !== 'owner' && targetMember.role !== 'admin';
      }
      return false;
    }
    if (isEducational) {
      if (myRole === 'owner') return true;
      if (myRole === 'teacher' || myRole === 'admin') {
        return targetMember.role !== 'owner' && targetMember.role !== 'teacher' && targetMember.role !== 'admin';
      }
      return false;
    }
    if (isProfessional) {
      if (isOwner) return true;
      if (isAdmin || isTeamLeader) {
        return targetMember.role === 'developer' || targetMember.role === 'tester';
      }
      return false;
    }
    if (isOwner) return true;
    if (isTeacher) return targetMember.role === 'student' || targetMember.role === 'viewer';
    if (isTeamLeader) return targetMember.role === 'developer' || targetMember.role === 'viewer' || targetMember.role === 'tester';
    if (isAdmin) {
      return targetMember.role === 'editor' || targetMember.role === 'viewer' || targetMember.role === 'student' || targetMember.role === 'developer' || targetMember.role === 'tester';
    }
    return false;
  };

  const handleRoleChange = async (userId: number, newRole: WorkspaceRole) => {
    if (!canManageRoles) return;
    try {
      const res = await collabService.updateMemberRole(workspaceId, userId, newRole, token);
      if (res && (res as any).success) {
        const nextAccess: StudentAccessLevel | undefined =
          newRole === 'editor' ? 'editor' : newRole === 'viewer' ? 'viewer' : newRole === 'developer' ? 'editor' : newRole === 'tester' ? 'viewer' : undefined;
        setMembers(prev => prev.map(m => m.userId === userId ? {
          ...m,
          role: newRole,
          ...(nextAccess ? { studentAccess: nextAccess } : {}),
        } : m));
        if (nextAccess) {
          onStudentAccessUpdated?.(userId, nextAccess);
        }
      } else {
        setError((res as any)?.error || 'Failed to update role');
      }
    } catch {
      setError('Failed to update role');
    }
  };

  const handleAccessChange = async (userId: number, access: StudentAccessLevel) => {
    if (userId === currentUserId) return;
    if (isEducational && !isTeacher) return;
    if (isProfessional && !isOwner && !isAdmin && !isTeamLeader) return;
    setUpdatingAccessUserId(userId);
    try {
      if (socket) {
        socket.emit('member:set_access', { workspaceId, userId, access });
      }
      const res = await collabService.updateStudentAccess(workspaceId, userId, access, token);
      if (res && res.success) {
        setMembers(prev => prev.map(m => m.userId === userId ? {
          ...m,
          studentAccess: access
        } : m));
        onStudentAccessUpdated?.(userId, access);
      } else {
        setError((res as any)?.error || 'Failed to update access level');
      }
    } catch {
      setError('Failed to update access level');
    } finally {
      setUpdatingAccessUserId(null);
    }
  };

  const handleBulkAccessChange = async (access: StudentAccessLevel) => {
    if (selectedUserIds.length === 0) return;
    setBulkUpdating(true);
    setError('');
    try {
      if (socket) {
        socket.emit('member:set_access_bulk', { workspaceId, userIds: selectedUserIds, access });
      }
      const res = await collabService.updateBulkStudentAccess(workspaceId, selectedUserIds, access, token);
      if (res && res.success) {
        const updatedIds = res.updatedUserIds || selectedUserIds;
        setMembers(prev => prev.map(m => updatedIds.includes(m.userId) ? {
          ...m,
          studentAccess: access
        } : m));
        updatedIds.forEach(id => onStudentAccessUpdated?.(id, access));
        setSelectedUserIds([]);
      } else {
        setError((res as any)?.error || 'Failed to update access levels');
      }
    } catch {
      setError('Failed to update access levels in bulk');
    } finally {
      setBulkUpdating(false);
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
      case 'tester': return '#f43f5e';
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
      case 'tester': return <Eye size={12} />;
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Workspace Members ({filteredMembers.length}{filteredMembers.length !== members.length ? ` of ${members.length}` : ''})
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium capitalize"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: isEducational
                      ? (myRole === 'owner' ? '#eab308' : (myRole === 'teacher' || myRole === 'admin') ? '#a855f7' : '#38bdf8')
                      : isProfessional
                      ? (myRole === 'team_leader' || myRole === 'owner' || myRole === 'admin' ? '#58a6ff' : myRole === 'developer' ? '#10b981' : '#f43f5e')
                      : isCompetitive
                      ? (myRole === 'admin' || myRole === 'owner' ? '#eab308' : '#10b981')
                      : roleColor(myRole)
                  }}>
                  You: {
                    isEducational
                      ? (myRole === 'owner' ? 'Admin' : (myRole === 'teacher' || myRole === 'admin') ? 'Teacher' : 'Student')
                      : isProfessional
                      ? (myRole === 'team_leader' ? 'Team Lead' : myRole === 'owner' || myRole === 'admin' ? 'Admin' : myRole === 'developer' ? 'Developer' : myRole === 'tester' ? 'Tester' : myRole)
                      : isCompetitive
                      ? (myRole === 'admin' || myRole === 'owner' ? 'Admin (View & Comment)' : 'Team Member (Edit)')
                      : (myRole === 'editor' ? 'Edit' : myRole === 'viewer' ? 'View' : myRole)
                  }
                </span>
              </div>

              {/* Competitive Workspace: Hackathon Team Email Allowlist */}
              {isCompetitive && (isAdmin || isOwner) && (
                <div
                  className="p-3 rounded-lg mb-3 shadow-sm animate-fade-in"
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-yellow-500">
                      <Shield size={13} /> Hackathon Team Email Allowlist
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                      style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                      {allowedEmails.length} allowed
                    </span>
                  </div>
                  <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                    Only registered team members with these Gmail / email addresses are permitted into this workspace.
                  </p>

                  <div className="relative mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="email"
                          value={newEmailInput}
                          onChange={(e) => {
                            setNewEmailInput(e.target.value);
                            setAllowlistError(null);
                          }}
                          onFocus={() => {
                            if (emailSuggestions.length > 0) setShowEmailDropdown(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAllowedEmail();
                            }
                            if (e.key === 'Escape') {
                              setShowEmailDropdown(false);
                            }
                          }}
                          placeholder="Type registered email or username…"
                          className="w-full px-2.5 py-1.5 text-xs rounded border focus:outline-none font-mono"
                          style={{
                            background: 'var(--bg)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        />
                        {isSearchingEmail && (
                          <span className="absolute right-2 top-2">
                            <Spinner size={11} />
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!newEmailInput.trim() || addingEmail}
                        onClick={() => handleAddAllowedEmail()}
                        className="px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-opacity disabled:opacity-50 shrink-0 shadow-sm"
                        style={{
                          background: '#eab308',
                          color: '#000',
                          border: 'none',
                          cursor: newEmailInput.trim() && !addingEmail ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {addingEmail ? <Spinner size={11} /> : <Plus size={11} />}
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showEmailDropdown && (
                      <div
                        className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden animate-fade-in"
                        style={{
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                          maxHeight: 180,
                          overflowY: 'auto',
                        }}
                      >
                        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border-b"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--border)' }}>
                          Registered CodeSync Accounts
                        </div>
                        {emailSuggestions.length === 0 ? (
                          <div className="p-2.5 text-center text-xs" style={{ color: 'var(--error)' }}>
                            No registered user found for &quot;{newEmailInput}&quot;. Team members must have an account on CodeSync.
                          </div>
                        ) : (
                          emailSuggestions.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                handleAddAllowedEmail(u.email);
                              }}
                              className="w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-[var(--surface-2)] transition-colors border-b last:border-b-0"
                              style={{
                                borderColor: 'var(--border)',
                                background: 'transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0"
                                  style={{ background: 'var(--accent)', color: '#fff' }}
                                >
                                  {u.username[0] || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                                    {u.username}
                                  </div>
                                  <div className="text-[11px] font-mono truncate" style={{ color: 'var(--muted)' }}>
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                                style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                              >
                                + Add
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {allowlistError && (
                      <p className="text-[11px] text-red-400 mt-1.5 font-medium">{allowlistError}</p>
                    )}
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {allowedEmails.length === 0 ? (
                      <p className="text-[10px] text-center py-1.5 italic" style={{ color: 'var(--muted)' }}>
                        No emails added yet. Enter team member emails above.
                      </p>
                    ) : (
                      allowedEmails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between px-2 py-1 rounded text-[11px]"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                        >
                          <span className="font-mono truncate" style={{ color: 'var(--text)' }}>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllowedEmail(email)}
                            className="p-0.5 rounded hover:text-red-500 opacity-60 hover:opacity-100 transition-colors"
                            title="Remove email"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative mb-2.5">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" style={{ color: 'var(--text)' }} />
                <input
                  type="text"
                  placeholder="Search members by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-7 py-1.5 rounded-md outline-none transition-all"
                  style={{
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-60 hover:opacity-100"
                    style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Select All / Selection Summary */}
              {eligibleFilteredMembers.length > 0 && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-100 opacity-80"
                    style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0 }}
                  >
                    {isAllEligibleSelected ? (
                      <CheckSquare size={14} className="text-blue-500" />
                    ) : isSomeEligibleSelected ? (
                      <MinusSquare size={14} className="text-blue-500" />
                    ) : (
                      <Square size={14} style={{ color: 'var(--muted)' }} />
                    )}
                    <span className="text-[11px]" style={{ color: 'var(--text)' }}>
                      {isAllEligibleSelected ? 'Deselect All' : 'Select All'} ({eligibleFilteredMembers.length})
                    </span>
                  </button>

                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="text-[11px] hover:underline"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      Clear ({selectedUserIds.length})
                    </button>
                  )}
                </div>
              )}

              {/* Bulk Access Actions */}
              {selectedUserIds.length > 0 && (
                <div
                  className="p-2.5 rounded-lg mb-3 flex flex-col gap-2 shadow-sm animate-fade-in"
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold flex items-center gap-1 text-blue-400">
                      <CheckSquare size={12} /> Access for {selectedUserIds.length} member{selectedUserIds.length > 1 ? 's' : ''}:
                    </span>
                    {bulkUpdating && <Spinner size={12} />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isEducational ? (
                      <>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('view')}
                          className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to View"
                        >
                          <Eye size={10} /> View
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('comment')}
                          className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            color: '#a855f7',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to Comment"
                        >
                          <MessageSquare size={10} /> Comment
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('edit')}
                          className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(63, 185, 80, 0.15)',
                            color: '#3fb950',
                            border: '1px solid rgba(63, 185, 80, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to Edit"
                        >
                          <Edit3 size={10} /> Edit
                        </button>
                      </>
                    ) : isProfessional ? (
                      <>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('view')}
                          className="flex-1 py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to View"
                        >
                          <Eye size={11} /> View
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('comment')}
                          className="flex-1 py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            color: '#a855f7',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to Comment"
                        >
                          <MessageSquare size={11} /> Comment
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('edit')}
                          className="flex-1 py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                          style={{
                            background: 'rgba(63, 185, 80, 0.15)',
                            color: '#3fb950',
                            border: '1px solid rgba(63, 185, 80, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                          title="Set selected members to Edit"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('view')}
                          className="flex-1 py-1 px-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                        >
                          <Eye size={10} /> View
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('comment')}
                          className="flex-1 py-1 px-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                          style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            color: '#a855f7',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                        >
                          <MessageSquare size={10} /> Comment
                        </button>
                        <button
                          type="button"
                          disabled={bulkUpdating}
                          onClick={() => handleBulkAccessChange('edit')}
                          className="flex-1 py-1 px-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1"
                          style={{
                            background: 'rgba(63, 185, 80, 0.15)',
                            color: '#3fb950',
                            border: '1px solid rgba(63, 185, 80, 0.3)',
                            cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                            opacity: bulkUpdating ? 0.6 : 1,
                          }}
                        >
                          <Edit3 size={10} /> Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {filteredMembers.length === 0 ? (
                <div className="text-center py-6 px-3 flex flex-col items-center gap-2 rounded-lg"
                  style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    No members found matching &quot;{searchQuery}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-semibold px-2.5 py-1 rounded transition-colors"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredMembers.map(m => {
                    const isTargetOwner = m.role === 'owner';
                    const isTargetAdmin = m.role === 'owner' || m.role === 'admin' || m.role === 'team_leader';
                    const isTargetTeacher = m.role === 'teacher' || m.role === 'admin';
                    const isSelf = m.userId === currentUserId;

                    // Default access: Teachers have editor access, Students have viewer access
                    // In professional workspace: developer has edit access, tester has view access
                    // In competitive workspace: admin has comment access, team member has edit access
                    const currentAccess: StudentAccessLevel =
                      m.studentAccess || (
                        isEducational
                          ? (isTargetTeacher ? 'edit' : isTargetOwner ? 'edit' : 'view')
                          : isProfessional
                          ? (isTargetAdmin ? 'edit' : m.role === 'developer' ? 'edit' : 'view')
                          : isCompetitive
                          ? (m.role === 'admin' || isTargetOwner ? 'comment' : 'edit')
                          : (m.role === 'editor' ? 'edit' : 'view')
                      );

                    const isAccessEdit = currentAccess === 'editor' || currentAccess === 'edit';
                    const isAccessComment = currentAccess === 'commenter' || currentAccess === 'comment';
                    const isAccessView = currentAccess === 'viewer' || currentAccess === 'view';
                    const accessDisplay = isAccessEdit ? 'Edit' : isAccessComment ? 'Comment' : 'View';

                    const canChangeAccess = isMemberAccessModifiable(m);
                    const isSelected = selectedUserIds.includes(m.userId);

                    return (
                      <div
                        key={m.id}
                        className="flex flex-col p-2.5 rounded-lg gap-2 transition-all"
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
                          border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'var(--border)'}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {canChangeAccess && (
                              <button
                                type="button"
                                onClick={() => handleToggleSelectUser(m.userId)}
                                className="shrink-0 p-0.5 rounded transition-colors hover:opacity-100 opacity-80"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                title={isSelected ? 'Deselect member' : 'Select member'}
                              >
                                {isSelected ? (
                                  <CheckSquare size={15} className="text-blue-500" />
                                ) : (
                                  <Square size={15} style={{ color: 'var(--muted)' }} />
                                )}
                              </button>
                            )}
                            <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                              {m.User?.username?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium truncate block" style={{ color: 'var(--text)' }}>
                                {m.User?.username} {isSelf && '(You)'}
                              </span>
                              <span className="text-[11px] truncate block opacity-70" style={{ color: 'var(--muted)' }}>{m.User?.email}</span>
                            </div>
                          </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCompetitive ? (
                            isTargetOwner || m.role === 'admin' ? (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                <Crown size={11} /> Admin
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <Edit3 size={11} /> Team Member
                              </span>
                            )
                          ) : isEducational ? (
                            isTargetOwner ? (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                <Crown size={11} /> Admin
                              </span>
                            ) : isTargetTeacher ? (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                <GraduationCap size={11} /> Teacher
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                <GraduationCap size={11} /> Student
                              </span>
                            )
                          ) : isProfessional ? (
                            isTargetAdmin ? (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ background: 'rgba(88, 166, 255, 0.15)', color: '#58a6ff', border: '1px solid rgba(88, 166, 255, 0.3)' }}>
                                <Crown size={11} /> {m.role === 'team_leader' ? 'Team Lead' : 'Admin'}
                              </span>
                            ) : canChangeMember(m) ? (
                              <select
                                value={m.role === 'developer' ? 'developer' : 'tester'}
                                onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                                className="text-xs p-1 rounded outline-none cursor-pointer font-medium"
                                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                              >
                                <option value="developer">Developer</option>
                                <option value="tester">Tester</option>
                              </select>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{
                                  background: m.role === 'developer' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                  color: m.role === 'developer' ? '#10b981' : '#f43f5e',
                                  border: `1px solid ${m.role === 'developer' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                                }}>
                                {m.role === 'developer' ? <><Edit3 size={11} /> Developer</> : <><Eye size={11} /> Tester</>}
                              </span>
                            )
                          ) : (
                            canChangeMember(m) ? (
                              <select
                                value={m.role}
                                onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                                className="text-xs p-1 rounded outline-none cursor-pointer font-medium"
                                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                              >
                                {isOwner && <option value="owner">Owner</option>}
                                {isOwner && <option value="admin">Admin</option>}
                                <option value="editor">Edit</option>
                                <option value="viewer">View</option>
                              </select>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                                style={{ color: roleColor(m.role), border: `1px solid ${roleColor(m.role)}` }}>
                                {roleIcon(m.role)} {m.role === 'editor' ? 'Edit' : m.role === 'viewer' ? 'View' : m.role}
                              </span>
                            )
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

                      {/* Educational Workspace: Role & Access Level Information */}
                      {isEducational && (
                        isTargetOwner ? (
                          // Workspace Admin / Owner: Access control switch options are completely removed
                          <div className="pt-2 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--border)' }}>
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                              <Shield size={12} className="text-yellow-500" /> Host & Workspace Admin
                            </span>
                            <span className="text-[11px] font-semibold text-yellow-500">Full Access</span>
                          </div>
                        ) : (
                          // Teachers (other than owner) and Students have Access Level:
                          <div className="pt-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                                <GraduationCap size={11} className="text-purple-400" /> Access Level:
                              </span>
                              <span className="text-[10px] font-mono font-bold"
                                style={{
                                  color: isAccessComment ? '#a855f7' : isAccessView ? '#38bdf8' : '#3fb950'
                                }}>
                                {accessDisplay}
                              </span>
                            </div>

                            {canChangeAccess ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                {(
                                  [
                                    { level: 'view', label: 'View', icon: Eye, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' },
                                    { level: 'comment', label: 'Comment', icon: MessageSquare, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
                                    { level: 'edit', label: 'Edit', icon: Edit3, color: '#3fb950', bg: 'rgba(63, 185, 80, 0.2)' },
                                  ] as const
                                ).map(item => {
                                  const isActive =
                                    (item.level === 'comment' && isAccessComment) ||
                                    (item.level === 'view' && isAccessView) ||
                                    (item.level === 'edit' && isAccessEdit);
                                  const isPending = updatingAccessUserId === m.userId;
                                  const IconComponent = item.icon;
                                  return (
                                    <button
                                      key={item.level}
                                      disabled={isPending}
                                      onClick={() => handleAccessChange(m.userId, item.level)}
                                      className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                                      style={{
                                        background: isActive ? item.bg : 'var(--bg)',
                                        color: isActive ? item.color : 'var(--muted)',
                                        border: `1px solid ${isActive ? item.color : 'var(--border)'}`,
                                        cursor: isPending ? 'not-allowed' : 'pointer',
                                        opacity: isPending ? 0.6 : 1,
                                      }}
                                      title={`Set access level to ${item.label}`}
                                    >
                                      <IconComponent size={10} /> {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--muted)] flex items-center justify-between">
                                <span>Current Access: <strong style={{ color: 'var(--text)' }}>{accessDisplay}</strong></span>
                                <span className="opacity-60 text-[9px]">
                                  {isTargetTeacher ? '(Teacher Privilege)' : '(Controlled by Teacher)'}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* Professional Workspace: Role & Access Level Information */}
                      {isProfessional && (
                        isTargetAdmin ? (
                          // Workspace Admin / Owner: Access control switch options are completely removed
                          <div className="pt-2 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--border)' }}>
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                              <Shield size={12} className="text-blue-400" /> {m.role === 'team_leader' ? 'Team Lead' : 'Host & Workspace Admin'}
                            </span>
                            <span className="text-[11px] font-semibold text-blue-400">Full Access</span>
                          </div>
                        ) : (
                          // Developers & Testers have Access Level: View, Comment, Edit
                          <div className="pt-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                                <Shield size={11} className="text-blue-400" /> Access Level:
                              </span>
                              <span className="text-[10px] font-mono font-bold"
                                style={{
                                  color: isAccessComment ? '#a855f7' : isAccessView ? '#38bdf8' : '#3fb950'
                                }}>
                                {accessDisplay}
                              </span>
                            </div>

                            {canChangeAccess ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                {(
                                  [
                                    { level: 'view', label: 'View', icon: Eye, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' },
                                    { level: 'comment', label: 'Comment', icon: MessageSquare, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
                                    { level: 'edit', label: 'Edit', icon: Edit3, color: '#3fb950', bg: 'rgba(63, 185, 80, 0.2)' },
                                  ] as const
                                ).map(item => {
                                  const isActive =
                                    (item.level === 'comment' && isAccessComment) ||
                                    (item.level === 'view' && isAccessView) ||
                                    (item.level === 'edit' && isAccessEdit);
                                  const isPending = updatingAccessUserId === m.userId;
                                  const IconComponent = item.icon;
                                  return (
                                    <button
                                      key={item.level}
                                      disabled={isPending}
                                      onClick={() => handleAccessChange(m.userId, item.level)}
                                      className="flex-1 py-1 px-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                                      style={{
                                        background: isActive ? item.bg : 'var(--bg)',
                                        color: isActive ? item.color : 'var(--muted)',
                                        border: `1px solid ${isActive ? item.color : 'var(--border)'}`,
                                        cursor: isPending ? 'not-allowed' : 'pointer',
                                        opacity: isPending ? 0.6 : 1,
                                      }}
                                      title={`Set access level to ${item.label}`}
                                    >
                                      <IconComponent size={10} /> {item.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--muted)] flex items-center justify-between">
                                <span>Current Access: <strong style={{ color: 'var(--text)' }}>{accessDisplay}</strong></span>
                                <span className="opacity-60 text-[9px]">
                                  (Controlled by Admin)
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* Competitive Workspace: Role & Access Level Information */}
                      {isCompetitive && (
                        <div className="pt-2 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--border)' }}>
                          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                            <Shield size={11} style={{ color: (m.role === 'admin' || isTargetOwner) ? '#eab308' : '#10b981' }} />
                            Access Level:
                          </span>
                          <span className="text-[10px] font-mono font-bold"
                            style={{ color: (m.role === 'admin' || isTargetOwner) ? '#eab308' : '#10b981' }}>
                            {(m.role === 'admin' || isTargetOwner) ? 'View & Comment Only' : 'View, Comment & Edit'}
                          </span>
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
                            {m.handRaised && <Hand size={10} className="inline ml-1 text-amber-400" />}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
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
                        </>
                      ) : workspaceType === 'professional' ? (
                        <>
                          <option value="developer">Developer</option>
                          <option value="tester">Tester</option>
                          {isOwner && <option value="admin">Admin</option>}
                        </>
                      ) : workspaceType === 'competitive' ? (
                        <>
                          <option value="team_member">Team Member</option>
                          {isOwner && <option value="admin">Admin</option>}
                        </>
                      ) : (
                        <>
                          {(isOwner || isAdmin) && <option value="admin">Admin</option>}
                          <option value="editor">Edit</option>
                          <option value="viewer">View</option>
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
                              Role: <strong style={{ color: roleColor(invite.role) }}>{invite.role === 'editor' ? 'Edit' : invite.role === 'viewer' ? 'View' : invite.role}</strong>
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
