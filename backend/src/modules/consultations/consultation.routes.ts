import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';

const router = Router();

const consultationSchema = z.object({
  tokenId: z.string().uuid(),
  patientId: z.string().uuid(),
  chiefComplaint: z.string().optional(),
  history: z.string().optional(),
  clinicalNotes: z.string().optional(),
  diagnosis: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpDate: z.string().optional(),
  referralDept: z.string().optional(),
  referralNotes: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DRAFT']).default('IN_PROGRESS'),
});

// Create consultation
router.post('/', authenticate, authorize('DOCTOR'), validate(consultationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) throw AppError.notFound('Doctor profile');

    const data: any = { ...req.body, doctorId: doctor.id };
    if (data.followUpDate) data.followUpDate = new Date(data.followUpDate);

    const consultation = await prisma.consultation.create({
      data,
      include: {
        token: { select: { displayToken: true } },
        patient: { include: { user: { select: { name: true } } } },
      },
    });

    auditFromRequest(req, 'CREATE', 'Consultation', consultation.id);
    res.status(201).json(successResponse(consultation));
  } catch (err) { next(err); }
});

// Update consultation
router.put('/:id', authenticate, authorize('DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = { ...req.body };
    if (data.followUpDate) data.followUpDate = new Date(data.followUpDate);

    const consultation = await prisma.consultation.update({
      where: { id: req.params.id as string },
      data,
      include: {
        token: { select: { displayToken: true } },
        prescriptions: { include: { items: true } },
        labOrders: true,
      },
    });

    auditFromRequest(req, 'UPDATE', 'Consultation', consultation.id);
    res.json(successResponse(consultation));
  } catch (err) { next(err); }
});

// Get consultation by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id as string },
      include: {
        token: { select: { displayToken: true, priority: true, triageId: true } },
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        patient: {
          include: {
            user: { select: { name: true, phone: true } },
            vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        prescriptions: { include: { items: true } },
        labOrders: { include: { reports: true } },
      },
    });
    if (!consultation) throw AppError.notFound('Consultation');

    // Fetch triage if available
    let triage = null;
    if ((consultation as any).token?.triageId) {
      triage = await prisma.triageAssessment.findUnique({ where: { id: (consultation as any).token.triageId } });
    }

    res.json(successResponse({ ...consultation, triage }));
  } catch (err) { next(err); }
});

// Get consultations by token
router.get('/token/:tokenId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { tokenId: req.params.tokenId as string },
      include: {
        prescriptions: { include: { items: true } },
        labOrders: { include: { reports: true } },
      },
    });
    res.json(successResponse(consultation));
  } catch (err) { next(err); }
});

export { router as consultationRoutes };
