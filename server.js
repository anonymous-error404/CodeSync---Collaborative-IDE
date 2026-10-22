import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const socketToRoom = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Room Join Event
  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socketToRoom[socket.id] = roomId;
    console.log(`${userName} joined room: ${roomId}`);
    socket.to(roomId).emit('user-joined-voice', { callerID: socket.id, userName });
  });

  // Text Chat Broadcast Event
  socket.on('send-message', ({ roomId, message, sender }) => {
    console.log(`Message in ${roomId} from ${sender}: ${message}`);
    io.to(roomId).emit('receive-message', {
      id: Date.now(),
      sender,
      message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  });

  // WebRTC Voice Signaling
  socket.on('sending-signal', (payload) => {
    io.to(payload.userToSignal).emit('user-joined-signal', {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on('returning-signal', (payload) => {
    io.to(payload.callerID).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    if (roomId) {
      socket.to(roomId).emit('user-left-voice', socket.id);
      delete socketToRoom[socket.id];
    }
  });
});

httpServer.listen(5000, () => {
  console.log('CodeSync Realtime Server running on port 5000');
});