'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email: string) => {
    setEmail(email);
    setPassword('Demo@1234');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏥</div>
          <h1>SwasthAI</h1>
          <p>Intelligent OPD Triage & Smart Queue Management</p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <p className="text-sm text-muted">Don&apos;t have an account? <Link href="/auth/register">Register</Link></p>
        </div>

        <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-lg)' }}>
          <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>Quick Demo Login</p>
          <div className="flex flex-wrap gap-sm" style={{ justifyContent: 'center' }}>
            <button onClick={() => quickLogin('patient.demo@swasthai.com')} className="btn btn-outline btn-sm">Patient</button>
            <button onClick={() => quickLogin('doctor.demo@swasthai.com')} className="btn btn-outline btn-sm">Doctor</button>
            <button onClick={() => quickLogin('admin.demo@swasthai.com')} className="btn btn-outline btn-sm">Admin</button>
            <button onClick={() => quickLogin('reception.demo@swasthai.com')} className="btn btn-outline btn-sm">Reception</button>
          </div>
          <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 'var(--space-sm)' }}>Password: Demo@1234</p>
        </div>
      </div>
    </div>
  );
}
