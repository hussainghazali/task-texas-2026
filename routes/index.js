/**
 * Configure all application routes
 * @param {Express} app - Express application instance
 */
const configureRoutes = (app) => {
  // API routes
  app.use('/api/auth', require('./api/auth'));
  app.use('/api/users', require('./api/users'));
  app.use('/api/chips', require('./api/chips'));
  app.use('/api/rooms', require('./api/rooms'));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  });

  // API root endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Texas Hold\'em Online API',
      version: '1.0.0',
    });
  });

  // 404 handler for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
    });
  });
};

module.exports = configureRoutes;  