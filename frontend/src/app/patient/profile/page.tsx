'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ dateOfBirth: '', gender: '', bloodGroup: '', address: '', city: '', state: '', pinCode: '', emergencyContact: '', allergies: '', currentMedicines: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    (async () => {
      try {
        const res = await apiGet('/patients/me');
        setPatient(res.data);
        if (res.data) {
          setForm({
            dateOfBirth: res.data.dateOfBirth ? res.data.dateOfBirth.split('T')[0] : '',
            gender: res.data.gender || '', bloodGroup: res.data.bloodGroup || '',
            address: res.data.address || '', city: res.data.city || '',
            state: res.data.state || '', pinCode: res.data.pinCode || '',
            emergencyContact: res.data.emergencyContact || '',
            allergies: res.data.allergies || '', currentMedicines: res.data.currentMedicines || '',
          });
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [authLoading, isAuthenticated, router]);

  const handleSave = async () => {
    try {
      await apiPut('/patients/me', form);
      setEditing(false);
      const res = await apiGet('/patients/me');
      setPatient(res.data);
    } catch (err: any) { alert(err.message); }
  };

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar"><Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link><span className="topbar-title">My Profile</span><div></div></div>
      <div className="page-container" style={{ maxWidth: '600px' }}>
        <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto var(--space-md)' }}>
            {user?.name?.[0] || '?'}
          </div>
          <h3>{user?.name}</h3>
          <p className="text-sm text-muted">{user?.email}</p>
          <p className="text-sm text-muted">{user?.phone}</p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
            <h4>Health Information</h4>
            <button onClick={() => editing ? handleSave() : setEditing(true)} className={`btn ${editing ? 'btn-success' : 'btn-outline'} btn-sm`}>
              {editing ? '💾 Save' : '✏️ Edit'}
            </button>
          </div>

          <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
            {[
              { label: 'Date of Birth', field: 'dateOfBirth', type: 'date' },
              { label: 'Gender', field: 'gender', type: 'select', options: ['MALE', 'FEMALE', 'OTHER'] },
              { label: 'Blood Group', field: 'bloodGroup' },
              { label: 'Emergency Contact', field: 'emergencyContact' },
              { label: 'Address', field: 'address' },
              { label: 'City', field: 'city' },
              { label: 'State', field: 'state' },
              { label: 'PIN Code', field: 'pinCode' },
              { label: 'Allergies', field: 'allergies' },
              { label: 'Current Medicines', field: 'currentMedicines' },
            ].map(({ label, field, type, options }) => (
              <div key={field} className="form-group">
                <label className="form-label">{label}</label>
                {editing ? (
                  type === 'select' ? (
                    <select className="form-select" value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}>
                      <option value="">Select</option>
                      {options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={type || 'text'} className="form-input" value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
                  )
                ) : (
                  <p style={{ fontWeight: 500 }}>{(patient as any)?.[field] || '—'}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={logout} className="btn btn-danger btn-full">Logout</button>
      </div>

      <div className="mobile-nav"><div className="mobile-nav-items">
        <Link href="/patient" className="mobile-nav-item"><span className="nav-icon">🏠</span>Home</Link>
        <Link href="/patient/triage" className="mobile-nav-item"><span className="nav-icon">🩺</span>Consult</Link>
        <Link href="/patient/queue" className="mobile-nav-item"><span className="nav-icon">📋</span>Queue</Link>
        <Link href="/patient/records" className="mobile-nav-item"><span className="nav-icon">📁</span>Records</Link>
        <Link href="/patient/profile" className="mobile-nav-item active"><span className="nav-icon">👤</span>Profile</Link>
      </div></div>
    </div>
  );
}
