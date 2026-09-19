import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

interface ClientHistory {
  timestamps: number[];
}

const clientLimits = new Map<string, ClientHistory>();

export function rateLimiter(
  windowMs = env.BID_RATE_LIMIT_WINDOW_MS,
  maxRequests = env.BID_RATE_LIMIT_MAX_REQUESTS
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine client identifier (user ID if authenticated, else IP)
    const clientId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();

    let client = clientLimits.get(clientId);
    if (!client) {
      client = { timestamps: [] };
      clientLimits.set(clientId, client);
    }

    // Filter out timestamps outside window
    client.timestamps = client.timestamps.filter((ts) => now - ts < windowMs);

    if (client.timestamps.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Rate limit exceeded.',
        retryAfterMs: windowMs - (now - client.timestamps[0]),
      });
      return;
    }

    client.timestamps.push(now);
    next();
  };
}
