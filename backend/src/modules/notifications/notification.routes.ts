import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { successResponse } from '../../utils/response';

const router = Router();

// Get notifications for current user
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.id } }),
      prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);

    res.json(successResponse({ notifications, total, unreadCount, page, limit }));
  } catch (err) { next(err); }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id as string },
      data: { read: true },
    });
    res.json(successResponse(notification));
  } catch (err) { next(err); }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json(successResponse({ message: 'All notifications marked as read' }));
  } catch (err) { next(err); }
});

export { router as notificationRoutes };
