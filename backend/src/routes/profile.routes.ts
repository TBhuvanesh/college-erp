import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { updateProfileSchema, changePasswordSchema } from '../types/profile';

const router = Router();

router.use(authenticate);

// GET /api/profile — returns the authenticated user's profile (role-specific shape)
router.get('/', profileController.getProfile);

// PUT /api/profile — update phone number or email (own account only)
router.put(
  '/',
  validate({ body: updateProfileSchema }),
  profileController.updateProfile
);

// PUT /api/profile/change-password — change own password; invalidates all sessions
router.put(
  '/change-password',
  validate({ body: changePasswordSchema }),
  profileController.changePassword
);

export default router;
