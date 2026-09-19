import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { placeBid, BidResult } from './bidService.js';
import { broadcastSimulationProgress } from '../sockets/socketServer.js';
import { verifyAuctionCorrectness } from './verificationService.js';

export interface TestRunConfig {
  auctionId: string;
  totalRequests: number;
  concurrency: number;
  strategy: 'same_amount' | 'incremental' | 'random_concurrent';
  numClients?: number;
  resetAuctionBeforeRun?: boolean;
}

export interface TestRunSummary {
  testRunId: string;
  auctionId: string;
  requestedRequests: number;
  concurrency: number;
  strategy: string;
  acceptedCount: number;
  rejectedCount: number;
  errorCount: number;
  durationMs: number;
  requestsPerSecond: number;
  finalHighestBid: number;
  stats: {
    minLatencyMs: number;
    maxLatencyMs: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    uniqueAcceptedKeys: number;
  };
  verification?: any;
}

export async function runLoadSimulation(config: TestRunConfig): Promise<TestRunSummary> {
  const {
    auctionId,
    totalRequests,
    concurrency,
    strategy,
    numClients = Math.min(concurrency, 20),
    resetAuctionBeforeRun = false,
  } = config;

  const testRunId = uuidv4();

  // Reset or prepare test auction if requested
  if (resetAuctionBeforeRun) {
    await resetTestAuction(auctionId);
  }

  // Fetch current auction state
  const auctionRes = await query(
    `SELECT id, starting_price, current_highest_bid, minimum_increment FROM auctions WHERE id = $1`,
    [auctionId]
  );
  if (auctionRes.rows.length === 0) {
    throw new Error(`Auction ${auctionId} not found`);
  }

  const auction = auctionRes.rows[0];
  const startingPrice = parseFloat(auction.starting_price);
  const currentHighestBid = auction.current_highest_bid ? parseFloat(auction.current_highest_bid) : startingPrice;
  const minimumIncrement = parseFloat(auction.minimum_increment);

  // Fetch or create simulated bidders
  const bidderIds = await getOrCreateSimulatedBidders(numClients);

  // Build the list of requests according to strategy
  const requests: Array<{
    amount: number;
    bidderId: string;
    bidderName: string;
    idempotencyKey: string;
    requestId: string;
  }> = [];

  for (let i = 0; i < totalRequests; i++) {
    const clientIdx = i % bidderIds.length;
    const bidderId = bidderIds[clientIdx];
    const bidderName = `SimClient #${clientIdx + 1}`;
    const requestId = `req-${testRunId.slice(0, 8)}-${i}`;
    let amount = 0;
    let idempotencyKey = `idemp-${testRunId.slice(0, 8)}-${i}`;

    if (strategy === 'same_amount') {
      // All requests race for the exact same amount
      // Exactly 1 must win, all others rejected!
      amount = parseFloat((currentHighestBid + minimumIncrement).toFixed(2));
    } else if (strategy === 'incremental') {
      // Each request submits an incremental bid
      amount = parseFloat((currentHighestBid + (i + 1) * minimumIncrement).toFixed(2));
    } else {
      // Random concurrent bids: mix of valid, outdated, duplicate, and high bids
      const rand = Math.random();
      if (rand < 0.2) {
        // Under-bid (below increment) -> guaranteed rejection
        amount = parseFloat((currentHighestBid - 10).toFixed(2));
      } else if (rand < 0.4) {
        // Exact same amount as current highest -> guaranteed rejection
        amount = currentHighestBid;
      } else if (rand < 0.5 && i > 0) {
        // Intentional duplicate idempotency key -> test idempotency handling
        idempotencyKey = requests[Math.floor(Math.random() * i)].idempotencyKey;
        amount = parseFloat((currentHighestBid + minimumIncrement).toFixed(2));
      } else {
        // Valid bid
        amount = parseFloat((currentHighestBid + (Math.floor(rand * 5) + 1) * minimumIncrement).toFixed(2));
      }
    }

    requests.push({
      amount: Math.max(1, amount),
      bidderId,
      bidderName,
      idempotencyKey,
      requestId,
    });
  }

  // Record initial test run in DB
  await query(
    `INSERT INTO auction_test_runs (
      id, auction_id, requested_requests, concurrency, strategy,
      accepted_count, rejected_count, error_count, duration_ms, status, stats, created_at
    ) VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 'running', '{}'::jsonb, $6)`,
    [testRunId, auctionId, totalRequests, concurrency, strategy, new Date().toISOString()]
  );

  // Execute concurrent requests with worker throttling
  let acceptedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];
  const acceptedKeys = new Set<string>();

  const testStartTime = Date.now();
  let completedCount = 0;
  let lastBroadcastTime = 0;

  // Worker queue processor
  let queueIndex = 0;

  async function worker() {
    while (queueIndex < requests.length) {
      const idx = queueIndex++;
      const req = requests[idx];
      const reqStart = Date.now();

      try {
        // Execute through real placeBid transactional service
        const res: BidResult = await placeBid({
          auctionId,
          bidderId: req.bidderId,
          bidderName: req.bidderName,
          amount: req.amount,
          idempotencyKey: req.idempotencyKey,
          requestId: req.requestId,
        });

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);

        if (res.status === 'accepted') {
          acceptedCount++;
          acceptedKeys.add(req.idempotencyKey);
        } else {
          rejectedCount++;
        }
      } catch (err) {
        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);
        errorCount++;
      } finally {
        completedCount++;

        // Broadcast progress at most every 200ms
        const now = Date.now();
        if (now - lastBroadcastTime > 200 || completedCount === totalRequests) {
          lastBroadcastTime = now;
          const elapsedSec = Math.max(0.1, (now - testStartTime) / 1000);
          const currentRps = parseFloat((completedCount / elapsedSec).toFixed(1));
          const progressPercent = Math.round((completedCount / totalRequests) * 100);

          broadcastSimulationProgress({
            testRunId,
            sent: completedCount,
            accepted: acceptedCount,
            rejected: rejectedCount,
            errors: errorCount,
            currentRps,
            progressPercent,
          });
        }
      }
    }
  }

  // Launch parallel workers up to concurrency level
  const workerPool = [];
  const effectiveConcurrency = Math.min(concurrency, requests.length);
  for (let i = 0; i < effectiveConcurrency; i++) {
    workerPool.push(worker());
  }

  await Promise.all(workerPool);

  const totalDurationMs = Date.now() - testStartTime;
  const rps = parseFloat(((totalRequests / (totalDurationMs / 1000)) || 0).toFixed(1));

  // Compute latency percentiles
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const minLatencyMs = sortedLatencies[0] || 0;
  const maxLatencyMs = sortedLatencies[sortedLatencies.length - 1] || 0;
  const avgLatencyMs = latencies.length > 0 
    ? parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
    : 0;
  const p50LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
  const p95LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

  // Fetch final auction state
  const finalAuctionRes = await query(`SELECT current_highest_bid FROM auctions WHERE id = $1`, [auctionId]);
  const finalHighestBid = parseFloat(finalAuctionRes.rows[0]?.current_highest_bid || '0');

  const stats = {
    minLatencyMs,
    maxLatencyMs,
    avgLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    uniqueAcceptedKeys: acceptedKeys.size,
  };

  // Update test run in database
  await query(
    `UPDATE auction_test_runs
     SET accepted_count = $1, rejected_count = $2, error_count = $3,
         duration_ms = $4, status = 'completed', stats = $5
     WHERE id = $6`,
    [acceptedCount, rejectedCount, errorCount, totalDurationMs, JSON.stringify(stats), testRunId]
  );

  // Run automated correctness verification against database
  let verification = null;
  try {
    verification = await verifyAuctionCorrectness(testRunId);
  } catch (err: any) {
    console.error('[TEST_RUNNER] Verification error:', err.message);
  }

  return {
    testRunId,
    auctionId,
    requestedRequests: totalRequests,
    concurrency,
    strategy,
    acceptedCount,
    rejectedCount,
    errorCount,
    durationMs: totalDurationMs,
    requestsPerSecond: rps,
    finalHighestBid,
    stats,
    verification,
  };
}

