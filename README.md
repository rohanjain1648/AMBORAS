# Store Analytics Dashboard

Amboras is a multi-tenant eCommerce platform orchestrator, and this repository contains the Store Analytics Dashboard—a real-time analytics suite designed to handle high-volume event streams (~10,000 events/min) while delivering sub-second dashboard load times.

## Setup Instructions

This project requires Docker (or Docker Desktop) and Node.js v18+.

**Step 1: Start the Infrastructure**
We use Docker Compose to spin up PostgreSQL 16 and Redis 7.
\`\`\`bash
cd c:/Users/ACER/Downloads/amboras
docker-compose up -d
\`\`\`

**Step 2: Setup the Backend**
The backend is a NestJS application. It handles ingestion, real-time streaming, and batch aggregation.
\`\`\`bash
cd backend
npm install
# Run TypeORM migrations to create tables, indexes, and materialized views
npm run migration:run
# Seed the database with 100,000 realistic eCommerce events across multiple stores
npm run seed
# Start the backend server
npm run start:dev
\`\`\`
*Note: The backend runs on `http://localhost:3001`.*

**Step 3: Setup the Frontend**
The frontend is a Next.js 14 App Router application featuring a glassmorphic dashboard.
\`\`\`bash
# In a new terminal window:
cd frontend
npm install
# Start the frontend server
npm run dev
\`\`\`
*Note: The frontend runs on `http://localhost:3000`.*

**Step 4: View the Dashboard**
1. Open `http://localhost:3000` in your browser.
2. Select any demo store (e.g., `store_alpha`) from the dropdown and click "Access Dashboard".
3. The dashboard will instantly populate with aggregated data and begin listening for live events.

---

## Architecture Decisions

### Data Aggregation Strategy
- **Decision:** PostgreSQL Materialized Views combined with a Redis Cache layer.
- **Why:** Running raw `SUM()`, `COUNT()`, and `GROUP BY` queries on millions of rows for every page load is too slow and resource-intensive (`>2000ms`). By using Materialized Views, we pre-compute the daily revenue, event counts, and top products. The dashboard simply acts as an indexed read-replica on these small, pre-calculated tables (`<50ms`). We then wrap these reads in a 60-second Redis cache to entirely prevent database hits during high-traffic spikes.
- **Trade-offs:** 
  - *What we gained:* Extreme performance and horizontal scaling capability. Database CPU load remains near zero during dashboard reads.
  - *What we sacrificed:* Data freshness for aggregate metrics. Revenue and Conversion numbers can be up to 60 seconds stale between CRON executions.

### Real-time vs. Batch Processing
- **Decision:** Hybrid Architecture (Batch Aggregation + Real-Time Streaming).
- **Why:** Store owners expect absolute accuracy for revenue (which can be slightly delayed) but want the dopamine hit of watching customers interact with their store *right now*. 
  - **Batch:** Aggregated metrics (revenue, top products) are processed via a NestJS `@Cron` job that refreshes materialized views concurrently in the background.
  - **Real-Time:** The "Recent Activity" and "Live Visitors" widgets are powered by Server-Sent Events (SSE) piped through Redis Pub/Sub, pushing individual events directly to the browser the millisecond they are ingested.
- **Trade-offs:** Minimal complexity increase. The primary trade-off is a slight visual desynchronization—a user might see a "Purchase" stream into the live activity feed, but the "Total Revenue" KPI card won't tick up until the next 60-second batch cycle completes.

### Frontend Data Fetching
- **Decision:** `SWR` (Stale-While-Revalidate) for aggregated metrics + Native `EventSource` for live streams.
- **Why:** 
  - `useSWR` perfectly complements our backend Redis cache. It instantly renders cached data, fetches in the background, and automatically revalidates when the user switches tabs, ensuring the UI always reflects the latest batch cycle.
  - `EventSource` (SSE) is vastly superior to WebSockets for this specific use case because the communication is strictly unidirectional (Server → Client). It requires less overhead, supports native auto-reconnection, and easily bypasses corporate firewalls.

### Performance Optimizations
1. **Strategic PostgreSQL Indexing:** Created composite `B-Tree` indexes on `(store_id, event_type, timestamp DESC)` and `(store_id, timestamp DESC)`. This guarantees that even when querying the raw append-only table (for recent activity), PostgreSQL performs a targeted Index Scan rather than a massive Sequential Scan.
2. **Concurrent View Refreshes:** The CRON job executes `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Without the `CONCURRENTLY` keyword, PostgreSQL places an exclusive lock on the view while refreshing, which would severely block incoming dashboard read requests.
3. **Application-Level Multi-Tenancy:** By managing isolation via a JWT `store_id` claim and injecting it into every query via a strict `@StoreId` guard, we avoided the high connection-pool overhead associated with Row-Level Security (RLS) connection-variable swapping, keeping the database transaction lifecycle as fast as possible.
4. **Debounced React Renders:** The live visitor counter interpolates states between incoming SSE chunks rather than aggressively locking the DOM on every payload.

---

## Known Limitations

- **Materialized View Scaling:** As historical data spans years, the `mv_daily_store_metrics` view will eventually become slow to rebuild. Full rebuilds on a massive `store_events` table will choke the CRON worker.
- **Archival Strategy Missing:** We do not currently prune or partition the `store_events` table. Append-only tables at 10k/min will exponentially degrade disk space and index maintenance speeds.
- **Ingestion Bottleneck:** The NestJS `POST /events` endpoint writes directly to PostgreSQL. During sudden viral traffic spikes (e.g., 50k events/min), this will exhaust the TypeORM connection pool.
- **SSE Connection Limits:** Maintaining thousands of active `EventSource` HTTP streaming connections simultaneously consumes significant memory per Node.js worker.

---

## What I'd Improve With More Time

If I had an additional week to evolve this architecture to true enterprise scale:

1. **Implement TimescaleDB (Continuous Aggregates):** I would migrate the standard PostgreSQL instance to the TimescaleDB extension. Continuous aggregates only process *new* data since the last refresh, solving the materialized view rebuild scaling issue completely.
2. **Message Queuing for Ingestion:** I would introduce RabbitMQ or Kafka. The ingest API would simply validate and push the JSON event into a queue, returning `202 Accepted` instantly. A separate fleet of background workers would pull batches of 5,000 events from the queue and utilize Postgres `COPY` for high-throughput bulk insertions.
3. **Database Partitioning:** I would partition the `store_events` table by month (e.g., `store_events_2026_03`). This makes dropping historical data trivial and shrinks active indexes to keep writes blisteringly fast.
4. **User Authentication:** Swap the mock JWT flow for a robust OAuth/Auth0 implementation.
5. **Interactive Charts:** Evolve the simple Recharts area graph into a fully drill-down capable interactive dashboard where store owners can click specific nodes to investigate anomalous order days.

---

## Time Spent

**Approximate time spent:** 3.5 Hours.
This included system design mapping, database schema architecture, NestJS generic modularization, React/Next.js UI structuring with a custom glassmorphism CSS theme, and documentation drafting.
