import { Router } from 'express';
import * as controller from '../controllers/teachingLoadSettings.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', controller.getSettings);
router.put('/', controller.updateSettings);

export default router;
