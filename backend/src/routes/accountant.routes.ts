import { Router } from 'express';
import { z } from 'zod';
import * as accountantController from '../controllers/accountant.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createAccountantSchema,
  updateAccountantSchema,
  listAccountantsQuerySchema,
} from '../types/accountant';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid accountant ID') }) };

// Protect all accountant endpoints to require admin authentication
router.use(authenticate, requireRole('admin'));

router.post(
  '/',
  validate({ body: createAccountantSchema }),
  accountantController.createAccountant
);

router.get(
  '/',
  validate({ query: listAccountantsQuerySchema }),
  accountantController.listAccountants
);

router.get(
  '/:id',
  validate(uuidParam),
  accountantController.getAccountant
);

router.patch(
  '/:id',
  validate({ ...uuidParam, body: updateAccountantSchema }),
  accountantController.updateAccountant
);

router.patch(
  '/:id/status',
  validate({
    ...uuidParam,
    body: z.object({ isActive: z.boolean() }),
  }),
  accountantController.updateAccountantStatus
);

router.delete(
  '/:id',
  validate(uuidParam),
  accountantController.deleteAccountant
);

export default router;
