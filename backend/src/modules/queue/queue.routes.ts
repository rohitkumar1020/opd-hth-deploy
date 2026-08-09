import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';
import { emitQueueUpdate, emitTokenCalled, emitTokenStatusChanged, emitEmergencyAlert, emitNotification } from '../realtime/socket';

const router = Router();

const PRIORITY_ORDER = { EMERGENCY: 0, HIGH: 1, MODERATE: 2, NORMAL: 3 };

const createTokenSchema = z.object({
  patientId: z.string().uuid(),
  hospitalId: z.string().uuid(),
  departmentId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  priority: z.enum(['NORMAL', 'MODERATE', 'HIGH', 'EMERGENCY']).default('NORMAL'),
  triageId: z.string().uuid().optional(),
});

// Helper: generate display token
async function generateDisplayToken(hospitalId: string, departmentId: string, priority: string, date: Date): Promise<{ tokenNumber: number; displayToken: string }> {
  const prefix = priority === 'EMERGENCY' ? 'E' : priority === 'HIGH' ? 'H' : priority === 'MODERATE' ? 'M' : 'G';

  const todayStart = new Date(date.toISOString().split('T')[0]);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const count = await prisma.queueToken.count({
    where: {
      hospitalId,
      departmentId,
      date: { gte: todayStart, lt: todayEnd },
    },
  });

  const tokenNumber = count + 1;
  const displayToken = `${prefix}-${String(tokenNumber).padStart(3, '0')}`;
  return { tokenNumber, displayToken };
}

// Helper: estimate wait time
async function estimateWaitTime(doctorId: string | null, departmentId: string, priority: string, date: Date): Promise<number> {
  const todayStart = new Date(date.toISOString().split('T')[0]);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const where: any = {
    departmentId,
    status: { in: ['WAITING', 'CALLED'] },
    date: { gte: todayStart, lt: todayEnd },
  };
  if (doctorId) where.doctorId = doctorId;

  const waitingCount = await prisma.queueToken.count({ where });

  // Get avg consultation time
  let avgMinutes = 10;
  if (doctorId) {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { avgConsultMinutes: true } });
    if (doctor) avgMinutes = doctor.avgConsultMinutes;
  } else {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { avgConsultationMinutes: true } });
    if (dept) avgMinutes = dept.avgConsultationMinutes;
  }

  // Priority patients may skip ahead
  const priorityDiscount = priority === 'EMERGENCY' ? 0 : priority === 'HIGH' ? 0.3 : priority === 'MODERATE' ? 0.7 : 1;

  return Math.round(waitingCount * avgMinutes * priorityDiscount);
}

