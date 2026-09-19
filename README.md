# ⚡ BidStorm — Real-Time Auction System Under Load

> **College Hackathon Distributed Systems & Concurrency Showcase**  
> A production-grade real-time online auction platform engineered to safely process extreme bursts of simultaneous bids with zero race conditions, zero phantom bids, and strict mathematical guarantee against double-winner allocations.

---

## 🏛️ Executive Summary & Architectural Overview

In high-stakes online auctions (e.g. limited-edition hardware drops, rare collectibles), hundreds of bidders submit bids within milliseconds of each other. Naive web applications read the current price from a cache or database without locking, evaluate the bid in application memory, and execute an update. Under concurrent load, this causes **lost updates**, **out-of-order bid acceptance**, and **multiple winning bidders**.

**BidStorm** solves this through **PostgreSQL row-level locking (`SELECT ... FOR UPDATE`)**, atomic transactional commit pipelines, idempotency keys, and post-commit WebSocket broadcasting.

```
       [ Client A ]      [ Client B ]      [ Client C ]
            │                 │                 │
            ▼                 ▼                 ▼
  ┌────────────────────────────────────────────────────────┐
  │         BidStorm Express API (Zod Validation)          │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │       BEGIN PostgreSQL Transaction & Idempotency       │
  │     SELECT ... FROM auctions WHERE id = $1 FOR UPDATE  │
  └───────────────────────────┬────────────────────────────┘
                              │ (Acquires Exclusive Row Lock)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │          Sequential Invariant Validation:             │
  │   1. Status == 'active' && now between start & end     │
  │   2. Bid >= current_highest_bid + minimum_increment    │
  └───────────────┬────────────────────────┬───────────────┘
                  │ Valid                  │ Invalid
                  ▼                        ▼
  ┌───────────────────────────┐    ┌───────────────────────────┐
  │ - Insert into bids (acc)  │    │ - Insert into bids (rej)  │
  │ - UPDATE auctions (price) │    │ - Record conflict counter │
  │ - INSERT auction_events   │    │ - Return 400 with reason  │
  │ - COMMIT TRANSACTION      │    └───────────────────────────┘
  └───────────────┬───────────┘
                  │ (Post-Commit Hook)
                  ▼
  ┌────────────────────────────────────────────────────────┐
  │        Socket.IO Broadcast to auction room:            │
  │     "auction:updated", "bid:accepted" to all tabs     │
  └────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Transactional Row-Level Locking**: `SELECT ... FOR UPDATE` serializes concurrent bids at the database engine level. The database is the single source of truth.
2. **Strict Idempotency Protection**: Unique constraint on `(auction_id, idempotency_key)` guarantees network retries never produce duplicate charges or phantom accepted bids.
3. **Dual-Mode PostgreSQL Engine**:
   - **Production / Docker**: Connects to PostgreSQL 16 connection pool via `pg.Pool`.
   - **Instant Local Dev**: Seamlessly initializes embedded PostgreSQL WebAssembly (`@electric-sql/pglite` with disk persistence), allowing the application to run immediately on any laptop without Docker or PostgreSQL pre-installed.
4. **Sub-10ms Real-Time Sync**: Socket.IO broadcasts latest price, bid count, and bidder names to connected clients only after successful database commit.
5. **Live Concurrency Lab & Stress Tester**: Administrator dashboard to simulate 10 to 5,000 concurrent bid requests across 3 strategies (Same Amount race, Incremental bids, Random traffic).
6. **7-Check Automated Correctness Verification**: Post-test validation engine proving that zero invariants were broken during stress tests.
7. **1-Click Demo Persona Switcher**: Instant switching between Buyer, Auction Manager, and Administrator for frictionless hackathon judging.

---

## 👥 Demo User Credentials

BidStorm comes pre-seeded with three demo personas. The navigation bar and login screen include **1-Click Quick Login** buttons:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Buyer** (Alice) | `buyer@bidstorm.dev` | `password123` | Browse auctions, place real-time bids, view personal portfolio & win/loss ratio |
| **Manager** (Marcus) | `manager@bidstorm.dev` | `password123` | Create auctions, configure increments, pause/resume, settle & close auctions |
| **Admin** (Sarah) | `admin@bidstorm.dev` | `password123` | Real-time system telemetry, p50/p95 latency monitor, **Concurrency Lab**, run invariant checks |

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
- Node.js v18+ (tested on Node v20.18.0)
- npm v9+

### 1. Install Dependencies
Run from the project root:
```bash
npm run install:all
```
*(Installs root, server, and client packages).*

### 2. Seed Demo Data & Schema
```bash
npm run seed
```
*(Initializes the database, creates tables, foreign keys, constraints, indexes, 5 demo users, and 6 realistic sample auctions).*

### 3. Start Frontend & Backend Concurrently
```bash
npm run dev
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Check**: [http://localhost:5000/api/health/ready](http://localhost:5000/api/health/ready)

---

## 🐳 Docker Deployment (Optional)

A complete `docker-compose.yml` is provided for containerized multi-container deployment:
```bash
# Start PostgreSQL 16, Redis 7, Backend Server, and Nginx SPA Frontend
docker compose up --build -d
```
Services exposed:
- Web App: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- PostgreSQL: `localhost:5432` (`bidstorm` / `postgrespassword`)
- Redis: `localhost:6379`

---

## 🧪 Automated Testing Suite

The backend includes a comprehensive Vitest test suite executing against all 10 project requirements:
```bash
npm --prefix server test
```

### Verified Test Cases:
1. **Successful bid placement**: Valid bid exceeding increment is accepted.
2. **Rejection below minimum increment**: Rejects bids below `current + increment`.
3. **Rejection of equal or outdated bids**: Rejects stale bids without corrupting state.
4. **Closed auction rejection**: Bidding on ended auctions is rejected.
5. **Duplicate idempotency key**: Replays existing result without double-counting.
6. **Two concurrent identical bids**: Serializes race; exactly 1 accepted, 1 rejected.
7. **Multiple concurrent clients**: 10 parallel bids racing; validates strict increment progression.
8. **Transaction rollback**: Reverts cleanly on non-existent auction without orphaned rows.
9. **Role-based authorization**: Enforces JWT token and role access.
10. **Audit event integrity**: Every accepted bid creates an immutable event in `auction_events`.

---

## 🔬 Concurrency Lab & The 7 Invariant Checks

Located at `/concurrency-lab` (Admin persona), this dashboard allows judges to configure:
- **Simulation Strategies**:
  - **Strategy A (Same Amount)**: 20–100 clients attempt the exact same price. Proves only 1 bid wins and all others are safely rejected.
  - **Strategy B (Incremental Bids)**: Clients submit increasing amounts. Proves throughput under serialized row locks.
  - **Strategy C (Random Mix)**: Mixture of valid, invalid, duplicate, and high bids simulating real internet noise.
- **Real-Time Visuals**: Live progress bar, instant RPS gauge, latency spectrum bar chart (p50, p95, p99, max).
- **Post-Test Automated Verification**: Executes 7 strict database queries via `GET /api/admin/test-runs/:id/verify`:

1. **Minimum Increment Invariant**: Every consecutive accepted bid is `>= previous_bid + minimum_increment`.
2. **Time Window Invariant**: All accepted bids occurred strictly within `start_time` and `end_time`.
3. **Idempotency Invariant**: Zero duplicate idempotency keys accepted.
4. **Final State Consistency**: Auction `current_highest_bid` equals `MAX(amount)` of accepted bids.
5. **Event Audit Integrity**: Every accepted bid has a corresponding immutable `auction_events` row.
6. **Monotonicity**: Accepted bids are strictly monotonically increasing in amount over time.
7. **Single Winner Guarantee**: Exactly one winner at auction conclusion.

---

## ⏱️ 5–7 Minute Hackathon Presentation Script

1. **Landing Page (1 min)**:
   - Point out the "PostgreSQL Row-Locking & Concurrency Engine" badge.
   - Explain why naive bidding breaks: stale memory reads cause race conditions.
2. **Marketplace & Live Tabs Demo (2 mins)**:
   - Open [http://localhost:5173/marketplace](http://localhost:5173/marketplace).
   - Click **Demo Roles** in Navbar -> Switch to **Buyer (Alice)**.
   - Open the **ApexBook Pro** auction.
   - Open a second incognito browser window side-by-side.
   - Click quick bid **+$50.00** in Tab 1 -> Watch Tab 2 update its price and bid count **instantly via WebSockets** without page refresh.
3. **Concurrency Lab & Live Stress Test (2 mins)**:
   - In Navbar, switch to **Admin (Sarah)** -> Click **Concurrency Lab**.
   - Select **Strategy A: Same Amount (Race)**.
   - Click preset **100 Reqs / 10 clients** -> Click **Launch Live Stress Simulation**.
   - Show live counters: **1 Accepted**, **99 Rejected**, **0 Errors**. Explain why: Under `SELECT ... FOR UPDATE`, only the first lock-holder committed; all subsequent attempts were rejected for not meeting increment.
4. **Automated Correctness Verification (1 min)**:
   - Click **Run Correctness Check**.
   - Highlight the green **ALL INVARIANTS PASSED** badge and the 7 database verification checks.
   - Click **Export Report** (JSON/CSV) to show auditor-grade traceability.

---

## 🔒 Security & Production Disclaimer

- Passwords hashed using bcrypt (10 rounds).
- Role-based authorization enforced on backend API endpoints.
- Rate limiter protecting bid endpoints.
- **Disclaimer**: This application is built as an educational demonstration of distributed systems, row-level locking, and concurrency testing. Handling real financial transactions in production requires additional payment gateway escrow, identity verification (KYC), multi-region active-active database clustering, and financial compliance audits.
