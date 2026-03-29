import React from 'react';
import { ShoppingCart, Eye, CreditCard, Crosshair, PackageX } from 'lucide-react';
import { formatTime, formatCurrency } from '../lib/formatters';

interface RecentActivityProps {
  events: any[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ events }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <CreditCard size={16} color="var(--success)" />;
      case 'page_view': return <Eye size={16} color="var(--accent-secondary)" />;
      case 'add_to_cart': return <ShoppingCart size={16} color="var(--accent-primary)" />;
      case 'checkout_started': return <Crosshair size={16} color="#eab308" />;
      case 'remove_from_cart': return <PackageX size={16} color="var(--danger)" />;
      default: return <Eye size={16} />;
    }
  };

  const getEventDescription = (event: any) => {
    const data = event.data || {};
    switch (event.eventType) {
      case 'purchase':
        return <span>Purchased <b>{data.product_name}</b> for {formatCurrency(data.amount)}</span>;
      case 'page_view':
        return <span>Viewed <b>{data.page}</b> (from {data.referrer})</span>;
      case 'add_to_cart':
        return <span>Added <b>{data.product_name}</b> to cart</span>;
      case 'checkout_started':
        return <span>Started checkout ({formatCurrency(data.cart_total)})</span>;
      case 'remove_from_cart':
        return <span>Removed <b>{data.product_name}</b> from cart</span>;
      default:
        return <span>Unknown activity</span>;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Recent Activity</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--success)' }}>
          <span className="live-indicator"></span> Live
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        {events?.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '24px' }}>
            Listening for events...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {events?.map((event) => (
              <div 
                key={event.eventId} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  animation: 'fadeIn 0.5s',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  width: '32px', height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getEventIcon(event.eventType)}
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {getEventDescription(event)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
