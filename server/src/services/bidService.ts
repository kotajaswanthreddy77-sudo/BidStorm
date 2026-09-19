import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction, DbClient } from '../db/index.js';
import {
  broadcastAuctionUpdate,
  broadcastBidAccepted,
} from '../sockets/socketServer.js';
import { metricsService } from './metricsService.js';

export interface PlaceBidInput {
  auctionId: string;
  bidderId: string;
  bidderName?: string;
  amount: number;
  idempotencyKey: string;
  requestId?: string;
}

export interface BidResult {
  success: boolean;
  bidId?: string;
  auctionId: string;
  amount: number;
  currentHighestBid: number;
  bidCount: number;
  status: 'accepted' | 'rejected';
  rejectionReason?: string;
  idempotentReplay?: boolean;
  version?: number;
  timestamp: string;
}

export async function placeBid(input: PlaceBidInput): Promise<BidResult> {
  const startTime = Date.now();
  const { auctionId, bidderId, bidderName, amount, idempotencyKey, requestId } = input;

  // 1. Idempotency Check: Check if this idempotency key was already submitted for this auction
  const existingBidRes = await query(
    `SELECT b.id, b.auction_id, b.bidder_id, b.amount, b.status, b.rejection_reason, b.created_at,
            a.current_highest_bid, a.version,
            (SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status = 'accepted') as bid_count
     FROM bids b
     JOIN auctions a ON b.auction_id = a.id
     WHERE b.auction_id = $1 AND b.idempotency_key = $2
     LIMIT 1`,
    [auctionId, idempotencyKey]
  );

  if (existingBidRes.rows.length > 0) {
    const existing = existingBidRes.rows[0];
    const duration = Date.now() - startTime;
    metricsService.recordLatency(duration);

    return {
      success: existing.status === 'accepted',
      bidId: existing.id,
      auctionId,
      amount: parseFloat(existing.amount),
      currentHighestBid: parseFloat(existing.current_highest_bid || '0'),
      bidCount: parseInt(existing.bid_count || '0', 10),
      status: existing.status,
      rejectionReason: existing.rejection_reason || undefined,
      idempotentReplay: true,
      version: existing.version,
      timestamp: existing.created_at,
    };
  }

  // 2. Execute Transaction with Row-Level Lock (SELECT ... FOR UPDATE)
  let result: BidResult;
  let commitSucceeded = false;
  let eventPayloadToBroadcast: any = null;

  try {
    result = await withTransaction(async (client: DbClient) => {
      // Lock the specific auction row
      const auctionRes = await client.query(
        `SELECT id, title, starting_price, current_highest_bid, minimum_increment,
                status, start_time, end_time, version
         FROM auctions
         WHERE id = $1
         FOR UPDATE`,
        [auctionId]
      );

      if (auctionRes.rows.length === 0) {
        throw new Error(`AUCTION_NOT_FOUND: Auction ${auctionId} does not exist`);
      }

      const auction = auctionRes.rows[0];
      const startingPrice = parseFloat(auction.starting_price);
      const currentHighestBid = auction.current_highest_bid ? parseFloat(auction.current_highest_bid) : null;
      const minimumIncrement = parseFloat(auction.minimum_increment);
      const now = new Date();
      const startTimeDate = new Date(auction.start_time);
      const endTimeDate = new Date(auction.end_time);

      // Validate auction state
      let rejectionReason: string | null = null;

      if (auction.status !== 'active') {
        rejectionReason = `Auction is not active. Current status: ${auction.status}`;
      } else if (now < startTimeDate) {
        rejectionReason = `Auction has not started yet. Starts at ${startTimeDate.toISOString()}`;
      } else if (now > endTimeDate) {
        rejectionReason = `Auction has ended at ${endTimeDate.toISOString()}`;
      } else {
        // Compute minimum required bid
        const minRequired = currentHighestBid === null 
          ? startingPrice 
          : parseFloat((currentHighestBid + minimumIncrement).toFixed(2));

        if (amount < minRequired) {
          rejectionReason = currentHighestBid === null
            ? `Bid amount $${amount.toFixed(2)} is less than the starting price $${minRequired.toFixed(2)}`
            : `Bid amount $${amount.toFixed(2)} is lower than the minimum required bid of $${minRequired.toFixed(2)} (Current highest: $${currentHighestBid.toFixed(2)} + Increment: $${minimumIncrement.toFixed(2)})`;
        }
      }

      const bidId = uuidv4();
      const bidCreatedAt = new Date().toISOString();

      if (rejectionReason) {
        // Record rejected bid in audit log
        await client.query(
          `INSERT INTO bids (id, auction_id, bidder_id, amount, status, idempotency_key, request_id, rejection_reason, created_at)
           VALUES ($1, $2, $3, $4, 'rejected', $5, $6, $7, $8)
           ON CONFLICT (auction_id, idempotency_key) DO NOTHING`,
          [bidId, auctionId, bidderId, amount, idempotencyKey, requestId || null, rejectionReason, bidCreatedAt]
        );

        // Fetch current bid count
        const countRes = await client.query(
          `SELECT COUNT(*) as count FROM bids WHERE auction_id = $1 AND status = 'accepted'`,
          [auctionId]
        );

        metricsService.recordConflict();

        return {
          success: false,
          bidId,
          auctionId,
          amount,
          currentHighestBid: currentHighestBid ?? startingPrice,
          bidCount: parseInt(countRes.rows[0]?.count || '0', 10),
          status: 'rejected' as const,
          rejectionReason,
          idempotentReplay: false,
          version: auction.version,
          timestamp: bidCreatedAt,
        };
      }

      // Valid Bid Flow:
      // 1. Insert accepted bid
      await client.query(
        `INSERT INTO bids (id, auction_id, bidder_id, amount, status, idempotency_key, request_id, rejection_reason, created_at)
         VALUES ($1, $2, $3, $4, 'accepted', $5, $6, NULL, $7)`,
        [bidId, auctionId, bidderId, amount, idempotencyKey, requestId || null, bidCreatedAt]
      );

      // 2. Update auction record
      const newVersion = (auction.version || 0) + 1;
      await client.query(
        `UPDATE auctions
         SET current_highest_bid = $1, version = $2, updated_at = $3
         WHERE id = $4`,
        [amount, newVersion, bidCreatedAt, auctionId]
      );

      // 3. Record auction audit event
      const eventPayload = {
        amount,
        bidderId,
        bidderName: bidderName || 'Anonymous Bidder',
        previousHighestBid: currentHighestBid,
        newHighestBid: amount,
        version: newVersion,
        timestamp: bidCreatedAt,
      };

      await client.query(
        `INSERT INTO auction_events (id, auction_id, event_type, bid_id, payload, created_at)
         VALUES ($1, $2, 'BID_ACCEPTED', $3, $4, $5)`,
        [uuidv4(), auctionId, bidId, JSON.stringify(eventPayload), bidCreatedAt]
      );

      // 4. Query total accepted bids count
      const countRes = await client.query(
        `SELECT COUNT(*) as count FROM bids WHERE auction_id = $1 AND status = 'accepted'`,
        [auctionId]
      );
      const bidCount = parseInt(countRes.rows[0]?.count || '0', 10);

      eventPayloadToBroadcast = {
        auctionId,
        bidId,
        amount,
        currentHighestBid: amount,
        bidCount,
        bidderId,
        bidderName: bidderName || 'Anonymous Bidder',
        timestamp: bidCreatedAt,
      };

      return {
        success: true,
        bidId,
        auctionId,
        amount,
        currentHighestBid: amount,
        bidCount,
        status: 'accepted' as const,
        idempotentReplay: false,
        version: newVersion,
        timestamp: bidCreatedAt,
      };
    });

    commitSucceeded = true;
  } catch (err: any) {
    metricsService.recordDbError();

    // Check if error was due to concurrent idempotency collision
    if (err.code === '23505' || err.message?.includes('uq_auction_idempotency')) {
      const retryRes = await query(
        `SELECT b.id, b.auction_id, b.bidder_id, b.amount, b.status, b.rejection_reason, b.created_at,
                a.current_highest_bid, a.version,
                (SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status = 'accepted') as bid_count
         FROM bids b
         JOIN auctions a ON b.auction_id = a.id
         WHERE b.auction_id = $1 AND b.idempotency_key = $2
         LIMIT 1`,
        [auctionId, idempotencyKey]
      );
      if (retryRes.rows.length > 0) {
        const existing = retryRes.rows[0];
        return {
          success: existing.status === 'accepted',
          bidId: existing.id,
          auctionId,
          amount: parseFloat(existing.amount),
          currentHighestBid: parseFloat(existing.current_highest_bid || '0'),
          bidCount: parseInt(existing.bid_count || '0', 10),
          status: existing.status,
          rejectionReason: existing.rejection_reason || undefined,
          idempotentReplay: true,
          version: existing.version,
          timestamp: existing.created_at,
        };
      }
    }

    throw err;
  } finally {
    const duration = Date.now() - startTime;
    metricsService.recordLatency(duration);
  }

  // 12. Only after a successful commit, publish the accepted-bid event to connected clients
  if (commitSucceeded && result.success && eventPayloadToBroadcast) {
    broadcastAuctionUpdate({
      auctionId: eventPayloadToBroadcast.auctionId,
      currentHighestBid: eventPayloadToBroadcast.currentHighestBid,
      bidCount: eventPayloadToBroadcast.bidCount,
      latestBidderName: eventPayloadToBroadcast.bidderName,
      timestamp: eventPayloadToBroadcast.timestamp,
    });

    broadcastBidAccepted({
      auctionId: eventPayloadToBroadcast.auctionId,
      bidId: eventPayloadToBroadcast.bidId,
      amount: eventPayloadToBroadcast.amount,
      bidderName: eventPayloadToBroadcast.bidderName,
      bidderId: eventPayloadToBroadcast.bidderId,
      timestamp: eventPayloadToBroadcast.timestamp,
    });
  }

  return result;
}

