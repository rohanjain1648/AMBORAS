import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1711600000000 implements MigrationInterface {
  name = 'InitialSchema1711600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create store_events table
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

    // Strategic indexes for analytics queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_store_type_ts
      ON store_events (store_id, event_type, timestamp DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_store_ts
      ON store_events (store_id, timestamp DESC);
    `);

    // Materialized view: daily aggregated metrics per store
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_store_metrics AS
      SELECT
        store_id,
        DATE(timestamp) AS metric_date,
        event_type,
        COUNT(*) AS event_count,
        COALESCE(SUM((data->>'amount')::NUMERIC), 0) AS total_revenue
      FROM store_events
      GROUP BY store_id, DATE(timestamp), event_type;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily
      ON mv_daily_store_metrics (store_id, metric_date, event_type);
    `);

    // Materialized view: top products per store
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_products AS
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

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_products
      ON mv_top_products (store_id, product_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_top_products;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_daily_store_metrics;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_store_ts;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_store_type_ts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS store_events;`);
  }
}
