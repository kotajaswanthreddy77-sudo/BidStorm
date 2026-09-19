import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { metricsService } from '../services/metricsService.js';
import { runLoadSimulation, resetTestAuction } from '../services/testRunnerService.js';
import { verifyAuctionCorrectness } from '../services/verificationService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { query } from '../db/index.js';

const router = Router();

// Require admin role for all admin routes
router.use(authenticate, requireRole('admin'));

const runSimulationSchema = z.object({
  auctionId: z.string().uuid(),
  totalRequests: z.coerce.number().int().min(1).max(10000).default(100),
  concurrency: z.coerce.number().int().min(1).max(100).default(10),
  strategy: z.enum(['same_amount', 'incremental', 'random_concurrent']).default('same_amount'),
  numClients: z.coerce.number().int().min(1).max(100).optional(),
  resetAuctionBeforeRun: z.boolean().default(true),
});

// GET /api/admin/metrics - Real-time system performance & database health metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch system metrics', message: err.message });
  }
});

// GET /api/admin/events - Recent transactional events audit log
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const events = await metricsService.getRecentEvents(limit);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch events', message: err.message });
  }
});

// GET /api/admin/test-runs - List past test runs
router.get('/test-runs', async (req: Request, res: Response) => {
  try {
    const resList = await query(
      `SELECT tr.id, tr.auction_id, tr.requested_requests, tr.concurrency, tr.strategy,
              tr.accepted_count, tr.rejected_count, tr.error_count, tr.duration_ms,
              tr.status, tr.stats, tr.created_at,
              a.title as auction_title
       FROM auction_test_runs tr
       LEFT JOIN auctions a ON tr.auction_id = a.id
       ORDER BY tr.created_at DESC
       LIMIT 20`
    );

    const testRuns = resList.rows.map((r) => ({
      ...r,
      stats: typeof r.stats === 'string' ? JSON.parse(r.stats) : r.stats,
    }));

    res.json({ testRuns });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch test runs', message: err.message });
  }
});

// POST /api/admin/test-runs - Start concurrency simulation
router.post(
  '/test-runs',
  validateBody(runSimulationSchema),
  async (req: Request, res: Response) => {
    try {
      const summary = await runLoadSimulation(req.body);
      res.status(201).json(summary);
    } catch (err: any) {
      res.status(500).json({ error: 'Simulation execution failed', message: err.message });
    }
  }
);

// GET /api/admin/test-runs/:id - Get test run summary
router.get('/test-runs/:id', async (req: Request, res: Response) => {
  try {
    const testRunRes = await query(
      `SELECT tr.*, a.title as auction_title
       FROM auction_test_runs tr
       LEFT JOIN auctions a ON tr.auction_id = a.id
       WHERE tr.id = $1`,
      [req.params.id]
    );

    if (testRunRes.rows.length === 0) {
      res.status(404).json({ error: 'Test run not found' });
      return;
    }

    const row = testRunRes.rows[0];
    const testRun = {
      ...row,
      stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
    };

    res.json({ testRun });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch test run', message: err.message });
  }
});

// GET /api/admin/test-runs/:id/verify - Correctness verification endpoint
router.get('/test-runs/:id/verify', async (req: Request, res: Response) => {
  try {
    const report = await verifyAuctionCorrectness(req.params.id);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

// POST /api/admin/test-runs/reset-test-auction - Reset benchmark auction
router.post('/test-runs/reset-test-auction', async (req: Request, res: Response) => {
  try {
    const auctionId = req.body.auctionId || '11111111-1111-1111-1111-111111111105';
    await resetTestAuction(auctionId);
    res.json({ message: 'Test auction reset successfully', auctionId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset test auction', message: err.message });
  }
});

export default router;
