import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../server.js';
import { initDb, query, closeDb } from '../db/index.js';
import { placeBid } from '../services/bidService.js';
import { generateToken } from '../middleware/auth.js';

describe('BidStorm Core Transactional Bidding & Concurrency Suite', () => {
  let buyerToken: string;
  let managerToken: string;
  let testAuctionId: string;
  let closedAuctionId: string;

  const testBuyer = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Alice Buyer',
    email: 'buyer@bidstorm.dev',
    role: 'buyer' as const,
  };

  const testManager = {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Marcus Manager',
    email: 'manager@bidstorm.dev',
    role: 'manager' as const,
  };

  beforeAll(async () => {
    await initDb();
    buyerToken = generateToken(testBuyer);
    managerToken = generateToken(testManager);

    // Create fresh test auctions for the test suite
    testAuctionId = uuidv4();
    closedAuctionId = uuidv4();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const tomorrow = new Date(now.getTime() + 86400000).toISOString();
    const thirtyMinsAgo = new Date(now.getTime() - 1800000).toISOString();

    // Active test auction: starting $100, increment $10
    await query(
      `INSERT INTO auctions (id, title, description, category, starting_price, current_highest_bid, minimum_increment, status, start_time, end_time, created_by, version)
       VALUES ($1, 'Test Live Auction', 'Test auction for unit tests', 'Testing', 100.00, 100.00, 10.00, 'active', $2, $3, $4, 0)`,
      [testAuctionId, oneHourAgo, tomorrow, testManager.id]
    );

    // Closed auction
    await query(
      `INSERT INTO auctions (id, title, description, category, starting_price, current_highest_bid, minimum_increment, status, start_time, end_time, created_by, version)
       VALUES ($1, 'Test Closed Auction', 'Ended test auction', 'Testing', 50.00, 50.00, 5.00, 'ended', $2, $3, $4, 0)`,
      [closedAuctionId, oneHourAgo, thirtyMinsAgo, testManager.id]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await query(`DELETE FROM bids WHERE auction_id IN ($1, $2)`, [testAuctionId, closedAuctionId]);
    await query(`DELETE FROM auction_events WHERE auction_id IN ($1, $2)`, [testAuctionId, closedAuctionId]);
    await query(`DELETE FROM auctions WHERE id IN ($1, $2)`, [testAuctionId, closedAuctionId]);
    await closeDb();
  });

  // Test 1: Successful bid placement
  it('1. should accept a valid bid that exceeds current highest bid by at least the minimum increment', async () => {
    const res = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 110.00,
        idempotencyKey: 'test-key-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.result.status).toBe('accepted');
    expect(res.body.result.amount).toBe(110.00);
    expect(res.body.result.currentHighestBid).toBe(110.00);

    // Check DB state
    const dbRes = await query(`SELECT current_highest_bid, version FROM auctions WHERE id = $1`, [testAuctionId]);
    expect(parseFloat(dbRes.rows[0].current_highest_bid)).toBe(110.00);
    expect(dbRes.rows[0].version).toBe(1);
  });

  // Test 2: Rejection of a bid below the minimum increment
  it('2. should reject a bid below the minimum increment (e.g. +$5 when increment is $10)', async () => {
    const res = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 115.00, // Current is 110, increment is 10 -> minimum valid is 120
        idempotencyKey: 'test-key-below-inc',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bid rejected');
    expect(res.body.result.status).toBe('rejected');
    expect(res.body.reason).toMatch(/lower than the minimum required bid/i);

    // Check that auction price was not mutated
    const dbRes = await query(`SELECT current_highest_bid FROM auctions WHERE id = $1`, [testAuctionId]);
    expect(parseFloat(dbRes.rows[0].current_highest_bid)).toBe(110.00);
  });

  // Test 3: Rejection of an equal or outdated bid
  it('3. should reject an equal or lower bid amount', async () => {
    const res = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 110.00, // Equal to current
        idempotencyKey: 'test-key-equal',
      });

    expect(res.status).toBe(400);
    expect(res.body.result.status).toBe('rejected');
  });

  // Test 4: Bidding on a closed auction
  it('4. should reject any bid on a closed or ended auction', async () => {
    const res = await request(app)
      .post(`/api/auctions/${closedAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 200.00,
        idempotencyKey: 'test-key-closed',
      });

    expect(res.status).toBe(400);
    expect(res.body.result.status).toBe('rejected');
    expect(res.body.reason).toMatch(/not active/i);
  });

  // Test 5: Duplicate idempotency-key handling
  it('5. should safely return previous accepted bid for duplicate idempotency key without double-bidding', async () => {
    const uniqueKey = `idemp-dup-${Date.now()}`;

    // First submission
    const res1 = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 130.00,
        idempotencyKey: uniqueKey,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.result.status).toBe('accepted');
    expect(res1.body.result.idempotentReplay).toBe(false);

    // Second submission with exact same key
    const res2 = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amount: 130.00,
        idempotencyKey: uniqueKey,
      });

    expect(res2.status).toBe(201);
    expect(res2.body.result.status).toBe('accepted');
    expect(res2.body.result.idempotentReplay).toBe(true);
    expect(res2.body.result.bidId).toBe(res1.body.result.bidId);

    // Ensure only 1 bid record exists in DB for this key
    const dbRes = await query(
      `SELECT COUNT(*) as cnt FROM bids WHERE auction_id = $1 AND idempotency_key = $2`,
      [testAuctionId, uniqueKey]
    );
    expect(parseInt(dbRes.rows[0].cnt, 10)).toBe(1);
  });

  // Test 6: Two concurrent bids on the same auction
  it('6. should serialize two concurrent identical bids: exactly one accepted, one rejected', async () => {
    // Current price is 130. Both attempt to bid 150 simultaneously
    const bidAmount = 150.00;

    const [resA, resB] = await Promise.all([
      placeBid({
        auctionId: testAuctionId,
        bidderId: testBuyer.id,
        amount: bidAmount,
        idempotencyKey: `concurrent-key-A-${Date.now()}`,
      }),
      placeBid({
        auctionId: testAuctionId,
        bidderId: testManager.id,
        amount: bidAmount,
        idempotencyKey: `concurrent-key-B-${Date.now()}`,
      }),
    ]);

    const statuses = [resA.status, resB.status];
    expect(statuses).toContain('accepted');
    expect(statuses).toContain('rejected');

    // Final highest bid in DB should be exactly 150.00
    const auctionRes = await query(`SELECT current_highest_bid FROM auctions WHERE id = $1`, [testAuctionId]);
    expect(parseFloat(auctionRes.rows[0].current_highest_bid)).toBe(150.00);
  });

  // Test 7: Multiple concurrent clients racing
  it('7. should process 10 concurrent requests without race conditions or invariant violations', async () => {
    // Submit 10 concurrent bids from different simulated bidders with varying amounts
    const currentRes = await query(`SELECT current_highest_bid FROM auctions WHERE id = $1`, [testAuctionId]);
    const base = parseFloat(currentRes.rows[0].current_highest_bid);

    // Launch 10 promises concurrently
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      promises.push(
        placeBid({
          auctionId: testAuctionId,
          bidderId: testBuyer.id,
          amount: parseFloat((base + i * 10).toFixed(2)),
          idempotencyKey: `load-test-key-${i}-${Date.now()}`,
        })
      );
    }

    const results = await Promise.all(promises);
    const accepted = results.filter((r) => r.status === 'accepted');

    expect(accepted.length).toBeGreaterThanOrEqual(1);

    // Verify that all accepted bids strictly obeyed the minimum increment
    const allAcceptedBidsRes = await query(
      `SELECT amount FROM bids WHERE auction_id = $1 AND status = 'accepted' ORDER BY amount ASC`,
      [testAuctionId]
    );
    const amounts = allAcceptedBidsRes.rows.map((r) => parseFloat(r.amount));

    for (let j = 1; j < amounts.length; j++) {
      expect(amounts[j]).toBeGreaterThanOrEqual(amounts[j - 1] + 10.00);
    }
  });

  // Test 8: Database rollback behavior on non-existent auction
  it('8. should roll back and handle transaction errors gracefully when auction does not exist', async () => {
    const nonExistentId = uuidv4();
    await expect(
      placeBid({
        auctionId: nonExistentId,
        bidderId: testBuyer.id,
        amount: 500,
        idempotencyKey: 'rollback-test-key',
      })
    ).rejects.toThrow(/AUCTION_NOT_FOUND/);

    // Ensure no orphaned bid was created
    const orphaned = await query(`SELECT * FROM bids WHERE auction_id = $1`, [nonExistentId]);
    expect(orphaned.rows.length).toBe(0);
  });

  // Test 9: Authentication & role-based authorization
  it('9. should reject unauthorized requests and enforce role-based access control', async () => {
    // Unauthenticated bid attempt
    const noAuthRes = await request(app)
      .post(`/api/auctions/${testAuctionId}/bids`)
      .send({ amount: 999 });
    expect(noAuthRes.status).toBe(401);

    // Buyer trying to access admin metrics -> 403 Forbidden
    const buyerAdminRes = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyerAdminRes.status).toBe(403);
  });

  // Test 10: Real-time event recording after successful commits
  it('10. should create an audit event in auction_events table after each accepted bid', async () => {
    const eventKey = `audit-test-key-${Date.now()}`;
    const latestRes = await query(`SELECT current_highest_bid FROM auctions WHERE id = $1`, [testAuctionId]);
    const nextValid = parseFloat(latestRes.rows[0].current_highest_bid) + 20.00;

    const bidRes = await placeBid({
      auctionId: testAuctionId,
      bidderId: testBuyer.id,
      amount: nextValid,
      idempotencyKey: eventKey,
    });

    expect(bidRes.status).toBe('accepted');

    const eventDbRes = await query(
      `SELECT * FROM auction_events WHERE bid_id = $1 AND event_type = 'BID_ACCEPTED'`,
      [bidRes.bidId]
    );

    expect(eventDbRes.rows.length).toBe(1);
    const event = eventDbRes.rows[0];
    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
    expect(payload.newHighestBid).toBe(nextValid);
  });
});
