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

const prescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  patientId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    medicineName: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
    instructions: z.string().optional(),
  })).min(1, 'At least one medicine is required'),
});

// Create prescription
router.post('/', authenticate, authorize('DOCTOR'), validate(prescriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) throw AppError.notFound('Doctor profile');

    const { items, ...data } = req.body;

    const prescription = await prisma.prescription.create({
      data: {
        ...data,
        doctorId: doctor.id,
        items: { create: items },
      },
      include: { items: true, patient: { include: { user: { select: { id: true, name: true } } } } },
    });

    // Notify patient
    await prisma.notification.create({
      data: {
        userId: prescription.patient.user.id,
        type: 'PRESCRIPTION_CREATED',
        title: 'New Prescription',
        message: `Dr. ${req.user!.name} has created a prescription for you.`,
        data: JSON.stringify({ prescriptionId: prescription.id }),
      },
    });
    emitNotification(prescription.patient.user.id, { type: 'PRESCRIPTION_CREATED' });

    auditFromRequest(req, 'CREATE', 'Prescription', prescription.id);
    res.status(201).json(successResponse(prescription));
  } catch (err) { next(err); }
});

// Get prescriptions for patient
router.get('/patient/:patientId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: req.params.patientId as string },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        consultation: { select: { diagnosis: true, chiefComplaint: true } },
      },
    });
    res.json(successResponse(prescriptions));
  } catch (err) { next(err); }
});

// Get prescription by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.id as string },
      include: {
        items: true,
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        patient: { include: { user: { select: { name: true } } } },
        consultation: { select: { diagnosis: true, chiefComplaint: true, clinicalNotes: true } },
      },
    });
    if (!prescription) throw AppError.notFound('Prescription');
    res.json(successResponse(prescription));
  } catch (err) { next(err); }
});

export { router as prescriptionRoutes };
