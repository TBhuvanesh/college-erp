import { Router } from 'express';
import * as controller from '../controllers/mentorshipSettings.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { updateMentorshipSettingsSchema } from '../types/mentorGroup';

const router = Router();

router.use(authenticate);

router.get('/', controller.getSettings);
router.put('/', requireRole('admin'), validate({ body: updateMentorshipSettingsSchema }), controller.updateSettings);

export default router;
