import { DataSource } from 'typeorm';
import { StoreEvent } from './entities/store-event.entity';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const STORE_IDS = [
  'store_alpha',
  'store_beta',
  'store_gamma',
  'store_delta',
  'store_epsilon',
];

const EVENT_TYPES = [
  'page_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'purchase',
] as const;

// Weighted distribution: more page views, fewer purchases (realistic funnel)
const EVENT_WEIGHTS = [50, 20, 5, 10, 15];

const PRODUCTS = [
  { id: 'prod_001', name: 'Wireless Earbuds Pro', priceRange: [29.99, 79.99] },
  { id: 'prod_002', name: 'Smart Watch Elite', priceRange: [149.99, 299.99] },
  { id: 'prod_003', name: 'Leather Laptop Bag', priceRange: [59.99, 129.99] },
  { id: 'prod_004', name: 'Organic Coffee Blend', priceRange: [12.99, 34.99] },
  { id: 'prod_005', name: 'Yoga Mat Premium', priceRange: [24.99, 69.99] },
  { id: 'prod_006', name: 'Bluetooth Speaker', priceRange: [39.99, 89.99] },
  { id: 'prod_007', name: 'Kitchen Knife Set', priceRange: [49.99, 149.99] },
  { id: 'prod_008', name: 'Running Shoes', priceRange: [79.99, 179.99] },
  { id: 'prod_009', name: 'Phone Case Ultra', priceRange: [14.99, 39.99] },
  { id: 'prod_010', name: 'Desk Lamp LED', priceRange: [22.99, 59.99] },
  { id: 'prod_011', name: 'Water Bottle Insulated', priceRange: [19.99, 44.99] },
  { id: 'prod_012', name: 'Notebook Journal', priceRange: [9.99, 24.99] },
  { id: 'prod_013', name: 'Sunglasses Aviator', priceRange: [49.99, 129.99] },
  { id: 'prod_014', name: 'Backpack Explorer', priceRange: [59.99, 139.99] },
  { id: 'prod_015', name: 'Wireless Charger Pad', priceRange: [19.99, 49.99] },
];

function pickWeighted<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generateEventData(eventType: string): Record<string, any> | null {
  const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];

  switch (eventType) {
    case 'page_view':
      return {
        page: ['/', '/products', '/product/' + product.id, '/cart', '/about'][
          Math.floor(Math.random() * 5)
        ],
        referrer: ['google', 'direct', 'social', 'email'][
          Math.floor(Math.random() * 4)
        ],
      };
    case 'add_to_cart':
    case 'remove_from_cart':
      return {
        product_id: product.id,
        product_name: product.name,
        amount: randomFloat(product.priceRange[0], product.priceRange[1]),
        currency: 'USD',
        quantity: Math.ceil(Math.random() * 3),
      };
    case 'checkout_started':
      return {
        cart_total: randomFloat(30, 500),
        currency: 'USD',
        item_count: Math.ceil(Math.random() * 5),
      };
    case 'purchase':
      return {
        product_id: product.id,
        product_name: product.name,
        amount: randomFloat(product.priceRange[0], product.priceRange[1]),
        currency: 'USD',
        quantity: Math.ceil(Math.random() * 3),
        order_id: 'ord_' + crypto.randomBytes(6).toString('hex'),
      };
    default:
      return null;
  }
}

async function seed() {
  console.log('🌱 Connecting to database...');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [StoreEvent],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Connected to database');

  // Run the migration SQL directly
  console.log('📦 Ensuring schema exists...');
  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS store_events (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id        VARCHAR(50) UNIQUE NOT NULL,
      store_id        VARCHAR(50) NOT NULL,
      event_type      VARCHAR(30) NOT NULL,
      timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data            JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await queryRunner.query(`
    CREATE INDEX IF NOT EXISTS idx_events_store_type_ts
    ON store_events (store_id, event_type, timestamp DESC);
  `);

  await queryRunner.query(`
    CREATE INDEX IF NOT EXISTS idx_events_store_ts
    ON store_events (store_id, timestamp DESC);
  `);

  await queryRunner.release();

  // Clear existing data
  console.log('🗑️  Clearing existing events...');
  await dataSource.getRepository(StoreEvent).clear();

  const TOTAL_EVENTS = 100_000;
  const BATCH_SIZE = 5000;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log(`🔄 Generating ${TOTAL_EVENTS.toLocaleString()} events across ${STORE_IDS.length} stores...`);

  let inserted = 0;

  for (let batch = 0; batch < Math.ceil(TOTAL_EVENTS / BATCH_SIZE); batch++) {
    const events: Partial<StoreEvent>[] = [];
    const batchCount = Math.min(BATCH_SIZE, TOTAL_EVENTS - inserted);

    for (let i = 0; i < batchCount; i++) {
      const eventType = pickWeighted(EVENT_TYPES, EVENT_WEIGHTS);
      const storeId = STORE_IDS[Math.floor(Math.random() * STORE_IDS.length)];

      // Generate timestamps weighted towards recent days
      const ageMs = Math.pow(Math.random(), 1.5) * (now.getTime() - thirtyDaysAgo.getTime());
      const timestamp = new Date(now.getTime() - ageMs);

      events.push({
        eventId: `evt_${crypto.randomBytes(12).toString('hex')}`,
        storeId,
        eventType,
        timestamp,
        data: generateEventData(eventType),
      });
    }

    await dataSource
      .createQueryBuilder()
      .insert()
      .into(StoreEvent)
      .values(events)
      .execute();

    inserted += batchCount;
    const pct = Math.round((inserted / TOTAL_EVENTS) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${inserted.toLocaleString()} / ${TOTAL_EVENTS.toLocaleString()})`);
  }

  console.log('\n✅ Events inserted');

  // Create/refresh materialized views
  console.log('📊 Creating materialized views...');

  await dataSource.query(`
    DROP MATERIALIZED VIEW IF EXISTS mv_daily_store_metrics;
    CREATE MATERIALIZED VIEW mv_daily_store_metrics AS
    SELECT
      store_id,
      DATE(timestamp) AS metric_date,
      event_type,
      COUNT(*) AS event_count,
      COALESCE(SUM((data->>'amount')::NUMERIC), 0) AS total_revenue
    FROM store_events
    GROUP BY store_id, DATE(timestamp), event_type;
  `);

  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily
    ON mv_daily_store_metrics (store_id, metric_date, event_type);
  `);

  await dataSource.query(`
    DROP MATERIALIZED VIEW IF EXISTS mv_top_products;
    CREATE MATERIALIZED VIEW mv_top_products AS
    SELECT
      store_id,
      data->>'product_id' AS product_id,
      data->>'product_name' AS product_name,
      COUNT(*) AS purchase_count,
      SUM((data->>'amount')::NUMERIC) AS total_revenue
    FROM store_events
    WHERE event_type = 'purchase'
    GROUP BY store_id, data->>'product_id', data->>'product_name';
  `);

  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_products
    ON mv_top_products (store_id, product_id);
  `);

  console.log('✅ Materialized views created');

  // Print summary
  const countResult = await dataSource.query(
    `SELECT store_id, event_type, COUNT(*) as cnt FROM store_events GROUP BY store_id, event_type ORDER BY store_id, event_type`,
  );

  console.log('\n📋 Summary by store and event type:');
  console.table(countResult);

  await dataSource.destroy();
  console.log('\n🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
