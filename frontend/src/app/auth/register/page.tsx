'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: 'PATIENT' });
      router.push('/patient');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏥</div>
          <h1>Create Account</h1>
          <p>Register as a patient on SwasthAI</p>
        </div>

        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" placeholder="Enter your full name" value={form.name} onChange={e => updateField('name', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="Enter your email" value={form.email} onChange={e => updateField('email', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" className="form-input" placeholder="+91-XXXXXXXXXX" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={e => updateField('password', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-input" placeholder="Confirm password" value={form.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          Already have an account? <Link href="/auth/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
