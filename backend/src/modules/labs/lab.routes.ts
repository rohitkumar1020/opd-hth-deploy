import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';
import { emitNotification } from '../realtime/socket';

const router = Router();

const labOrderSchema = z.object({
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  testName: z.string().min(2),
  priority: z.enum(['NORMAL', 'MODERATE', 'HIGH', 'EMERGENCY']).default('NORMAL'),
  notes: z.string().optional(),
});

// Order lab test
router.post('/order', authenticate, authorize('DOCTOR'), validate(labOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) throw AppError.notFound('Doctor profile');

    const order = await prisma.labOrder.create({
      data: { ...req.body, doctorId: doctor.id },
      include: {
        patient: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Notify patient
    await prisma.notification.create({
      data: {
        userId: order.patient.user.id,
        type: 'GENERAL',
        title: 'Lab Test Ordered',
        message: `Dr. ${req.user!.name} has ordered a ${order.testName} test.`,
        data: JSON.stringify({ labOrderId: order.id }),
      },
    });

    auditFromRequest(req, 'CREATE', 'LabOrder', order.id);
    res.status(201).json(successResponse(order));
  } catch (err) { next(err); }
});

// Upload lab report
router.post('/report/:orderId', authenticate, authorize('DOCTOR', 'NURSE', 'RECEPTIONIST', 'HOSPITAL_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { findings, fileUrl, cloudinaryId, aiSummary } = req.body;

    const order = await prisma.labOrder.findUnique({
      where: { id: req.params.orderId as string },
      include: { patient: { select: { userId: true } } },
    });
    if (!order) throw AppError.notFound('Lab order');

    const report = await prisma.labReport.create({
      data: {
        labOrderId: req.params.orderId as string,
        findings,
        fileUrl,
        cloudinaryId,
        aiSummary,
        uploadedById: req.user!.id,
      },
    });

    // Update order status
    await prisma.labOrder.update({
      where: { id: req.params.orderId as string },
      data: { status: 'COMPLETED' },
    });

    // Notify patient
    await prisma.notification.create({
      data: {
        userId: order.patient.userId,
        type: 'LAB_REPORT_READY',
        title: 'Lab Report Ready',
        message: `Your ${order.testName} report is now available.`,
        data: JSON.stringify({ labOrderId: order.id, reportId: report.id }),
      },
    });
    emitNotification(order.patient.userId, { type: 'LAB_REPORT_READY', testName: order.testName });

    auditFromRequest(req, 'UPLOAD', 'LabReport', report.id);
    res.status(201).json(successResponse(report));
  } catch (err) { next(err); }
});

// Get lab orders for patient
router.get('/patient/:patientId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.labOrder.findMany({
      where: { patientId: req.params.patientId as string },
      orderBy: { createdAt: 'desc' },
      include: {
        reports: true,
        doctor: { include: { user: { select: { name: true } } } },
      },
    });
    res.json(successResponse(orders));
  } catch (err) { next(err); }
});

// Get lab order by ID
router.get('/order/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: req.params.id as string },
      include: {
        reports: { include: { uploadedBy: { select: { name: true } } } },
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        patient: { include: { user: { select: { name: true } } } },
      },
    });
    if (!order) throw AppError.notFound('Lab order');
    res.json(successResponse(order));
  } catch (err) { next(err); }
});

// Update order status
router.patch('/order/:id/status', authenticate, authorize('DOCTOR', 'NURSE', 'RECEPTIONIST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const order = await prisma.labOrder.update({
      where: { id: req.params.id as string },
      data: { status },
    });
    res.json(successResponse(order));
  } catch (err) { next(err); }
});

export { router as labRoutes };
