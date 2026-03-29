'use client';

import { useState } from 'react';
import { useOverview, useTopProducts } from '../lib/hooks/useAnalytics';
import { useEventStream } from '../lib/hooks/useEventStream';
import { MetricCard } from '../components/MetricCard';
import { RevenueChart } from '../components/RevenueChart';
import { TopProductsTable } from '../components/TopProductsTable';
import { RecentActivity } from '../components/RecentActivity';
import { LiveVisitors } from '../components/LiveVisitors';
import { DateRangePicker } from '../components/DateRangePicker';
import { formatCurrency, formatNumber } from '../lib/formatters';
import { DollarSign, MousePointerClick, ShoppingBag, TrendingUp, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');

  // Fetch REST API Aggregates
  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useOverview(period);
  const { data: topProducts, isLoading: productsLoading } = useTopProducts();

  // Listen to SSE Stream
  const { events, visitors } = useEventStream(20);

  if (overviewError) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--danger)' }}>
        Failed to load dashboard data. Ensure backend is running.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header bar */}
      <div className="header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, color: 'white' }}>Store Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Monitor your real-time analytics and activity.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <LiveVisitors count={visitors} />
          <DateRangePicker period={period} onChange={setPeriod} />
        </div>
      </div>

      {overviewLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <Loader2 size={48} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="dashboard-grid">
            <div className="col-span-3">
              <MetricCard 
                title="Total Revenue" 
                value={formatCurrency(overview?.revenue?.[period] || 0)} 
                icon={<DollarSign size={24} />}
                trend={{ value: 12.5, isPositive: true }}
                delay={100}
              />
            </div>
            <div className="col-span-3">
              <MetricCard 
                title="Total Orders" 
                value={formatNumber(overview?.eventCounts?.purchase || 0)} 
                icon={<ShoppingBag size={24} />}
                trend={{ value: 4.2, isPositive: true }}
                delay={200}
              />
            </div>
            <div className="col-span-3">
              <MetricCard 
                title="Conversion Rate" 
                value={(overview?.conversionRate || 0) + '%'} 
                icon={<TrendingUp size={24} />}
                trend={{ value: 1.1, isPositive: false }}
                delay={300}
              />
            </div>
            <div className="col-span-3">
              <MetricCard 
                title="Total Events" 
                value={formatNumber(overview?.totalEvents || 0)} 
                icon={<MousePointerClick size={24} />}
                delay={400}
              />
            </div>
          </div>

          {/* Main Charts & Feeds */}
          <div className="dashboard-grid" style={{ alignItems: 'stretch' }}>
            <div className="col-span-8">
              <RevenueChart data={overview?.revenueTrend || []} />
            </div>
            <div className="col-span-4" style={{ maxHeight: '400px' }}>
              <RecentActivity events={events} />
            </div>
          </div>

          {/* Bottom row */}
          <div className="dashboard-grid">
            <div className="col-span-12">
              <TopProductsTable products={topProducts || []} />
            </div>
          </div>
        </>
      )}
      
      <style dangerouslySetInnerHTML={{__html: \`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      \`}} />
    </div>
  );
}
