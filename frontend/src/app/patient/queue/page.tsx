'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getSocket, joinRoom } from '@/lib/socket';
import Link from 'next/link';

export default function PatientQueuePage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const patRes = await apiGet('/patients/me');
      if (!patRes.data?.id) return;

      const tokenRes = await apiGet(`/queue/patient/${patRes.data.id}/active`);
      setToken(tokenRes.data);

      if (tokenRes.data?.departmentId) {
        const queueRes = await apiGet(`/queue/department/${tokenRes.data.departmentId}`);
        setQueue(queueRes.data || []);

        const socket = getSocket();
        if (tokenRes.data.hospitalId) joinRoom(`hospital:${tokenRes.data.hospitalId}`);
        socket.on('queue:updated', () => {
          apiGet(`/queue/department/${tokenRes.data.departmentId}`).then(r => setQueue(r.data || []));
          apiGet(`/queue/patient/${patRes.data.id}/active`).then(r => setToken(r.data));
        });
        socket.on('token:called', (data: any) => {
          if (data.tokenId === tokenRes.data?.id) alert('🔔 Your token has been called! Please proceed.');
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    fetchData();
  }, [authLoading, isAuthenticated, router, fetchData]);

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar">
        <Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link>
        <span className="topbar-title">Live Queue</span>
        <div></div>
      </div>

      <div className="page-container" style={{ maxWidth: '600px' }}>
        {!token ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Active Token</h3>
            <p className="text-muted">You don&apos;t have an active token. Start a consultation to get one.</p>
            <Link href="/patient/triage" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>🩺 Start Consultation</Link>
          </div>
        ) : (
          <div>
            <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center', borderLeft: `4px solid var(--primary)` }}>
              <p className="text-xs text-muted">Your Token</p>
              <p className="font-mono font-bold" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>{token.displayToken}</p>
              <span className={`badge badge-${token.priority?.toLowerCase()}`} style={{ marginBottom: 'var(--space-md)' }}>{token.priority}</span>
              <div className="flex justify-between" style={{ marginTop: 'var(--space-md)' }}>
                <div><p className="text-xs text-muted">Patients Ahead</p><p className="font-bold" style={{ fontSize: '1.5rem' }}>{token.patientsAhead ?? '—'}</p></div>
                <div><p className="text-xs text-muted">Est. Wait</p><p className="font-bold" style={{ fontSize: '1.5rem' }}>{token.estimatedWaitMinutes ?? '—'} min</p></div>
                <div><p className="text-xs text-muted">Status</p><p><span className={`badge status-${token.status?.toLowerCase().replace('_', '-')}`}>{token.status?.replace('_', ' ')}</span></p></div>
              </div>
            </div>

            <h4 style={{ marginBottom: 'var(--space-md)' }}>Queue — {token.department?.name}</h4>
            {queue.map((t, i) => (
              <div key={t.id} className={`token-card ${t.id === token.id ? '' : ''} ${t.priority === 'EMERGENCY' ? 'emergency' : ''}`} style={{
                marginBottom: 'var(--space-sm)',
                background: t.id === token.id ? 'var(--primary-bg)' : 'var(--bg-card)',
                border: t.id === token.id ? '2px solid var(--primary)' : undefined,
              }}>
                <div className="token-number" style={{ color: t.id === token.id ? 'var(--primary)' : 'var(--text-primary)' }}>{t.displayToken}</div>
                <div className="token-info">
                  <div className="token-patient">{t.id === token.id ? `${t.patient?.user?.name} (You)` : `Patient ${i + 1}`}</div>
                  <div className="token-meta">{t.doctor?.user?.name || 'Doctor'}</div>
                </div>
                <span className={`badge status-${t.status?.toLowerCase().replace('_', '-')}`}>{t.status?.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mobile-nav">
        <div className="mobile-nav-items">
          <Link href="/patient" className="mobile-nav-item"><span className="nav-icon">🏠</span>Home</Link>
          <Link href="/patient/triage" className="mobile-nav-item"><span className="nav-icon">🩺</span>Consult</Link>
          <Link href="/patient/queue" className="mobile-nav-item active"><span className="nav-icon">📋</span>Queue</Link>
          <Link href="/patient/records" className="mobile-nav-item"><span className="nav-icon">📁</span>Records</Link>
          <Link href="/patient/profile" className="mobile-nav-item"><span className="nav-icon">👤</span>Profile</Link>
        </div>
      </div>
    </div>
  );
}
