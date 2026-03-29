import React from 'react';
import { Users } from 'lucide-react';

export const LiveVisitors: React.FC<{ count: number }> = ({ count }) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
      <div style={{ 
        background: 'rgba(16, 185, 129, 0.1)', 
        color: 'var(--success)', 
        padding: '12px', 
        borderRadius: '12px',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: 'var(--success)', borderRadius: '50%', transform: 'translate(30%, -30%)', boxShadow: '0 0 10px var(--success)', animation: 'pulse-live 2s infinite' }} />
        <Users size={24} />
      </div>
      <div>
        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0, marginBottom: '4px' }}>Active Visitors</h4>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          {count}
          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>right now</span>
        </div>
      </div>
    </div>
  );
};
