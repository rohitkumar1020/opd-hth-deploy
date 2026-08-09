import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { auditFromRequest } from '../../utils/audit';
import bcrypt from 'bcryptjs';

const router = Router();

const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(['NURSE', 'RECEPTIONIST']),
  hospitalId: z.string().uuid(),
});

// List staff for hospital
router.get('/hospital/:hospitalId', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string;
    const where: any = {
      hospitalId: req.params.hospitalId,
      role: { in: ['NURSE', 'RECEPTIONIST'] },
      active: true,
    };
    if (role) where.role = role;

    const staff = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, active: true },
      orderBy: { name: 'asc' },
    });
    res.json(successResponse(staff));
  } catch (err) { next(err); }
});

// Create staff
router.post('/', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), validate(staffSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone, role, hospitalId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone, role, hospitalId },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });

    auditFromRequest(req, 'CREATE', 'Staff', user.id, { role });
    res.status(201).json(successResponse(user));
  } catch (err) { next(err); }
});

// Update staff
router.put('/:id', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, active } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { ...(name && { name }), ...(phone && { phone }), ...(active !== undefined && { active }) },
      select: { id: true, email: true, name: true, phone: true, role: true, active: true },
    });
    auditFromRequest(req, 'UPDATE', 'Staff', user.id);
    res.json(successResponse(user));
  } catch (err) { next(err); }
});

// Deactivate staff (soft delete)
router.delete('/:id', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.params.id as string }, data: { active: false } });
    auditFromRequest(req, 'DEACTIVATE', 'Staff', req.params.id as string);
    res.json(successResponse({ message: 'Staff member deactivated' }));
  } catch (err) { next(err); }
});

export { router as staffRoutes };
