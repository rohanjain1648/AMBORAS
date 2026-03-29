import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  period: string;
  onChange: (period: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ period, onChange }) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', overflow: 'hidden', borderRadius: '8px', padding: '4px' }}>
      {(['today', 'week', 'month'] as const).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '8px 16px',
            background: period === p ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: period === p ? 'white' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'capitalize'
          }}
        >
          {p === 'month' && <Calendar size={14} />}
          {p}
        </button>
      ))}
    </div>
  );
};
