import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction, DbClient } from '../db/index.js';
import { broadcastAuctionClosed, broadcastAuctionUpdate } from '../sockets/socketServer.js';

export interface AuctionListParams {
  category?: string;
  status?: string;
  search?: string;
  sortBy?: 'created_at' | 'end_time' | 'current_highest_bid';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export async function getAuctions(params: AuctionListParams = {}) {
  const {
    category,
    status,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    limit = 20,
    offset = 0,
  } = params;

  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (category && category !== 'All') {
    queryParams.push(category);
    conditions.push(`a.category = $${queryParams.length}`);
  }

  if (status && status !== 'all') {
    queryParams.push(status);
    conditions.push(`a.status = $${queryParams.length}`);
  }

  if (search && search.trim()) {
    queryParams.push(`%${search.trim()}%`);
    conditions.push(`(a.title ILIKE $${queryParams.length} OR a.description ILIKE $${queryParams.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = `ORDER BY a.${sortBy === 'current_highest_bid' ? 'COALESCE(a.current_highest_bid, a.starting_price)' : sortBy} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;

  queryParams.push(limit);
  const limitParam = `$${queryParams.length}`;
  queryParams.push(offset);
  const offsetParam = `$${queryParams.length}`;

  const sql = `
    SELECT 
      a.id, a.title, a.description, a.category, a.image_url,
      a.starting_price, a.current_highest_bid, a.minimum_increment,
      a.status, a.start_time, a.end_time, a.version,
      a.created_by, a.winner_id, a.winning_bid, a.created_at, a.updated_at,
      u.name as creator_name,
      w.name as winner_name,
      (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id AND b.status = 'accepted') as bid_count
    FROM auctions a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN users w ON a.winner_id = w.id
    ${whereClause}
    ${orderClause}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*) as total
    FROM auctions a
    ${whereClause}
  `;

  const [itemsRes, countRes] = await Promise.all([
    query(sql, queryParams),
    query(countSql, queryParams.slice(0, queryParams.length - 2)),
  ]);

  const auctions = itemsRes.rows.map(formatAuctionRow);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  return { auctions, total, limit, offset };
}

export async function getAuctionById(id: string) {
  const sql = `
    SELECT 
      a.id, a.title, a.description, a.category, a.image_url,
      a.starting_price, a.current_highest_bid, a.minimum_increment,
      a.status, a.start_time, a.end_time, a.version,
      a.created_by, a.winner_id, a.winning_bid, a.created_at, a.updated_at,
      u.name as creator_name,
      w.name as winner_name,
      (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id AND b.status = 'accepted') as bid_count,
      (
        SELECT json_build_object('id', b.id, 'amount', b.amount, 'bidder_name', bu.name, 'created_at', b.created_at)
        FROM bids b
        JOIN users bu ON b.bidder_id = bu.id
        WHERE b.auction_id = a.id AND b.status = 'accepted'
        ORDER BY b.amount DESC, b.created_at ASC
        LIMIT 1
      ) as highest_bid_info
    FROM auctions a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN users w ON a.winner_id = w.id
    WHERE a.id = $1
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    return null;
  }

  return formatAuctionRow(res.rows[0]);
}

export async function createAuction(data: {
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  startingPrice: number;
  minimumIncrement: number;
  startTime: string;
  endTime: string;
  createdBy: string;
}) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO auctions (
      id, title, description, category, image_url,
      starting_price, current_highest_bid, minimum_increment,
      status, start_time, end_time, created_by, version, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, $13)`,
    [
      id,
      data.title,
      data.description,
      data.category,
      data.imageUrl || null,
      data.startingPrice,
      data.startingPrice, // initial highest bid baseline
      data.minimumIncrement,
      'active',
      data.startTime,
      data.endTime,
      data.createdBy,
      now,
    ]
  );

  return getAuctionById(id);
}

export async function updateAuction(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    imageUrl: string;
    minimumIncrement: number;
    status: string;
    startTime: string;
    endTime: string;
  }>
) {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) {
    values.push(data.title);
    fields.push(`title = $${values.length}`);
  }
  if (data.description !== undefined) {
    values.push(data.description);
    fields.push(`description = $${values.length}`);
  }
  if (data.category !== undefined) {
    values.push(data.category);
    fields.push(`category = $${values.length}`);
  }
  if (data.imageUrl !== undefined) {
    values.push(data.imageUrl);
    fields.push(`image_url = $${values.length}`);
  }
  if (data.minimumIncrement !== undefined) {
    values.push(data.minimumIncrement);
    fields.push(`minimum_increment = $${values.length}`);
  }
  if (data.status !== undefined) {
    values.push(data.status);
    fields.push(`status = $${values.length}`);
  }
  if (data.startTime !== undefined) {
    values.push(data.startTime);
    fields.push(`start_time = $${values.length}`);
  }
  if (data.endTime !== undefined) {
    values.push(data.endTime);
    fields.push(`end_time = $${values.length}`);
  }

