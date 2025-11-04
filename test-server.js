const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.send('Simple test server is working!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Simple server healthy' });
});

console.log('🚀 Starting simple test server...');

app.listen(PORT, () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`📍 Test: http://localhost:${PORT}/health`);
  console.log('⏹️  Press Ctrl+C to stop');
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 Server stopped by user');
  process.exit(0);
});