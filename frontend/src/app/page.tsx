'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    // Redirect based on role
    switch (user?.role) {
      case 'PATIENT': router.replace('/patient'); break;
      case 'DOCTOR': router.replace('/doctor'); break;
      case 'HOSPITAL_ADMIN': router.replace('/admin'); break;
      case 'RECEPTIONIST': router.replace('/reception'); break;
      case 'NURSE': router.replace('/doctor'); break;
      default: router.replace('/auth/login');
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="auth-page">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-md)' }}></div>
        <p className="text-muted">Loading SwasthAI...</p>
      </div>
    </div>
  );
}
