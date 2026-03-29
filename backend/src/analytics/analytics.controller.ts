import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { StoreId } from '../auth/store.decorator';
import { OverviewQueryDto } from './dto/overview-query.dto';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/analytics/overview
   * Returns aggregate metrics: revenue, event counts, conversion rate
   */
  @Get('overview')
  async getOverview(
    @StoreId() storeId: string,
    @Query() query: OverviewQueryDto,
  ) {
    return this.analyticsService.getOverview(storeId, query);
  }

  /**
   * GET /api/v1/analytics/top-products
   * Returns top 10 products by revenue
   */
  @Get('top-products')
  async getTopProducts(@StoreId() storeId: string) {
    return this.analyticsService.getTopProducts(storeId);
  }

  /**
   * GET /api/v1/analytics/recent-activity
   * Returns last 20 events
   */
  @Get('recent-activity')
  async getRecentActivity(@StoreId() storeId: string) {
    return this.analyticsService.getRecentActivity(storeId);
  }
}
