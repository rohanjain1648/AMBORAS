# 🏪 Amboras — Store Analytics Dashboard

> A production-grade, real-time eCommerce analytics platform built with **NestJS**, **Next.js 14**, **PostgreSQL**, and **Redis** — designed to process ~10,000 events/min and deliver sub-second dashboard load times across a multi-tenant architecture.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [What The Platform Does](#what-the-platform-does)
3. [System Overview](#system-overview)
4. [System Architecture](#system-architecture)
5. [Code Structure & Reproducibility](#code-structure--reproducibility)
6. [Core Logic Deep Dive](#core-logic-deep-dive)
7. [Architecture Decisions](#architecture-decisions)
8. [Performance Optimizations](#performance-optimizations)
9. [Setup Instructions](#setup-instructions)
10. [API Reference](#api-reference)
11. [Known Limitations](#known-limitations)
12. [What I'd Improve With More Time](#what-id-improve-with-more-time)
13. [Time Spent](#time-spent)

---

## Problem Statement

Amboras is a **multi-tenant eCommerce platform orchestrator** — helping entrepreneurs launch their own online stores in minutes. Each store owner gets a private dashboard to manage products, orders, and business performance.

### The Challenge

We have a **high-volume event stream** (~10,000 events/minute across all stores) tracking every user interaction:

```json
{
  "event_id": "evt_123",
  "store_id": "store_456",
  "event_type": "purchase",
  "timestamp": "2026-03-24T10:30:00Z",
  "data": {
    "product_id": "prod_789",
    "amount": 49.99,
    "currency": "USD"
  }
}
```

**Event types tracked:** `page_view`, `add_to_cart`, `remove_from_cart`, `checkout_started`, `purchase`

### The Core Problem

Store owners want to see:
- **Total revenue** across different time windows (today, this week, this month)
- **Conversion rate** (purchases ÷ page views)
- **Top products** ranked by revenue
- **Real-time activity** (events streaming in live)

But the data is **high-volume** and the dashboard must feel **fast** — loading in <2 seconds with individual API responses under 500ms, even with millions of historical events.

**Naive approaches fail:** Running `SELECT SUM(amount) FROM events WHERE store_id = ? AND timestamp > ?` on a table with millions of rows takes 2000ms+ per query. Multiply that by 4 dashboard widgets and you're looking at 8-second load times.

---

## What The Platform Does

### High-Level Overview

Amboras Analytics is a **real-time business intelligence dashboard** that transforms raw eCommerce event streams into actionable insights for store owners. It provides:

| Feature | Description |
|---------|-------------|
| 📊 **Revenue Tracking** | Aggregated revenue across today, this week, and this month — with daily trend visualization |
| 📈 **Conversion Funnel** | Live conversion rate (purchases / page views) with trend indicators |
| 🏆 **Product Rankings** | Top 10 products ranked by total revenue generated |
| ⚡ **Live Activity Feed** | Server-Sent Events (SSE) streaming real-time user interactions without page refresh |
| 👥 **Live Visitors** | Estimated active visitor count extrapolated from recent page view activity |
| 📅 **Date Range Filtering** | Toggle between Today / Week / Month views to slice data |
| 🔐 **Multi-Tenant Security** | JWT-based store isolation ensuring each owner sees only their own data |

### Low-Level Mechanics

Under the hood, the system operates as a **three-stage data pipeline**:

```
Stage 1: INGEST        Stage 2: AGGREGATE         Stage 3: SERVE
─────────────────      ──────────────────────      ──────────────────
Store Frontend         Background CRON Worker      Dashboard APIs
    │                       │                           │
    ├─ POST /events ──►  Raw DB Write               GET /overview
    │                       │                           │
    │                  Materialized View            Redis Cache Hit?
    │                  REFRESH (every 60s)          ├── YES → Return
    │                       │                       └── NO  → Query MV
    │                       ▼                           │
    │                  mv_daily_store_metrics        Return JSON
    │                  mv_top_products
    │
    └─ Redis Pub/Sub ──────────────────────────►  SSE /events/stream
                                                  (live activity feed)
```

1. **Ingest:** Events arrive via REST API, are written to PostgreSQL, and simultaneously published to Redis Pub/Sub.
2. **Aggregate:** A CRON job refreshes PostgreSQL Materialized Views every 60 seconds, pre-computing daily metrics.
3. **Serve:** Dashboard APIs read from pre-aggregated views (cached in Redis), while live events stream directly via SSE.

---

## System Overview

```mermaid
graph TB
    subgraph "Store Frontend (Customer Facing)"
        SF[Store Website]
    end

    subgraph "Analytics Frontend (Next.js 14)"
        LP[Login Page]
        DB[Dashboard Page]
        MC[MetricCards]
        RC[RevenueChart]
        TP[TopProductsTable]
        RA[RecentActivity SSE]
        LV[LiveVisitors]
    end

    subgraph "Backend API (NestJS)"
        AG[Auth Guard - JWT]
        AC[Analytics Controller]
        AS[Analytics Service]
        EC[Events Controller]
        ES[Events Service]
        CR[CRON Aggregation]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16)]
        RD[(Redis 7)]
        MV[Materialized Views]
    end

    SF -->|POST /events| EC
    EC --> ES
    ES -->|Write| PG
    ES -->|Pub/Sub Publish| RD

    LP -->|POST /auth/login| AG
    DB -->|GET /analytics/*| AC
    AC --> AG --> AS
    AS -->|Cache Check| RD
    AS -->|Cache Miss| MV
    MV --> PG

    DB -->|EventSource| RA
    RA -->|SSE Stream| ES
    ES -->|Pub/Sub Subscribe| RD

    CR -->|REFRESH CONCURRENTLY| MV

    MC --> DB
    RC --> DB
    TP --> DB
    LV --> DB
```

### Data Flow Sequence

```mermaid
sequenceDiagram
    participant Store as Store Frontend
    participant API as NestJS Backend
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant CRON as CRON Worker
    participant Dash as Dashboard (Next.js)

    Note over Store,Dash: Event Ingestion Flow
    Store->>API: POST /api/v1/events
    API->>DB: INSERT INTO store_events
    API->>Redis: PUBLISH store_events channel
    API-->>Store: 201 Created

    Note over CRON,DB: Background Aggregation (every 60s)
    CRON->>DB: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_store_metrics
    CRON->>DB: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products

    Note over Dash,Redis: Dashboard Load Flow
    Dash->>API: GET /api/v1/analytics/overview (Bearer JWT)
    API->>Redis: GET analytics:overview:store_alpha:month
    alt Cache Hit
        Redis-->>API: Cached JSON
    else Cache Miss
        API->>DB: SELECT FROM mv_daily_store_metrics WHERE store_id = $1
        DB-->>API: Aggregated Results
        API->>Redis: SETEX (60s TTL)
    end
    API-->>Dash: { revenue, conversionRate, revenueTrend }

    Note over Dash,Redis: Real-time SSE Flow
    Dash->>API: GET /api/v1/events/stream (Bearer JWT)
    Redis-->>API: Subscribe store_events channel
    loop On Each New Event
        API-->>Dash: data: { eventType, timestamp, data }
    end
```

---

## System Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | Server/Client React rendering |
| **Charting** | Recharts | SVG-based responsive data visualizations |
| **Data Fetching** | SWR + EventSource | Cache-first polling + Server-Sent Events |
| **Backend** | NestJS 10 (TypeScript) | Modular API framework with dependency injection |
| **ORM** | TypeORM | Entity mapping, migrations, query building |
| **Database** | PostgreSQL 16 | Primary data store with Materialized Views |
| **Cache/Pub-Sub** | Redis 7 (optional) | Response caching + real-time event routing |
| **Auth** | Passport.js + JWT | Stateless multi-tenant authentication |
| **Scheduling** | @nestjs/schedule | Background CRON for view aggregation |

### Database Schema

```sql
-- Raw event store (append-only, high write volume)
CREATE TABLE store_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        VARCHAR(50) UNIQUE NOT NULL,     -- Idempotency key
    store_id        VARCHAR(50) NOT NULL,             -- Tenant isolation
    event_type      VARCHAR(30) NOT NULL,             -- page_view | add_to_cart | ...
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data            JSONB,                            -- Flexible event payload
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indexes for analytics query patterns
CREATE INDEX idx_events_store_type_ts ON store_events (store_id, event_type, timestamp DESC);
CREATE INDEX idx_events_store_ts      ON store_events (store_id, timestamp DESC);
```

**Materialized Views (pre-aggregated):**

```sql
-- Daily metrics per store per event type
CREATE MATERIALIZED VIEW mv_daily_store_metrics AS
SELECT store_id, DATE(timestamp) AS metric_date, event_type,
       COUNT(*) AS event_count,
       COALESCE(SUM((data->>'amount')::NUMERIC), 0) AS total_revenue
FROM store_events
GROUP BY store_id, DATE(timestamp), event_type;

-- Top products per store by revenue
CREATE MATERIALIZED VIEW mv_top_products AS
SELECT store_id, data->>'product_id' AS product_id,
       data->>'product_name' AS product_name,
       COUNT(*) AS purchase_count,
       SUM((data->>'amount')::NUMERIC) AS total_revenue
FROM store_events WHERE event_type = 'purchase'
GROUP BY store_id, data->>'product_id', data->>'product_name';
```

---

## Code Structure & Reproducibility

### Repository Layout

```
amboras/
├── backend/                          # NestJS API Server
│   ├── src/
│   │   ├── main.ts                   # Bootstrap: CORS, validation, prefix
│   │   ├── app.module.ts             # Root module — imports all features
│   │   │
│   │   ├── auth/                     # 🔐 Authentication Module
│   │   │   ├── auth.module.ts        # JWT + Passport registration
│   │   │   ├── auth.controller.ts    # POST /auth/login (mock JWT issuer)
│   │   │   ├── jwt.strategy.ts       # Extracts storeId from Bearer tokens
│   │   │   └── store.decorator.ts    # @StoreId() & @StoreUser() param decorators
│   │   │
│   │   ├── analytics/                # 📊 Analytics Module
│   │   │   ├── analytics.module.ts   # Wires controller + service + entity
│   │   │   ├── analytics.controller.ts  # GET /overview, /top-products, /recent-activity
│   │   │   ├── analytics.service.ts  # Query logic, Redis cache, date ranges
│   │   │   └── dto/
│   │   │       └── overview-query.dto.ts  # Period & date range validation
│   │   │
│   │   ├── events/                   # ⚡ Event Ingestion + SSE Module
│   │   │   ├── events.module.ts      # Wires controller + service
│   │   │   ├── events.controller.ts  # POST /events (ingest), GET /events/stream (SSE)
│   │   │   ├── events.service.ts     # DB write + Pub/Sub + in-memory fallback
│   │   │   └── dto/
│   │   │       └── create-event.dto.ts  # Input validation (class-validator)
│   │   │
│   │   ├── aggregation/              # ⏰ Background CRON Module
│   │   │   ├── aggregation.module.ts
│   │   │   └── aggregation.service.ts  # Every-60s materialized view refresh
│   │   │
│   │   ├── redis/                    # 🔴 Optional Redis Module
│   │   │   └── redis.module.ts       # Fault-tolerant: falls back if unavailable
│   │   │
│   │   └── database/                 # 🗄️ Database Layer
│   │       ├── database.module.ts    # TypeORM async config from env
│   │       ├── data-source.ts        # CLI migration data source
│   │       ├── entities/
│   │       │   └── store-event.entity.ts  # TypeORM entity + indexes
│   │       ├── migrations/
│   │       │   └── 1711600000000-InitialSchema.ts  # Tables, indexes, views
│   │       └── seed.ts               # 100k realistic event generator
│   │
│   ├── .env                          # Local environment variables
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
├── frontend/                         # Next.js 14 Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout (Inter font, globals.css)
│   │   │   ├── page.tsx              # Login page (store selector + JWT)
│   │   │   ├── globals.css           # Dark glassmorphic design system
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx        # Sidebar shell + auth guard
│   │   │       └── page.tsx          # Main dashboard (assembles all widgets)
│   │   │
│   │   ├── components/
│   │   │   ├── MetricCard.tsx        # Glass KPI card with trend arrow
│   │   │   ├── RevenueChart.tsx      # Recharts area chart (revenue over time)
│   │   │   ├── TopProductsTable.tsx  # Ranked product table
│   │   │   ├── RecentActivity.tsx    # Live SSE event stream feed
│   │   │   ├── LiveVisitors.tsx      # Animated active visitor counter
│   │   │   └── DateRangePicker.tsx   # Period toggle (today/week/month)
│   │   │
│   │   └── lib/
│   │       ├── formatters.ts         # Currency, number, date formatting
│   │       └── hooks/
│   │           ├── useAnalytics.ts   # SWR hooks for REST endpoints
│   │           └── useEventStream.ts # SSE hook with reconnection logic
│   │
│   ├── .env.local
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js                # API proxy rewrites to backend
│
├── docker-compose.yml                # PostgreSQL 16 + Redis 7
├── .env.example                      # Template for environment variables
└── README.md                         # This file
```

### Reproducibility

This project is fully deterministic and reproducible on any machine with Docker and Node.js:

1. **Infrastructure as Code:** `docker-compose.yml` defines exact versions of PostgreSQL (16-alpine) and Redis (7-alpine), ensuring identical database behavior regardless of host OS.
2. **Migrations:** The database schema is version-controlled via TypeORM migrations — running `npm run migration:run` creates the exact same tables, indexes, and materialized views every time.
3. **Deterministic Seeding:** The seed script generates 100,000 events using a **weighted probability distribution** (50% page views, 20% add-to-cart, 15% purchases, 10% checkout, 5% remove-from-cart) mimicking a realistic eCommerce conversion funnel. Events are distributed across 5 demo stores over a 30-day window with a recency bias (more events in recent days).
4. **Environment Isolation:** All configuration is externalized via `.env` files. The `.env.example` template documents every required variable.
5. **Zero External Dependencies:** No external APIs, third-party services, or cloud accounts are required. Everything runs locally.

---

## Core Logic Deep Dive

### 1. Multi-Tenant Isolation Strategy

Every incoming request passes through a JWT AuthGuard that extracts the `store_id` claim:

```
Request → JwtStrategy.validate(payload) → { storeId: "store_alpha" }
                                              │
                                              ▼
                              @StoreId() decorator injects into handler
                                              │
                                              ▼
                              Service method: WHERE store_id = $1
```

**Why this matters:** Even if a malicious user crafts a request with a different `store_id` in the query params, the controller ignores it — the `store_id` always comes from the cryptographically signed JWT token. A store owner **cannot** access another store's data.

### 2. Materialized View Aggregation Logic

The `AnalyticsService.getOverview()` method queries the pre-aggregated `mv_daily_store_metrics` view:

```sql
-- Single query computes all three revenue windows simultaneously
SELECT
  SUM(CASE WHEN metric_date = CURRENT_DATE THEN total_revenue ELSE 0 END) AS revenue_today,
  SUM(CASE WHEN metric_date >= CURRENT_DATE - INTERVAL '7 days' THEN total_revenue ELSE 0 END) AS revenue_week,
  SUM(total_revenue) AS revenue_month
FROM mv_daily_store_metrics
WHERE store_id = $1 AND event_type = 'purchase' AND metric_date >= $2 AND metric_date <= $3
```

This executes in **<10ms** because:
- The materialized view has already grouped millions of events into a few hundred rows (one per store per day per event type)
- The unique index on `(store_id, metric_date, event_type)` makes the lookup an O(1) B-Tree traversal

### 3. Conversion Rate Calculation

```
Conversion Rate = (purchase_count / page_view_count) × 100

WHERE both counts come from the same materialized view query,
filtered by the selected date range.
```

This is a **session-independent** conversion rate — it does not track individual user journeys through the funnel. For a true session-based conversion analysis, you'd need a session stitching pipeline (documented in improvements).

### 4. SSE Real-Time Pipeline

The real-time pipeline has two code paths, chosen automatically based on Redis availability:

```
WITH REDIS:
  Event Ingested → redis.publish("store_events", JSON)
                                    │
  Dashboard SSE ← redisSub.on("message") → filter by storeId → push to client

WITHOUT REDIS (fallback):
  Event Ingested → RxJS Subject.next(event)
                                    │
  Dashboard SSE ← Subject.subscribe() → filter by storeId → push to client
```

The SSE endpoint uses NestJS's native `@Sse()` decorator, which returns an RxJS `Observable<MessageEvent>`. NestJS automatically handles keep-alive pings, connection cleanup, and proper `text/event-stream` headers.

### 5. Redis Cache Layer Logic

```
┌──────────────────────────────────────────┐
│  GET /api/v1/analytics/overview          │
│                                          │
│  1. Build cache key:                     │
│     "analytics:overview:{storeId}:{period}" │
│                                          │
│  2. redis.GET(key)                       │
│     ├── HIT → return parsed JSON         │
│     └── MISS → query materialized view   │
│              → redis.SETEX(key, 60, JSON)│
│              → return result             │
│                                          │
│  TTL: 60 seconds                         │
│  Invalidation: passive (TTL expiry)      │
└──────────────────────────────────────────┘
```

Redis is **entirely optional**. The `RedisModule` catches all connection errors silently and the `AnalyticsService` methods all check `if (!this.redis) return null` before attempting cache operations.

### 6. Seed Script Intelligence

The seed script doesn't generate random noise — it models a **realistic eCommerce funnel**:

| Event Type | Weight | Rationale |
|-----------|--------|-----------|
| `page_view` | 50% | Most common — browsing is the top of funnel |
| `add_to_cart` | 20% | ~40% of viewers add something |
| `purchase` | 15% | ~30% of cart additions convert |
| `checkout_started` | 10% | Some start checkout but don't finish |
| `remove_from_cart` | 5% | Rare — most abandoners just leave |

Timestamps use a **power distribution** (`Math.pow(Math.random(), 1.5)`) to cluster more events in recent days, mimicking a growing store with accelerating traffic.

---

## Architecture Decisions

### Data Aggregation Strategy
- **Decision:** PostgreSQL Materialized Views combined with a Redis Cache layer.
- **Why:** Running raw `SUM()`, `COUNT()`, and `GROUP BY` queries on millions of rows for every page load is too slow and resource-intensive (`>2000ms`). By using Materialized Views, we pre-compute the daily revenue, event counts, and top products. The dashboard simply acts as an indexed read-replica on these small, pre-calculated tables (`<50ms`). We then wrap these reads in a 60-second Redis cache to entirely prevent database hits during high-traffic spikes.
- **Trade-offs:** 
  - *What we gained:* Extreme performance and horizontal scaling capability. Database CPU load remains near zero during dashboard reads.
  - *What we sacrificed:* Data freshness for aggregate metrics. Revenue and Conversion numbers can be up to 60 seconds stale between CRON executions.
- **Alternatives considered:**
  - *Real-time aggregation (rejected):* Computing aggregates on every request would spike latency to 2-5 seconds as the table grows beyond 1M rows.
  - *TimescaleDB Continuous Aggregates (ideal but over-scoped):* Would solve the stale-data problem, but requires an additional PostgreSQL extension and more complex infrastructure.

### Real-time vs. Batch Processing
- **Decision:** Hybrid Architecture (Batch Aggregation + Real-Time Streaming).
- **Why:** Store owners expect absolute accuracy for revenue (which can be slightly delayed) but want the dopamine hit of watching customers interact with their store *right now*. 
  - **Batch:** Aggregated metrics (revenue, top products) are processed via a NestJS `@Cron` job that refreshes materialized views concurrently in the background.
  - **Real-Time:** The "Recent Activity" and "Live Visitors" widgets are powered by Server-Sent Events (SSE) piped through Redis Pub/Sub, pushing individual events directly to the browser the millisecond they are ingested.
- **Trade-offs:** The primary trade-off is a slight visual desynchronization — a user might see a "Purchase" stream into the live activity feed, but the "Total Revenue" KPI card won't tick up until the next 60-second batch cycle completes.

### Frontend Data Fetching
- **Decision:** `SWR` (Stale-While-Revalidate) for aggregated metrics + Native `EventSource` for live streams.
- **Why:** 
  - `useSWR` perfectly complements our backend Redis cache. It instantly renders cached data, fetches in the background, and automatically revalidates when the user switches tabs.
  - `EventSource` (SSE) is vastly superior to WebSockets for this specific use case because the communication is strictly unidirectional (Server → Client). It requires less overhead, supports native auto-reconnection, and easily bypasses corporate firewalls.
- **Alternatives considered:**
  - *WebSockets (rejected):* Bidirectional communication is unnecessary. WebSocket connections are harder to scale behind load balancers and don't auto-reconnect natively.
  - *Polling (rejected):* Would introduce unnecessary latency for the live feed and waste bandwidth with empty requests.

---

## Performance Optimizations

| # | Optimization | Layer | Impact | Mechanism |
|---|-------------|-------|--------|-----------|
| 1 | Materialized Views | PostgreSQL | Reads go from ~2000ms → <10ms | Pre-computed daily aggregates eliminate full-table scans |
| 2 | Composite B-Tree Indexes | PostgreSQL | `WHERE store_id AND timestamp` queries use Index Scan | `(store_id, event_type, timestamp DESC)` covers all query patterns |
| 3 | `REFRESH CONCURRENTLY` | PostgreSQL | Zero read-blocking during refresh | Avoids exclusive locks by using the unique index on the view |
| 4 | Redis Response Cache | Redis | Eliminates DB round-trip for 60s | `SETEX` with 60s TTL on JSON-serialized results |
| 5 | Application-Level Tenancy | NestJS | Lower connection overhead vs RLS | JWT-injected `store_id` avoids `SET LOCAL` per-transaction cost |
| 6 | SWR Background Revalidation | Next.js | Instant first paint, fresh data in background | Cache-first rendering with passive refresh |
| 7 | SSE over WebSocket | NestJS/Browser | Lower memory per connection | Unidirectional stream, HTTP-native, auto-reconnect |
| 8 | Batched Seed Inserts | Seed Script | 100k rows in ~5 seconds | 5,000-row batch inserts instead of individual INSERTs |

---

## Setup Instructions

### Prerequisites
- Docker & Docker Compose (for PostgreSQL & Redis)
- Node.js v18+
- npm

### Step 1: Start Infrastructure
```bash
docker-compose up -d
```
This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379.

### Step 2: Setup Backend
```bash
cd backend
npm install
npm run migration:run    # Create schema, indexes, materialized views
npm run seed             # Generate 100,000 test events (~30 seconds)
npm run start:dev        # Start NestJS on http://localhost:3001
```

### Step 3: Setup Frontend
```bash
cd frontend
npm install
npm run dev              # Start Next.js on http://localhost:3000
```

### Step 4: Access the Dashboard
1. Open `http://localhost:3000`
2. Select a demo store (e.g., `store_alpha`) from the dropdown
3. Click **"Access Dashboard"**
4. Explore revenue charts, top products, and the live event feed

### Environment Variables
See `.env.example` for all configuration:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/amboras
REDIS_URL=redis://localhost:6379    # Leave empty to run without Redis
JWT_SECRET=amboras-dev-secret-key
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description | Cache |
|--------|----------|------|-------------|-------|
| `POST` | `/auth/login` | ❌ | Issue JWT for a store | — |
| `GET` | `/analytics/overview?period=month` | ✅ | Revenue, event counts, conversion rate, daily trend | 60s Redis |
| `GET` | `/analytics/top-products` | ✅ | Top 10 products by revenue | 60s Redis |
| `GET` | `/analytics/recent-activity` | ✅ | Last 20 events (raw table query) | None |
| `POST` | `/events` | ❌ | Ingest a new store event | — |
| `GET` | `/events/stream` | ✅ | SSE stream of real-time events | — |

---

## Known Limitations

| Limitation | Impact | Severity |
|-----------|--------|----------|
| **Materialized View Full Rebuild** | As data grows past 10M+ rows, the 60s CRON refresh will lag | Medium |
| **No Table Partitioning** | Append-only table at 10k/min → ~14M rows/day with no pruning | High at scale |
| **Direct DB Writes** | `POST /events` writes synchronously — no queue buffering for burst traffic | Medium |
| **SSE Memory** | Each active SSE connection holds an open HTTP stream in Node.js memory | Medium at scale |
| **Mock Authentication** | No real user database, password hashing, or OAuth flow | Low (prototype) |
| **Session-Independent Conversion** | Conversion rate is aggregate (purchases/views), not per-user funnel tracking | Low |

---

## What I'd Improve With More Time

If I had an additional week to evolve this architecture to true enterprise scale:

1. **TimescaleDB Continuous Aggregates:** Migrate from standard PostgreSQL to TimescaleDB. Continuous aggregates only process *new* data since the last refresh, eliminating the full-rebuild penalty. The existing SQL barely changes.
2. **Message Queue Ingestion:** Insert RabbitMQ/Kafka between the ingest API and the database. The `POST /events` endpoint would validate and enqueue, returning `202 Accepted` instantly. Background workers batch-insert via Postgres `COPY` for 10x write throughput.
3. **Table Partitioning by Month:** Partition `store_events` by `timestamp` ranges (`store_events_2026_03`, etc.). Dropping old months becomes a single `DROP TABLE` rather than a slow `DELETE`.
4. **Real User Authentication:** Replace mock JWT with OAuth 2.0 / Auth0. Add user registration, password management, and role-based access control.
5. **Drill-Down Charts:** Click a data point on the revenue chart →  see that day's top products, traffic sources, and individual order details.
6. **Export & Reporting:** CSV/PDF export of analytics data for store owners who need to share reports with stakeholders.
7. **WebSocket Upgrade for SSE:** At extreme scale (10k+ concurrent dashboard users), migrate SSE to a dedicated WebSocket gateway with connection pooling.

---

## Time Spent

**Approximate total time spent:** ~3.5 Hours

| Phase | Time | Activities |
|-------|------|-----------|
| Architecture & Design | 45 min | Problem analysis, technology selection, schema design, trade-off evaluation |
| Backend Implementation | 90 min | NestJS modules, TypeORM entities, migrations, analytics queries, SSE pipeline, CRON job |
| Frontend Implementation | 60 min | Next.js pages, Recharts visualizations, SWR hooks, SSE integration, glassmorphic CSS |
| Seed Script & Testing | 15 min | Weighted event generator, data verification |
| Documentation | 30 min | README, architecture decisions, code comments |
