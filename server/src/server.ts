import http from 'http';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { initDb, closeDb } from './db/index.js';
import { initSocketServer } from './sockets/socketServer.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import auctionRoutes from './routes/auctionRoutes.js';
import bidRoutes from './routes/bidRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

export const app = express();
export const httpServer = http.createServer(app);

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

// Mount API routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/auctions', bidRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Socket.IO Server Initialization
export const io = initSocketServer(httpServer);

// Startup sequence
export async function startServer() {
  try {
    await initDb();
    console.log('[SERVER] Database connection established.');

    return new Promise<void>((resolve) => {
      httpServer.listen(env.PORT, "0.0.0.0", () => {
        console.log(`[SERVER] BidStorm Backend listening on port ${env.PORT}`);
        console.log(`[SERVER] Environment: ${env.NODE_ENV}`);
        resolve();
      });
    });
  } catch (error) {
    console.error('[SERVER] Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received. Shutting down gracefully...');
  httpServer.close(async () => {
    await closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[SERVER] SIGINT received. Shutting down gracefully...');
  httpServer.close(async () => {
    await closeDb();
    process.exit(0);
  });
});

// Auto-start if run directly
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  startServer();
}
