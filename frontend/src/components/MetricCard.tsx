import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, delay = 0 }) => {
  return (
    <div 
      className="glass-panel animate-fade-in" 
      style={{ padding: '24px', animationDelay: \`\${delay}ms\` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{title}</p>
        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-primary)' }}>
          {icon}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0 }}>{value}</h3>
        
        {trend && (
          <span style={{ 
            fontSize: '0.875rem', 
            fontWeight: 500,
            color: trend.isPositive ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: trend.isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {trend.isPositive ? '↑' : '↓'}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
};
