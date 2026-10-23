/**
 * Whiteboard Socket Handlers
 * Attaches real-time canvas collaboration, element sync, presence, and mode changes.
 * Enforces both Professional RBAC (viewers cannot edit) and Education RBAC (locked students cannot edit).
 * @param {import('socket.io').Socket} socket 
 * @param {import('socket.io').Namespace} namespace 
 */
export function attachWhiteboardSocketHandlers(socket) {
  const checkWhiteboardEditAccess = () => {
    if (socket.role === 'viewer') {
      socket.emit('workspace-error', { message: 'Viewers cannot edit whiteboard' });
      return false;
    }
    if (socket.sessionRole === 'student' && socket.editorLocked) {
      socket.emit('workspace-error', { message: 'Whiteboard is locked during teaching session' });
      return false;
    }
    return true;
  };

  // Join a specific whiteboard room session
  socket.on('whiteboard:join', ({ whiteboardId, boardId }) => {
    const id = whiteboardId || boardId;
    if (!id) return;
    const roomName = `whiteboard:${id}`;
    socket.join(roomName);

    socket.to(roomName).emit('whiteboard:user-joined', {
      socketId: socket.id,
      username: socket.username || 'Collaborator',
      userId: socket.userId,
    });
  });

  // Leave whiteboard room
  socket.on('whiteboard:leave', ({ whiteboardId, boardId }) => {
    const id = whiteboardId || boardId;
    if (!id) return;
    const roomName = `whiteboard:${id}`;
    socket.leave(roomName);

    socket.to(roomName).emit('whiteboard:user-left', {
      socketId: socket.id,
    });
  });

  // Batch elements change
  socket.on('whiteboard:elements-change', ({ whiteboardId, boardId, elements, action }) => {
    const id = whiteboardId || boardId;
    if (!id) return;
    if (!checkWhiteboardEditAccess()) return;

    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:elements-updated', {
      elements,
      action: action || 'update',
      updatedBy: socket.id,
      username: socket.username || 'Collaborator',
    });
  });

  // Single element update
  socket.on('whiteboard:element_update', ({ boardId, whiteboardId, element }) => {
    const id = boardId || whiteboardId;
    if (!id || !element) return;
    if (!checkWhiteboardEditAccess()) return;

    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:element_update', element);
  });

  // Single element delete
  socket.on('whiteboard:element_delete', ({ boardId, whiteboardId, elementId }) => {
    const id = boardId || whiteboardId;
    if (!id || !elementId) return;
    if (!checkWhiteboardEditAccess()) return;

    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:element_delete', elementId);
  });

  // Real-time canvas cursor position sync
  socket.on('whiteboard:cursor', ({ boardId, whiteboardId, cursor, username }) => {
    const id = boardId || whiteboardId;
    if (!id) return;
    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:cursor', {
      socketId: socket.id,
      userId: socket.userId,
      username: username || socket.username || 'Collaborator',
      cursor,
    });
  });

  socket.on('whiteboard:cursor-move', ({ whiteboardId, boardId, cursor }) => {
    const id = whiteboardId || boardId;
    if (!id) return;
    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:remote-cursor', {
      socketId: socket.id,
      username: socket.username || 'Collaborator',
      cursor,
    });
  });

  // Mode change switch (Teach vs Development)
  socket.on('whiteboard:mode-change', ({ whiteboardId, boardId, mode }) => {
    const id = whiteboardId || boardId;
    if (!id) return;
    const roomName = `whiteboard:${id}`;
    socket.to(roomName).emit('whiteboard:mode-updated', {
      mode,
      updatedBy: socket.id,
      username: socket.username || 'Collaborator',
    });
  });
}

export default attachWhiteboardSocketHandlers;
