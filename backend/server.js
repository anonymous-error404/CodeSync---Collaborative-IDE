require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { workspaceRoutes, initWorkspaceSockets } = require('./workspace');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// CORS and JSON body parsing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());

// REST API routes
app.use('/api', workspaceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'CodeSync Workspace Backend', timestamp: new Date().toISOString() });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error]: ${err.stack || err.message}`);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Socket.io server with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach Workspace Real-Time Socket Handlers
initWorkspaceSockets(io);

server.listen(PORT, () => {
  console.log(`============================================`);
  console.log(`Workspace Backend Service running on port ${PORT}`);
  console.log(`REST API: http://localhost:${PORT}/api/workspaces`);
  console.log(`WebSocket Namespace: ws://localhost:${PORT}/workspace`);
  console.log(`============================================`);
});
