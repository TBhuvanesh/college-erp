import { Router } from 'express';
import { z } from 'zod';
import * as feeController from '../controllers/fee.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createFeeSchema,
  bulkCreateFeeSchema,
  updateFeeSchema,
  recordPaymentSchema,
  listFeesQuerySchema,
} from '../types/fee';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid fee record ID') }) };

// ── Static paths before /:id ───────────────────────────────────────────────────

// Admin/Accountant: batch-assign same fee to all students in a program or explicit list
router.post(
  '/bulk',
  authenticate,
  requireRole('admin', 'accountant'),
  validate({ body: bulkCreateFeeSchema }),
  feeController.bulkCreateFees
);

// Student: all own fee records (optionally filtered)
router.get(
  '/my-fees',
  authenticate,
  requireRole('student'),
  feeController.getMyFees
);

// Student: only pending/overdue/partially-paid fees, sorted by due date
router.get(
  '/my-dues',
  authenticate,
  requireRole('student'),
  feeController.getMyDues
);

// ── Collection endpoints ───────────────────────────────────────────────────────

// Admin/Accountant: list all fee records with filters
router.get(
  '/',
  authenticate,
  requireRole('admin', 'accountant'),
  validate({ query: listFeesQuerySchema }),
  feeController.listFees
);

// Admin/Accountant: create a single fee record
router.post(
  '/',
  authenticate,
  requireRole('admin', 'accountant'),
  validate({ body: createFeeSchema }),
  feeController.createFee
);

// ── Individual fee endpoints (/:id last) ───────────────────────────────────────

// Admin/Accountant + Student: view single fee record (student sees own only)
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'student', 'accountant'),
  validate(uuidParam),
  feeController.getFee
);

// Admin/Accountant: update fee amount, due date, or remarks
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'accountant'),
  validate({ ...uuidParam, body: updateFeeSchema }),
  feeController.updateFee
);

// Admin/Accountant: soft-delete (only if no payments recorded)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'accountant'),
  validate(uuidParam),
  feeController.deleteFee
);

// ── Payment sub-resource (/:id/payments) ──────────────────────────────────────

// Admin/Accountant: record a new payment against this fee
router.post(
  '/:id/payments',
  authenticate,
  requireRole('admin', 'accountant'),
  validate({ ...uuidParam, body: recordPaymentSchema }),
  feeController.recordPayment
);

// Admin/Accountant + Student: view payment history (student sees own only)
router.get(
  '/:id/payments',
  authenticate,
  requireRole('admin', 'student', 'accountant'),
  validate(uuidParam),
  feeController.getFeePayments
);

export default router;
