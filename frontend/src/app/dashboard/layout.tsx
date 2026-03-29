'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, LayoutDashboard, Activity, Settings, LogOut } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('amboras_token');
    if (!token) {
      router.push('/');
      return;
    }
    setStoreName(localStorage.getItem('amboras_store_name') || 'Store');
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  if (!isMounted) return null;

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', padding: '8px', borderRadius: '8px', color: 'white' }}>
            <Store size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Amboras</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{storeName}</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 500 }}>
            <LayoutDashboard size={20} /> Overview
          </a>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', color: 'var(--text-muted)', transition: 'color 0.2s' }}>
            <Activity size={20} /> Live Feed
          </a>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', color: 'var(--text-muted)', transition: 'color 0.2s' }}>
            <Settings size={20} /> Settings
          </a>
        </nav>

        <button 
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', marginTop: 'auto' }}
        >
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
