'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiGet, apiPatch } from '@/lib/api';
import Link from 'next/link';

export default function NotificationsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await apiGet('/notifications?limit=50');
      setNotifications(res.data?.notifications || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    fetchNotifications();
  }, [authLoading, isAuthenticated, router]);

  const markAllRead = async () => {
    await apiPatch('/notifications/read-all');
    fetchNotifications();
  };

  if (authLoading || loading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  const iconMap: Record<string, string> = { TOKEN_CREATED: '🎫', TOKEN_CALLED: '🔔', PRESCRIPTION_CREATED: '💊', LAB_REPORT_READY: '🔬', QUEUE_UPDATE: '📋', EMERGENCY_ALERT: '🚨', GENERAL: 'ℹ️' };

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar"><Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link><span className="topbar-title">Notifications</span><button onClick={markAllRead} className="btn btn-ghost btn-sm">Mark All Read</button></div>
      <div className="page-container" style={{ maxWidth: '600px' }}>
        {notifications.length === 0 ? <div className="empty-state"><div className="empty-icon">🔔</div><h3>No notifications</h3></div> :
          notifications.map(n => (
            <div key={n.id} className="card" style={{ marginBottom: 'var(--space-sm)', opacity: n.read ? 0.7 : 1, borderLeft: n.read ? undefined : '3px solid var(--primary)' }}>
              <div className="flex gap-sm items-center">
                <span style={{ fontSize: '1.3rem' }}>{iconMap[n.type] || 'ℹ️'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                  <p className="text-xs text-muted">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
