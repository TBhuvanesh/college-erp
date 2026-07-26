import { Router } from 'express';
import * as controller from '../controllers/resultEntryTask.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', controller.listMyResultEntryTasks);
router.get('/:id', controller.getResultEntryTask);
router.post('/:id/submit', controller.submitTaskForApproval);
router.post('/:id/verify', controller.verifyResultEntryTask);

export default router;
