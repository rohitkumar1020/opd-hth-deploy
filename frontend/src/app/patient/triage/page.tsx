'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import Link from 'next/link';

type Step = 'symptoms' | 'followup' | 'result' | 'doctor-select' | 'confirm';

export default function TriagePage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmergency = searchParams.get('emergency') === 'true';

  const [step, setStep] = useState<Step>('symptoms');
  const [symptoms, setSymptoms] = useState(isEmergency ? '' : '');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [triageResult, setTriageResult] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<number, string>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenCreated, setTokenCreated] = useState<any>(null);

  const loadInitial = useCallback(async () => {
    try {
      const [hospRes, patRes] = await Promise.all([
        apiGet('/hospitals?limit=10'),
        apiGet('/patients/me'),
      ]);
      setHospitals(hospRes.data || []);
      setPatientData(patRes.data);
      if (hospRes.data?.length > 0) setSelectedHospital(hospRes.data[0].id);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    loadInitial();
  }, [authLoading, isAuthenticated, router, loadInitial]);

  const handleAssess = async () => {
    if (!symptoms.trim() || symptoms.length < 5) { setError('Please describe your symptoms in more detail'); return; }
    if (!selectedHospital) { setError('Please select a hospital'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await apiPost('/triage/assess', {
        symptoms,
        hospitalId: selectedHospital,
      });

      const { triage, assessment: assess } = res.data;
      setTriageResult(triage);
      setAssessment(assess);

      if (triage.followUpQuestions?.length > 0) {
        setStep('followup');
      } else {
        setStep('result');
        // Load doctors for recommended department
        loadDoctors(selectedHospital, triage.recommendedDepartment);
      }
    } catch (err: any) {
      setError(err.message || 'Triage assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    setLoading(true);
    try {
      const answers = triageResult.followUpQuestions.map((q: string, i: number) => ({
        question: q,
        answer: followUpAnswers[i] || 'Not specified',
      }));

      const res = await apiPost('/triage/assess', {
        symptoms,
        hospitalId: selectedHospital,
        answers,
      });

      setTriageResult(res.data.triage);
      setAssessment(res.data.assessment);
      setStep('result');
      loadDoctors(selectedHospital, res.data.triage.recommendedDepartment);
    } catch (err: any) {
      setError(err.message || 'Follow-up assessment failed');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async (hospitalId: string, deptName: string) => {
    try {
      const deptRes = await apiGet(`/departments/hospital/${hospitalId}`);
      setDepartments(deptRes.data || []);
      const matchedDept = (deptRes.data || []).find((d: any) =>
        d.name.toLowerCase().includes(deptName.toLowerCase()) ||
        deptName.toLowerCase().includes(d.name.toLowerCase())
      );

      if (matchedDept) {
        const docRes = await apiGet(`/doctors/hospital/${hospitalId}?departmentId=${matchedDept.id}`);
        setDoctors(docRes.data || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateToken = async () => {
    if (!patientData?.id) { setError('Patient profile not found'); return; }
    setLoading(true);
    setError('');

    try {
      const matchedDept = departments.find((d: any) =>
        d.name.toLowerCase().includes(triageResult.recommendedDepartment.toLowerCase()) ||
        triageResult.recommendedDepartment.toLowerCase().includes(d.name.toLowerCase())
      );

      const res = await apiPost('/queue/token', {
        patientId: patientData.id,
        hospitalId: selectedHospital,
        departmentId: matchedDept?.id || departments[0]?.id,
        doctorId: selectedDoctor || undefined,
        priority: triageResult.priority,
        triageId: assessment?.id,
      });

      setTokenCreated(res.data);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Token creation failed');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY': return 'var(--danger)';
      case 'HIGH': return 'var(--priority-high)';
      case 'MODERATE': return 'var(--warning)';
      default: return 'var(--success)';
    }
  };

  if (authLoading) return <div className="loading-container" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;

  return (
    <div className="app-container" style={{ background: 'var(--bg)' }}>
      <div className="topbar">
        <Link href="/patient" className="btn btn-ghost btn-sm">← Back</Link>
        <span className="topbar-title">AI Symptom Assessment</span>
        <div></div>
      </div>

      <div className="page-container" style={{ maxWidth: '600px' }}>
        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        {/* Step 1: Symptoms */}
        {step === 'symptoms' && (
          <div>
            {isEmergency && (
              <div className="alert alert-danger" style={{ marginBottom: 'var(--space-lg)' }}>
                🚨 <strong>Emergency Mode</strong> — If you are experiencing a life-threatening emergency, please call emergency services immediately.
              </div>
            )}

            <div className="card">
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Describe Your Symptoms</h3>
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
                Tell us what you&apos;re experiencing. Our AI will help identify the right department and priority level.
              </p>

              <div className="form-group">
                <label className="form-label">Select Hospital</label>
                <select className="form-select" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}>
                  {hospitals.map((h: any) => (
                    <option key={h.id} value={h.id}>{h.name} — {h.city}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">What symptoms are you experiencing?</label>
                <textarea
                  className="form-textarea"
                  placeholder="Example: I have fever and cough for two days, with mild headache..."
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  rows={4}
                />
                <p className="form-hint">Describe your symptoms in detail including duration, severity, and any other relevant information.</p>
              </div>

              <button onClick={handleAssess} className="btn btn-primary btn-full btn-lg" disabled={loading || !symptoms.trim()}>
                {loading ? 'Analyzing Symptoms...' : '🤖 Analyze Symptoms'}
              </button>
            </div>

            <div className="alert alert-info" style={{ marginTop: 'var(--space-md)' }}>
              ℹ️ This AI assessment provides preliminary triage support only. Final medical decisions must be made by a qualified healthcare professional.
            </div>
          </div>
        )}

        {/* Step 2: Follow-up Questions */}
        {step === 'followup' && triageResult?.followUpQuestions && (
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Follow-up Questions</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              Please answer these questions to help us better assess your condition.
            </p>

            {triageResult.followUpQuestions.map((q: string, i: number) => (
              <div className="form-group" key={i}>
                <label className="form-label">{q}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your answer"
                  value={followUpAnswers[i] || ''}
                  onChange={e => setFollowUpAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                />
              </div>
            ))}

            <div className="flex gap-sm">
              <button onClick={() => setStep('symptoms')} className="btn btn-outline" style={{ flex: 1 }}>← Back</button>
              <button onClick={handleFollowUp} className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Processing...' : 'Submit Answers'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Triage Result */}
        {step === 'result' && triageResult && (
          <div>
            <div className="card" style={{ borderLeft: `4px solid ${getPriorityColor(triageResult.priority)}`, marginBottom: 'var(--space-md)' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
                <h3>Triage Assessment</h3>
                <span className={`badge badge-${triageResult.priority.toLowerCase()}`}>{triageResult.priority}</span>
              </div>

              {triageResult.priority === 'EMERGENCY' && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>
                  🚨 <strong>EMERGENCY:</strong> {triageResult.recommendedAction}
                </div>
              )}

              <div className="grid grid-2" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div>
                  <p className="text-xs text-muted">Recommended Department</p>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>🏥 {triageResult.recommendedDepartment}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Risk Score</p>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>{triageResult.riskScore}/10</p>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-md)' }}>
                <p className="text-xs text-muted" style={{ marginBottom: '4px' }}>Assessment Summary</p>
                <p className="text-sm">{triageResult.reasoningSummary}</p>
              </div>

              {triageResult.redFlags?.length > 0 && (
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <p className="text-xs text-muted" style={{ marginBottom: '4px' }}>⚠️ Red Flags</p>
                  {triageResult.redFlags.map((rf: string, i: number) => (
                    <span key={i} className="badge badge-danger" style={{ marginRight: '6px', marginBottom: '4px' }}>{rf}</span>
                  ))}
                </div>
              )}

              <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
                ⚕️ AI-generated preliminary triage. Final medical assessment must be performed by a qualified healthcare professional.
              </div>
            </div>

            {/* Doctor Selection */}
            <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Available Doctors — {triageResult.recommendedDepartment}</h4>
              {doctors.length > 0 ? (
                <div>
                  {doctors.map((doc: any) => (
                    <label key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', border: `2px solid ${selectedDoctor === doc.id ? 'var(--primary)' : 'var(--border)'}`,
                      marginBottom: 'var(--space-sm)', background: selectedDoctor === doc.id ? 'var(--primary-bg)' : 'transparent',
                    }}>
                      <input type="radio" name="doctor" value={doc.id} checked={selectedDoctor === doc.id} onChange={() => setSelectedDoctor(doc.id)} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600 }}>{doc.user.name}</p>
                        <p className="text-xs text-muted">{doc.specialization} • Room {doc.roomNumber}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p className="text-xs text-muted">Queue</p>
                        <p style={{ fontWeight: 600, color: 'var(--primary)' }}>{doc._count?.queueTokens || 0}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">Loading doctors...</p>
              )}
            </div>

            <button onClick={handleCreateToken} className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Creating Token...' : '🎫 Get OPD Token'}
            </button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 'confirm' && tokenCreated && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✅</div>
            <h2 style={{ marginBottom: 'var(--space-sm)' }}>Token Created!</h2>

            <div style={{
              fontSize: '2.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: 'var(--primary)', padding: 'var(--space-lg)', background: 'var(--primary-bg)',
              borderRadius: 'var(--radius-lg)', margin: 'var(--space-lg) 0',
            }}>
              {tokenCreated.displayToken}
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-md)', textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
              <div>
                <p className="text-xs text-muted">Department</p>
                <p style={{ fontWeight: 500 }}>{tokenCreated.department?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Doctor</p>
                <p style={{ fontWeight: 500 }}>{tokenCreated.doctor?.user?.name || 'Auto-assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Priority</p>
                <span className={`badge badge-${tokenCreated.priority?.toLowerCase()}`}>{tokenCreated.priority}</span>
              </div>
              <div>
                <p className="text-xs text-muted">Est. Wait</p>
                <p style={{ fontWeight: 500 }}>{tokenCreated.estimatedWaitMinutes || 0} minutes</p>
              </div>
            </div>

            <div className="flex gap-sm" style={{ flexDirection: 'column' }}>
              <Link href="/patient/queue" className="btn btn-primary btn-full">View Live Queue</Link>
              <Link href="/patient" className="btn btn-outline btn-full">Go to Home</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
