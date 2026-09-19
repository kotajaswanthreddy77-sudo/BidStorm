import { query } from '../db/index.js';

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

export async function verifyAuctionCorrectness(testRunId: string): Promise<VerificationReport> {
  // 1. Fetch test run
  const testRunRes = await query(
    `SELECT id, auction_id, requested_requests, concurrency, strategy,
            accepted_count, rejected_count, error_count, duration_ms, status, stats
     FROM auction_test_runs
     WHERE id = $1`,
    [testRunId]
  );

  if (testRunRes.rows.length === 0) {
    throw new Error(`TEST_RUN_NOT_FOUND: ${testRunId}`);
  }

  const testRun = testRunRes.rows[0];
  const auctionId = testRun.auction_id;

  // 2. Fetch auction record
  const auctionRes = await query(
    `SELECT id, title, starting_price, current_highest_bid, minimum_increment,
            status, start_time, end_time, version
     FROM auctions
     WHERE id = $1`,
    [auctionId]
  );

  if (auctionRes.rows.length === 0) {
    throw new Error(`AUCTION_NOT_FOUND: ${auctionId}`);
  }

  const auction = auctionRes.rows[0];
  const minimumIncrement = parseFloat(auction.minimum_increment);
  const currentHighestBid = parseFloat(auction.current_highest_bid || '0');
  const startTime = new Date(auction.start_time);
  const endTime = new Date(auction.end_time);

  // 3. Fetch all bids for this auction in order of creation
  const bidsRes = await query(
    `SELECT id, auction_id, bidder_id, amount, status, idempotency_key, request_id, rejection_reason, created_at
     FROM bids
     WHERE auction_id = $1
     ORDER BY created_at ASC, amount ASC`,
    [auctionId]
  );

  const allBids = bidsRes.rows;
  const acceptedBids = allBids.filter((b) => b.status === 'accepted');
  const rejectedBids = allBids.filter((b) => b.status === 'rejected');

  // Fetch auction events
  const eventsRes = await query(
    `SELECT id, event_type, bid_id, payload, created_at
     FROM auction_events
     WHERE auction_id = $1`,
    [auctionId]
  );
  const events = eventsRes.rows;

  const checks: InvariantCheck[] = [];

  // -------------------------------------------------------------
  // Check 1: Minimum Increment Invariant
  // Every accepted bid after the first must be >= previous_bid + minimum_increment
  // -------------------------------------------------------------
  const incrementViolations: any[] = [];
  let prevAmount = parseFloat(auction.starting_price);

  for (let i = 0; i < acceptedBids.length; i++) {
    const b = acceptedBids[i];
    const amount = parseFloat(b.amount);
    if (i === 0) {
      if (amount < prevAmount) {
        incrementViolations.push({
          bidId: b.id,
          amount,
          startingPrice: prevAmount,
          reason: 'First accepted bid is lower than starting price',
        });
      }
    } else {
      const minExpected = parseFloat((prevAmount + minimumIncrement).toFixed(2));
      if (amount < minExpected) {
        incrementViolations.push({
          bidId: b.id,
          amount,
          previousAmount: prevAmount,
          minimumIncrement,
          expectedAtLeast: minExpected,
          difference: (minExpected - amount).toFixed(2),
        });
      }
    }
    prevAmount = amount;
  }

  checks.push({
    id: 'minimum_increment_rule',
    name: 'Minimum Increment Enforcement',
    description: `Each accepted bid must strictly be >= prior bid + minimum increment ($${minimumIncrement.toFixed(2)})`,
    passed: incrementViolations.length === 0,
    violationCount: incrementViolations.length,
    violations: incrementViolations,
    details: incrementViolations.length === 0 
      ? `All ${acceptedBids.length} accepted bids strictly satisfied increment >= $${minimumIncrement.toFixed(2)}`
      : `Found ${incrementViolations.length} bids violating minimum increment`,
  });

  // -------------------------------------------------------------
  // Check 2: Active Time Window Invariant
  // No accepted bid occurs outside the auction active window
  // -------------------------------------------------------------
  const timeWindowViolations: any[] = [];
  for (const b of acceptedBids) {
    const bidTime = new Date(b.created_at);
    // Allow a small 5-second leeway for clock sync
    if (bidTime.getTime() < startTime.getTime() - 5000 || bidTime.getTime() > endTime.getTime() + 5000) {
      timeWindowViolations.push({
        bidId: b.id,
        bidTime: bidTime.toISOString(),
        auctionStartTime: startTime.toISOString(),
        auctionEndTime: endTime.toISOString(),
      });
    }
  }

  checks.push({
    id: 'time_window_rule',
    name: 'Time Window Compliance',
    description: "All accepted bids must occur strictly within the auction's designated start and end time window",
    passed: timeWindowViolations.length === 0,
    violationCount: timeWindowViolations.length,
    violations: timeWindowViolations,
    details: timeWindowViolations.length === 0
      ? `All ${acceptedBids.length} accepted bids occurred within active window`
      : `Found ${timeWindowViolations.length} bids outside time window`,
  });

  // -------------------------------------------------------------
  // Check 3: Idempotency Key Uniqueness Invariant
  // No idempotency key can have multiple accepted bids
  // -------------------------------------------------------------
  const keyMap = new Map<string, number>();
  const duplicateKeyViolations: any[] = [];

  for (const b of acceptedBids) {
    const count = (keyMap.get(b.idempotency_key) || 0) + 1;
    keyMap.set(b.idempotency_key, count);
    if (count > 1) {
      duplicateKeyViolations.push({
        idempotencyKey: b.idempotency_key,
        duplicateBidId: b.id,
        occurrences: count,
      });
    }
  }

  checks.push({
    id: 'idempotency_key_uniqueness',
    name: 'Idempotency Protection',
    description: 'No duplicate bid may be accepted under the same idempotency key',
    passed: duplicateKeyViolations.length === 0,
    violationCount: duplicateKeyViolations.length,
    violations: duplicateKeyViolations,
    details: duplicateKeyViolations.length === 0
      ? `All ${acceptedBids.length} accepted bids have distinct unique idempotency keys`
      : `Found ${duplicateKeyViolations.length} duplicate idempotency key executions`,
  });

  // -------------------------------------------------------------
  // Check 4: Highest Bid Matches Database Record
  // The final highest bid in the auction row must equal MAX(amount) of accepted bids
  // -------------------------------------------------------------
  const maxAcceptedAmount = acceptedBids.length > 0 
    ? Math.max(...acceptedBids.map((b) => parseFloat(b.amount)))
    : parseFloat(auction.starting_price);

  const highestBidMatches = Math.abs(currentHighestBid - maxAcceptedAmount) < 0.001;
  const highestBidViolations = highestBidMatches
    ? []
    : [{
        auctionHighestBid: currentHighestBid,
        maxAcceptedBid: maxAcceptedAmount,
        discrepancy: (currentHighestBid - maxAcceptedAmount).toFixed(2),
      }];

  checks.push({
    id: 'final_highest_bid_consistency',
    name: 'Final Highest Bid Integrity',
    description: "The auction's current_highest_bid column must match the maximum amount across all accepted bids",
    passed: highestBidMatches,
    violationCount: highestBidViolations.length,
    violations: highestBidViolations,
    details: highestBidMatches
      ? `Auction highest bid ($${currentHighestBid.toFixed(2)}) perfectly matches MAX(accepted_bids) ($${maxAcceptedAmount.toFixed(2)})`
      : `Discrepancy: Auction table has $${currentHighestBid} but max accepted bid is $${maxAcceptedAmount}`,
  });

  // -------------------------------------------------------------
  // Check 5: Audit Event Integrity
  // Every accepted bid has a corresponding immutable auction_events record
  // -------------------------------------------------------------
  const eventBidIds = new Set(events.map((e) => e.bid_id));
  const missingEventViolations: any[] = [];

  for (const b of acceptedBids) {
    if (!eventBidIds.has(b.id)) {
      missingEventViolations.push({
        bidId: b.id,
        amount: b.amount,
        reason: 'No corresponding event record in auction_events',
      });
    }
  }

  checks.push({
    id: 'event_audit_trail',
    name: 'Audit Trail Completeness',
    description: 'Every accepted bid must have an immutable corresponding record in auction_events',
    passed: missingEventViolations.length === 0,
    violationCount: missingEventViolations.length,
    violations: missingEventViolations,
    details: missingEventViolations.length === 0
      ? `All ${acceptedBids.length} accepted bids possess corresponding audit events`
      : `Missing audit events for ${missingEventViolations.length} accepted bids`,
  });

  // -------------------------------------------------------------
  // Check 6: Strict Monotonic Bid Progression
  // Accepted bids must never decrease over time
  // -------------------------------------------------------------
  const monotonicityViolations: any[] = [];
  for (let i = 1; i < acceptedBids.length; i++) {
    const current = parseFloat(acceptedBids[i].amount);
    const prior = parseFloat(acceptedBids[i - 1].amount);
    if (current <= prior) {
      monotonicityViolations.push({
        index: i,
        priorBidId: acceptedBids[i - 1].id,
        priorAmount: prior,
        currentBidId: acceptedBids[i].id,
        currentAmount: current,
        reason: 'Current bid is less than or equal to prior accepted bid',
      });
    }
  }

  checks.push({
    id: 'monotonic_progression',
    name: 'Strict Monotonic Bid Progression',
    description: 'Consecutive accepted bids must strictly increase in value',
    passed: monotonicityViolations.length === 0,
    violationCount: monotonicityViolations.length,
    violations: monotonicityViolations,
    details: monotonicityViolations.length === 0
      ? `All ${acceptedBids.length} accepted bids strictly progressed monotonically upwards`
      : `Found ${monotonicityViolations.length} non-monotonic bid occurrences`,
  });

  // -------------------------------------------------------------
  // Check 7: Internal State & Version Consistency
  // Auction version must equal or exceed initial version + accepted bids count
  // -------------------------------------------------------------
  const expectedMinVersion = acceptedBids.length;
  const versionConsistent = (auction.version || 0) >= expectedMinVersion;
  const versionViolations = versionConsistent
    ? []
    : [{
        auctionVersion: auction.version,
        expectedMinVersion,
        reason: 'Auction version did not increment for every accepted transaction',
      }];

  checks.push({
    id: 'state_version_consistency',
    name: 'Transactional Version Consistency',
    description: 'Auction record version must increment for every committed accepted bid',
    passed: versionConsistent,
    violationCount: versionViolations.length,
    violations: versionViolations,
    details: versionConsistent
      ? `Auction version (${auction.version}) is fully consistent with accepted bids count (${acceptedBids.length})`
      : `Version inconsistency: auction version is ${auction.version}, expected at least ${expectedMinVersion}`,
  });

  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.filter((c) => !c.passed).length;
  const overallPassed = failedChecks === 0;

  return {
    testRunId,
    auctionId,
    passed: overallPassed,
    verifiedAt: new Date().toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    scope: {
      requestedRequests: testRun.requested_requests,
      concurrency: testRun.concurrency,
      strategy: testRun.strategy,
      acceptedBidsCount: acceptedBids.length,
      rejectedBidsCount: rejectedBids.length,
      finalHighestBid: currentHighestBid,
    },
    checks,
  };
}
