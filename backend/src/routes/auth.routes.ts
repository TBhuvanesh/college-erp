import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';

const router = Router();

const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
};

// Public
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Protected
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.me);

export default router;
