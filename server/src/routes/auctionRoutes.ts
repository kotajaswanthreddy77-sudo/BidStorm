import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  closeAuction,
} from '../services/auctionService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const createAuctionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  category: z.string().default('General'),
  imageUrl: z.string().url().optional(),
  startingPrice: z.coerce.number().positive(),
  minimumIncrement: z.coerce.number().positive().default(10),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const updateAuctionSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(10).optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  minimumIncrement: z.coerce.number().positive().optional(),
  status: z.enum(['pending', 'active', 'paused', 'ended', 'cancelled']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

// GET /api/auctions - List auctions with filters & search
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, status, search, sortBy, sortOrder, limit, offset } = req.query;

    const result = await getAuctions({
      category: category as string,
      status: status as string,
      search: search as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch auctions', message: err.message });
  }
});

// GET /api/auctions/:id - Get auction details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const auction = await getAuctionById(req.params.id);
    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }
    res.json({ auction });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch auction details', message: err.message });
  }
});

// POST /api/auctions - Create auction (manager or admin)
router.post(
  '/',
  authenticate,
  requireRole('manager', 'admin'),
  validateBody(createAuctionSchema),
  async (req: Request, res: Response) => {
    try {
      const auction = await createAuction({
        ...req.body,
        createdBy: req.user!.id,
      });

      res.status(201).json({ auction });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create auction', message: err.message });
    }
  }
);

// PATCH /api/auctions/:id - Update auction
router.patch(
  '/:id',
  authenticate,
  requireRole('manager', 'admin'),
  validateBody(updateAuctionSchema),
  async (req: Request, res: Response) => {
    try {
      const updated = await updateAuction(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Auction not found' });
        return;
      }
      res.json({ auction: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update auction', message: err.message });
    }
  }
);

// POST /api/auctions/:id/close - Close auction (manager or admin)
router.post(
  '/:id/close',
  authenticate,
  requireRole('manager', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await closeAuction(req.params.id);
      res.json({ message: 'Auction closed successfully', result });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to close auction', message: err.message });
    }
  }
);

export default router;
