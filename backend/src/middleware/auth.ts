import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from '../utils/errors';
import { prisma } from '../config/database';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  hospitalId: string | null;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, hospitalId: true, name: true, active: true },
    });

    if (!user || !user.active) {
      throw AppError.unauthorized('User not found or inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      name: user.name,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Invalid token'));
    } else if (err instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('Token expired'));
    } else {
      next(err);
    }
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

export function requireHospital(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(AppError.unauthorized());
  }
  if (!req.user.hospitalId && req.user.role !== 'SUPER_ADMIN') {
    return next(AppError.forbidden('No hospital assigned'));
  }
  next();
}

export function requireSameHospital(paramKey = 'hospitalId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.role === 'SUPER_ADMIN') return next();

    const targetHospitalId = req.params[paramKey] || req.body?.hospitalId || req.query?.hospitalId;
    if (targetHospitalId && targetHospitalId !== req.user.hospitalId) {
      return next(AppError.forbidden('Access denied: hospital scope mismatch'));
    }
    next();
  };
}