export async function getAuctionBids(auctionId: string, limit = 50) {
  const res = await query(
    `SELECT b.id, b.auction_id, b.bidder_id, b.amount, b.status, b.rejection_reason, b.created_at,
            u.name as bidder_name, u.email as bidder_email
     FROM bids b
     LEFT JOIN users u ON b.bidder_id = u.id
     WHERE b.auction_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [auctionId, limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    auctionId: row.auction_id,
    bidderId: row.bidder_id,
    bidderName: row.bidder_name || 'Anonymous Bidder',
    amount: parseFloat(row.amount),
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }));
}

export async function getUserBids(userId: string, limit = 50) {
  const res = await query(
    `SELECT b.id, b.auction_id, b.bidder_id, b.amount, b.status, b.rejection_reason, b.created_at,
            a.title as auction_title, a.status as auction_status, a.current_highest_bid,
            a.image_url, a.end_time
     FROM bids b
     JOIN auctions a ON b.auction_id = a.id
     WHERE b.bidder_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return res.rows.map((row) => ({
    id: row.id,
    auctionId: row.auction_id,
    auctionTitle: row.auction_title,
    auctionStatus: row.auction_status,
    auctionImageUrl: row.image_url,
    auctionEndTime: row.end_time,
    currentHighestBid: parseFloat(row.current_highest_bid || '0'),
    amount: parseFloat(row.amount),
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }));
}
