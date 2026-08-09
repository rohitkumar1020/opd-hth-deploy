import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { successResponse } from '../../utils/response';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(successResponse(result));
    } catch (err) { next(err); }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.json(successResponse(result));
    } catch (err) { next(err); }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getProfile(req.user!.id);
      res.json(successResponse(user));
    } catch (err) { next(err); }
  }
}

export const authController = new AuthController();
