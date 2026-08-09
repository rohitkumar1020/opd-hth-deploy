import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { hospitalRoutes } from './modules/hospitals/hospital.routes';
import { departmentRoutes } from './modules/departments/department.routes';
import { doctorRoutes } from './modules/doctors/doctor.routes';
import { patientRoutes } from './modules/patients/patient.routes';
import { queueRoutes } from './modules/queue/queue.routes';
import { triageRoutes } from './modules/triage/triage.routes';
import { consultationRoutes } from './modules/consultations/consultation.routes';
import { prescriptionRoutes } from './modules/prescriptions/prescription.routes';
import { labRoutes } from './modules/labs/lab.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { staffRoutes } from './modules/staff/staff.routes';

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
app.use(cors({
  origin: config.frontendUrl.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan(':method :url :status :response-time ms'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/staff', staffRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Error handler
app.use(errorHandler);

export { app };
