import { query } from '../db/index.js';
import { getActiveSocketCount } from '../sockets/socketServer.js';

interface LatencyRecord {
  durationMs: number;
  timestamp: number;
}

class MetricsService {
  private latencies: LatencyRecord[] = [];
  private maxLatenciesToKeep = 5000;
  private dbErrorsCount = 0;
  private conflictCount = 0;

  public recordLatency(durationMs: number) {
    this.latencies.push({ durationMs, timestamp: Date.now() });
    if (this.latencies.length > this.maxLatenciesToKeep) {
      this.latencies.shift();
    }
  }

  public recordDbError() {
    this.dbErrorsCount++;
  }

  public recordConflict() {
    this.conflictCount++;
  }

  public getLatencyPercentiles(): { p50: number; p95: number; p99: number; avg: number; max: number } {
    if (this.latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, max: 0 };
    }

    const sorted = [...this.latencies.map((l) => l.durationMs)].sort((a, b) => a - b);
    const count = sorted.length;
    const p50 = sorted[Math.floor(count * 0.5)] || 0;
    const p95 = sorted[Math.floor(count * 0.95)] || 0;
    const p99 = sorted[Math.floor(count * 0.99)] || 0;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / count).toFixed(2));
    const max = sorted[count - 1] || 0;

    return { p50, p95, p99, avg, max };
  }

  public getThroughputRps(): number {
    const now = Date.now();
    const oneSecAgo = now - 1000;
    const recent = this.latencies.filter((l) => l.timestamp >= oneSecAgo);
    return recent.length;
  }

  public async getSystemMetrics() {
    // Read real numbers from database
    const auctionStatsRes = await query(`
      SELECT 
        COUNT(*) as total_auctions,
        COUNT(*) FILTER (WHERE status = 'active') as active_auctions,
        COUNT(*) FILTER (WHERE status = 'ended') as ended_auctions
      FROM auctions
    `);

    const bidStatsRes = await query(`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_bids,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_bids
      FROM bids
    `);

    const userCountRes = await query(`SELECT COUNT(*) as total_users FROM users`);

    const auctionStats = auctionStatsRes.rows[0] || {};
    const bidStats = bidStatsRes.rows[0] || {};
    const totalUsers = parseInt(userCountRes.rows[0]?.total_users || '0', 10);

    const totalBids = parseInt(bidStats.total_bids || '0', 10);
    const acceptedBids = parseInt(bidStats.accepted_bids || '0', 10);
    const rejectedBids = parseInt(bidStats.rejected_bids || '0', 10);

    const acceptanceRate = totalBids > 0 ? parseFloat(((acceptedBids / totalBids) * 100).toFixed(1)) : 100;
    const latencies = this.getLatencyPercentiles();
    const throughputRps = this.getThroughputRps();
    const activeSockets = getActiveSocketCount();

    return {
      totalAuctions: parseInt(auctionStats.total_auctions || '0', 10),
      activeAuctions: parseInt(auctionStats.active_auctions || '0', 10),
      endedAuctions: parseInt(auctionStats.ended_auctions || '0', 10),
      totalBids,
      acceptedBids,
      rejectedBids,
      acceptanceRate,
      totalUsers,
      throughputRps,
      averageResponseTimeMs: latencies.avg,
      p50ResponseTimeMs: latencies.p50,
      p95ResponseTimeMs: latencies.p95,
      p99ResponseTimeMs: latencies.p99,
      maxResponseTimeMs: latencies.max,
      databaseErrors: this.dbErrorsCount,
      databaseConflicts: this.conflictCount,
      activeWebSocketConnections: activeSockets,
      timestamp: new Date().toISOString(),
    };
  }

  public async getRecentEvents(limit = 50) {
    const res = await query(
      `SELECT ae.id, ae.auction_id, ae.event_type, ae.bid_id, ae.payload, ae.created_at,
              a.title as auction_title
       FROM auction_events ae
       LEFT JOIN auctions a ON ae.auction_id = a.id
       ORDER BY ae.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.rows.map((row) => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
  }
}

export const metricsService = new MetricsService();
