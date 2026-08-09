'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getSocket, joinRoom } from '@/lib/socket';

export default function AdminDashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ name: '', email: '', phone: '', password: 'Demo@1234', departmentId: '', registrationNumber: '', qualification: '', specialization: '', roomNumber: '' });
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '', floor: 0, avgConsultationMinutes: 10, dailyCapacity: 50, emergencySupported: false });
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', password: 'Demo@1234', role: 'RECEPTIONIST' as 'NURSE' | 'RECEPTIONIST' });
  const [formError, setFormError] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.hospitalId) return;
    try {
      const [analyticsRes, deptRes, docRes, staffRes] = await Promise.all([
        apiGet(`/analytics/hospital/${user.hospitalId}`),
        apiGet(`/departments/hospital/${user.hospitalId}`),
        apiGet(`/doctors/hospital/${user.hospitalId}`),
        apiGet(`/staff/hospital/${user.hospitalId}`),
      ]);
      setAnalytics(analyticsRes.data);
      setDepartments(deptRes.data || []);
      setDoctors(docRes.data || []);
      setStaff(staffRes.data || []);

      const socket = getSocket();
      joinRoom(`hospital:${user.hospitalId}`);
      socket.on('queue:updated', () => apiGet(`/analytics/hospital/${user.hospitalId}`).then(r => setAnalytics(r.data)));
      socket.on('emergency:alert', (data: any) => alert(`🚨 EMERGENCY: ${data.patientName || 'Patient'} - ${data.department || 'Emergency'}`));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'HOSPITAL_ADMIN') { router.replace('/auth/login'); return; }
    fetchData();
  }, [authLoading, isAuthenticated, user, router, fetchData]);

  const handleAddDoctor = async () => {
    setFormError('');
    if (!newDoctor.name || !newDoctor.email || !newDoctor.departmentId) { setFormError('Name, email, and department are required'); return; }
    try {
      await apiPost('/doctors', { ...newDoctor, hospitalId: user?.hospitalId, floor: 0 });
      setShowAddDoctor(false);
      setNewDoctor({ name: '', email: '', phone: '', password: 'Demo@1234', departmentId: '', registrationNumber: '', qualification: '', specialization: '', roomNumber: '' });
      fetchData();
    } catch (err: any) { setFormError(err.message); }
  };

  const handleAddDept = async () => {
    setFormError('');
    if (!newDept.name || !newDept.code) { setFormError('Name and code are required'); return; }
    try {
      await apiPost('/departments', { ...newDept, hospitalId: user?.hospitalId });
      setShowAddDept(false);
      setNewDept({ name: '', code: '', description: '', floor: 0, avgConsultationMinutes: 10, dailyCapacity: 50, emergencySupported: false });
      fetchData();
    } catch (err: any) { setFormError(err.message); }
  };

  const handleAddStaff = async () => {
    setFormError('');
    if (!newStaff.name || !newStaff.email) { setFormError('Name and email are required'); return; }
    try {
      await apiPost('/staff', { ...newStaff, hospitalId: user?.hospitalId });
      setShowAddStaff(false);
      setNewStaff({ name: '', email: '', phone: '', password: 'Demo@1234', role: 'RECEPTIONIST' });
      fetchData();
    } catch (err: any) { setFormError(err.message); }
  };

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  const overview = analytics?.overview || {};

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><span>🏥</span> SwasthAI</div>
          <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Hospital Admin</p>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Dashboard</div>
          <a className={`sidebar-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>📊 Overview</a>
          <a className={`sidebar-link ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>🏥 Live View</a>
          <div className="sidebar-section">Management</div>
          <a className={`sidebar-link ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>🏬 Departments</a>
          <a className={`sidebar-link ${activeTab === 'doctors' ? 'active' : ''}`} onClick={() => setActiveTab('doctors')}>👨‍⚕️ Doctors</a>
          <a className={`sidebar-link ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>👥 Staff</a>
        </nav>
        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)' }}>
          <p className="text-sm font-bold">{user?.name}</p>
          <p className="text-xs text-muted">Hospital Admin</p>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)', width: '100%' }}>Logout</button>
        </div>
      </div>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Hospital Administration</span>
          <span className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        <div className="page-container">
          {/* Overview */}
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-4" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>👥</div><div className="stat-value">{overview.totalPatientsToday}</div><div className="stat-label">Total Patients Today</div></div>
                <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>⏳</div><div className="stat-value">{overview.waitingPatients}</div><div className="stat-label">Currently Waiting</div></div>
                <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>✅</div><div className="stat-value">{overview.completedConsultations}</div><div className="stat-label">Completed</div></div>
                <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>🚨</div><div className="stat-value">{overview.emergencyTokens}</div><div className="stat-label">Emergency Cases</div></div>
              </div>

              <div className="grid grid-3" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card"><div className="stat-value">{overview.avgWaitTime || 0} <span className="text-sm text-muted">min</span></div><div className="stat-label">Avg Wait Time</div></div>
                <div className="stat-card"><div className="stat-value">{overview.onlineDoctors}/{overview.totalDoctors}</div><div className="stat-label">Doctors Online</div></div>
                <div className="stat-card"><div className="stat-value">{overview.cancelledTokens || 0}</div><div className="stat-label">Cancellations</div></div>
              </div>

              {/* Hourly Traffic */}
              <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 style={{ marginBottom: 'var(--space-md)' }}>📈 Hourly Patient Traffic</h4>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                  {(analytics?.hourlyTraffic || []).filter((h: any) => h.hour >= 7 && h.hour <= 18).map((h: any) => {
                    const max = Math.max(...(analytics?.hourlyTraffic || []).map((x: any) => x.count), 1);
                    return (
                      <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="text-xs">{h.count}</span>
                        <div style={{ width: '100%', background: h.count > 0 ? 'var(--primary)' : 'var(--border)', height: `${Math.max((h.count / max) * 100, 4)}px`, borderRadius: '3px 3px 0 0', minHeight: '4px' }}></div>
                        <span className="text-xs text-muted" style={{ marginTop: '4px' }}>{h.hour}:00</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Live Department View */}
          {activeTab === 'live' && (
            <div>
              <h3 style={{ marginBottom: 'var(--space-lg)' }}>🏥 Live Hospital View</h3>
              <div className="grid grid-2">
                {(analytics?.departmentLoad || []).map((dept: any) => (
                  <div key={dept.id} className="card">
                    <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                      <h4>{dept.name}</h4>
                      <span className={`badge ${dept.utilization > 80 ? 'badge-danger' : dept.utilization > 50 ? 'badge-warning' : 'badge-success'}`}>
                        {dept.utilization}%
                      </span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 'var(--space-md)' }}>
                      <div className="progress-fill" style={{
                        width: `${Math.min(dept.utilization, 100)}%`,
                        background: dept.utilization > 80 ? 'var(--danger)' : dept.utilization > 50 ? 'var(--warning)' : 'var(--success)',
                      }}></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>👥 {dept.activePatients} patients</span>
                      <span>👨‍⚕️ {dept.onlineDoctors}/{dept.doctorCount} doctors</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Departments */}
          {activeTab === 'departments' && (
            <div>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3>Department Management</h3>
                <button onClick={() => { setShowAddDept(true); setFormError(''); }} className="btn btn-primary">+ Add Department</button>
              </div>

              {showAddDept && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)', border: '2px solid var(--primary)' }}>
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>Add New Department</h4>
                  {formError && <div className="alert alert-danger">{formError}</div>}
                  <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                    <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={newDept.name} onChange={e => setNewDept(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={newDept.code} onChange={e => setNewDept(p => ({ ...p, code: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Floor</label><input type="number" className="form-input" value={newDept.floor} onChange={e => setNewDept(p => ({ ...p, floor: parseInt(e.target.value) || 0 }))} /></div>
                    <div className="form-group"><label className="form-label">Daily Capacity</label><input type="number" className="form-input" value={newDept.dailyCapacity} onChange={e => setNewDept(p => ({ ...p, dailyCapacity: parseInt(e.target.value) || 50 }))} /></div>
                  </div>
                  <div className="flex gap-sm">
                    <button onClick={handleAddDept} className="btn btn-primary">Save Department</button>
                    <button onClick={() => setShowAddDept(false)} className="btn btn-outline">Cancel</button>
                  </div>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>Name</th><th>Code</th><th>Floor</th><th>Capacity</th><th>Doctors</th><th>Waiting</th></tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td><span className="font-mono">{d.code}</span></td>
                      <td>{d.floor}</td>
                      <td>{d.dailyCapacity}</td>
                      <td>{d._count?.doctors || 0}</td>
                      <td><span className="badge badge-warning">{d._count?.queueTokens || 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Doctors */}
          {activeTab === 'doctors' && (
            <div>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3>Doctor Management</h3>
                <button onClick={() => { setShowAddDoctor(true); setFormError(''); }} className="btn btn-primary">+ Add Doctor</button>
              </div>

              {showAddDoctor && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)', border: '2px solid var(--primary)' }}>
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>Add New Doctor</h4>
                  {formError && <div className="alert alert-danger">{formError}</div>}
                  <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                    <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={newDoctor.name} onChange={e => setNewDoctor(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={newDoctor.email} onChange={e => setNewDoctor(p => ({ ...p, email: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Department</label>
                      <select className="form-select" value={newDoctor.departmentId} onChange={e => setNewDoctor(p => ({ ...p, departmentId: e.target.value }))}>
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" value={newDoctor.specialization} onChange={e => setNewDoctor(p => ({ ...p, specialization: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Qualification</label><input className="form-input" value={newDoctor.qualification} onChange={e => setNewDoctor(p => ({ ...p, qualification: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Room Number</label><input className="form-input" value={newDoctor.roomNumber} onChange={e => setNewDoctor(p => ({ ...p, roomNumber: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-sm"><button onClick={handleAddDoctor} className="btn btn-primary">Save Doctor</button><button onClick={() => setShowAddDoctor(false)} className="btn btn-outline">Cancel</button></div>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>Name</th><th>Department</th><th>Specialization</th><th>Room</th><th>Status</th><th>Queue</th></tr></thead>
                <tbody>
                  {doctors.map((d: any) => (
                    <tr key={d.id}>
                      <td><strong>{d.user?.name}</strong><br /><span className="text-xs text-muted">{d.user?.email}</span></td>
                      <td>{d.department?.name}</td>
                      <td>{d.specialization}</td>
                      <td>{d.roomNumber}</td>
                      <td><span className={`badge ${d.isOnline ? 'badge-success' : 'badge-danger'}`}>{d.isOnline ? '● Online' : '○ Offline'}</span></td>
                      <td>{d._count?.queueTokens || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Staff */}
          {activeTab === 'staff' && (
            <div>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3>Staff Management</h3>
                <button onClick={() => { setShowAddStaff(true); setFormError(''); }} className="btn btn-primary">+ Add Staff</button>
              </div>

              {showAddStaff && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)', border: '2px solid var(--primary)' }}>
                  <h4 style={{ marginBottom: 'var(--space-md)' }}>Add Staff Member</h4>
                  {formError && <div className="alert alert-danger">{formError}</div>}
                  <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
                    <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={newStaff.email} onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Role</label>
                      <select className="form-select" value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value as any }))}>
                        <option value="RECEPTIONIST">Receptionist</option>
                        <option value="NURSE">Nurse</option>
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={newStaff.phone} onChange={e => setNewStaff(p => ({ ...p, phone: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-sm"><button onClick={handleAddStaff} className="btn btn-primary">Save Staff</button><button onClick={() => setShowAddStaff(false)} className="btn btn-outline">Cancel</button></div>
                </div>
              )}

              <table className="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Status</th></tr></thead>
                <tbody>
                  {staff.map((s: any) => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.email}</td>
                      <td><span className="badge badge-info">{s.role}</span></td>
                      <td>{s.phone || '—'}</td>
                      <td><span className={`badge ${s.active ? 'badge-success' : 'badge-danger'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