  if (fields.length === 0) {
    return getAuctionById(id);
  }

  values.push(new Date().toISOString());
  fields.push(`updated_at = $${values.length}`);

  values.push(id);
  const idParam = `$${values.length}`;

  const sql = `UPDATE auctions SET ${fields.join(', ')} WHERE id = ${idParam}`;
  await query(sql, values);

  const updated = await getAuctionById(id);

  if (updated) {
    broadcastAuctionUpdate({
      auctionId: updated.id,
      currentHighestBid: updated.currentHighestBid,
      bidCount: updated.bidCount,
      latestBidderName: updated.highestBidInfo?.bidderName,
      timestamp: updated.updatedAt,
    });
  }

  return updated;
}

export async function closeAuction(auctionId: string) {
  return await withTransaction(async (client: DbClient) => {
    // Lock auction row
    const auctionRes = await client.query(
      `SELECT id, status, current_highest_bid FROM auctions WHERE id = $1 FOR UPDATE`,
      [auctionId]
    );

    if (auctionRes.rows.length === 0) {
      throw new Error(`AUCTION_NOT_FOUND: ${auctionId}`);
    }

    const auction = auctionRes.rows[0];
    if (auction.status === 'ended') {
      return getAuctionById(auctionId);
    }

    // Find highest accepted bid
    const highestBidRes = await client.query(
      `SELECT b.id, b.bidder_id, b.amount, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1 AND b.status = 'accepted'
       ORDER BY b.amount DESC, b.created_at ASC
       LIMIT 1`,
      [auctionId]
    );

    let winnerId = null;
    let winningBid = null;
    let winnerName = null;

    if (highestBidRes.rows.length > 0) {
      winnerId = highestBidRes.rows[0].bidder_id;
      winningBid = parseFloat(highestBidRes.rows[0].amount);
      winnerName = highestBidRes.rows[0].bidder_name;
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE auctions
       SET status = 'ended', winner_id = $1, winning_bid = $2, updated_at = $3
       WHERE id = $4`,
      [winnerId, winningBid, now, auctionId]
    );

    await client.query(
      `INSERT INTO auction_events (id, auction_id, event_type, payload, created_at)
       VALUES ($1, $2, 'AUCTION_CLOSED', $3, $4)`,
      [uuidv4(), auctionId, JSON.stringify({ winnerId, winningBid, winnerName }), now]
    );

    broadcastAuctionClosed({
      auctionId,
      winnerId,
      winnerName,
      winningBid,
      timestamp: now,
    });

    return {
      auctionId,
      status: 'ended',
      winnerId,
      winnerName,
      winningBid,
      closedAt: now,
    };
  });
}

function formatAuctionRow(row: any) {
  const startingPrice = parseFloat(row.starting_price);
  const currentHighestBid = row.current_highest_bid ? parseFloat(row.current_highest_bid) : startingPrice;
  const minimumIncrement = parseFloat(row.minimum_increment);
  const minNextBid = parseFloat((currentHighestBid + minimumIncrement).toFixed(2));

  let highestBidInfo = null;
  if (row.highest_bid_info) {
    const info = typeof row.highest_bid_info === 'string' ? JSON.parse(row.highest_bid_info) : row.highest_bid_info;
    highestBidInfo = {
      id: info.id,
      amount: parseFloat(info.amount),
      bidderName: info.bidder_name,
      createdAt: info.created_at,
    };
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    startingPrice,
    currentHighestBid,
    minimumIncrement,
    minNextBid,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    version: row.version,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    winningBid: row.winning_bid ? parseFloat(row.winning_bid) : null,
    bidCount: parseInt(row.bid_count || '0', 10),
    highestBidInfo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
