import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse, paginatedResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';

const router = Router();

const updatePatientSchema = z.object({
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  emergencyContact: z.string().optional(),
  aadhaarLast4: z.string().max(4).optional(),
  allergies: z.string().optional(),
  currentMedicines: z.string().optional(),
});

const familyMemberSchema = z.object({
  name: z.string().min(2),
  relation: z.string().min(2),
  age: z.number().int().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  phone: z.string().optional(),
});

// Get current patient profile
router.get('/me', authenticate, authorize('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        familyMembers: true,
      },
    });
    if (!patient) throw AppError.notFound('Patient profile');
    res.json(successResponse(patient));
  } catch (err) { next(err); }
});

// Update patient profile
router.put('/me', authenticate, authorize('PATIENT'), validate(updatePatientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body };
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    const patient = await prisma.patient.update({
      where: { userId: req.user!.id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    auditFromRequest(req, 'UPDATE', 'Patient', patient.id);
    res.json(successResponse(patient));
  } catch (err) { next(err); }
});

// Search patients (for receptionist/doctor/admin)
router.get('/search', authenticate, authorize('DOCTOR', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'NURSE'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!search || search.length < 2) {
      return res.json(paginatedResponse([], 0, page, limit));
    }

    const where: any = {
      user: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
        role: 'PATIENT',
      },
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json(paginatedResponse(patients, total, page, limit));
  } catch (err) { next(err); }
});

// Get patient by ID (doctor/receptionist/admin)
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id as string },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        familyMembers: true,
        vitals: { orderBy: { createdAt: 'desc' }, take: 5 },
        consultations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
            prescriptions: { include: { items: true } },
            labOrders: { include: { reports: true } },
          },
        },
      },
    });
    if (!patient) throw AppError.notFound('Patient');

    auditFromRequest(req, 'VIEW', 'Patient', patient.id);
    res.json(successResponse(patient));
  } catch (err) { next(err); }
});

// Add family member
router.post('/me/family', authenticate, authorize('PATIENT'), validate(familyMemberSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } });
    if (!patient) throw AppError.notFound('Patient profile');

    const member = await prisma.familyMember.create({
      data: { ...req.body, patientId: patient.id },
    });
    res.status(201).json(successResponse(member));
  } catch (err) { next(err); }
});

// Get patient medical history
router.get('/:id/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consultations = await prisma.consultation.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { include: { user: { select: { name: true } }, department: { select: { name: true } } } },
        prescriptions: { include: { items: true } },
        labOrders: { include: { reports: true } },
        token: { select: { displayToken: true, date: true, priority: true } },
      },
    });

    const vitals = await prisma.vital.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const triageAssessments = await prisma.triageAssessment.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(successResponse({ consultations, vitals, triageAssessments }));
  } catch (err) { next(err); }
});

export { router as patientRoutes };
