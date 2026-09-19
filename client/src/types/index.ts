export type UserRole = 'buyer' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface Auction {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  startingPrice: number;
  currentHighestBid: number;
  minimumIncrement: number;
  minNextBid: number;
  status: 'pending' | 'active' | 'paused' | 'ended' | 'cancelled';
  startTime: string;
  endTime: string;
  version: number;
  createdBy?: string;
  creatorName?: string;
  winnerId?: string | null;
  winnerName?: string | null;
  winningBid?: number | null;
  bidCount: number;
  highestBidInfo?: {
    id: string;
    amount: number;
    bidderName: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  auctionTitle?: string;
  auctionStatus?: string;
  auctionImageUrl?: string;
  auctionEndTime?: string;
  currentHighestBid?: number;
  bidderId: string;
  bidderName?: string;
  amount: number;
  status: 'accepted' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
}

export interface SystemMetrics {
  totalAuctions: number;
  activeAuctions: number;
  endedAuctions: number;
  totalBids: number;
  acceptedBids: number;
  rejectedBids: number;
  acceptanceRate: number;
  totalUsers: number;
  throughputRps: number;
  averageResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  databaseErrors: number;
  databaseConflicts: number;
  activeWebSocketConnections: number;
  timestamp: string;
}

export interface InvariantCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  details?: string;
  violationCount: number;
  violations: any[];
}

export interface VerificationReport {
  testRunId: string;
  auctionId: string;
  passed: boolean;
  verifiedAt: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  scope: {
    requestedRequests: number;
    concurrency: number;
    strategy: string;
    acceptedBidsCount: number;
    rejectedBidsCount: number;
    finalHighestBid: number;
  };
  checks: InvariantCheck[];
}

export interface TestRun {
  id: string;
  auction_id: string;
  auction_title?: string;
  requested_requests: number;
  concurrency: number;
  strategy: string;
  accepted_count: number;
  rejected_count: number;
  error_count: number;
  duration_ms: number;
  status: string;
  stats: {
    minLatencyMs: number;
    maxLatencyMs: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    uniqueAcceptedKeys: number;
  };
  created_at: string;
}
