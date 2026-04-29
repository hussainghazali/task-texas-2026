const express = require('express');
const config = require('./config');
const configureMiddleware = require('./middleware');
const configureRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const socketio = require('socket.io');
const gameSocket = require('./socket/index');

/**
 * Initialize Express application
 */
const app = express();

// Configure middleware (must be before routes)
configureMiddleware(app);

// Set up API routes
configureRoutes(app);

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Start HTTP server
 */
const server = app.listen(config.PORT, () => {
  console.log(
    `🚀 Server is running in ${config.NODE_ENV} mode on port ${config.PORT}`
  );
});

/**
 * Initialize Socket.IO for real-time game communication
 */
const io = socketio(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CLIENT_URL
      : true,
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  gameSocket.init(socket, io);
});

/**
 * Graceful shutdown handlers
 */
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
