import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { StoreEvent } from '../database/entities/store-event.entity';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(StoreEvent)
    private readonly eventRepo: Repository<StoreEvent>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null,
  ) {}

  /**
   * Get date range boundaries based on period
   */
  private getDateRange(query: OverviewQueryDto): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (query.period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (query.startDate && query.endDate) {
          start = new Date(query.startDate);
          return { start, end: new Date(query.endDate) };
        }
        // Fall through to month if custom dates not provided
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return { start, end };
  }

  /**
   * Try to get from Redis cache, if available
   */
  private async getCached<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set Redis cache with TTL
   */
  private async setCache(key: string, data: any, ttlSeconds = 60): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
      // Silently fail — cache is optional
    }
  }

  /**
   * GET /analytics/overview
   * Uses materialized view for fast aggregation
   */
  async getOverview(storeId: string, query: OverviewQueryDto) {
    const cacheKey = `analytics:overview:${storeId}:${query.period}:${query.startDate || ''}:${query.endDate || ''}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const { start, end } = this.getDateRange(query);

    // Revenue by period (today, week, month) from materialized view
    const revenueData = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(CASE WHEN metric_date = CURRENT_DATE THEN total_revenue ELSE 0 END), 0) AS revenue_today,
        COALESCE(SUM(CASE WHEN metric_date >= CURRENT_DATE - INTERVAL '7 days' THEN total_revenue ELSE 0 END), 0) AS revenue_week,
        COALESCE(SUM(total_revenue), 0) AS revenue_month
      FROM mv_daily_store_metrics
      WHERE store_id = $1
        AND event_type = 'purchase'
        AND metric_date >= $2::date
        AND metric_date <= $3::date`,
      [storeId, start.toISOString(), end.toISOString()],
    );

    // Event counts by type from materialized view
    const eventCounts = await this.dataSource.query(
      `SELECT
        event_type,
        COALESCE(SUM(event_count), 0)::INTEGER AS count
      FROM mv_daily_store_metrics
      WHERE store_id = $1
        AND metric_date >= $2::date
        AND metric_date <= $3::date
      GROUP BY event_type`,
      [storeId, start.toISOString(), end.toISOString()],
    );

    // Daily revenue trend for charts
    const revenueTrend = await this.dataSource.query(
      `SELECT
        metric_date as date,
        COALESCE(SUM(total_revenue), 0) AS revenue,
        COALESCE(SUM(event_count), 0)::INTEGER AS events
      FROM mv_daily_store_metrics
      WHERE store_id = $1
        AND event_type = 'purchase'
        AND metric_date >= $2::date
        AND metric_date <= $3::date
      GROUP BY metric_date
      ORDER BY metric_date ASC`,
      [storeId, start.toISOString(), end.toISOString()],
    );

    // Build event counts map
    const eventCountsMap: Record<string, number> = {};
    for (const row of eventCounts) {
      eventCountsMap[row.event_type] = parseInt(row.count, 10);
    }

    // Calculate conversion rate
    const pageViews = eventCountsMap['page_view'] || 0;
    const purchases = eventCountsMap['purchase'] || 0;
    const conversionRate = pageViews > 0
      ? Math.round((purchases / pageViews) * 10000) / 100
      : 0;

    const result = {
      revenue: {
        today: parseFloat(revenueData[0]?.revenue_today || '0'),
        week: parseFloat(revenueData[0]?.revenue_week || '0'),
        month: parseFloat(revenueData[0]?.revenue_month || '0'),
      },
      eventCounts: eventCountsMap,
      conversionRate,
      totalEvents: Object.values(eventCountsMap).reduce((a: number, b: number) => a + b, 0),
      revenueTrend: revenueTrend.map((r: any) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        events: parseInt(r.events, 10),
      })),
      period: query.period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
    };

    await this.setCache(cacheKey, result, 60);
    return result;
  }

  /**
   * GET /analytics/top-products
   * Uses materialized view for top products
   */
  async getTopProducts(storeId: string) {
    const cacheKey = `analytics:top-products:${storeId}`;
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const products = await this.dataSource.query(
      `SELECT
        product_id,
        product_name,
        purchase_count::INTEGER,
        total_revenue
      FROM mv_top_products
      WHERE store_id = $1
      ORDER BY total_revenue DESC
      LIMIT 10`,
      [storeId],
    );

    const result = products.map((p: any) => ({
      productId: p.product_id,
      productName: p.product_name || p.product_id,
      purchaseCount: parseInt(p.purchase_count, 10),
      revenue: parseFloat(p.total_revenue),
    }));

    await this.setCache(cacheKey, result, 60);
    return result;
  }

  /**
   * GET /analytics/recent-activity
   * Direct query on raw events table (small result set, always fresh)
   */
  async getRecentActivity(storeId: string) {
    const events = await this.eventRepo.find({
      where: { storeId },
      order: { timestamp: 'DESC' },
      take: 20,
    });

    return events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      timestamp: e.timestamp,
      data: e.data,
    }));
  }
}
