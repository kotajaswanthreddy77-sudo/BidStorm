import { Router, Request, Response } from 'express';
import { query, getDbMode } from '../db/index.js';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'bidstorm-api',
  });
});

router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const dbRes = await query('SELECT 1 as alive');
    const isDbAlive = dbRes.rows.length > 0 && dbRes.rows[0].alive === 1;

    res.json({
      status: isDbAlive ? 'ready' : 'unhealthy',
      database: {
        connected: isDbAlive,
        mode: getDbMode(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: {
        connected: false,
        error: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
