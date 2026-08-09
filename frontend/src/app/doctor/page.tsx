'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { getSocket, joinRoom } from '@/lib/socket';
import Link from 'next/link';

export default function DoctorDashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'queue' | 'consultation'>('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [triageData, setTriageData] = useState<any>(null);
  const [consultForm, setConsultForm] = useState({ chiefComplaint: '', history: '', clinicalNotes: '', diagnosis: '', treatmentPlan: '', followUpDate: '' });
  const [rxItems, setRxItems] = useState([{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const [labTest, setLabTest] = useState({ testName: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const profileRes = await apiGet(`/doctors/user/${user?.id}`);
      setDoctorProfile(profileRes.data);

      const [queueRes, statsRes] = await Promise.all([
        apiGet(`/queue/doctor/${profileRes.data.id}`),
        apiGet(`/analytics/doctor/${profileRes.data.id}`),
      ]);
      setQueue(queueRes.data || []);
      setStats(statsRes.data);

      // Socket setup
      const socket = getSocket();
      if (user?.hospitalId) joinRoom(`hospital:${user.hospitalId}`);
      joinRoom(`doctor:${profileRes.data.id}`);

      socket.on('queue:updated', () => {
        apiGet(`/queue/doctor/${profileRes.data.id}`).then(r => setQueue(r.data || []));
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || (user?.role !== 'DOCTOR' && user?.role !== 'NURSE')) { router.replace('/auth/login'); return; }
    fetchData();
  }, [authLoading, isAuthenticated, user, router, fetchData]);

  const handleCallNext = async (tokenId: string) => {
    setActionLoading(tokenId);
    try {
      await apiPatch(`/queue/token/${tokenId}/call`);
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleStartConsultation = async (token: any) => {
    setActionLoading(token.id);
    try {
      await apiPatch(`/queue/token/${token.id}/start`);
      // Load patient data
      const patRes = await apiGet(`/patients/${token.patientId}`);
      setSelectedPatient(patRes.data);
      setSelectedToken(token);

      // Load triage
      if (token.triageId) {
        try {
          const triageRes = await apiGet(`/triage/${token.triageId}`);
          setTriageData(triageRes.data);
        } catch { /* no triage */ }
      } else {
        // Try latest triage
        try {
          const triageRes = await apiGet(`/triage/patient/${token.patientId}`);
          if (triageRes.data?.length > 0) setTriageData(triageRes.data[0]);
        } catch { /* no triage */ }
      }

      setActiveView('consultation');
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleCompleteConsultation = async () => {
    if (!selectedToken || !doctorProfile) return;
    setActionLoading('complete');
    try {
      // Create consultation
      const consultRes = await apiPost('/consultations', {
        tokenId: selectedToken.id,
        patientId: selectedToken.patientId,
        ...consultForm,
        status: 'COMPLETED',
      });

      // Create prescription if items filled
      const validItems = rxItems.filter(i => i.medicineName.trim());
      if (validItems.length > 0) {
        await apiPost('/prescriptions', {
          consultationId: consultRes.data.id,
          patientId: selectedToken.patientId,
          items: validItems,
        });
      }

      // Create lab order if test specified
      if (labTest.testName.trim()) {
        await apiPost('/labs/order', {
          consultationId: consultRes.data.id,
          patientId: selectedToken.patientId,
          testName: labTest.testName,
          notes: labTest.notes,
        });
      }

      // Complete token
      await apiPatch(`/queue/token/${selectedToken.id}/complete`);

      // Reset
      setActiveView('dashboard');
      setSelectedPatient(null);
      setSelectedToken(null);
      setTriageData(null);
      setConsultForm({ chiefComplaint: '', history: '', clinicalNotes: '', diagnosis: '', treatmentPlan: '', followUpDate: '' });
      setRxItems([{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
      setLabTest({ testName: '', notes: '' });
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleSkip = async (tokenId: string) => {
    if (!confirm('Mark patient as no-show?')) return;
    try {
      await apiPatch(`/queue/token/${tokenId}/skip`, { reason: 'No show' });
      fetchData();
    } catch (err: any) { alert(err.message); }
  };

  const addRxItem = () => setRxItems(prev => [...prev, { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const updateRxItem = (index: number, field: string, value: string) => setRxItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  const waitingTokens = queue.filter(t => t.status === 'WAITING');
  const calledTokens = queue.filter(t => t.status === 'CALLED');
  const inConsultation = queue.filter(t => t.status === 'IN_CONSULTATION');
  const completedTokens = queue.filter(t => t.status === 'COMPLETED');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><span>🏥</span> SwasthAI</div>
          <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Doctor Portal</p>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Main</div>
          <a className={`sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>📊 Dashboard</a>
          <a className={`sidebar-link ${activeView === 'queue' ? 'active' : ''}`} onClick={() => setActiveView('queue')}>📋 My Queue</a>
          {selectedToken && <a className={`sidebar-link ${activeView === 'consultation' ? 'active' : ''}`} onClick={() => setActiveView('consultation')}>🩺 Consultation</a>}
        </nav>
        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
          <p className="text-sm font-bold">{user?.name}</p>
          <p className="text-xs text-muted">{doctorProfile?.specialization}</p>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)', width: '100%' }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{activeView === 'dashboard' ? 'Dashboard' : activeView === 'queue' ? 'My Queue' : 'Consultation'}</span>
          <div className="topbar-actions">
            <span className="badge badge-success">● Online</span>
            <span className="text-sm text-muted">{doctorProfile?.department?.name}</span>
          </div>
        </div>

        <div className="page-container">
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div>
              <div className="grid grid-4" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>👥</div>
                  <div className="stat-value">{stats?.totalToday || 0}</div>
                  <div className="stat-label">Total Patients Today</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>⏳</div>
                  <div className="stat-value">{stats?.waiting || 0}</div>
                  <div className="stat-label">Waiting</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>✅</div>
                  <div className="stat-value">{stats?.completed || 0}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>🚨</div>
                  <div className="stat-value">{stats?.emergency || 0}</div>
                  <div className="stat-label">Emergency</div>
                </div>
              </div>

              {/* Current/Next Patient */}
              <div className="grid grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>🩺 Current Patient</h4>
                  {inConsultation.length > 0 ? (
                    <div>
                      <p className="font-bold" style={{ fontSize: '1.1rem' }}>{inConsultation[0].patient?.user?.name}</p>
                      <p className="text-sm text-muted">Token: {inConsultation[0].displayToken}</p>
                      <span className={`badge badge-${inConsultation[0].priority?.toLowerCase()}`}>{inConsultation[0].priority}</span>
                    </div>
                  ) : <p className="text-muted text-sm">No patient in consultation</p>}
                </div>
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>⏭️ Next Patient</h4>
                  {waitingTokens.length > 0 ? (
                    <div>
                      <p className="font-bold" style={{ fontSize: '1.1rem' }}>{waitingTokens[0].patient?.user?.name}</p>
                      <p className="text-sm text-muted">Token: {waitingTokens[0].displayToken}</p>
                      <span className={`badge badge-${waitingTokens[0].priority?.toLowerCase()}`}>{waitingTokens[0].priority}</span>
                      <div style={{ marginTop: 'var(--space-md)' }}>
                        <button onClick={() => handleCallNext(waitingTokens[0].id)} className="btn btn-primary btn-sm" disabled={actionLoading === waitingTokens[0].id}>
                          {actionLoading === waitingTokens[0].id ? 'Calling...' : '📢 Call Patient'}
                        </button>
                      </div>
                    </div>
                  ) : <p className="text-muted text-sm">No patients waiting</p>}
                </div>
              </div>

              {/* Queue Overview */}
              <div className="card">
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Today&apos;s Queue</h4>
                {queue.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📋</div><h3>No patients today</h3></div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Token</th><th>Patient</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {queue.map(t => (
                        <tr key={t.id}>
                          <td><span className="font-mono font-bold">{t.displayToken}</span></td>
                          <td>{t.patient?.user?.name}</td>
                          <td><span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                          <td><span className={`badge status-${t.status?.toLowerCase().replace('_', '-')}`}>{t.status?.replace('_', ' ')}</span></td>
                          <td>
                            {t.status === 'WAITING' && <button onClick={() => handleCallNext(t.id)} className="btn btn-primary btn-sm" disabled={!!actionLoading}>Call</button>}
                            {t.status === 'CALLED' && <button onClick={() => handleStartConsultation(t)} className="btn btn-success btn-sm" disabled={!!actionLoading}>Start</button>}
                            {(t.status === 'WAITING' || t.status === 'CALLED') && <button onClick={() => handleSkip(t.id)} className="btn btn-ghost btn-sm" style={{ marginLeft: '4px' }}>Skip</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Queue View */}
          {activeView === 'queue' && (
            <div>
              <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                <span className="badge badge-warning">⏳ Waiting: {waitingTokens.length}</span>
                <span className="badge badge-info">📢 Called: {calledTokens.length}</span>
                <span className="badge badge-success">✅ Completed: {completedTokens.length}</span>
              </div>

              {queue.map(t => (
                <div key={t.id} className={`token-card ${t.priority === 'EMERGENCY' ? 'emergency' : t.priority === 'HIGH' ? 'high' : ''}`} style={{ marginBottom: 'var(--space-sm)' }}>
                  <div className="token-number" style={{ color: t.priority === 'EMERGENCY' ? 'var(--danger)' : 'var(--primary)' }}>{t.displayToken}</div>
                  <div className="token-info">
                    <div className="token-patient">{t.patient?.user?.name}</div>
                    <div className="token-meta">{t.patient?.user?.phone}</div>
                  </div>
                  <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                  <span className={`badge status-${t.status?.toLowerCase().replace('_', '-')}`}>{t.status?.replace('_', ' ')}</span>
                  <div>
                    {t.status === 'WAITING' && <button onClick={() => handleCallNext(t.id)} className="btn btn-primary btn-sm">📢 Call</button>}
                    {t.status === 'CALLED' && <button onClick={() => handleStartConsultation(t)} className="btn btn-success btn-sm">🩺 Start</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Consultation View */}
          {activeView === 'consultation' && selectedPatient && selectedToken && (
            <div>
              <div className="grid grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
                {/* Patient Info */}
                <div className="card">
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>👤 Patient Information</h4>
                  <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                    <div><span className="text-xs text-muted">Name:</span> <strong>{selectedPatient.user?.name}</strong></div>
                    <div><span className="text-xs text-muted">Age:</span> {selectedPatient.dateOfBirth ? Math.floor((Date.now() - new Date(selectedPatient.dateOfBirth).getTime()) / 31557600000) : 'N/A'}</div>
                    <div><span className="text-xs text-muted">Gender:</span> {selectedPatient.gender || 'N/A'}</div>
                    <div><span className="text-xs text-muted">Blood Group:</span> {selectedPatient.bloodGroup || 'N/A'}</div>
                    <div><span className="text-xs text-muted">Phone:</span> {selectedPatient.user?.phone || 'N/A'}</div>
                    {selectedPatient.allergies && <div><span className="text-xs text-muted">Allergies:</span> <span className="badge badge-danger">{selectedPatient.allergies}</span></div>}
                    {selectedPatient.currentMedicines && <div><span className="text-xs text-muted">Current Medicines:</span> {selectedPatient.currentMedicines}</div>}
                  </div>
                </div>

                {/* AI Triage Summary */}
                <div className="card" style={{ borderLeft: '4px solid var(--info)' }}>
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>🤖 AI Triage Summary</h4>
                  {triageData ? (
                    <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                      <div><span className="text-xs text-muted">Symptoms:</span> {triageData.symptoms}</div>
                      <div><span className="text-xs text-muted">Priority:</span> <span className={`badge badge-${triageData.priority?.toLowerCase()}`}>{triageData.priority}</span></div>
                      <div><span className="text-xs text-muted">Risk Score:</span> {triageData.riskScore}/10</div>
                      <div><span className="text-xs text-muted">Summary:</span> <span className="text-sm">{triageData.reasoningSummary}</span></div>
                      {triageData.redFlags && JSON.parse(triageData.redFlags || '[]').length > 0 && (
                        <div><span className="text-xs text-muted">Red Flags:</span> {JSON.parse(triageData.redFlags).map((rf: string, i: number) => <span key={i} className="badge badge-danger" style={{ marginRight: '4px' }}>{rf}</span>)}</div>
                      )}
                      <p className="text-xs text-muted" style={{ fontStyle: 'italic' }}>⚕️ AI-generated preliminary assessment{triageData.isDemo ? ' (Demo Mode)' : ''}</p>
                    </div>
                  ) : <p className="text-muted text-sm">No AI triage data available</p>}
                </div>
              </div>

              {/* Consultation Form */}
              <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>📋 Consultation Notes</h4>
                <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Chief Complaint</label>
                    <input className="form-input" value={consultForm.chiefComplaint} onChange={e => setConsultForm(p => ({ ...p, chiefComplaint: e.target.value }))} placeholder="Main complaint" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">History</label>
                    <input className="form-input" value={consultForm.history} onChange={e => setConsultForm(p => ({ ...p, history: e.target.value }))} placeholder="Medical history" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Clinical Notes</label>
                  <textarea className="form-textarea" value={consultForm.clinicalNotes} onChange={e => setConsultForm(p => ({ ...p, clinicalNotes: e.target.value }))} placeholder="Examination findings, vitals, observations..." />
                </div>
                <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Diagnosis / Clinical Impression</label>
                    <input className="form-input" value={consultForm.diagnosis} onChange={e => setConsultForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="Diagnosis" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Treatment Plan</label>
                    <input className="form-input" value={consultForm.treatmentPlan} onChange={e => setConsultForm(p => ({ ...p, treatmentPlan: e.target.value }))} placeholder="Treatment plan" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Follow-up Date (Optional)</label>
                  <input type="date" className="form-input" value={consultForm.followUpDate} onChange={e => setConsultForm(p => ({ ...p, followUpDate: e.target.value }))} />
                </div>
              </div>

              {/* Prescription */}
              <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="card-header">
                  <h4>💊 Prescription</h4>
                  <button onClick={addRxItem} className="btn btn-outline btn-sm">+ Add Medicine</button>
                </div>
                {rxItems.map((item, i) => (
                  <div key={i} className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                    <input className="form-input" placeholder="Medicine name" value={item.medicineName} onChange={e => updateRxItem(i, 'medicineName', e.target.value)} />
                    <input className="form-input" placeholder="Dosage" value={item.dosage} onChange={e => updateRxItem(i, 'dosage', e.target.value)} />
                    <input className="form-input" placeholder="Frequency" value={item.frequency} onChange={e => updateRxItem(i, 'frequency', e.target.value)} />
                    <input className="form-input" placeholder="Duration" value={item.duration} onChange={e => updateRxItem(i, 'duration', e.target.value)} />
                    <input className="form-input" placeholder="Instructions" value={item.instructions} onChange={e => updateRxItem(i, 'instructions', e.target.value)} />
                  </div>
                ))}
              </div>

              {/* Lab Tests */}
              <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>🔬 Order Lab Test (Optional)</h4>
                <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Test Name</label>
                    <input className="form-input" placeholder="e.g., CBC, Blood Sugar" value={labTest.testName} onChange={e => setLabTest(p => ({ ...p, testName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" placeholder="Special instructions" value={labTest.notes} onChange={e => setLabTest(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
              </div>

              <button onClick={handleCompleteConsultation} className="btn btn-success btn-full btn-lg" disabled={actionLoading === 'complete'}>
                {actionLoading === 'complete' ? 'Saving...' : '✅ Complete Consultation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
