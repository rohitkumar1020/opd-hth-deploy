import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { setupSocketHandlers } from './modules/realtime/socket';

const server = http.createServer(app);

// Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: config.frontendUrl.split(',').map(s => s.trim()),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Make io accessible globally
export { io };

// Setup socket handlers
setupSocketHandlers(io);

async function start() {
  await connectDatabase();

  server.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║          SwasthAI Backend Server             ║
║  AI-Powered OPD Triage & Queue Management    ║
╠══════════════════════════════════════════════╣
║  Port:     ${String(config.port).padEnd(33)}║
║  Env:      ${config.nodeEnv.padEnd(33)}║
║  AI Mode:  ${(config.geminiApiKey ? 'Gemini' : 'Demo').padEnd(33)}║
╚══════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down...');
  await disconnectDatabase();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down...');
  await disconnectDatabase();
  server.close(() => process.exit(0));
});

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
