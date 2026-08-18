import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { workspaceRoutes, authRoutes, initWorkspaceSockets } from './src/index.js';
import { syncDatabase } from './src/models/index.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// JSON body parser
app.use(express.json());

// REST API routes
app.use('/api/auth', authRoutes);
app.use('/api', workspaceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'CodeSync Collaborative Backend Service',
    timestamp: new Date().toISOString(),
  });
});

// Centralized Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error]: ${err.stack || err.message}`);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Socket.io server with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Attach Workspace Real-Time Socket Handlers
initWorkspaceSockets(io);

// Start Server and Synchronize SQLite Database
const startServer = async (port = PORT) => {
  try {
    // Sync Sequelize models with SQLite
    await syncDatabase();

    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`============================================`);
        console.log(`CodeSync Backend running on port ${port}`);
        console.log(`Auth REST API: http://localhost:${port}/api/auth`);
        console.log(`Workspace REST API: http://localhost:${port}/api/workspaces`);
        console.log(`WebSocket Namespace: ws://localhost:${port}/workspace`);
        console.log(`Health Check:  http://localhost:${port}/health`);
        console.log(`============================================`);
        resolve(server);
      });
    });
  } catch (error) {
    console.error('[Startup Error]: Could not start the server:', error);
    process.exit(1);
  }
};

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  startServer();
}

export { app, server, startServer };
