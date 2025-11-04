require('dotenv').config();
const { app } = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Local: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`  DB test: http://localhost:${PORT}/test-db`);
  console.log('  Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Server shutting down...');
  server.close(() => {
    console.log(' Server closed');
    process.exit(0);
  });
});
