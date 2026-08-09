import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (err: any) {
      if (err.constructor?.name === 'ZodError') {
        const details = err.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(AppError.validationError('Invalid input data', details));
      } else {
        next(err);
      }
    }
  };
}
