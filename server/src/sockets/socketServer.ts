import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env.js';

let io: SocketIOServer | null = null;
let activeConnectionCount = 0;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    activeConnectionCount++;
    // console.log(`[SOCKET] Client connected: ${socket.id}. Total active: ${activeConnectionCount}`);

    socket.on('join:auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
      // console.log(`[SOCKET] Socket ${socket.id} joined auction:${auctionId}`);
    });

    socket.on('leave:auction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`);
      // console.log(`[SOCKET] Socket ${socket.id} left auction:${auctionId}`);
    });

    socket.on('join:admin', () => {
      socket.join('admin');
      // console.log(`[SOCKET] Socket ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      activeConnectionCount = Math.max(0, activeConnectionCount - 1);
      // console.log(`[SOCKET] Client disconnected: ${socket.id}. Total active: ${activeConnectionCount}`);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function getActiveSocketCount(): number {
  return activeConnectionCount;
}

export function broadcastAuctionUpdate(payload: {
  auctionId: string;
  currentHighestBid: number;
  bidCount: number;
  latestBidderName?: string;
  timestamp: string;
}): void {
  if (!io) return;
  io.to(`auction:${payload.auctionId}`).emit('auction:updated', payload);
  io.to('admin').emit('auction:updated', payload);
}

export function broadcastBidAccepted(payload: {
  auctionId: string;
  bidId: string;
  amount: number;
  bidderName?: string;
  bidderId: string;
  timestamp: string;
}): void {
  if (!io) return;
  io.to(`auction:${payload.auctionId}`).emit('bid:accepted', payload);
  io.to('admin').emit('bid:accepted', payload);
}

export function broadcastAuctionClosed(payload: {
  auctionId: string;
  winnerId: string | null;
  winnerName: string | null;
  winningBid: number | null;
  timestamp: string;
}): void {
  if (!io) return;
  io.to(`auction:${payload.auctionId}`).emit('auction:closed', payload);
  io.to('admin').emit('auction:closed', payload);
}

export function broadcastSimulationProgress(payload: {
  testRunId: string;
  sent: number;
  accepted: number;
  rejected: number;
  errors: number;
  currentRps: number;
  progressPercent: number;
  currentHighestBid?: number;
}): void {
  if (!io) return;
  io.to('admin').emit('simulation:progress', payload);
}
