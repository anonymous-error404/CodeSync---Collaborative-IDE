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
