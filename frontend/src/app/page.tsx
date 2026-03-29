'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowRight, Loader } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [storeId, setStoreId] = useState('store_alpha');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          storeName: storeId.replace('store_', '').toUpperCase() + ' Store',
        }),
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      
      // Store token
      localStorage.setItem('amboras_token', data.access_token);
      localStorage.setItem('amboras_store_id', data.store_id);
      localStorage.setItem('amboras_store_name', data.store_name);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '400px', width: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', marginBottom: '16px' }}>
            <Store size={32} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Welcome to <span className="gradient-text">Amboras</span></h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Sign in to your store dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Store ID</label>
            <select
              title='Store selector'
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="input-field"
              style={{ appearance: 'none', cursor: 'pointer' }}
            >
              <option value="store_alpha">Store Alpha (Demo)</option>
              <option value="store_beta">Store Beta (Demo)</option>
              <option value="store_gamma">Store Gamma (Demo)</option>
              <option value="store_delta">Store Delta (Demo)</option>
              <option value="store_epsilon">Store Epsilon (Demo)</option>
            </select>
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : (
              <>
                Access Dashboard
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    </div>
  );
}
