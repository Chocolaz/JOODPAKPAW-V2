import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { prisma } from './database/prisma';
import {
  startBookingLifecycleScheduler,
  stopBookingLifecycleScheduler,
} from './services/bookingLifecycle.service';
import {
  initSocketServer,
  closeSocketServer,
} from './services/socket.service';
import { cacheService } from './services/cache.service';

const app = createApp();
const server = http.createServer(app);

// Pre-rewrite listener for legacy socket path compatibility
server.prependListener('request', (req: http.IncomingMessage) => {
  if (req.url && req.url.startsWith('/capstone25/cp25nk2/api/socket.io')) {
    req.url = req.url.replace('/capstone25/cp25nk2/api/socket.io', '/api/socket.io');
  }
});

server.prependListener('upgrade', (req: http.IncomingMessage) => {
  if (req.url && req.url.startsWith('/capstone25/cp25nk2/api/socket.io')) {
    req.url = req.url.replace('/capstone25/cp25nk2/api/socket.io', '/api/socket.io');
  }
});

// Initialize Socket.IO v4 server attached to the HTTP server
initSocketServer(server);

const PORT = config.port;

server.listen(PORT, () => {
  console.log(`[JoodPakPaw API] Server running in ${config.env} mode on http://localhost:${PORT}`);
  console.log(`[JoodPakPaw API] Health endpoint available at http://localhost:${PORT}/health`);
  console.log(`[JoodPakPaw API] API v1 base available at http://localhost:${PORT}/api/v1`);
  startBookingLifecycleScheduler();
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  stopBookingLifecycleScheduler();
  cacheService.destroy();
  console.log(`\n[JoodPakPaw API] Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after 10 seconds timeout
  const forceExitTimeout = setTimeout(() => {
    console.error('[JoodPakPaw API] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);

  try {
    await closeSocketServer();
  } catch (socketErr) {
    console.error('[JoodPakPaw API] Error closing Socket.IO server:', socketErr);
  }

  server.close(async () => {
    console.log('[JoodPakPaw API] HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('[JoodPakPaw API] Database connection closed.');
    } catch (err) {
      console.error('[JoodPakPaw API] Error closing database connection:', err);
    } finally {
      clearTimeout(forceExitTimeout);
      console.log('[JoodPakPaw API] Graceful shutdown completed. Exiting.');
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[JoodPakPaw API] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[JoodPakPaw API] Uncaught Exception:', err);
  handleShutdown('uncaughtException');
});

export { app, server };
