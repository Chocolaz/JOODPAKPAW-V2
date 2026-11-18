import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../database/prisma';

let io: SocketIOServer | null = null;

const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) return true;
  return true; // Dev fallback
}

/**
 * Initializes and attaches the Socket.IO v4 server to the HTTP server instance.
 */
export function initSocketServer(httpServer: http.Server): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    },
    transports: ['polling', 'websocket'],
  });

  // JWT Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let rawToken: string | undefined =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.query?.token as string | undefined) ||
        (socket.handshake.headers?.authorization as string | undefined);

      if (!rawToken) {
        return next(new Error('A-3005: Unauthorized. Missing authentication token.'));
      }

      if (typeof rawToken === 'string' && rawToken.toLowerCase().startsWith('bearer ')) {
        rawToken = rawToken.slice(7).trim();
      }

      let decoded: any;
      try {
        decoded = jwt.verify(rawToken, config.jwt.secret);
      } catch (_err) {
        return next(new Error('A-3005: Invalid or expired authentication token.'));
      }

      const userId = typeof decoded?.userId === 'number' ? decoded.userId : decoded?.id;
      if (!userId || typeof userId !== 'number') {
        return next(new Error('A-3005: Invalid token payload.'));
      }

      // Check user existence and ban status in DB
      let user: any = null;
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, deletedAt: true, bannedAt: true },
        });
      } catch (dbErr) {
        console.warn('[Socket.IO] Database lookup failed during handshake:', dbErr);
      }

      if (!user || user.deletedAt !== null) {
        return next(new Error('A-3005: User account not found or deactivated.'));
      }

      if (user.bannedAt !== null) {
        return next(new Error('A-3002: User account has been banned.'));
      }

      socket.data.userId = user.id;
      next();
    } catch (err: any) {
      console.error('[Socket.IO] Handshake error:', err?.message || err);
      next(new Error('A-3005: Authentication failed.'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const userId = socket.data.userId as number;
    if (userId) {
      const roomName = `user:${userId}`;
      socket.join(roomName);

      // Emit connected event to satisfy NotificationContext and ChatContext
      socket.emit('connected', { status: 'ok', userId });

      if (config.env !== 'test') {
        console.log(`[Socket.IO] User #${userId} connected (socket ID: ${socket.id})`);
      }

      socket.on('disconnect', (_reason) => {
        if (config.env !== 'test') {
          console.log(`[Socket.IO] User #${userId} disconnected (socket ID: ${socket.id})`);
        }
      });
    }
  });

  return io;
}

/**
 * Returns the active Socket.IO server instance or null if not yet initialized.
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emits an event to a specific user's private socket room (`user:${userId}`).
 * Safe no-op when the Socket.IO server is not running (e.g. during standalone tests).
 */
export function emitToUser(userId: number, event: string, payload: unknown): void {
  if (!io || !userId) {
    return;
  }
  try {
    io.to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    console.warn(`[Socket.IO] Failed to emit "${event}" to user ${userId}:`, err);
  }
}

/**
 * Closes the Socket.IO server gracefully during application shutdown.
 */
export async function closeSocketServer(): Promise<void> {
  if (!io) {
    return;
  }

  const currentIo = io;
  io = null;

  return new Promise<void>((resolve) => {
    currentIo.close(() => {
      console.log('[Socket.IO] WebSocket server closed gracefully.');
      resolve();
    });
  });
}