// Create token
router.post('/token', authenticate, authorize('PATIENT', 'RECEPTIONIST'), validate(createTokenSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, hospitalId, departmentId, doctorId, priority, triageId } = req.body;
    const today = new Date();

    // Check if patient already has active token today
    const todayStart = new Date(today.toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const existingToken = await prisma.queueToken.findFirst({
      where: {
        patientId,
        hospitalId,
        status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
        date: { gte: todayStart, lt: todayEnd },
      },
    });

    if (existingToken) {
      throw AppError.conflict('Patient already has an active token for today');
    }

    // Auto-assign doctor if not specified: pick doctor with fewest waiting patients
    let assignedDoctorId = doctorId;
    if (!assignedDoctorId) {
      const doctors = await prisma.doctorProfile.findMany({
        where: { departmentId, active: true },
        include: {
          _count: {
            select: {
              queueTokens: {
                where: {
                  status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
                  date: { gte: todayStart, lt: todayEnd },
                },
              },
            },
          },
        },
      });

      if (doctors.length > 0) {
        doctors.sort((a, b) => a._count.queueTokens - b._count.queueTokens);
        assignedDoctorId = doctors[0].id;
      }
    }

    const { tokenNumber, displayToken } = await generateDisplayToken(hospitalId, departmentId, priority, today);
    const estimatedWait = await estimateWaitTime(assignedDoctorId || null, departmentId, priority, today);

    const token = await prisma.queueToken.create({
      data: {
        tokenNumber,
        displayToken,
        patientId,
        hospitalId,
        departmentId,
        doctorId: assignedDoctorId,
        priority: priority as any,
        status: 'WAITING',
        date: todayStart,
        estimatedWaitMinutes: estimatedWait,
        triageId,
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        department: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    // Create notification
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
    if (patient) {
      await prisma.notification.create({
        data: {
          userId: patient.userId,
          type: 'TOKEN_CREATED',
          title: 'Token Created',
          message: `Your token ${displayToken} has been created. Estimated wait: ${estimatedWait} minutes.`,
          data: JSON.stringify({ tokenId: token.id, displayToken }),
        },
      });
      emitNotification(patient.userId, { type: 'TOKEN_CREATED', token: displayToken, wait: estimatedWait });
    }

    // Emit queue update
    emitQueueUpdate(hospitalId, departmentId, { action: 'TOKEN_CREATED', token });

    // Emergency alert
    if (priority === 'EMERGENCY') {
      emitEmergencyAlert(hospitalId, {
        tokenId: token.id,
        displayToken,
        patientName: token.patient.user.name,
        department: token.department.name,
        timestamp: new Date().toISOString(),
      });
    }

    auditFromRequest(req, 'CREATE', 'QueueToken', token.id, { displayToken, priority });
    res.status(201).json(successResponse(token));
  } catch (err) { next(err); }
});

// Get department queue (ordered by priority then time)
router.get('/department/:departmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date(new Date().toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const tokens = await prisma.queueToken.findMany({
      where: { departmentId: req.params.departmentId as string, date: { gte: todayStart, lt: todayEnd  },
        status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    // Custom sort: EMERGENCY first, then HIGH, MODERATE, NORMAL; within same priority, by creation time
    tokens.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 3;
      const pb = PRIORITY_ORDER[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    res.json(successResponse(tokens));
  } catch (err) { next(err); }
});

// Get doctor's queue
router.get('/doctor/:doctorId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date(new Date().toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const tokens = await prisma.queueToken.findMany({
      where: { doctorId: req.params.doctorId as string, date: { gte: todayStart, lt: todayEnd  },
      },
      include: {
        patient: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        department: { select: { name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    // Sort: IN_CONSULTATION first, then CALLED, then WAITING (by priority), then completed
    const statusOrder: Record<string, number> = {
      IN_CONSULTATION: 0, CALLED: 1, WAITING: 2, COMPLETED: 3, CANCELLED: 4, NO_SHOW: 5, TRANSFERRED: 6,
    };

    tokens.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 9;
      const sb = statusOrder[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      if (a.status === 'WAITING' && b.status === 'WAITING') {
        const pa = PRIORITY_ORDER[a.priority] ?? 3;
        const pb = PRIORITY_ORDER[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    res.json(successResponse(tokens));
  } catch (err) { next(err); }
});

// Get token by ID
router.get('/token/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.findUnique({
      where: { id: req.params.id as string },
      include: {
        patient: { include: { user: { select: { name: true, phone: true } } } },
        department: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
        hospital: { select: { name: true } },
      },
    });
    if (!token) throw AppError.notFound('Token');
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Get patient's active token
router.get('/patient/:patientId/active', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date(new Date().toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const token = await prisma.queueToken.findFirst({
      where: { patientId: req.params.patientId as string, status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION']  },
        date: { gte: todayStart, lt: todayEnd },
      },
      include: {
        department: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
        hospital: { select: { name: true } },
      },
    });

    if (token) {
      // Calculate position
      const ahead = await prisma.queueToken.count({
        where: {
          departmentId: token.departmentId,
          doctorId: token.doctorId,
          status: 'WAITING',
          date: { gte: todayStart, lt: todayEnd },
          createdAt: { lt: token.createdAt },
        },
      });
      const estimatedWait = await estimateWaitTime(token.doctorId, token.departmentId, token.priority, new Date());

      res.json(successResponse({ ...token, patientsAhead: ahead, estimatedWaitMinutes: estimatedWait }));
    } else {
      res.json(successResponse(null));
    }
  } catch (err) { next(err); }
});

// Call next patient
router.patch('/token/:id/call', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.update({
      where: { id: req.params.id as string },
      data: { status: 'CALLED', calledTime: new Date() },
      include: {
        patient: { include: { user: { select: { id: true, name: true } } } },
        department: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    // Notify patient
    emitTokenCalled(token.patient.user.id, {
      tokenId: token.id,
      displayToken: token.displayToken,
      doctorName: token.doctor?.user.name,
      department: token.department.name,
    });

    await prisma.notification.create({
      data: {
        userId: token.patient.user.id,
        type: 'TOKEN_CALLED',
        title: 'Your Token Has Been Called!',
        message: `Token ${token.displayToken} — Please proceed to ${token.department.name}${token.doctor ? ', Dr. ' + token.doctor.user.name : ''}.`,
        data: JSON.stringify({ tokenId: token.id }),
      },
    });

    emitQueueUpdate(token.hospitalId, token.departmentId, { action: 'TOKEN_CALLED', token });
    auditFromRequest(req, 'CALL', 'QueueToken', token.id);
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Start consultation
router.patch('/token/:id/start', authenticate, authorize('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.update({
      where: { id: req.params.id as string },
      data: {
        status: 'IN_CONSULTATION',
        consultationStartTime: new Date(),
        actualWaitMinutes: Math.round((Date.now() - new Date(req.body.calledTime || Date.now()).getTime()) / 60000),
      },
      include: { department: { select: { name: true } } },
    });

    emitTokenStatusChanged(token.hospitalId, token.departmentId, { action: 'CONSULTATION_STARTED', tokenId: token.id });
    auditFromRequest(req, 'START_CONSULTATION', 'QueueToken', token.id);
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Complete consultation
router.patch('/token/:id/complete', authenticate, authorize('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.update({
      where: { id: req.params.id as string },
      data: { status: 'COMPLETED', consultationEndTime: new Date() },
      include: { department: { select: { name: true } }, patient: { select: { userId: true } } },
    });

    emitTokenStatusChanged(token.hospitalId, token.departmentId, { action: 'CONSULTATION_COMPLETED', tokenId: token.id });
    emitQueueUpdate(token.hospitalId, token.departmentId, { action: 'TOKEN_COMPLETED', tokenId: token.id });
    auditFromRequest(req, 'COMPLETE', 'QueueToken', token.id);
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Skip / No-show
router.patch('/token/:id/skip', authenticate, authorize('DOCTOR', 'RECEPTIONIST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.update({
      where: { id: req.params.id as string },
      data: { status: 'NO_SHOW', cancellationReason: req.body.reason || 'No show' },
      include: { department: { select: { name: true } } },
    });

    emitQueueUpdate(token.hospitalId, token.departmentId, { action: 'TOKEN_SKIPPED', tokenId: token.id });
    auditFromRequest(req, 'SKIP', 'QueueToken', token.id);
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Cancel token
router.patch('/token/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.update({
      where: { id: req.params.id as string },
      data: {
        status: 'CANCELLED',
        cancellationTime: new Date(),
        cancellationReason: req.body.reason || 'Cancelled by user',
      },
      include: { department: { select: { name: true } } },
    });

    emitQueueUpdate(token.hospitalId, token.departmentId, { action: 'TOKEN_CANCELLED', tokenId: token.id });
    auditFromRequest(req, 'CANCEL', 'QueueToken', token.id);
    res.json(successResponse(token));
  } catch (err) { next(err); }
});

// Get wait estimate
router.get('/estimate/:tokenId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await prisma.queueToken.findUnique({ where: { id: req.params.tokenId as string } });
    if (!token) throw AppError.notFound('Token');

    const estimate = await estimateWaitTime(token.doctorId, token.departmentId, token.priority, new Date());
    res.json(successResponse({ estimatedWaitMinutes: estimate }));
  } catch (err) { next(err); }
});

export { router as queueRoutes };
