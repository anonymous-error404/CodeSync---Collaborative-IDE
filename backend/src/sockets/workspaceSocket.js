import workspaceService from '../services/workspaceService.js';
import storageService from '../services/storageService.js';
import executionService from '../services/executionService.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/authConfig.js';
import { WorkspaceMember } from '../models/index.js';

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