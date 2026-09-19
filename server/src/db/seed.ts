import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initDb, query, withTransaction, closeDb } from './index.js';

export async function seed(skipInit = false) {
  console.log('[SEED] Seeding database with demo users, test auctions, and sample bids...');
  if (!skipInit) {
    await initDb();
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Alice Buyer',
      email: 'buyer@bidstorm.dev',
      password_hash: passwordHash,
      role: 'buyer'
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Marcus Manager',
      email: 'manager@bidstorm.dev',
      password_hash: passwordHash,
      role: 'manager'
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Sarah Admin',
      email: 'admin@bidstorm.dev',
      password_hash: passwordHash,
      role: 'admin'
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Bob Trader',
      email: 'bob@bidstorm.dev',
      password_hash: passwordHash,
      role: 'buyer'
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Elena Collector',
      email: 'elena@bidstorm.dev',
      password_hash: passwordHash,
      role: 'buyer'
    }
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.id, u.name, u.email, u.password_hash, u.role]
    );
  }
  console.log(`[SEED] Seeded ${users.length} demo users.`);

  // Auctions
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const auctions = [
    {
      id: '11111111-1111-1111-1111-111111111101',
      title: 'ApexBook Pro M3 Max (32-Core GPU, 64GB RAM)',
      description: 'Factory-sealed engineering sample with custom matte titanium finish. Includes 2TB NVMe PCIe 5.0 SSD and magnetic liquid cooling dock.',
      category: 'Computing',
      image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
      starting_price: 2499.00,
      current_highest_bid: 2650.00,
      minimum_increment: 50.00,
      status: 'active',
      start_time: oneHourAgo,
      end_time: tomorrow,
      created_by: users[1].id,
      version: 3
    },
    {
      id: '11111111-1111-1111-1111-111111111102',
      title: 'Leica M11 Monochrom Collector’s Edition',
      description: 'Handcrafted rangefinder body in stealth black anodized finish with Noctilux-M 50mm f/0.95 ASPH lens. Serial number #007/100.',
      category: 'Photography',
      image_url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
      starting_price: 7200.00,
      current_highest_bid: 7500.00,
      minimum_increment: 100.00,
      status: 'active',
      start_time: oneHourAgo,
      end_time: nextWeek,
      created_by: users[1].id,
      version: 2
    },
    {
      id: '11111111-1111-1111-1111-111111111103',
      title: 'Chronotech Tourbillon Titanium Sapphire',
      description: 'Hand-wound mechanical tourbillon movement with skeleton dial, Grade 5 titanium chassis, and sapphire crystal exhibition case back.',
      category: 'Watches',
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
      starting_price: 12500.00,
      current_highest_bid: 13000.00,
      minimum_increment: 250.00,
      status: 'active',
      start_time: oneHourAgo,
      end_time: tomorrow,
      created_by: users[1].id,
      version: 2
    },
    {
      id: '11111111-1111-1111-1111-111111111104',
      title: 'CyberPhone Quantum Matrix Pro (512GB)',
      description: 'Ultralight aerospace graphene body, 165Hz AMOLED HDR10+ display, Snapdragon 8 Gen 3 with custom vapor chamber cooling.',
      category: 'Electronics',
      image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=80',
      starting_price: 899.00,
      current_highest_bid: 950.00,
      minimum_increment: 25.00,
      status: 'active',
      start_time: oneHourAgo,
      end_time: tomorrow,
      created_by: users[1].id,
      version: 2
    },
    {
      id: '11111111-1111-1111-1111-111111111105',
      title: 'Dedicated Stress Test Auction [LAB-BENCHMARK-01]',
      description: 'Dedicated isolated auction used exclusively for high-concurrency stress testing and race condition verification in the Concurrency Lab.',
      category: 'Benchmark',
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80',
      starting_price: 100.00,
      current_highest_bid: 100.00,
      minimum_increment: 10.00,
      status: 'active',
      start_time: oneHourAgo,
      end_time: tomorrow,
      created_by: users[2].id,
      version: 0
    },
    {
      id: '11111111-1111-1111-1111-111111111106',
      title: 'CyberDeck Vintage Terminal Prototype (Ended)',
      description: 'Experimental mechanical split-chassis cyberdeck with CRT-emulation OLED display and integrated software-defined radio.',
      category: 'Collectibles',
      image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80',
      starting_price: 1500.00,
      current_highest_bid: 1950.00,
      minimum_increment: 50.00,
      status: 'ended',
      start_time: twoHoursAgo,
      end_time: thirtyMinsAgo,
      created_by: users[1].id,
      winner_id: users[0].id,
      winning_bid: 1950.00,
      version: 5
    }
  ];

  for (const a of auctions) {
    await query(
      `INSERT INTO auctions (id, title, description, category, image_url, starting_price, current_highest_bid, minimum_increment, status, start_time, end_time, created_by, winner_id, winning_bid, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, description = EXCLUDED.description, current_highest_bid = EXCLUDED.current_highest_bid,
           status = EXCLUDED.status, winner_id = EXCLUDED.winner_id, winning_bid = EXCLUDED.winning_bid`,
      [a.id, a.title, a.description, a.category, a.image_url, a.starting_price, a.current_highest_bid, a.minimum_increment, a.status, a.start_time, a.end_time, a.created_by, a.winner_id || null, a.winning_bid || null, a.version]
    );
  }
  console.log(`[SEED] Seeded ${auctions.length} auctions.`);

  // Sample historical bids for ApexBook
  const sampleBids = [
    {
      id: uuidv4(),
      auction_id: auctions[0].id,
      bidder_id: users[0].id,
      amount: 2550.00,
      status: 'accepted',
      idempotency_key: 'seed-bid-1',
      request_id: 'seed-req-1',
      created_at: new Date(now.getTime() - 40 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      auction_id: auctions[0].id,
      bidder_id: users[3].id,
      amount: 2600.00,
      status: 'accepted',
      idempotency_key: 'seed-bid-2',
      request_id: 'seed-req-2',
      created_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      auction_id: auctions[0].id,
      bidder_id: users[4].id,
      amount: 2650.00,
      status: 'accepted',
      idempotency_key: 'seed-bid-3',
      request_id: 'seed-req-3',
      created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    }
  ];

  for (const b of sampleBids) {
    await query(
      `INSERT INTO bids (id, auction_id, bidder_id, amount, status, idempotency_key, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (auction_id, idempotency_key) DO NOTHING`,
      [b.id, b.auction_id, b.bidder_id, b.amount, b.status, b.idempotency_key, b.request_id, b.created_at]
    );

    await query(
      `INSERT INTO auction_events (id, auction_id, event_type, bid_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), b.auction_id, 'BID_ACCEPTED', b.id, JSON.stringify({ amount: b.amount, bidderId: b.bidder_id }), b.created_at]
    );
  }

  console.log(`[SEED] Seeded initial bids and audit events successfully!`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed()
    .then(() => {
      console.log('[SEED] Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Error:', err);
      process.exit(1);
    });
}
