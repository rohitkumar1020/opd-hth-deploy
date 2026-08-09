import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { registerSchema, loginSchema } from './auth.schema';

const router = Router();

router.post('/register', validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getProfile(req, res, next));

export { router as authRoutes };
