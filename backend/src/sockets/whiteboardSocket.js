/**
 * Whiteboard Socket Handlers
 * Attaches real-time canvas collaboration, element sync, presence, and mode changes.
 * @param {import('socket.io').Socket} socket 
 * @param {import('socket.io').Namespace} namespace 
 */
export function attachWhiteboardSocketHandlers(socket, namespace) {
  // Join a specific whiteboard room session
  socket.on('whiteboard:join', ({ workspaceId, whiteboardId }) => {
    if (!workspaceId || !whiteboardId) return;
    const roomName = `whiteboard:${whiteboardId}`;
    socket.join(roomName);

    console.log(`[Socket] User ${socket.username || socket.id} joined ${roomName}`);

    socket.to(roomName).emit('whiteboard:user-joined', {
      socketId: socket.id,
      username: socket.username || 'Collaborator',
      userId: socket.userId,
    });
  });

  // Leave whiteboard room
  socket.on('whiteboard:leave', ({ whiteboardId }) => {
    if (!whiteboardId) return;
    const roomName = `whiteboard:${whiteboardId}`;
    socket.leave(roomName);

    socket.to(roomName).emit('whiteboard:user-left', {
      socketId: socket.id,
    });
  });

  // Real-time canvas element updates (addition, modification, deletion)
  socket.on('whiteboard:elements-change', ({ workspaceId, whiteboardId, elements, action }) => {
    if (!whiteboardId) return;
    if (socket.role === 'viewer') {
      socket.emit('workspace-error', { message: 'Viewers cannot edit whiteboard' });
      return;
    }

    const roomName = `whiteboard:${whiteboardId}`;
    socket.to(roomName).emit('whiteboard:elements-updated', {
      elements,
      action: action || 'update',
      updatedBy: socket.id,
      username: socket.username || 'Collaborator',
    });
  });

  // Real-time canvas cursor position sync
  socket.on('whiteboard:cursor-move', ({ whiteboardId, cursor }) => {
    if (!whiteboardId) return;
    const roomName = `whiteboard:${whiteboardId}`;
    socket.to(roomName).emit('whiteboard:remote-cursor', {
      socketId: socket.id,
      username: socket.username || 'Collaborator',
      cursor,
    });
  });

  // Mode change switch (Teach vs Development)
  socket.on('whiteboard:mode-change', ({ whiteboardId, mode }) => {
    if (!whiteboardId) return;
    const roomName = `whiteboard:${whiteboardId}`;
    socket.to(roomName).emit('whiteboard:mode-updated', {
      mode,
      updatedBy: socket.id,
      username: socket.username || 'Collaborator',
    });
  });
}

export default attachWhiteboardSocketHandlers;
