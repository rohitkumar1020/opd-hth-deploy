'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function PrescriptionsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    (async () => {
      try {
        const patRes = await apiGet('/patients/me');
        if (patRes.data?.id) {
          const rxRes = await apiGet(`/prescriptions/patient/${patRes.data.id}`);
          setPrescriptions(rxRes.data || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar"><Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link><span className="topbar-title">Prescriptions</span><div></div></div>
      <div className="page-container" style={{ maxWidth: '700px' }}>
        {prescriptions.length === 0 ? <div className="empty-state"><div className="empty-icon">💊</div><h3>No prescriptions yet</h3></div> :
          prescriptions.map((rx: any) => (
            <div key={rx.id} className="card" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                <div><strong>{rx.consultation?.diagnosis || 'Prescription'}</strong><p className="text-xs text-muted">Dr. {rx.doctor?.user?.name} • {rx.doctor?.department?.name}</p></div>
                <span className="text-xs text-muted">{new Date(rx.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              <table className="data-table"><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                <tbody>{(rx.items || []).map((item: any) => (<tr key={item.id}><td><strong>{item.medicineName}</strong></td><td>{item.dosage}</td><td>{item.frequency}</td><td>{item.duration}</td><td className="text-sm">{item.instructions || '—'}</td></tr>))}</tbody>
              </table>
              {rx.notes && <p className="text-sm text-muted" style={{ marginTop: 'var(--space-sm)' }}>📝 {rx.notes}</p>}
            </div>
          ))
        }
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
