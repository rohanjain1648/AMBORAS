import React from 'react';
import { formatCurrency, formatNumber } from '../lib/formatters';

interface TopProductsTableProps {
  products: any[];
}

export const TopProductsTable: React.FC<TopProductsTableProps> = ({ products }) => {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '24px' }}>Top Products</h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Product</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, textAlign: 'right' }}>Sales</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '32px', height: '32px', 
                    borderRadius: '6px', 
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', color: 'var(--text-muted)'
                  }}>
                    #{i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{product.productName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{product.productId}</div>
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>{formatNumber(product.purchaseCount)}</td>
                <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                  {formatCurrency(product.revenue)}
                </td>
              </tr>
            ))}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No product data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
