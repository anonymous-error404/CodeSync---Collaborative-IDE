require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const { syncDatabase } = require('./models');

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

// Authentication Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'CodeSync Authentication & Backend Service',
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

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
