import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Refresh materialized views every 60 seconds.
   * Uses CONCURRENTLY to avoid blocking reads while refreshing.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshMaterializedViews(): Promise<void> {
    const start = Date.now();
    try {
      await this.dataSource.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_store_metrics`,
      );
      await this.dataSource.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products`,
      );
      const duration = Date.now() - start;
      this.logger.log(`Materialized views refreshed in ${duration}ms`);
    } catch (error: any) {
      this.logger.error(`Failed to refresh materialized views: ${error.message}`);
    }
  }
}
