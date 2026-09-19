import { Router, Request, Response } from 'express';
import { getUserBids } from '../services/bidService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/users/me/bids - Get bids placed by the currently logged-in user
router.get('/me/bids', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const bids = await getUserBids(req.user!.id, limit);
    res.json({ bids });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user bids', message: err.message });
  }
});

export default router;
