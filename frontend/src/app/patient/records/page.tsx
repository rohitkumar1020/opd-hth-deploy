'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function PatientRecordsPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'consultations' | 'prescriptions' | 'labs'>('consultations');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    (async () => {
      try {
        const patRes = await apiGet('/patients/me');
        setPatient(patRes.data);
        if (patRes.data?.id) {
          const histRes = await apiGet(`/patients/${patRes.data.id}/history`);
          setHistory(histRes.data);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  const consultations = history?.consultations || [];
  const prescriptions = consultations.flatMap((c: any) => c.prescriptions || []);
  const labOrders = consultations.flatMap((c: any) => c.labOrders || []);

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar"><Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link><span className="topbar-title">Medical Records</span><div></div></div>
      <div className="page-container" style={{ maxWidth: '700px' }}>
        <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
          <button className={`btn ${tab === 'consultations' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('consultations')}>Consultations</button>
          <button className={`btn ${tab === 'prescriptions' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('prescriptions')}>Prescriptions</button>
          <button className={`btn ${tab === 'labs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('labs')}>Lab Reports</button>
        </div>

        {tab === 'consultations' && (
          consultations.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><h3>No consultation records</h3></div> :
          consultations.map((c: any) => (
            <div key={c.id} className="card" style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-sm)' }}>
                <div><strong>{c.diagnosis || 'Consultation'}</strong><p className="text-xs text-muted">{c.doctor?.user?.name} • {c.doctor?.department?.name}</p></div>
                <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              {c.chiefComplaint && <p className="text-sm"><span className="text-muted">Complaint:</span> {c.chiefComplaint}</p>}
              {c.clinicalNotes && <p className="text-sm"><span className="text-muted">Notes:</span> {c.clinicalNotes}</p>}
              {c.treatmentPlan && <p className="text-sm"><span className="text-muted">Treatment:</span> {c.treatmentPlan}</p>}
              {c.token && <span className="badge badge-info">{c.token.displayToken}</span>}
            </div>
          ))
        )}

        {tab === 'prescriptions' && (
          prescriptions.length === 0 ? <div className="empty-state"><div className="empty-icon">💊</div><h3>No prescriptions</h3></div> :
          prescriptions.map((rx: any) => (
            <div key={rx.id} className="card" style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                <strong>Prescription</strong>
                <span className="text-xs text-muted">{new Date(rx.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                <tbody>
                  {(rx.items || []).map((item: any) => (
                    <tr key={item.id}><td>{item.medicineName}</td><td>{item.dosage}</td><td>{item.frequency}</td><td>{item.duration}</td></tr>
                  ))}
                </tbody>
              </table>
              {rx.notes && <p className="text-sm text-muted" style={{ marginTop: 'var(--space-sm)' }}>📝 {rx.notes}</p>}
            </div>
          ))
        )}

        {tab === 'labs' && (
          labOrders.length === 0 ? <div className="empty-state"><div className="empty-icon">🔬</div><h3>No lab reports</h3></div> :
          labOrders.map((lab: any) => (
            <div key={lab.id} className="card" style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between items-center">
                <div><strong>{lab.testName}</strong><p className="text-xs text-muted">{new Date(lab.createdAt).toLocaleDateString('en-IN')}</p></div>
                <span className={`badge ${lab.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{lab.status}</span>
              </div>
              {lab.reports?.map((r: any) => (
                <div key={r.id} style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                  {r.findings && <p className="text-sm"><strong>Findings:</strong> {r.findings}</p>}
                  {r.fileUrl && <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-xs)' }}>📄 View Report</a>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="mobile-nav"><div className="mobile-nav-items">
        <Link href="/patient" className="mobile-nav-item"><span className="nav-icon">🏠</span>Home</Link>
        <Link href="/patient/triage" className="mobile-nav-item"><span className="nav-icon">🩺</span>Consult</Link>
        <Link href="/patient/queue" className="mobile-nav-item"><span className="nav-icon">📋</span>Queue</Link>
        <Link href="/patient/records" className="mobile-nav-item active"><span className="nav-icon">📁</span>Records</Link>
        <Link href="/patient/profile" className="mobile-nav-item"><span className="nav-icon">👤</span>Profile</Link>
      </div></div>
    </div>
  );
}
