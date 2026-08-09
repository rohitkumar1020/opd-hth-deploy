import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';
import bcrypt from 'bcryptjs';
import { emitDoctorStatusChanged } from '../realtime/socket';

const router = Router();

const doctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
  hospitalId: z.string().uuid(),
  departmentId: z.string().uuid(),
  registrationNumber: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  roomNumber: z.string().optional(),
  floor: z.number().int().default(0),
  workingDays: z.string().default('MON,TUE,WED,THU,FRI,SAT'),
  shiftStart: z.string().default('08:00'),
  shiftEnd: z.string().default('16:00'),
  maxPatientsPerDay: z.number().int().default(30),
  avgConsultMinutes: z.number().int().default(10),
  emergencyAvailable: z.boolean().default(false),
});

// List doctors for a hospital
router.get('/hospital/:hospitalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = req.query.departmentId as string;
    const where: any = {
      user: { hospitalId: req.params.hospitalId },
      active: true,
    };
    if (departmentId) where.departmentId = departmentId;

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            queueTokens: {
              where: {
                status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] },
                date: new Date(new Date().toISOString().split('T')[0]),
              },
            },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });
    res.json(successResponse(doctors));
  } catch (err) { next(err); }
});

// Get doctor by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: req.params.id as string },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!doctor) throw AppError.notFound('Doctor');
    res.json(successResponse(doctor));
  } catch (err) { next(err); }
});

// Get doctor by user ID
router.get('/user/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.params.userId as string },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, hospitalId: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!doctor) throw AppError.notFound('Doctor profile');
    res.json(successResponse(doctor));
  } catch (err) { next(err); }
});

// Create doctor (Admin)
router.post('/', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), validate(doctorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone, hospitalId, departmentId, ...profileData } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, password: hashedPassword, name, phone, role: 'DOCTOR', hospitalId },
      });

      const doctorProfile = await tx.doctorProfile.create({
        data: { userId: user.id, departmentId, ...profileData },
        include: { user: { select: { id: true, name: true, email: true } }, department: { select: { name: true } } },
      });

      return doctorProfile;
    });

    auditFromRequest(req, 'CREATE', 'Doctor', result.id);
    res.status(201).json(successResponse(result));
  } catch (err) { next(err); }
});

// Update doctor
router.put('/:id', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, ...profileData } = req.body;
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: req.params.id as string } });
    if (!doctor) throw AppError.notFound('Doctor');

    if (name || phone) {
      await prisma.user.update({ where: { id: doctor.userId }, data: { ...(name && { name }), ...(phone && { phone }) } });
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: req.params.id as string },
      data: profileData,
      include: { user: { select: { id: true, name: true, email: true } }, department: { select: { name: true } } },
    });

    auditFromRequest(req, 'UPDATE', 'Doctor', req.params.id as string);
    res.json(successResponse(updated));
  } catch (err) { next(err); }
});

// Toggle doctor online/offline
router.patch('/:id/status', authenticate, authorize('DOCTOR', 'HOSPITAL_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isOnline } = req.body;
    const doctor = await prisma.doctorProfile.update({
      where: { id: req.params.id as string },
      data: { isOnline },
      include: { user: { select: { id: true, name: true, hospitalId: true } }, department: { select: { name: true } } },
    });

    if (doctor.user.hospitalId) {
      emitDoctorStatusChanged(doctor.user.hospitalId, {
        doctorId: doctor.id,
        name: doctor.user.name,
        department: doctor.department.name,
        isOnline,
      });
    }

    res.json(successResponse(doctor));
  } catch (err) { next(err); }
});

export { router as doctorRoutes };
