import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { prisma } from './database/prisma';

const app = createApp();
const server = http.createServer(app);

const PORT = config.port;

server.listen(PORT, () => {
  console.log(`[JoodPakPaw API] Server running in ${config.env} mode on http://localhost:${PORT}`);
  console.log(`[JoodPakPaw API] Health endpoint available at http://localhost:${PORT}/health`);
  console.log(`[JoodPakPaw API] API v1 base available at http://localhost:${PORT}/api/v1`);
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[JoodPakPaw API] Received ${signal}. Starting graceful shutdown...`);

  // Force shutdown after 10 seconds timeout
  const forceExitTimeout = setTimeout(() => {
    console.error('[JoodPakPaw API] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);

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
