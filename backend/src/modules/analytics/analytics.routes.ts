import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';

const router = Router();

// Hospital dashboard analytics
router.get('/hospital/:hospitalId', authenticate, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.params.hospitalId as string;
    const todayStart = new Date(new Date().toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const dateFilter = { gte: todayStart, lt: todayEnd };

    const [
      totalPatientsToday,
      waitingPatients,
      completedConsultations,
      emergencyTokens,
      cancelledTokens,
      noShowTokens,
      onlineDoctors,
      totalDoctors,
      allTokensToday,
    ] = await Promise.all([
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter } }),
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter, status: 'WAITING' } }),
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter, status: 'COMPLETED' } }),
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter, priority: 'EMERGENCY' } }),
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter, status: 'CANCELLED' } }),
      prisma.queueToken.count({ where: { hospitalId, date: dateFilter, status: 'NO_SHOW' } }),
      prisma.doctorProfile.count({ where: { user: { hospitalId }, isOnline: true, active: true } }),
      prisma.doctorProfile.count({ where: { user: { hospitalId }, active: true } }),
      prisma.queueToken.findMany({
        where: { hospitalId, date: dateFilter },
        select: { actualWaitMinutes: true, estimatedWaitMinutes: true, consultationStartTime: true, consultationEndTime: true },
      }),
    ]);

    // Calculate average wait time
    const completedWithWait = allTokensToday.filter(t => t.actualWaitMinutes != null);
    const avgWaitTime = completedWithWait.length > 0
      ? Math.round(completedWithWait.reduce((sum, t) => sum + (t.actualWaitMinutes || 0), 0) / completedWithWait.length)
      : 0;

    // Calculate average consultation duration
    const completedWithDuration = allTokensToday.filter(t => t.consultationStartTime && t.consultationEndTime);
    const avgConsultDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, t) => {
          const start = new Date(t.consultationStartTime!).getTime();
          const end = new Date(t.consultationEndTime!).getTime();
          return sum + (end - start) / 60000;
        }, 0) / completedWithDuration.length)
      : 0;

    // Department load
    const departments = await prisma.department.findMany({
      where: { hospitalId, active: true },
      include: {
        _count: {
          select: {
            queueTokens: { where: { date: dateFilter, status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] } } },
          },
        },
        doctors: {
          where: { active: true },
          include: {
            _count: { select: { queueTokens: { where: { date: dateFilter, status: { in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] } } } } },
          },
        },
      },
    });

    const departmentLoad = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      activePatients: dept._count.queueTokens,
      capacity: dept.dailyCapacity,
      utilization: Math.round((dept._count.queueTokens / dept.dailyCapacity) * 100),
      doctorCount: dept.doctors.length,
      onlineDoctors: dept.doctors.filter((d: any) => d.isOnline).length,
    }));

    // Hourly traffic (simplified: group by hour)
    const hourlyTokens = await prisma.queueToken.groupBy({
      by: ['createdAt'],
      where: { hospitalId, date: dateFilter },
    });

    const hourlyTraffic: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyTraffic[h] = 0;
    hourlyTokens.forEach(t => {
      const hour = new Date(t.createdAt).getHours();
      hourlyTraffic[hour] = (hourlyTraffic[hour] || 0) + 1;
    });

    res.json(successResponse({
      overview: {
        totalPatientsToday,
        waitingPatients,
        completedConsultations,
        emergencyTokens,
        cancelledTokens,
        noShowTokens,
        avgWaitTime,
        avgConsultDuration,
        onlineDoctors,
        totalDoctors,
        offlineDoctors: totalDoctors - onlineDoctors,
      },
      departmentLoad,
      hourlyTraffic: Object.entries(hourlyTraffic).map(([hour, count]) => ({ hour: parseInt(hour), count })),
    }));
  } catch (err) { next(err); }
});

// Doctor stats
router.get('/doctor/:doctorId', authenticate, authorize('DOCTOR', 'HOSPITAL_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = req.params.doctorId as string;
    const todayStart = new Date(new Date().toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const dateFilter = { gte: todayStart, lt: todayEnd };

    const [totalToday, waiting, completed, emergency, inConsultation] = await Promise.all([
      prisma.queueToken.count({ where: { doctorId, date: dateFilter } }),
      prisma.queueToken.count({ where: { doctorId, date: dateFilter, status: 'WAITING' } }),
      prisma.queueToken.count({ where: { doctorId, date: dateFilter, status: 'COMPLETED' } }),
      prisma.queueToken.count({ where: { doctorId, date: dateFilter, priority: 'EMERGENCY' } }),
      prisma.queueToken.count({ where: { doctorId, date: dateFilter, status: 'IN_CONSULTATION' } }),
    ]);

    res.json(successResponse({
      totalToday,
      waiting,
      completed,
      emergency,
      inConsultation,
    }));
  } catch (err) { next(err); }
});

export { router as analyticsRoutes };
