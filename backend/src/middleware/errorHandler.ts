import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      errorResponse(err.code, err.message, err.details)
    );
    return;
  }

  // Prisma errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json(
        errorResponse('CONFLICT', 'A record with this data already exists')
      );
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json(
        errorResponse('NOT_FOUND', 'Record not found')
      );
      return;
    }
  }

  // Zod validation errors
  if (err.constructor?.name === 'ZodError') {
    const zodErr = err as any;
    res.status(422).json(
      errorResponse('VALIDATION_ERROR', 'Invalid input data', zodErr.issues)
    );
    return;
  }

  console.error('Unhandled error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(500).json(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred')
  );
}
