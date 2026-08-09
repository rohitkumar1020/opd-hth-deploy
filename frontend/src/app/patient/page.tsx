'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function PatientDashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [patientData, setPatientData] = useState<any>(null);
  const [activeToken, setActiveToken] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [patientRes, hospitalRes, notifRes] = await Promise.all([
        apiGet('/patients/me'),
        apiGet('/hospitals?limit=5'),
        apiGet('/notifications?limit=5'),
      ]);
      setPatientData(patientRes.data);
      setHospitals(hospitalRes.data || []);
      setNotifications(notifRes.data?.notifications || []);

      // Get active token
      if (patientRes.data?.id) {
        try {
          const tokenRes = await apiGet(`/queue/patient/${patientRes.data.id}/active`);
          setActiveToken(tokenRes.data);
        } catch { setActiveToken(null); }
      }
    } catch (err) {
      console.error('Failed to load patient data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'PATIENT') { router.replace('/auth/login'); return; }
    fetchData();
  }, [authLoading, isAuthenticated, user, router, fetchData]);

  if (authLoading || loading) {
    return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div><p className="mt-md text-muted">Loading...</p></div>;
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      {/* Top Bar */}
      <div className="topbar">
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>🏥 SwasthAI</div>
        </div>
        <div className="topbar-actions">
          <Link href="/patient/notifications" className="btn btn-ghost btn-sm">🔔 {notifications.filter(n => !n.read).length > 0 && <span className="badge badge-danger">{notifications.filter(n => !n.read).length}</span>}</Link>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </div>

      <div className="page-container" style={{ maxWidth: '600px' }}>
        {/* Greeting */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h2>{greeting()}, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-muted text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Active Token */}
        {activeToken && (
          <div className={`card ${activeToken.priority === 'EMERGENCY' ? '' : ''}`} style={{
            marginBottom: 'var(--space-lg)',
            borderLeft: `4px solid ${activeToken.priority === 'EMERGENCY' ? 'var(--danger)' : activeToken.priority === 'HIGH' ? 'var(--priority-high)' : 'var(--primary)'}`,
          }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
              <div>
                <p className="text-xs text-muted">Current Token</p>
                <p className="font-mono font-bold" style={{ fontSize: '1.8rem', color: 'var(--primary)' }}>{activeToken.displayToken}</p>
              </div>
              <span className={`badge badge-${activeToken.priority?.toLowerCase()}`}>{activeToken.priority}</span>
            </div>

            <div className="flex justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
              <div>
                <p className="text-xs text-muted">Department</p>
                <p style={{ fontWeight: 500 }}>{activeToken.department?.name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="text-xs text-muted">Doctor</p>
                <p style={{ fontWeight: 500 }}>{activeToken.doctor?.user?.name || 'To be assigned'}</p>
              </div>
            </div>

            {activeToken.status === 'WAITING' && (
              <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--info)' }}>Patients Ahead</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--info)' }}>{activeToken.patientsAhead ?? '...'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="text-xs" style={{ color: 'var(--info)' }}>Est. Wait Time</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--info)' }}>{activeToken.estimatedWaitMinutes ?? '...'} min</p>
                  </div>
                </div>
              </div>
            )}

            {activeToken.status === 'CALLED' && (
              <div className="alert alert-success" style={{ marginTop: 'var(--space-md)' }}>
                🔔 <strong>Your token has been called!</strong> Please proceed to {activeToken.department?.name}.
              </div>
            )}

            {activeToken.status === 'IN_CONSULTATION' && (
              <div className="alert alert-info" style={{ marginTop: 'var(--space-md)' }}>
                👨‍⚕️ <strong>In Consultation</strong> with {activeToken.doctor?.user?.name}
              </div>
            )}

            <Link href="/patient/queue" className="btn btn-outline btn-full" style={{ marginTop: 'var(--space-md)' }}>
              View Live Queue
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Quick Actions</h4>
          <div className="grid grid-2" style={{ gap: 'var(--space-sm)' }}>
            <Link href="/patient/triage" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-sm)' }}>🩺</div>
              <p style={{ fontWeight: 600 }}>Consult Doctor</p>
              <p className="text-xs text-muted">AI-assisted triage</p>
            </Link>
            <Link href="/patient/appointments" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-sm)' }}>📅</div>
              <p style={{ fontWeight: 600 }}>Appointments</p>
              <p className="text-xs text-muted">View history</p>
            </Link>
            <Link href="/patient/records" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-sm)' }}>📋</div>
              <p style={{ fontWeight: 600 }}>Medical Records</p>
              <p className="text-xs text-muted">History & reports</p>
            </Link>
            <Link href="/patient/prescriptions" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-sm)' }}>💊</div>
              <p style={{ fontWeight: 600 }}>Prescriptions</p>
              <p className="text-xs text-muted">View medicines</p>
            </Link>
          </div>
        </div>

        {/* Emergency Button */}
        <Link href="/patient/triage?emergency=true" className="btn btn-danger btn-full btn-lg" style={{ marginBottom: 'var(--space-lg)' }}>
          🚨 Emergency Help
        </Link>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Notifications</span>
              <Link href="/patient/notifications" className="text-sm" style={{ color: 'var(--primary)' }}>View All</Link>
            </div>
            {notifications.slice(0, 3).map((notif: any) => (
              <div key={notif.id} style={{ padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
                <span style={{ opacity: notif.read ? 0.5 : 1 }}>{notif.type === 'TOKEN_CALLED' ? '🔔' : notif.type === 'PRESCRIPTION_CREATED' ? '💊' : notif.type === 'LAB_REPORT_READY' ? '🔬' : 'ℹ️'}</span>
                <div>
                  <p style={{ fontWeight: notif.read ? 400 : 600, fontSize: '0.9rem' }}>{notif.title}</p>
                  <p className="text-xs text-muted">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="mobile-nav">
        <div className="mobile-nav-items">
          <Link href="/patient" className="mobile-nav-item active"><span className="nav-icon">🏠</span>Home</Link>
          <Link href="/patient/triage" className="mobile-nav-item"><span className="nav-icon">🩺</span>Consult</Link>
          <Link href="/patient/queue" className="mobile-nav-item"><span className="nav-icon">📋</span>Queue</Link>
          <Link href="/patient/records" className="mobile-nav-item"><span className="nav-icon">📁</span>Records</Link>
          <Link href="/patient/profile" className="mobile-nav-item"><span className="nav-icon">👤</span>Profile</Link>
        </div>
      </div>
    </div>
  );
}