export async function resetTestAuction(auctionId: string) {
  // Clear bids and events for this test auction
  await query(`DELETE FROM bids WHERE auction_id = $1`, [auctionId]);
  await query(`DELETE FROM auction_events WHERE auction_id = $1`, [auctionId]);

  // Reset auction starting bid and version
  await query(
    `UPDATE auctions 
     SET current_highest_bid = starting_price, 
         version = 0, 
         status = 'active',
         start_time = NOW() - INTERVAL '1 hour',
         end_time = NOW() + INTERVAL '24 hours',
         updated_at = NOW()
     WHERE id = $1`,
    [auctionId]
  );
}

async function getOrCreateSimulatedBidders(count: number): Promise<string[]> {
  const usersRes = await query(`SELECT id FROM users LIMIT $1`, [count]);
  const ids = usersRes.rows.map((r) => r.id);

  if (ids.length >= count) {
    return ids;
  }

  // Create additional test users if needed
  const needed = count - ids.length;
  for (let i = 0; i < needed; i++) {
    const id = uuidv4();
    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, 'dummy_hash', 'buyer')
       ON CONFLICT DO NOTHING`,
      [id, `Simulated Bidder ${i + 1}`, `sim-bidder-${id.slice(0, 8)}@bidstorm.dev`]
    );
    ids.push(id);
  }

  return ids;
}
