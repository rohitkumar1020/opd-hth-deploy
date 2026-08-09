'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { getSocket, joinRoom } from '@/lib/socket';

export default function ReceptionDashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', password: 'Walk@1234', dateOfBirth: '', gender: 'MALE' });
  const [tokenForm, setTokenForm] = useState({ patientId: '', departmentId: '', priority: 'NORMAL' });
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.hospitalId) return;
    try {
      const [deptRes] = await Promise.all([
        apiGet(`/departments/hospital/${user.hospitalId}`),
      ]);
      setDepartments(deptRes.data || []);

      // Load queue for all departments
      const allQueues: any[] = [];
      for (const dept of (deptRes.data || []).slice(0, 5)) {
        try {
          const qRes = await apiGet(`/queue/department/${dept.id}`);
          allQueues.push(...(qRes.data || []));
        } catch { /* skip */ }
      }
      setQueue(allQueues);

      const socket = getSocket();
      joinRoom(`hospital:${user.hospitalId}`);
      socket.on('queue:updated', fetchData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'RECEPTIONIST') { router.replace('/auth/login'); return; }
    fetchData();
  }, [authLoading, isAuthenticated, user, router, fetchData]);

  const searchPatients = async () => {
    if (searchQuery.length < 2) return;
    try {
      const res = await apiGet(`/patients/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data || []);
    } catch (err: any) { setError(err.message); }
  };

  const handleRegister = async () => {
    setError('');
    if (!regForm.name || !regForm.email) { setError('Name and email are required'); return; }
    try {
      const res = await apiPost('/auth/register', { ...regForm, role: 'PATIENT', hospitalId: user?.hospitalId });
      setShowRegister(false);
      setTokenForm(prev => ({ ...prev, patientId: res.data.user.id }));
      alert(`Patient registered: ${regForm.name}. Now create a token.`);
      setRegForm({ name: '', email: '', phone: '', password: 'Walk@1234', dateOfBirth: '', gender: 'MALE' });
      // Note: we need the Patient record ID, not user ID. We'll need to look it up.
      const patRes = await apiGet(`/patients/search?q=${encodeURIComponent(regForm.email)}`);
      if (patRes.data?.length > 0) {
        setTokenForm(prev => ({ ...prev, patientId: patRes.data[0].id }));
        setShowTokenForm(true);
      }
    } catch (err: any) { setError(err.message); }
  };

  const handleCreateToken = async () => {
    setError('');
    if (!tokenForm.patientId || !tokenForm.departmentId) { setError('Patient and department are required'); return; }
    try {
      await apiPost('/queue/token', {
        patientId: tokenForm.patientId,
        hospitalId: user?.hospitalId,
        departmentId: tokenForm.departmentId,
        priority: tokenForm.priority,
      });
      setShowTokenForm(false);
      setTokenForm({ patientId: '', departmentId: '', priority: 'NORMAL' });
      fetchData();
    } catch (err: any) { setError(err.message); }
  };

  const handleCallToken = async (tokenId: string) => {
    try { await apiPatch(`/queue/token/${tokenId}/call`); fetchData(); }
    catch (err: any) { alert(err.message); }
  };

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><span>🏥</span> SwasthAI</div>
          <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Reception Desk</p>
        </div>
        <nav className="sidebar-nav">
          <a className={`sidebar-link ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>📋 Queue</a>
          <a className={`sidebar-link ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>➕ Register Patient</a>
          <a className={`sidebar-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>🔍 Search Patient</a>
        </nav>
        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
          <p className="text-sm font-bold">{user?.name}</p>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)', width: '100%' }}>Logout</button>
        </div>
      </div>

      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Reception Dashboard</span>
          <button onClick={() => { setShowTokenForm(true); setError(''); }} className="btn btn-primary">🎫 Create Token</button>
        </div>

        <div className="page-container">
          {error && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

          {/* Token Creation Modal */}
          {showTokenForm && (
            <div className="card" style={{ marginBottom: 'var(--space-lg)', border: '2px solid var(--primary)' }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Create OPD Token</h4>
              <div className="grid grid-3" style={{ gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Patient ID</label>
                  <input className="form-input" value={tokenForm.patientId} onChange={e => setTokenForm(p => ({ ...p, patientId: e.target.value }))} placeholder="Patient ID (from search)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={tokenForm.departmentId} onChange={e => setTokenForm(p => ({ ...p, departmentId: e.target.value }))}>
                    <option value="">Select</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={tokenForm.priority} onChange={e => setTokenForm(p => ({ ...p, priority: e.target.value }))}>
                    <option value="NORMAL">Normal</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-sm">
                <button onClick={handleCreateToken} className="btn btn-primary">Create Token</button>
                <button onClick={() => setShowTokenForm(false)} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}

          {/* Queue View */}
          {activeTab === 'queue' && (
            <div>
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Today&apos;s Queue</h3>
              {queue.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📋</div><h3>No patients in queue</h3></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Token</th><th>Patient</th><th>Department</th><th>Doctor</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {queue.map(t => (
                      <tr key={t.id}>
                        <td><span className="font-mono font-bold">{t.displayToken}</span></td>
                        <td>{t.patient?.user?.name}</td>
                        <td>{t.department?.name || '—'}</td>
                        <td>{t.doctor?.user?.name || 'Auto'}</td>
                        <td><span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                        <td><span className={`badge status-${t.status?.toLowerCase().replace('_', '-')}`}>{t.status?.replace('_', ' ')}</span></td>
                        <td>{t.status === 'WAITING' && <button onClick={() => handleCallToken(t.id)} className="btn btn-primary btn-sm">📢 Call</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Register */}
          {activeTab === 'register' && (
            <div className="card" style={{ maxWidth: '600px' }}>
              <h3 style={{ marginBottom: 'var(--space-lg)' }}>Register Walk-in Patient</h3>
              <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={regForm.name} onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Gender</label>
                  <select className="form-select" value={regForm.gender} onChange={e => setRegForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-input" value={regForm.dateOfBirth} onChange={e => setRegForm(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
              </div>
              <button onClick={handleRegister} className="btn btn-primary btn-lg">Register Patient</button>
            </div>
          )}

          {/* Search */}
          {activeTab === 'search' && (
            <div>
              <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Search by name, email, or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                <button onClick={searchPatients} className="btn btn-primary">🔍 Search</button>
              </div>
              {searchResults.length > 0 && (
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
                  <tbody>
                    {searchResults.map((p: any) => (
                      <tr key={p.id}>
                        <td><strong>{p.user?.name}</strong></td>
                        <td>{p.user?.email}</td>
                        <td>{p.user?.phone || '—'}</td>
                        <td><button onClick={() => { setTokenForm(prev => ({ ...prev, patientId: p.id })); setShowTokenForm(true); setActiveTab('queue'); }} className="btn btn-primary btn-sm">🎫 Create Token</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
