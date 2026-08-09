import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize, requireHospital } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';

const router = Router();

const departmentSchema = z.object({
  hospitalId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
  floor: z.number().int().default(0),
  avgConsultationMinutes: z.number().int().default(10),
  dailyCapacity: z.number().int().default(50),
  emergencySupported: z.boolean().default(false),
});

// List departments for a hospital
router.get('/hospital/:hospitalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      where: { hospitalId: req.params.hospitalId as string, active: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { doctors: true, queueTokens: { where: { status: 'WAITING' } } } },
      },
    });
    res.json(successResponse(departments));
  } catch (err) { next(err); }
});

// Get department by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.findUnique({
      where: { id: req.params.id as string },
      include: {
        doctors: {
          where: { active: true },
          include: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { queueTokens: { where: { status: 'WAITING' } } } },
      },
    });
    if (!dept) throw AppError.notFound('Department');
    res.json(successResponse(dept));
  } catch (err) { next(err); }
});

// Create department
router.post('/', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), validate(departmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.create({ data: { ...req.body, active: true } });
    auditFromRequest(req, 'CREATE', 'Department', dept.id);
    res.status(201).json(successResponse(dept));
  } catch (err) { next(err); }
});

// Update department
router.put('/:id', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await prisma.department.update({ where: { id: req.params.id as string }, data: req.body });
    auditFromRequest(req, 'UPDATE', 'Department', dept.id);
    res.json(successResponse(dept));
  } catch (err) { next(err); }
});

// Deactivate department (soft delete)
router.delete('/:id', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.department.update({      where: { id: req.params.id as string },
      data: { active: false }, });
    auditFromRequest(req, 'DEACTIVATE', 'Department', req.params.id as string);
    res.json(successResponse({ message: 'Department deactivated' }));
  } catch (err) { next(err); }
});

export { router as departmentRoutes };
