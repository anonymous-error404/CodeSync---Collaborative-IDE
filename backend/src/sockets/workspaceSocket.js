import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import executionService from '../services/executionService.js';
import attachWhiteboardSocketHandlers from './whiteboardSocket.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/authConfig.js';
import { WorkspaceMember, TeachingSession, WorkspaceLock } from '../models/index.js';
import { checkPathLocked } from '../controllers/lockController.js';

/**
 * Attaches real-time workspace socket event handlers to Socket.io server.
 * Enforces both Workspace RBAC (Professional) and Teaching Session RBAC (Education).
 * @param {import('socket.io').Server} io 
 */
function initWorkspaceSockets(io) {
  const workspaceNamespace = io.of('/workspace');

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

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId: decoded.id }
      });

      if (!membership) {
        socket.emit('workspace-error', { message: 'Not a member of this workspace' });
        return;
      }

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.role = membership.role;                 // 'owner' | 'admin' | 'editor' | 'viewer' | 'teacher' | 'student' | 'team_leader' | 'developer' | 'no-view'
      socket.sessionRole = membership.sessionRole;   // 'teacher' | 'student' | 'none'
      socket.editorLocked = membership.editorLocked; // boolean
      socket.handRaised = membership.handRaised;     // boolean
      socket.studentAccess = membership.studentAccess || 'editor'; // 'no-view' | 'viewer' | 'editor'

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
        const isNoView = socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view');
        const fileTree = isNoView ? [] : await storageService.getFileTree(workspaceId);
        const locks = await WorkspaceLock.findAll({ where: { workspaceId } });
        socket.emit('workspace-ready', {
          workspaceId,
          fileTree,
          myRole: socket.role,
          mySessionRole: socket.sessionRole,
          editorLocked: socket.editorLocked,
          studentAccess: socket.studentAccess,
          locks,
        });
      } catch (err) {
        socket.emit('workspace-error', { message: err.message });
      }
    });

    // Real-time file content change
    socket.on('file-change', async ({ workspaceId, filePath, content }) => {
      if (!workspaceId || !filePath) return;

      // Access checks for editing
      if (socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view')) {
        socket.emit('workspace-error', { message: 'Access restricted by teacher (no-view)' });
        return;
      }

      if (socket.role === 'viewer' || (socket.role === 'student' && socket.studentAccess === 'viewer')) {
        socket.emit('workspace-error', { message: 'Viewers cannot edit files' });
        return;
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
        socket.emit('workspace-error', { message: 'Access restricted by teacher (no-view)' });
        return;
      }

      if (socket.role === 'viewer' || (socket.role === 'student' && socket.studentAccess === 'viewer')) {
        socket.emit('workspace-error', { message: 'Viewers cannot modify files' });
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
    socket.on('execute-code', ({ workspaceId, filePath, isGlobal }) => {
      if (!workspaceId || !filePath) return;

      if (socket.role === 'no-view' || (socket.role === 'student' && socket.studentAccess === 'no-view')) {
        socket.emit('workspace-error', { message: 'Access restricted by teacher (no-view)' });
        return;
      }

      if (socket.role === 'viewer' || (socket.role === 'student' && socket.studentAccess === 'viewer')) {
        socket.emit('workspace-error', { message: 'Viewers cannot execute code' });
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

      if (runGlobally) {
        workspaceNamespace.to(roomName).emit('execution-started', { filePath, isGlobal: true, initiatedBy: username });
      } else {
        socket.emit('execution-started', { filePath, isGlobal: false, initiatedBy: username });
      }

      try {
        executionService.executeFile({
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

      if (isGlobal && isAdmin) {
        const stopped = executionService.stopExecution(`${workspaceId}:global`);
        if (stopped) {
          workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-stderr', { chunk: '\n[Server] Global execution stopped by admin.\n', isGlobal: true });
          workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-finished', { exitCode: -1, isGlobal: true });
        }
        return;
      }

      const targetId = (targetUserId && isAdmin) ? targetUserId : (socket.userId || 'guest');
      const stopped = executionService.stopUserExecution(workspaceId, targetId);
      if (stopped) {
        socket.emit('execution-stderr', { chunk: '\n[Server] Execution stopped by user.\n', isGlobal: false });
        socket.emit('execution-finished', { exitCode: -1, isGlobal: false });
      }
    });

    // Environment management socket queries
    socket.on('env:get_status', ({ workspaceId }) => {
      if (!workspaceId) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      const supported = executionService.getSupportedEnvironments();
      const allActive = executionService.listEnvironments(workspaceId);
      const myActive = allActive.filter(e => String(e.userId) === String(socket.userId));

      socket.emit('env:status', {
        supported,
        myEnvironment: myActive[0] || null,
        activeEnvironments: isAdmin ? allActive : myActive,
        isAdmin,
      });
    });

    socket.on('env:stop_member', ({ workspaceId, targetUserId }) => {
      if (!workspaceId || !targetUserId) return;
      const isAdmin = ['owner', 'admin', 'teacher', 'team_leader'].includes(socket.role) || socket.sessionRole === 'teacher';
      if (!isAdmin) {
        socket.emit('workspace-error', { message: 'Only admins can terminate member environments' });
        return;
      }
      executionService.stopUserExecution(workspaceId, targetUserId);
      const allActive = executionService.listEnvironments(workspaceId);
      socket.emit('env:status', {
        supported: executionService.getSupportedEnvironments(),
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
        socket.emit('workspace-error', { message: 'Only a teacher or owner can modify student access' });
        return;
      }

      if (!['no-view', 'viewer', 'editor'].includes(access)) {
        socket.emit('workspace-error', { message: 'Invalid access level' });
        return;
      }

      try {
        await WorkspaceMember.update(
          { studentAccess: access },
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
