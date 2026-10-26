import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import executionService from '../services/executionService.js';
import { setPortNotifier, getPreviewPort } from '../services/previewService.js';
import attachWhiteboardSocketHandlers from './whiteboardSocket.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/authConfig.js';
import { WorkspaceMember, TeachingSession, WorkspaceLock, LineComment, User } from '../models/index.js';
import { checkPathLocked } from '../controllers/lockController.js';

/**
 * Attaches real-time workspace socket event handlers to Socket.io server.
 * Enforces both Workspace RBAC (Professional) and Teaching Session RBAC (Education).
 * @param {import('socket.io').Server} io 
 */
function initWorkspaceSockets(io) {
  const workspaceNamespace = io.of('/workspace');

  // Real-time notification when a terminal process starts listening on an HTTP port
  setPortNotifier((wsId, port) => {
    workspaceNamespace.to(`workspace:${wsId}`).emit('preview:port-detected', { port });
  });

  // Room voice call tracking: roomName -> { teacherSocketId, teacherName }
  const activeCalls = new Map();

  workspaceNamespace.on('connection', (socket) => {
    let currentWorkspaceId = null;

    console.log(`[Socket] Client connected: ${socket.id}`);

    // Attach Whiteboard Socket Listeners
    attachWhiteboardSocketHandlers(socket, workspaceNamespace);

    const inRoom = (wsId) => !!wsId && socket.rooms.has(`workspace:${wsId}`);

    // User joins workspace room
    socket.on('join-workspace', async ({ workspaceId, token }) => {
      if (!workspaceId) return;

      if (!token) {
        socket.emit('workspace-error', { message: 'Unauthorized: token missing' });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        socket.emit('workspace-error', { message: 'Unauthorized: invalid token' });
        return;
      }

      const ws = await workspaceService.getWorkspace(workspaceId);
      const isCompetitive = ws?.type === 'competitive';
      const isEducational = ws?.type === 'educational';

      let membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId: decoded.id }
      });

      if (!membership && isCompetitive) {
        const userEmail = (decoded.email || '').toLowerCase().trim();
        const allowed = (ws?.allowedEmails || []).map(e => (typeof e === 'string' ? e.toLowerCase().trim() : ''));
        const isCreator =
          (decoded.id && ws?.createdBy === decoded.id) ||
          (userEmail && (ws?.creatorEmail === userEmail || ws?.adminEmail === userEmail));

        if (isCreator) {
          membership = await WorkspaceMember.create({
            workspaceId,
            userId: decoded.id,
            role: 'admin',
            studentAccess: 'commenter',
          });
        } else if (userEmail && allowed.includes(userEmail)) {
          membership = await WorkspaceMember.create({
            workspaceId,
            userId: decoded.id,
            role: 'team_member',
            studentAccess: 'editor',
          });
        } else {
          // Check if admin
          const isAdminSomewhere = await WorkspaceMember.findOne({
            where: { userId: decoded.id, role: 'admin' },
          });
          if (isAdminSomewhere) {
            membership = await WorkspaceMember.create({
              workspaceId,
              userId: decoded.id,
              role: 'admin',
              studentAccess: 'commenter',
            });
          }
        }
      }

      if (!membership) {
        const msg = isCompetitive
          ? 'Access denied: Only registered team members on the email allowlist can access this workspace.'
          : 'Not a member of this workspace';
        socket.emit('workspace-error', { message: msg });
        return;
      }

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.role = membership.role;                 // 'owner' | 'admin' | 'editor' | 'viewer' | 'teacher' | 'student' | 'team_leader' | 'developer' | 'team_member'
      socket.sessionRole = membership.sessionRole;   // 'teacher' | 'student' | 'none'
      socket.editorLocked = membership.editorLocked; // boolean
      socket.handRaised = membership.handRaised;     // boolean
      socket.studentAccess = isCompetitive && membership.role === 'admin'
        ? 'commenter' // Admin can view and comment only!
        : membership.studentAccess ||
          (membership.role === 'tester' || membership.role === 'viewer' ? 'viewer' : 'editor');

      currentWorkspaceId = workspaceId;
      const roomName = `workspace:${workspaceId}`;

      socket.join(roomName);
      workspaceService.incrementUserCount(workspaceId);

      // Voice call presence for late joiners
      const call = activeCalls.get(roomName);
      if (call) {
        socket.emit('voice-started', { teacherSocketId: call.teacherSocketId, teacherName: call.teacherName });
      }

      // Teaching session state notification
      const activeSession = await TeachingSession.findOne({ where: { workspaceId, active: true } });
      if (activeSession) {
        socket.emit('session:active', {
          sessionId: activeSession.id,
          teacherId: activeSession.teacherUserId,
          teacherUserId: activeSession.teacherUserId,
          focusMode: activeSession.focusMode,
          focusedFilePath: activeSession.focusedFilePath,
          mySessionRole: membership.sessionRole,
          editorLocked: membership.editorLocked,
          handRaised: membership.handRaised,
        });
      }

      // Notify client of currently active web preview port if running
      const previewInfo = getPreviewPort(workspaceId);
      if (previewInfo?.port) {
        socket.emit('preview:port-detected', { port: previewInfo.port });
      }

      console.log(`[Socket] User ${socket.username} (${socket.id}) joined ${roomName} as [${socket.role}] / session:[${socket.sessionRole}] (locked: ${socket.editorLocked})`);

      // Notify others in the workspace room
      socket.to(roomName).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        role: socket.role,
        sessionRole: socket.sessionRole,
        studentAccess: socket.studentAccess,
        activeUsers: workspaceService.getActiveUsers(workspaceId),
      });

      // Send initial file tree to joining client
      try {
        const isStudentWithoutSession = isEducational && socket.role === 'student' && !activeSession;
        const fileTree = isStudentWithoutSession ? [] : await storageService.getFileTree(workspaceId);
        const locks = await WorkspaceLock.findAll({ where: { workspaceId } });
        socket.emit('workspace-ready', {
          workspaceId,
          fileTree,
          myRole: socket.role,
          mySessionRole: socket.sessionRole,
          editorLocked: socket.editorLocked,
          studentAccess: socket.studentAccess,
          classInSession: Boolean(isEducational && activeSession),
          locks,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: err.message });
      }
    });

    // Real-time file content change
    socket.on('file-change', async ({ workspaceId, filePath, content }) => {
      if (!workspaceId || !filePath) return;

      const ws = await workspaceService.getWorkspace(workspaceId);
      const isCompetitive = ws?.type === 'competitive';
      const isEducational = ws?.type === 'educational';

      // Competitive workspace Admin can view and comment only
      if (isCompetitive && socket.role === 'admin') {
        socket.emit('workspace-error', { message: 'Admin has View & Comment only access in competitive workspaces.' });
        return;
      }

      // Access checks for editing
      const isCommenterOnly = socket.studentAccess === 'commenter' || socket.studentAccess === 'comment';
      if (isCommenterOnly) {
        socket.emit('workspace-error', { message: 'Comment only: you cannot edit files' });
        return;
      }

      const isViewOnly =
        socket.role === 'viewer' ||
        socket.studentAccess === 'viewer' ||
        socket.studentAccess === 'view';

      const hasFullAdmin = ['owner', 'admin', 'teacher', 'team_leader', 'team_member'].includes(socket.role);

      if (!hasFullAdmin && isViewOnly) {
        socket.emit('workspace-error', { message: 'View only: you cannot edit files' });
        return;
      }

      // In Educational workspace, students can only edit when class is in session
      if (isEducational && socket.role === 'student') {
        const activeSession = await TeachingSession.findOne({ where: { workspaceId, active: true } });
        if (!activeSession) {
          socket.emit('workspace-error', { message: 'Class is not in session. Please wait for your teacher to start the class.' });
          return;
        }
      }

      // Education RBAC: students whose editors are locked cannot modify files
      if (socket.sessionRole === 'student' && socket.editorLocked) {
        socket.emit('workspace-error', { message: 'Your editor is locked by the teacher' });
        return;
      }

      // Check if file or containing folder is locked by someone else
      const lockCheck = await checkPathLocked(workspaceId, filePath, socket.userId);
      if (lockCheck.isLocked) {
        socket.emit('workspace-error', {
          message: `Cannot edit: ${filePath} is locked by ${lockCheck.lock.lockedByName}`,
        });
        return;
      }

      try {
        await storageService.writeFile(workspaceId, filePath, content);

        socket.to(`workspace:${workspaceId}`).emit('file-updated', {
          filePath,
          content,
          updatedBy: socket.id,
          username: socket.username || 'Collaborator',
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to sync file: ${err.message}` });
      }
    });

    // Real-time cursor/selection position sync
    socket.on('cursor-move', ({ workspaceId, filePath, cursor }) => {
      if (!workspaceId) return;
      socket.to(`workspace:${workspaceId}`).emit('remote-cursor', {
        socketId: socket.id,
        username: socket.username || 'Collaborator',
        filePath,
        cursor,
      });
    });

    // Real-time cursor leave / tab change
    socket.on('cursor-leave', ({ workspaceId, filePath }) => {
      if (!workspaceId) return;
      socket.to(`workspace:${workspaceId}`).emit('remote-cursor-remove', {
        socketId: socket.id,
        filePath,
      });
    });

    // Real-time workspace chat
    socket.on('chatMessage', ({ workspaceId, id, text, timestamp }) => {
      if (!workspaceId || typeof text !== 'string') return;
      const roomName = `workspace:${workspaceId}`;
      if (!socket.rooms.has(roomName)) return;

      const clean = text.trim().slice(0, 2000);
      if (!clean) return;

      socket.to(roomName).emit('chatMessage', {
        id,
        sender: socket.username || 'Collaborator',
        text: clean,
        timestamp,
      });
    });

    // Voice call (teacher in education mode, or owner/admin in professional mode)
    socket.on('voice-start', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const canStartVoice =
        socket.sessionRole === 'teacher' ||
        socket.role === 'owner' ||
        socket.role === 'admin';

      if (!canStartVoice) {
        socket.emit('workspace-error', { message: 'Only the teacher or workspace admin can start a voice broadcast' });
        return;
      }

      const roomName = `workspace:${workspaceId}`;
      activeCalls.set(roomName, { teacherSocketId: socket.id, teacherName: socket.username });
      socket.to(roomName).emit('voice-started', {
        teacherSocketId: socket.id,
        teacherName: socket.username,
      });
    });

    socket.on('voice-join', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const call = activeCalls.get(`workspace:${workspaceId}`);
      if (!call) return;
      workspaceNamespace.to(call.teacherSocketId).emit('voice-peer-joined', { socketId: socket.id });
    });

    socket.on('voice-leave', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const call = activeCalls.get(`workspace:${workspaceId}`);
      if (call) workspaceNamespace.to(call.teacherSocketId).emit('voice-peer-left', { socketId: socket.id });
    });

    socket.on('voice-signal', ({ workspaceId, to, data }) => {
      if (!inRoom(workspaceId) || !to || !data) return;
      const target = workspaceNamespace.sockets.get(to);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;
      target.emit('voice-signal', { from: socket.id, data });
    });

    socket.on('voice-stop', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const roomName = `workspace:${workspaceId}`;
      const call = activeCalls.get(roomName);
      if (call && call.teacherSocketId === socket.id) {
        activeCalls.delete(roomName);
        socket.to(roomName).emit('voice-ended');
      }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── TEACHING SESSION SOCKET EVENTS (EDUCATION RBAC) ───────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * session:announce_start — Teacher announces session start.
     */
    socket.on('session:announce_start', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const isTeacherOrAdmin =
        socket.role === 'teacher' ||
        socket.role === 'owner' ||
        socket.role === 'admin' ||
        socket.sessionRole === 'teacher';
      if (!isTeacherOrAdmin) {
        return;
      }
      socket.sessionRole = 'teacher';

      // Sync in-memory sockets with database session roles
      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.userId) {
          const m = await WorkspaceMember.findOne({ where: { workspaceId, userId: s.userId } });
          if (m) {
            s.sessionRole = m.sessionRole;
            s.editorLocked = m.editorLocked;
            s.handRaised = m.handRaised;
          }
        }
      }

      const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:started', {
        sessionId: session?.id,
        teacherId: socket.userId,
        teacherUserId: socket.userId,
        teacherName: socket.username,
        teacherUsername: socket.username,
        focusMode: session?.focusMode ?? false,
      });
    });

    /**
     * session:announce_end — Teacher announces session end.
     */
    socket.on('session:announce_end', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      const isTeacherOrAdmin =
        socket.role === 'teacher' ||
        socket.role === 'owner' ||
        socket.role === 'admin' ||
        socket.sessionRole === 'teacher';
      if (!isTeacherOrAdmin) {
        return;
      }
      socket.sessionRole = 'none';

      // Reset in-memory session states
      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        s.sessionRole = 'none';
        s.editorLocked = false;
        s.handRaised = false;
      }

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:ended', {
        message: 'The teaching session has ended',
      });
    });

    /**
     * session:lock_editor — Teacher locks a student's editor.
     */
    socket.on('session:lock_editor', async ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') {
        socket.emit('workspace-error', { message: 'Only the teacher can lock student editors' });
        return;
      }

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      target.editorLocked = true;
      if (target.userId) {
        await WorkspaceMember.update(
          { editorLocked: true },
          { where: { workspaceId, userId: target.userId } }
        );
      }

      target.emit('session:editor_locked', {
        lockedBy: socket.username,
        message: 'Your editor has been locked by the teacher',
      });

      socket.emit('session:lock_confirmed', { targetSocketId, username: target.username });
    });

    /**
     * session:unlock_editor — Teacher unlocks a student's editor.
     */
    socket.on('session:unlock_editor', async ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') {
        socket.emit('workspace-error', { message: 'Only the teacher can unlock student editors' });
        return;
      }

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      target.editorLocked = false;
      if (target.userId) {
        await WorkspaceMember.update(
          { editorLocked: false },
          { where: { workspaceId, userId: target.userId } }
        );
      }

      target.emit('session:editor_unlocked', {
        unlockedBy: socket.username,
        message: 'Your editor has been unlocked',
      });

      socket.emit('session:unlock_confirmed', { targetSocketId, username: target.username });
    });

    /**
     * session:lock_all — Teacher locks ALL students.
     */
    socket.on('session:lock_all', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      await WorkspaceMember.update(
        { editorLocked: true },
        { where: { workspaceId, sessionRole: 'student' } }
      );

      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.sessionRole === 'student') {
          s.editorLocked = true;
          s.emit('session:editor_locked', {
            lockedBy: socket.username,
            message: 'The teacher has locked all student editors',
          });
        }
      }
      socket.emit('session:lock_all_confirmed');
    });

    /**
     * session:unlock_all — Teacher unlocks all students.
     */
    socket.on('session:unlock_all', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      await WorkspaceMember.update(
        { editorLocked: false },
        { where: { workspaceId, sessionRole: 'student' } }
      );

      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.sessionRole === 'student') {
          s.editorLocked = false;
          s.emit('session:editor_unlocked', {
            unlockedBy: socket.username,
            message: 'The teacher has unlocked all student editors',
          });
        }
      }
      socket.emit('session:unlock_all_confirmed');
    });

    /**
     * session:focus — Teacher toggles focus mode and broadcast file.
     */
    socket.on('session:focus', async ({ workspaceId, filePath, enabled }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      await TeachingSession.update(
        { focusMode: enabled, focusedFilePath: enabled ? filePath : null },
        { where: { workspaceId, active: true } }
      );

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:focus_changed', {
        enabled,
        filePath: enabled ? filePath : null,
        teacherName: socket.username,
      });
    });

    /**
     * session:raise_hand — Student raises hand.
     */
    socket.on('session:raise_hand', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'student') {
        socket.emit('workspace-error', { message: 'Only students can raise their hand' });
        return;
      }

      socket.handRaised = true;
      if (socket.userId) {
        await WorkspaceMember.update(
          { handRaised: true },
          { where: { workspaceId, userId: socket.userId } }
        );
      }

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:hand_raised', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
      });
    });

    /**
     * session:lower_hand — Lower student hand.
     */
    socket.on('session:lower_hand', async ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      const isSelf = targetSocketId === socket.id;
      if (!isSelf && socket.sessionRole !== 'teacher') return;

      const target = targetSocketId ? workspaceNamespace.sockets.get(targetSocketId) : socket;
      if (target) {
        target.handRaised = false;
        if (target.userId) {
          await WorkspaceMember.update(
            { handRaised: false },
            { where: { workspaceId, userId: target.userId } }
          );
        }
      }

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:hand_lowered', {
        socketId: targetSocketId || socket.id,
        userId: target?.userId || socket.userId,
      });
    });

    /**
     * session:takeover — Teacher opens a file on a student's IDE.
     */
    socket.on('session:takeover', ({ workspaceId, targetSocketId, filePath }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      target.emit('session:open_file', {
        filePath,
        requestedBy: socket.username,
        message: `The teacher has opened ${filePath} in your IDE`,
      });
    });

    /**
     * session:kick — Teacher removes a student from session.
     */
    socket.on('session:kick', async ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      if (target.userId) {
        await WorkspaceMember.update(
          { sessionRole: 'none', editorLocked: false, handRaised: false },
          { where: { workspaceId, userId: target.userId } }
        );
      }

      target.sessionRole = 'none';
      target.editorLocked = false;
      target.handRaised = false;
      target.emit('session:kicked', {
        message: `You have been removed from the session by ${socket.username}`,
      });

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:student_left', {
        socketId: targetSocketId,
        username: target.username,
      });
    });

    /**
     * session:request_help — Student asks teacher for help.
     */
    socket.on('session:request_help', ({ workspaceId, message }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'student') return;

      const clean = (message || '').trim().slice(0, 500);
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:help_requested', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        message: clean,
        timestamp: Date.now(),
      });
    });

    /**
     * session:ping_students — Teacher pings all students for attention.
     */
    socket.on('session:ping_students', ({ workspaceId, message }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const clean = (message || '').trim().slice(0, 300);
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:ping', {
        from: socket.username,
        message: clean || 'The teacher is requesting your attention',
        timestamp: Date.now(),
      });
    });

    // Real-time File System changes (Professional & Education RBAC)
    socket.on('fs-action', async ({ workspaceId, action, payload }) => {
      if (!workspaceId) return;

      if (socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view')) {
        socket.emit('workspace-error', { message: 'Access restricted: no-view' });
        return;
      }

      const hasFullAdminFs = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role);
      const isViewOnlyFs =
        socket.role === 'viewer' ||
        (socket.role === 'student' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'tester' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'developer' && (socket.studentAccess === 'viewer' || socket.studentAccess === 'view')) ||
        socket.studentAccess === 'viewer' ||
        socket.studentAccess === 'view';

      if (!hasFullAdminFs && isViewOnlyFs) {
        socket.emit('workspace-error', { message: 'View only: you cannot modify files' });
        return;
      }

      // Education RBAC
      if (socket.sessionRole === 'student' && socket.editorLocked) {
        socket.emit('workspace-error', { message: 'Your workspace is locked by the teacher' });
        return;
      }

      const roomName = `workspace:${workspaceId}`;
      try {
        let result;
        if (action === 'create') {
          result = await storageService.createItem(workspaceId, payload.filePath, payload.isDirectory);
        } else if (action === 'delete') {
          result = await storageService.deleteItem(workspaceId, payload.filePath);
        } else if (action === 'rename') {
          result = await storageService.renameItem(workspaceId, payload.oldPath, payload.newPath);
        }

        const fileTree = await storageService.getFileTree(workspaceId);

        workspaceNamespace.to(roomName).emit('fs-updated', {
          action,
          result,
          fileTree,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `FS action failed: ${err.message}` });
      }
    });

    // Trigger Code Execution (Per-member isolated container OR admin global run)
    socket.on('execute-code', async ({ workspaceId, filePath, isGlobal }) => {
      if (!workspaceId || !filePath) return;

      if (socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view')) {
        socket.emit('workspace-error', { message: 'Access denied: no-view' });
        return;
      }

      const hasFullAdminExec = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const isViewOnlyExec =
        socket.role === 'viewer' ||
        (socket.role === 'student' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'tester' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'developer' && (socket.studentAccess === 'viewer' || socket.studentAccess === 'view')) ||
        socket.studentAccess === 'viewer' ||
        socket.studentAccess === 'view';

      if (!hasFullAdminExec && isViewOnlyExec) {
        socket.emit('workspace-error', { message: 'View only: you cannot execute code' });
        return;
      }

      // Education RBAC
      if (socket.sessionRole === 'student' && socket.editorLocked) {
        socket.emit('workspace-error', { message: 'Code execution is locked by the teacher' });
        return;
      }

      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const runGlobally = Boolean(isGlobal && isAdmin);

      const roomName = `workspace:${workspaceId}`;
      const userId = socket.userId || 'guest';
      const username = socket.username || 'User';

      // ── Docker Engine Pre-flight Check ────────────────────────────────────
      // Verify Docker availability before announcing execution-started so the
      // client never gets stuck in a "Running..." state when Docker is down.
      const isDocker = await executionService.isDockerRunning();
      if (!isDocker) {
        const errorMsg = '[Error] Runtime environment not available. Docker engine is not running.\nPlease start Docker Desktop to execute code.\n';
        if (runGlobally) {
          workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: errorMsg, isGlobal: true });
          workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: -1, isGlobal: true });
        } else {
          socket.emit('execution-stderr', { chunk: errorMsg, isGlobal: false });
          socket.emit('execution-finished', { exitCode: -1, isGlobal: false });
        }
        return;
      }

      if (runGlobally) {
        workspaceNamespace.to(roomName).emit('execution-started', { filePath, isGlobal: true, initiatedBy: username });
      } else {
        socket.emit('execution-started', { filePath, isGlobal: false, initiatedBy: username });
      }

      try {
        await executionService.executeFile({
          workspaceId,
          userId,
          username,
          isGlobal: runGlobally,
          filePath,
          onStdout: (chunk) => {
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-stdout', { chunk, isGlobal: true });
            } else {
              socket.emit('execution-stdout', { chunk, isGlobal: false });
            }
          },
          onStderr: (chunk) => {
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-stderr', { chunk, isGlobal: true });
            } else {
              socket.emit('execution-stderr', { chunk, isGlobal: false });
            }
          },
          onExit: (exitCode) => {
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-finished', { exitCode, isGlobal: true });
            } else {
              socket.emit('execution-finished', { exitCode, isGlobal: false });
            }
          },
        });
      } catch (err) {
        if (runGlobally) {
          workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: `Execution failed: ${err.message}\n`, isGlobal: true });
          workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: -1, isGlobal: true });
        } else {
          socket.emit('execution-stderr', { chunk: `Execution failed: ${err.message}\n`, isGlobal: false });
          socket.emit('execution-finished', { exitCode: -1, isGlobal: false });
        }
      }
    });

    // Stop execution
    socket.on('stop-execution', ({ workspaceId, targetUserId, isGlobal }) => {
      if (!workspaceId) return;
      if (
        socket.role === 'viewer' || 
        socket.role === 'no-view' || 
        (socket.role === 'student' && socket.studentAccess !== 'editor')
      ) {
        socket.emit('workspace-error', { message: 'Viewers cannot modify execution' });
        return;
      }

      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const targetId = (targetUserId && isAdmin) ? targetUserId : (socket.userId || 'guest');
      const stopGlobal = Boolean(isGlobal && isAdmin);

      const stoppedResult = executionService.stopExecutionByContext({
        workspaceId,
        userId: targetId,
        isGlobal: stopGlobal,
      });

      const roomName = `workspace:${workspaceId}`;
      if (!stoppedResult) {
        // No active running process was found; ensure finished is emitted so client UI never hangs
        if (stopGlobal) {
          workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: '\n[Server] No active execution running.\n', isGlobal: true });
          workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: 0, isGlobal: true });
        } else {
          socket.emit('execution-stderr', { chunk: '\n[Server] No active execution running.\n', isGlobal: false });
          socket.emit('execution-finished', { exitCode: 0, isGlobal: false });
        }
      } else {
        if (stopGlobal || stoppedResult.isGlobal) {
          workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: '\n[Server] Global execution stopped.\n', isGlobal: true });
        } else {
          socket.emit('execution-stderr', { chunk: '\n[Server] Execution stopped by user.\n', isGlobal: false });
        }
      }
    });

    // ── Interactive Terminal Command Execution ──────────────────────────────
    socket.on('terminal:command', async ({ workspaceId, command, isGlobal }) => {
      if (!workspaceId || !command || !command.trim()) return;

      if (socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view')) {
        socket.emit('workspace-error', { message: 'Access denied: no-view' });
        return;
      }

      const hasFullAdminExec = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const isViewOnlyExec =
        socket.role === 'viewer' ||
        (socket.role === 'student' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'tester' && socket.studentAccess !== 'editor' && socket.studentAccess !== 'edit') ||
        (socket.role === 'developer' && (socket.studentAccess === 'viewer' || socket.studentAccess === 'view')) ||
        socket.studentAccess === 'viewer' ||
        socket.studentAccess === 'view';

      if (!hasFullAdminExec && isViewOnlyExec) {
        socket.emit('workspace-error', { message: 'View only: you cannot execute terminal commands' });
        return;
      }

      if (socket.sessionRole === 'student' && socket.editorLocked) {
        socket.emit('workspace-error', { message: 'Terminal execution is locked by the teacher' });
        return;
      }

      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const runGlobally = Boolean(isGlobal && isAdmin);
      const roomName = `workspace:${workspaceId}`;
      const userId = socket.userId || 'guest';
      const username = socket.username || 'User';

      if (runGlobally) {
        workspaceNamespace.to(roomName).emit('execution-started', { filePath: command, isGlobal: true, initiatedBy: username, isTerminal: true });
      } else {
        socket.emit('execution-started', { filePath: command, isGlobal: false, initiatedBy: username, isTerminal: true });
      }

      try {
        await executionService.executeTerminalCommand({
          workspaceId,
          userId,
          username,
          isGlobal: runGlobally,
          command,
          onStdout: (chunk) => {
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-stdout', { chunk, isGlobal: true });
            } else {
              socket.emit('execution-stdout', { chunk, isGlobal: false });
            }
          },
          onStderr: (chunk) => {
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-stderr', { chunk, isGlobal: true });
            } else {
              socket.emit('execution-stderr', { chunk, isGlobal: false });
            }
          },
          onExit: (exitCode) => {
            const currentCwd = executionService.getCwd(runGlobally ? `${workspaceId}:global` : `${workspaceId}:${userId}`, workspaceId);
            if (runGlobally) {
              workspaceNamespace.to(roomName).emit('execution-finished', { exitCode, isGlobal: true, command, cwd: currentCwd });
            } else {
              socket.emit('execution-finished', { exitCode, isGlobal: false, command, cwd: currentCwd });
            }
          },
        });
      } catch (err) {
        if (runGlobally) {
          workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: `Terminal execution failed: ${err.message}\n`, isGlobal: true });
          workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: -1, isGlobal: true });
        } else {
          socket.emit('execution-stderr', { chunk: `Terminal execution failed: ${err.message}\n`, isGlobal: false });
          socket.emit('execution-finished', { exitCode: -1, isGlobal: false });
        }
      }
    });

    // Send input to stdin of running process
    socket.on('terminal:stdin', ({ workspaceId, input, isGlobal }) => {
      if (!workspaceId || input === undefined) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const runGlobally = Boolean(isGlobal && isAdmin);
      executionService.sendTerminalStdin({
        workspaceId,
        userId: socket.userId || 'guest',
        isGlobal: runGlobally,
        input,
      });
    });

    // Kill running terminal process (Ctrl+C)
    socket.on('terminal:kill', ({ workspaceId, isGlobal }) => {
      if (!workspaceId) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const stopGlobal = Boolean(isGlobal && isAdmin);
      executionService.stopExecutionByContext({
        workspaceId,
        userId: socket.userId || 'guest',
        isGlobal: stopGlobal,
      });
      const roomName = `workspace:${workspaceId}`;
      if (stopGlobal) {
        workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: '\n^C [Process terminated]\n', isGlobal: true });
        workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: 130, isGlobal: true });
      } else {
        socket.emit('execution-stderr', { chunk: '\n^C [Process terminated]\n', isGlobal: false });
        socket.emit('execution-finished', { exitCode: 130, isGlobal: false });
      }
    });

    // Environment management socket queries
    socket.on('env:get_status', async ({ workspaceId }) => {
      if (!workspaceId) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const supported = await executionService.getSupportedEnvironments();
      const allActive = executionService.listEnvironments(workspaceId);
      const myActive = allActive.filter(e => String(e.userId) === String(socket.userId));

      socket.emit('env:status', {
        supported,
        myEnvironment: myActive[0] || null,
        activeEnvironments: isAdmin ? allActive : myActive,
        isAdmin,
      });
    });

    socket.on('env:stop_member', async ({ workspaceId, targetUserId }) => {
      if (!workspaceId || !targetUserId) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      if (!isAdmin) {
        socket.emit('workspace-error', { message: 'Only admins can terminate member environments' });
        return;
      }
      executionService.stopExecutionByContext({ workspaceId, userId: targetUserId });
      const allActive = executionService.listEnvironments(workspaceId);
      socket.emit('env:status', {
        supported: await executionService.getSupportedEnvironments(),
        activeEnvironments: allActive,
        isAdmin: true,
      });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── RESOURCE LOCKING (FILE / FOLDER / CODE BLOCK) ─────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    socket.on('lock:create', async ({ workspaceId, lockType, targetPath, startLine, endLine, reason }) => {
      if (!workspaceId || !targetPath || !lockType) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const isEditor = socket.role === 'editor' || socket.studentAccess === 'editor';
      if (!isAdmin && !isEditor) {
        socket.emit('workspace-error', { message: 'Only Admins and Editors can lock resources' });
        return;
      }
      try {
        const normPath = targetPath.replace(/\\/g, '/');
        const existing = await WorkspaceLock.findOne({ where: { workspaceId, targetPath: normPath, lockType } });
        if (existing && existing.lockedBy !== socket.userId) {
          socket.emit('workspace-error', { message: `Already locked by ${existing.lockedByName}` });
          return;
        }
        const lock = await WorkspaceLock.create({
          workspaceId,
          lockType,
          targetPath: normPath,
          startLine: startLine ? Number(startLine) : null,
          endLine: endLine ? Number(endLine) : null,
          lockedBy: socket.userId,
          lockedByName: socket.username || 'User',
          reason: reason || null,
        });
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('lock:created', { lock });
      } catch (err) {
        socket.emit('workspace-error', { message: `Lock failed: ${err.message}` });
      }
    });

    socket.on('lock:release', async ({ workspaceId, lockId }) => {
      if (!workspaceId || !lockId) return;
      try {
        const lock = await WorkspaceLock.findOne({ where: { id: lockId, workspaceId } });
        if (!lock) return;
        const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
        if (lock.lockedBy !== socket.userId && !isAdmin) {
          socket.emit('workspace-error', { message: 'Only the locker or an Admin can release this lock' });
          return;
        }
        const targetPath = lock.targetPath;
        await lock.destroy();
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('lock:released', { lockId, targetPath });
      } catch (err) {
        socket.emit('workspace-error', { message: `Release lock failed: ${err.message}` });
      }
    });

    socket.on('lock:list', async ({ workspaceId }) => {
      if (!workspaceId) return;
      try {
        const locks = await WorkspaceLock.findAll({ where: { workspaceId } });
        socket.emit('lock:list_response', { locks });
      } catch (err) {
        socket.emit('workspace-error', { message: `Fetch locks failed: ${err.message}` });
      }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── EDUCATIONAL STUDENT ACCESS CONTROL (TEACHER -> STUDENT) ───────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * member:set_access — Teacher updates student access level (no-view, viewer, editor)
     */
    socket.on('member:set_access', async ({ workspaceId, userId, access }) => {
      if (!inRoom(workspaceId)) return;

      const isTeacher =
        socket.role === 'teacher' ||
        socket.sessionRole === 'teacher' ||
        socket.role === 'owner' ||
        socket.role === 'admin' ||
        socket.role === 'team_leader';

      if (!isTeacher) {
        socket.emit('workspace-error', { message: 'Only a teacher or workspace admin can modify access levels' });
        return;
      }

      const validAccess = ['no-view', 'viewer', 'editor', 'view', 'edit'];
      if (!validAccess.includes(access)) {
        socket.emit('workspace-error', { message: 'Invalid access level. Must be view or edit' });
        return;
      }

      const normalizedAccess = (access === 'view' || access === 'viewer') ? 'viewer' : (access === 'edit' || access === 'editor') ? 'editor' : 'no-view';

      // Admin/teacher cannot change their own access
      if (Number(userId) === Number(socket.userId)) {
        socket.emit('workspace-error', { message: 'Admins cannot change their own access levels' });
        return;
      }

      try {
        const targetMember = await WorkspaceMember.findOne({ where: { workspaceId, userId } });
        if (!targetMember) {
          socket.emit('workspace-error', { message: 'Target member not found' });
          return;
        }

        if (['owner', 'admin', 'team_leader'].includes(targetMember.role)) {
          socket.emit('workspace-error', { message: 'Cannot modify access level of workspace admin/owner' });
          return;
        }

        const isActorOwner = socket.role === 'owner' || socket.role === 'admin';
        if (targetMember.role === 'teacher' && !isActorOwner) {
          socket.emit('workspace-error', { message: 'Only workspace admin can modify teacher access control' });
          return;
        }

        const updateData = { studentAccess: normalizedAccess };

        await WorkspaceMember.update(
          updateData,
          { where: { workspaceId, userId } }
        );

        // Update active connected sockets for target user
        const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
        for (const s of roomSockets) {
          if (Number(s.userId) === Number(userId)) {
            s.studentAccess = access;
            s.emit('member:access_updated', {
              workspaceId,
              studentAccess: access,
              updatedBy: socket.username,
            });

            // If access restored from no-view to viewer/editor, send fileTree
            if (access !== 'no-view') {
              try {
                const fileTree = await storageService.getFileTree(workspaceId);
                s.emit('workspace-ready', {
                  workspaceId,
                  fileTree,
                  myRole: s.role,
                  mySessionRole: s.sessionRole,
                  editorLocked: s.editorLocked,
                  studentAccess: s.studentAccess,
                });
              } catch (e) {}
            }
          }
        }

        // Broadcast to all members so their member list updates
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('member:access_changed', {
          workspaceId,
          userId,
          studentAccess: access,
          updatedBy: socket.username,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to update student access: ${err.message}` });
      }
    });

    /**
     * member:set_access_bulk — Teacher / Admin bulk updates access level for multiple members
     */
    socket.on('member:set_access_bulk', async ({ workspaceId, userIds, access }) => {
      if (!inRoom(workspaceId)) return;
      if (!Array.isArray(userIds) || userIds.length === 0) return;

      const isTeacher =
        socket.role === 'teacher' ||
        socket.sessionRole === 'teacher' ||
        socket.role === 'owner' ||
        socket.role === 'admin' ||
        socket.role === 'team_leader';

      if (!isTeacher) {
        socket.emit('workspace-error', { message: 'Only a teacher or workspace admin can modify access levels' });
        return;
      }

      const validAccess = ['no-view', 'viewer', 'editor', 'view', 'edit'];
      if (!validAccess.includes(access)) {
        socket.emit('workspace-error', { message: 'Invalid access level' });
        return;
      }

      const normalizedAccess = (access === 'view' || access === 'viewer') ? 'viewer' : (access === 'edit' || access === 'editor') ? 'editor' : 'no-view';

      try {
        const isActorOwner = socket.role === 'owner' || socket.role === 'admin';
        const members = await WorkspaceMember.findAll({
          where: { workspaceId, userId: userIds },
        });

        const eligible = members.filter(m => {
          if (Number(m.userId) === Number(socket.userId)) return false;
          if (['owner', 'admin', 'team_leader'].includes(m.role)) return false;
          if (m.role === 'teacher' && !isActorOwner) return false;
          return true;
        });

        if (eligible.length === 0) return;

        const eligibleIds = eligible.map(m => m.userId);

        await WorkspaceMember.update(
          { studentAccess: normalizedAccess },
          { where: { workspaceId, userId: eligibleIds } }
        );

        const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
        for (const s of roomSockets) {
          if (eligibleIds.includes(Number(s.userId))) {
            s.studentAccess = normalizedAccess;
            s.emit('member:access_updated', {
              workspaceId,
              studentAccess: access,
              updatedBy: socket.username,
            });

            if (access !== 'no-view') {
              try {
                const fileTree = await storageService.getFileTree(workspaceId);
                s.emit('workspace-ready', {
                  workspaceId,
                  fileTree,
                  myRole: s.role,
                  mySessionRole: s.sessionRole,
                  editorLocked: s.editorLocked,
                  studentAccess: s.studentAccess,
                });
              } catch (e) {}
            }
          }
        }

        for (const uid of eligibleIds) {
          workspaceNamespace.to(`workspace:${workspaceId}`).emit('member:access_changed', {
            workspaceId,
            userId: uid,
            studentAccess: access,
            updatedBy: socket.username,
          });
        }
      } catch (err) {
        socket.emit('workspace-error', { message: `Bulk access update failed: ${err.message}` });
      }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ── PROFESSIONAL WORKSPACE (TASKS, REVIEWS, DEV FOCUS) ───────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * developer:focus_file — Developer or member broadcasts what file they are currently working on.
     */
    socket.on('developer:focus_file', ({ workspaceId, filePath }) => {
      if (!inRoom(workspaceId)) return;
      socket.to(`workspace:${workspaceId}`).emit('developer:file_focused', {
        userId: socket.userId,
        username: socket.username,
        filePath: filePath || null,
      });
    });

    /**
     * task:created — Broadcast newly created task.
     */
    socket.on('task:create', ({ workspaceId, task }) => {
      if (!inRoom(workspaceId) || !task) return;
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('task:created', {
        task,
        createdBy: socket.username,
      });
    });

    /**
     * task:updated — Broadcast updated task.
     */
    socket.on('task:update', ({ workspaceId, task }) => {
      if (!inRoom(workspaceId) || !task) return;
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('task:updated', {
        task,
        updatedBy: socket.username,
      });
    });

    /**
     * task:deleted — Broadcast deleted task ID.
     */
    socket.on('task:delete', ({ workspaceId, taskId }) => {
      if (!inRoom(workspaceId) || !taskId) return;
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('task:deleted', {
        taskId,
        deletedBy: socket.username,
      });
    });

    /**
     * review:create — Broadcast new code review request.
     */
    socket.on('review:create', ({ workspaceId, review }) => {
      if (!inRoom(workspaceId) || !review) return;
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('review:created', {
        review,
        authorName: socket.username,
      });
    });

    /**
     * review:update_status — Broadcast review status change (approved, changes_requested, etc).
     */
    socket.on('review:update_status', ({ workspaceId, review }) => {
      if (!inRoom(workspaceId) || !review) return;
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('review:status_changed', {
        review,
        updatedBy: socket.username,
      });
    });

    /**
     * Line Comments Socket Events
     */
    socket.on('comment:create', async ({ workspaceId, filePath, lineNumber, content, parentId }) => {
      if (!workspaceId || !filePath || lineNumber === undefined || !content) return;
      try {
        const comment = await LineComment.create({
          workspaceId,
          filePath,
          lineNumber: Number(lineNumber),
          userId: socket.userId,
          content: content.trim(),
          parentId: parentId ? Number(parentId) : null,
        });
        const fullComment = await LineComment.findOne({
          where: { id: comment.id },
          include: [{ model: User, as: 'author', attributes: ['id', 'username', 'email'] }],
        });
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('comment:created', {
          comment: fullComment,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to create comment: ${err.message}` });
      }
    });

    socket.on('comment:resolve', async ({ workspaceId, commentId, resolved }) => {
      if (!workspaceId || !commentId) return;
      try {
        const comment = await LineComment.findByPk(commentId);
        if (comment) {
          comment.resolved = Boolean(resolved);
          await comment.save();
          workspaceNamespace.to(`workspace:${workspaceId}`).emit('comment:updated', {
            commentId,
            resolved: comment.resolved,
          });
        }
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to resolve comment: ${err.message}` });
      }
    });

    socket.on('comment:delete', async ({ workspaceId, commentId }) => {
      if (!workspaceId || !commentId) return;
      try {
        const comment = await LineComment.findByPk(commentId);
        if (comment) {
          await LineComment.destroy({ where: { parentId: commentId } });
          await comment.destroy();
          workspaceNamespace.to(`workspace:${workspaceId}`).emit('comment:deleted', {
            commentId,
          });
        }
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to delete comment: ${err.message}` });
      }
    });

    /**
     * Educational Class in Session Socket Events
     */
    socket.on('class:start', async ({ workspaceId }) => {
      if (!workspaceId) return;
      try {
        let session = await TeachingSession.findOne({ where: { workspaceId } });
        if (session) {
          session.active = true;
          session.teacherUserId = socket.userId;
          await session.save();
        } else {
          session = await TeachingSession.create({
            workspaceId,
            teacherUserId: socket.userId,
            active: true,
          });
        }

        const fileTree = await storageService.getFileTree(workspaceId);
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('class:started', {
          sessionId: session.id,
          teacherId: socket.userId,
          teacherName: socket.username,
          fileTree,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to start class: ${err.message}` });
      }
    });

    socket.on('class:end', async ({ workspaceId }) => {
      if (!workspaceId) return;
      try {
        const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });
        if (session) {
          session.active = false;
          await session.save();
        }
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('class:ended', {
          workspaceId,
          endedBy: socket.username,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `Failed to end class: ${err.message}` });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (currentWorkspaceId) {
        const callRoom = `workspace:${currentWorkspaceId}`;
        const call = activeCalls.get(callRoom);
        if (call && call.teacherSocketId === socket.id) {
          activeCalls.delete(callRoom);
          socket.to(callRoom).emit('voice-ended');
        } else if (call) {
          workspaceNamespace.to(call.teacherSocketId).emit('voice-peer-left', { socketId: socket.id });
        }

        if (socket.sessionRole === 'teacher') {
          socket.to(callRoom).emit('session:teacher_disconnected', {
            username: socket.username,
            message: 'The teacher has disconnected',
          });
        }

        workspaceService.decrementUserCount(currentWorkspaceId);
        socket.to(`workspace:${currentWorkspaceId}`).emit('user-left', {
          socketId: socket.id,
        });
        socket.to(`workspace:${currentWorkspaceId}`).emit('remote-cursor-remove', {
          socketId: socket.id,
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

export default initWorkspaceSockets;
