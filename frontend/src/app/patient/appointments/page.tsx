'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function AppointmentsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    (async () => {
      try {
        const patRes = await apiGet('/patients/me');
        if (patRes.data?.id) {
          const histRes = await apiGet(`/patients/${patRes.data.id}/history`);
          setTokens(histRes.data?.consultations || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar"><Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link><span className="topbar-title">My Appointments</span><div></div></div>
      <div className="page-container" style={{ maxWidth: '600px' }}>
        {tokens.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📅</div><h3>No appointments yet</h3><p className="text-muted">Your consultation history will appear here.</p>
            <Link href="/patient/triage" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }}>🩺 Start Consultation</Link>
          </div>
        ) : (
          tokens.map((c: any) => (
            <div key={c.id} className="card" style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between items-center">
                <div>
                  <strong>{c.diagnosis || c.chiefComplaint || 'Consultation'}</strong>
                  <p className="text-xs text-muted">Dr. {c.doctor?.user?.name} • {c.doctor?.department?.name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${c.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>{c.status}</span>
                  <p className="text-xs text-muted" style={{ marginTop: '4px' }}>{new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              {c.followUpDate && <p className="text-sm" style={{ marginTop: 'var(--space-sm)' }}>📅 Follow-up: {new Date(c.followUpDate).toLocaleDateString('en-IN')}</p>}
            </div>
          ))
        )}
      </div>
      <div className="mobile-nav"><div className="mobile-nav-items">
        <Link href="/patient" className="mobile-nav-item"><span className="nav-icon">🏠</span>Home</Link>
        <Link href="/patient/triage" className="mobile-nav-item"><span className="nav-icon">🩺</span>Consult</Link>
        <Link href="/patient/queue" className="mobile-nav-item"><span className="nav-icon">📋</span>Queue</Link>
        <Link href="/patient/records" className="mobile-nav-item"><span className="nav-icon">📁</span>Records</Link>
        <Link href="/patient/profile" className="mobile-nav-item"><span className="nav-icon">👤</span>Profile</Link>
      </div></div>
    </div>
  );
}
