import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { placeBid, getAuctionBids, getUserBids } from '../services/bidService.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const placeBidSchema = z.object({
  amount: z.coerce.number().positive(),
  idempotencyKey: z.string().min(4).optional(),
});

// POST /api/auctions/:id/bids - Place a bid on an auction
router.post(
  '/:id/bids',
  authenticate,
  rateLimiter(),
  validateBody(placeBidSchema),
  async (req: Request, res: Response) => {
    try {
      const auctionId = req.params.id;
      const { amount, idempotencyKey } = req.body;
      const bidderId = req.user!.id;
      const bidderName = req.user!.name;
      const key = idempotencyKey || uuidv4();
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();

      const result = await placeBid({
        auctionId,
        bidderId,
        bidderName,
        amount,
        idempotencyKey: key,
        requestId,
      });

      if (!result.success) {
        // Return 400 with the exact domain reason why bid was rejected
        res.status(400).json({
          error: 'Bid rejected',
          reason: result.rejectionReason,
          result,
        });
        return;
      }

      res.status(201).json({
        message: 'Bid accepted successfully',
        result,
      });
    } catch (err: any) {
      if (err.message?.includes('AUCTION_NOT_FOUND')) {
        res.status(404).json({ error: 'Auction not found' });
        return;
      }
      res.status(500).json({ error: 'Failed to process bid', message: err.message });
    }
  }
);

// GET /api/auctions/:id/bids - Get bid history for an auction
router.get('/:id/bids', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const bids = await getAuctionBids(req.params.id, limit);
    res.json({ bids });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch auction bids', message: err.message });
  }
});

export default router;
