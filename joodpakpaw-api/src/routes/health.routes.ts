import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../database/prisma';
import { config } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = config.redisUrl ? 'configured' : 'in-memory-fallback';

  const healthPayload = {
    status: 'ok',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: '2.0.0',
    services: {
      database: dbHealth,
      redis: redisHealth,
      storage: 'ready',
    },
  };

  res.status(200).json(healthPayload);
});
