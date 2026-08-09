import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse, paginatedResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';

const router = Router();

const hospitalSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pinCode: z.string().min(5),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  opdStartTime: z.string().default('08:00'),
  opdEndTime: z.string().default('16:00'),
  emergencyAvailable: z.boolean().default(true),
  workingDays: z.string().default('MON,TUE,WED,THU,FRI,SAT'),
});

// List hospitals
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const where: any = { active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [hospitals, total] = await Promise.all([
      prisma.hospital.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { departments: true, users: true } } },
      }),
      prisma.hospital.count({ where }),
    ]);

    res.json(paginatedResponse(hospitals, total, page, limit));
  } catch (err) { next(err); }
});

// Get hospital by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: req.params.id as string },
      include: {
        departments: { where: { active: true }, orderBy: { name: 'asc' } },
        _count: { select: { departments: true, users: true, rooms: true } },
      },
    });
    if (!hospital) throw AppError.notFound('Hospital');
    res.json(successResponse(hospital));
  } catch (err) { next(err); }
});

// Create hospital (admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'HOSPITAL_ADMIN'), validate(hospitalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospital = await prisma.hospital.create({ data: req.body });
    auditFromRequest(req, 'CREATE', 'Hospital', hospital.id);
    res.status(201).json(successResponse(hospital));
  } catch (err) { next(err); }
});

// Update hospital
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'HOSPITAL_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospital = await prisma.hospital.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    auditFromRequest(req, 'UPDATE', 'Hospital', hospital.id);
    res.json(successResponse(hospital));
  } catch (err) { next(err); }
});

export { router as hospitalRoutes };
