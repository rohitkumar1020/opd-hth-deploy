import { Request } from 'express';
import { prisma } from '../config/database';

export interface AuditLogInput {
  actorId: string;
  role: string;
  action: string;
  resource: string;
  resourceId?: string;
  hospitalId?: string;
  details?: any;
  ipAddress?: string;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        role: input.role,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId || null,
        hospitalId: input.hospitalId || null,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

export function auditFromRequest(req: Request, action: string, resource: string, resourceId?: string, details?: any) {
  if (!req.user) return;
  createAuditLog({
    actorId: req.user.id,
    role: req.user.role,
    action,
    resource,
    resourceId,
    hospitalId: req.user.hospitalId || undefined,
    details,
    ipAddress: req.ip,
  });
}
