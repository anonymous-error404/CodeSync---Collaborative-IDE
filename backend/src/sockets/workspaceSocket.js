import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import executionService from '../services/executionService.js';
import attachWhiteboardSocketHandlers from './whiteboardSocket.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/authConfig.js';
import { WorkspaceMember, TeachingSession } from '../models/index.js';

/**
 * Attaches real-time workspace socket event handlers to Socket.io server.
 * @param {import('socket.io').Server} io 
 */
function initWorkspaceSockets(io) {
  const workspaceNamespace = io.of('/workspace');

  // ── NEW (voice call): roomName -> { teacherSocketId, teacherName }
  const activeCalls = new Map();

  workspaceNamespace.on('connection', (socket) => {
    let currentWorkspaceId = null;

    console.log(`[Socket] Client connected: ${socket.id}`);

    // Attach Whiteboard Socket Listeners
    attachWhiteboardSocketHandlers(socket, workspaceNamespace);

    // User joins workspace room
    socket.on('join-workspace', async ({ workspaceId, token }) => {
      if (!workspaceId) return;

      if (!token) {
        socket.emit('workspace-error', { message: 'Unauthorized' });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        socket.emit('workspace-error', { message: 'Unauthorized' });
        return;
      }

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId: decoded.id }
      });

      if (!membership) {
        socket.emit('workspace-error', { message: 'Not a member' });
        return;
      }

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.role = membership.role;
      socket.sessionRole = membership.sessionRole; // 'teacher' | 'student' | 'none'

      currentWorkspaceId = workspaceId;
      const roomName = `workspace:${workspaceId}`;

      socket.join(roomName);
      workspaceService.incrementUserCount(workspaceId);

      // ── NEW (voice call): tell late joiners that a call is already running
      const call = activeCalls.get(roomName);
      if (call) {
        socket.emit('voice-started', { teacherSocketId: call.teacherSocketId, teacherName: call.teacherName });
      }

      // ── Notify if a teaching session is already active
      const activeSession = await TeachingSession.findOne({ where: { workspaceId, active: true } });
      if (activeSession) {
        socket.emit('session:active', {
          sessionId: activeSession.id,
          teacherUserId: activeSession.teacherUserId,
          focusMode: activeSession.focusMode,
          focusedFilePath: activeSession.focusedFilePath,
          mySessionRole: membership.sessionRole,
        });
      }

      console.log(`[Socket] User ${socket.username} (${socket.id}) joined ${roomName} as ${socket.role} / session:${socket.sessionRole}`);

      // notify others in the workspace room
      socket.to(roomName).emit('user-joined', {
        socketId: socket.id,
        username: socket.username,
        activeUsers: workspaceService.getActiveUsers(workspaceId)
      });

      // Send initial file tree to joining client
      try {
        const fileTree = await storageService.getFileTree(workspaceId);
        socket.emit('workspace-ready', { workspaceId, fileTree });
      } catch (err) {
        socket.emit('workspace-error', { message: err.message });
      }
    });

    // Real-time file content change 
    socket.on('file-change', async ({ workspaceId, filePath, content }) => {
      if (!workspaceId || !filePath) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      // Students whose editors are locked cannot push changes
      if (socket.sessionRole === 'student' && socket.editorLocked) {
        socket.emit('workspace-error', { message: 'Your editor is locked by the teacher' });
        return;
      }

      try {
        // Save change to workspace storage
        await storageService.writeFile(workspaceId, filePath, content);

        // Broadcast updated content to all other users in the room
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
        cursor
      });
    });

    // Real-time cursor leave / tab change
    socket.on('cursor-leave', ({ workspaceId, filePath }) => {
      if (!workspaceId) return;
      socket.to(`workspace:${workspaceId}`).emit('remote-cursor-remove', {
        socketId: socket.id,
        filePath
      });
    });

    // ── NEW (chat): Real-time workspace chat
    socket.on('chatMessage', ({ workspaceId, id, text, timestamp }) => {
      if (!workspaceId || typeof text !== 'string') return;

      const roomName = `workspace:${workspaceId}`;

      // Only members who have joined this room may send to it
      if (!socket.rooms.has(roomName)) return;

      const clean = text.trim().slice(0, 2000);
      if (!clean) return;

      // Broadcast to everyone else in the room (sender already shows it locally)
      socket.to(roomName).emit('chatMessage', {
        id,
        sender: socket.username || 'Collaborator', // from the verified JWT
        text: clean,
        timestamp,
      });
    });

    // ── NEW (voice call): Voice call (teacher -> students) ─────────────────
    const inRoom = (wsId) => !!wsId && socket.rooms.has(`workspace:${wsId}`);

    socket.on('voice-start', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.role !== 'owner') {
        socket.emit('workspace-error', { message: 'Only the teacher can start a voice call' });
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

    // WebRTC signaling relay (offer / answer / ICE), only inside the same room
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
    // ── end of voice call handlers ─────────────────────────────────────────

    // ══════════════════════════════════════════════════════════════════════════
    // ── TEACHING SESSION SOCKET EVENTS ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * session:started — Teacher announces a session has started (after REST call).
     * Broadcasts session info and each socket's new sessionRole.
     */
    socket.on('session:announce_start', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') {
        socket.emit('workspace-error', { message: 'Only the teacher can announce a session start' });
        return;
      }

      // Refresh sessionRoles from DB for all connected sockets in this room
      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.userId) {
          const m = await WorkspaceMember.findOne({ where: { workspaceId, userId: s.userId } });
          if (m) s.sessionRole = m.sessionRole;
        }
      }

      const session = await TeachingSession.findOne({ where: { workspaceId, active: true } });
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:started', {
        sessionId: session?.id,
        teacherUserId: socket.userId,
        teacherName: socket.username,
        focusMode: session?.focusMode ?? false,
      });
    });

    /**
     * session:announce_end — Teacher announces session has ended.
     * Resets editorLocked state on all connected sockets.
     */
    socket.on('session:announce_end', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') {
        socket.emit('workspace-error', { message: 'Only the teacher can end a session' });
        return;
      }

      // Reset all in-memory session roles
      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        s.sessionRole = 'none';
        s.editorLocked = false;
      }

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:ended', {
        message: 'The teaching session has ended',
      });
    });

    /**
     * session:lock_editor — Teacher locks a specific student's editor (read-only).
     * Payload: { workspaceId, targetSocketId }
     */
    socket.on('session:lock_editor', ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      target.editorLocked = true;
      target.emit('session:editor_locked', {
        lockedBy: socket.username,
        message: 'Your editor has been locked by the teacher',
      });

      // Inform the teacher panel with confirmation
      socket.emit('session:lock_confirmed', { targetSocketId, username: target.username });
    });

    /**
     * session:unlock_editor — Teacher unlocks a student's editor.
     * Payload: { workspaceId, targetSocketId }
     */
    socket.on('session:unlock_editor', ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      target.editorLocked = false;
      target.emit('session:editor_unlocked', {
        unlockedBy: socket.username,
        message: 'Your editor has been unlocked',
      });

      socket.emit('session:unlock_confirmed', { targetSocketId, username: target.username });
    });

    /**
     * session:lock_all — Teacher locks ALL students' editors simultaneously.
     */
    socket.on('session:lock_all', async ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.sessionRole === 'student') {
          s.editorLocked = true;
          s.emit('session:editor_locked', {
            lockedBy: socket.username,
            message: 'The teacher has locked all editors',
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

      const roomSockets = await workspaceNamespace.in(`workspace:${workspaceId}`).fetchSockets();
      for (const s of roomSockets) {
        if (s.sessionRole === 'student') {
          s.editorLocked = false;
          s.emit('session:editor_unlocked', {
            unlockedBy: socket.username,
            message: 'The teacher has unlocked all editors',
          });
        }
      }
      socket.emit('session:unlock_all_confirmed');
    });

    /**
     * session:focus — Teacher sets focus mode (students see teacher's file).
     * Payload: { workspaceId, filePath, enabled }
     */
    socket.on('session:focus', ({ workspaceId, filePath, enabled }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:focus_changed', {
        enabled,
        filePath: enabled ? filePath : null,
        teacherName: socket.username,
      });
    });

    /**
     * session:raise_hand — Student raises their hand to ask a question.
     * Payload: { workspaceId }
     */
    socket.on('session:raise_hand', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'student') {
        socket.emit('workspace-error', { message: 'Only students can raise their hand' });
        return;
      }

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:hand_raised', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
      });
    });

    /**
     * session:lower_hand — Teacher or student lowers a raised hand.
     * Payload: { workspaceId, targetSocketId }
     */
    socket.on('session:lower_hand', ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      const isSelf = targetSocketId === socket.id;
      if (!isSelf && socket.sessionRole !== 'teacher') return;

      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:hand_lowered', {
        socketId: targetSocketId,
      });
    });

    /**
     * session:takeover — Teacher force-opens a specific file on a student's IDE.
     * Payload: { workspaceId, targetSocketId, filePath }
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
     * session:kick — Teacher removes a student from the session (not the workspace).
     * The student's sessionRole is reset to 'none', they are notified.
     * Payload: { workspaceId, targetSocketId }
     */
    socket.on('session:kick', async ({ workspaceId, targetSocketId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.sessionRole !== 'teacher') return;

      const target = workspaceNamespace.sockets.get(targetSocketId);
      if (!target || !target.rooms.has(`workspace:${workspaceId}`)) return;

      // Reset DB sessionRole
      if (target.userId) {
        await WorkspaceMember.update(
          { sessionRole: 'none' },
          { where: { workspaceId, userId: target.userId } }
        );
      }

      target.sessionRole = 'none';
      target.editorLocked = false;
      target.emit('session:kicked', {
        message: `You have been removed from the session by ${socket.username}`,
      });

      // Notify the room
      workspaceNamespace.to(`workspace:${workspaceId}`).emit('session:student_left', {
        socketId: targetSocketId,
        username: target.username,
      });
    });

    /**
     * session:request_help — Student requests teacher attention (different from raise hand — sends a text message).
     * Payload: { workspaceId, message }
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
     * session:ping_students — Teacher pings all students (attention signal).
     * Payload: { workspaceId, message }
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

    // ── end of teaching session socket events ─────────────────────────────────

    // Real-time File System changes 
    socket.on('fs-action', async ({ workspaceId, action, payload }) => {
      if (!workspaceId) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
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

        // Broadcasts updated file tree and filesystem action
        workspaceNamespace.to(roomName).emit('fs-updated', {
          action,
          result,
          fileTree
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `FS action failed: ${err.message}` });
      }
    });

    // Trigger Code Execution on Backend Server Workspace
    socket.on('execute-code', ({ workspaceId, filePath }) => {
      if (!workspaceId || !filePath) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      const roomName = `workspace:${workspaceId}`;

      // Broadcast execution start to room
      workspaceNamespace.to(roomName).emit('execution-started', { filePath });

      try {
        executionService.executeFile({
          workspaceId,
          filePath,
          onStdout: (chunk) => {
            workspaceNamespace.to(roomName).emit('execution-stdout', { chunk });
          },
          onStderr: (chunk) => {
            workspaceNamespace.to(roomName).emit('execution-stderr', { chunk });
          },
          onExit: (exitCode) => {
            workspaceNamespace.to(roomName).emit('execution-finished', { exitCode });
          }
        });
      } catch (err) {
        workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: `Execution failed: ${err.message}\n` });
        workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: -1 });
      }
    });

    // Stop execution
    socket.on('stop-execution', ({ workspaceId }) => {
      if (!workspaceId) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      const stopped = executionService.stopExecution(workspaceId);
      if (stopped) {
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-stderr', { chunk: '\n[Server] Execution stopped by user.\n' });
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-finished', { exitCode: -1 });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (currentWorkspaceId) {
        // ── NEW (voice call): end the call if the teacher left, else drop the student's peer
        const callRoom = `workspace:${currentWorkspaceId}`;
        const call = activeCalls.get(callRoom);
        if (call && call.teacherSocketId === socket.id) {
          activeCalls.delete(callRoom);
          socket.to(callRoom).emit('voice-ended');
        } else if (call) {
          workspaceNamespace.to(call.teacherSocketId).emit('voice-peer-left', { socketId: socket.id });
        }

        // If a teacher disconnects, notify the room
        if (socket.sessionRole === 'teacher') {
          socket.to(callRoom).emit('session:teacher_disconnected', {
            username: socket.username,
            message: 'The teacher has disconnected',
          });
        }

        workspaceService.decrementUserCount(currentWorkspaceId);
        socket.to(`workspace:${currentWorkspaceId}`).emit('user-left', {
          socketId: socket.id
        });
        socket.to(`workspace:${currentWorkspaceId}`).emit('remote-cursor-remove', {
          socketId: socket.id
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

export default initWorkspaceSockets;




  // ── NEW (voice call): roomName -> { teacherSocketId, teacherName }
  const activeCalls = new Map();

  workspaceNamespace.on('connection', (socket) => {
    let currentWorkspaceId = null;

    console.log(`[Socket] Client connected: ${socket.id}`);

    // Attach Whiteboard Socket Listeners
    attachWhiteboardSocketHandlers(socket, workspaceNamespace);

    // User joins workspace room
    socket.on('join-workspace', async ({ workspaceId, token }) => {
      if (!workspaceId) return;

      if (!token) {
        socket.emit('workspace-error', { message: 'Unauthorized' });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        socket.emit('workspace-error', { message: 'Unauthorized' });
        return;
      }

      const membership = await WorkspaceMember.findOne({
        where: { workspaceId, userId: decoded.id }
      });

      if (!membership) {
        socket.emit('workspace-error', { message: 'Not a member' });
        return;
      }

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.role = membership.role;

      currentWorkspaceId = workspaceId;
      const roomName = `workspace:${workspaceId}`;

      socket.join(roomName);
      workspaceService.incrementUserCount(workspaceId);

      // ── NEW (voice call): tell late joiners that a call is already running
      const call = activeCalls.get(roomName);
      if (call) {
        socket.emit('voice-started', { teacherSocketId: call.teacherSocketId, teacherName: call.teacherName });
      }
      console.log(`[Socket] User ${socket.username} (${socket.id}) joined ${roomName} as ${socket.role}`);

      // notify others in the workspace room
      socket.to(roomName).emit('user-joined', {
        socketId: socket.id,
        username: socket.username,
        activeUsers: workspaceService.getActiveUsers(workspaceId)
      });

      // Send initial file tree to joining client
      try {
        const fileTree = await storageService.getFileTree(workspaceId);
        socket.emit('workspace-ready', { workspaceId, fileTree });
      } catch (err) {
        socket.emit('workspace-error', { message: err.message });
      }
    });

    // Real-time file content change 
    socket.on('file-change', async ({ workspaceId, filePath, content }) => {
      if (!workspaceId || !filePath) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      try {
        // Save change to workspace storage
        await storageService.writeFile(workspaceId, filePath, content);

        // Broadcast updated content to all other users in the room
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
        cursor
      });
    });

    // Real-time cursor leave / tab change
    socket.on('cursor-leave', ({ workspaceId, filePath }) => {
      if (!workspaceId) return;
      socket.to(`workspace:${workspaceId}`).emit('remote-cursor-remove', {
        socketId: socket.id,
        filePath
      });
    });

    // ── NEW (chat): Real-time workspace chat
    socket.on('chatMessage', ({ workspaceId, id, text, timestamp }) => {
      if (!workspaceId || typeof text !== 'string') return;

      const roomName = `workspace:${workspaceId}`;

      // Only members who have joined this room may send to it
      if (!socket.rooms.has(roomName)) return;

      const clean = text.trim().slice(0, 2000);
      if (!clean) return;

      // Broadcast to everyone else in the room (sender already shows it locally)
      socket.to(roomName).emit('chatMessage', {
        id,
        sender: socket.username || 'Collaborator', // from the verified JWT
        text: clean,
        timestamp,
      });
    });

    // ── NEW (voice call): Voice call (teacher -> students) ─────────────────
    const inRoom = (wsId) => !!wsId && socket.rooms.has(`workspace:${wsId}`);

    socket.on('voice-start', ({ workspaceId }) => {
      if (!inRoom(workspaceId)) return;
      if (socket.role !== 'owner') {
        socket.emit('workspace-error', { message: 'Only the teacher can start a voice call' });
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

    // WebRTC signaling relay (offer / answer / ICE), only inside the same room
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
    // ── end of voice call handlers ─────────────────────────────────────────
    // Real-time File System changes 
    socket.on('fs-action', async ({ workspaceId, action, payload }) => {
      if (!workspaceId) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
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

        // Broadcasts updated file tree and filesystem action
        workspaceNamespace.to(roomName).emit('fs-updated', {
          action,
          result,
          fileTree
        });
      } catch (err) {
        socket.emit('workspace-error', { message: `FS action failed: ${err.message}` });
      }
    });

    // Trigger Code Execution on Backend Server Workspace
    socket.on('execute-code', ({ workspaceId, filePath }) => {
      if (!workspaceId || !filePath) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      const roomName = `workspace:${workspaceId}`;

      // Broadcast execution start to room
      workspaceNamespace.to(roomName).emit('execution-started', { filePath });

      try {
        executionService.executeFile({
          workspaceId,
          filePath,
          onStdout: (chunk) => {
            workspaceNamespace.to(roomName).emit('execution-stdout', { chunk });
          },
          onStderr: (chunk) => {
            workspaceNamespace.to(roomName).emit('execution-stderr', { chunk });
          },
          onExit: (exitCode) => {
            workspaceNamespace.to(roomName).emit('execution-finished', { exitCode });
          }
        });
      } catch (err) {
        workspaceNamespace.to(roomName).emit('execution-stderr', { chunk: `Execution failed: ${err.message}\n` });
        workspaceNamespace.to(roomName).emit('execution-finished', { exitCode: -1 });
      }
    });

    // Stop execution
    socket.on('stop-execution', ({ workspaceId }) => {
      if (!workspaceId) return;
      if (socket.role === 'viewer') {
        socket.emit('workspace-error', { message: 'Viewers cannot edit' });
        return;
      }

      const stopped = executionService.stopExecution(workspaceId);
      if (stopped) {
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-stderr', { chunk: '\n[Server] Execution stopped by user.\n' });
        workspaceNamespace.to(`workspace:${workspaceId}`).emit('execution-finished', { exitCode: -1 });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (currentWorkspaceId) {
        // ── NEW (voice call): end the call if the teacher left, else drop the student's peer
        const callRoom = `workspace:${currentWorkspaceId}`;
        const call = activeCalls.get(callRoom);
        if (call && call.teacherSocketId === socket.id) {
          activeCalls.delete(callRoom);
          socket.to(callRoom).emit('voice-ended');
        } else if (call) {
          workspaceNamespace.to(call.teacherSocketId).emit('voice-peer-left', { socketId: socket.id });
        }
        workspaceService.decrementUserCount(currentWorkspaceId);
        socket.to(`workspace:${currentWorkspaceId}`).emit('user-left', {
          socketId: socket.id
        });
        socket.to(`workspace:${currentWorkspaceId}`).emit('remote-cursor-remove', {
          socketId: socket.id
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

export default initWorkspaceSockets;
