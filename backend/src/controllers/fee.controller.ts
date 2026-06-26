import type { Request, Response } from 'express';
import * as feeService from '../services/fee.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type {
  CreateFeeInput,
  BulkCreateFeeInput,
  UpdateFeeInput,
  RecordPaymentInput,
  ListFeesQuery,
  FeeType,
} from '../types/fee';

// ── Admin: list and create ────────────────────────────────────────────────────

export const listFees = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListFeesQuery;
  const result = await feeService.listFees(filters);
  sendSuccess(res, result);
});

export const createFee = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateFeeInput;
  const fee = await feeService.createFee(data, req.user!.id);
  sendCreated(res, { fee }, 'Fee record created successfully');
});

export const bulkCreateFees = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as BulkCreateFeeInput;
  const result = await feeService.bulkCreateFees(data, req.user!.id);
  sendCreated(res, result, `${result.created} fee record(s) created successfully`);
});

// ── Admin + Student: single fee record ────────────────────────────────────────

export const getFee = asyncHandler(async (req: Request, res: Response) => {
  const fee = await feeService.getFeeById(req.params.id);

  // Students may only view their own fee records
  if (req.user!.role === 'student') {
    const { rows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!rows[0] || fee.studentId !== rows[0].id) {
      throw AppError.forbidden('You can only view your own fee records');
    }
  }

  sendSuccess(res, { fee });
});

// ── Admin: update and delete ──────────────────────────────────────────────────

export const updateFee = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateFeeInput;
  const fee = await feeService.updateFee(req.params.id, data, req.user!.id);
  sendSuccess(res, { fee }, 'Fee record updated successfully');
});

export const deleteFee = asyncHandler(async (req: Request, res: Response) => {
  await feeService.deleteFee(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Fee record deleted successfully');
});

// ── Admin: payment endpoints ───────────────────────────────────────────────────

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as RecordPaymentInput;
  const fee = await feeService.recordPayment(req.params.id, data, req.user!.id);
  sendCreated(res, { fee }, 'Payment recorded successfully');
});

export const getFeePayments = asyncHandler(async (req: Request, res: Response) => {
  const feeId = req.params.id;

  // Students may only view payment history for their own fees
  if (req.user!.role === 'student') {
    const { rows: feeRows } = await (await import('../config/database')).query<{ student_id: string }>(
      'SELECT student_id FROM fees WHERE id = $1 AND deleted_at IS NULL',
      [feeId]
    );
    if (!feeRows[0]) throw AppError.notFound('Fee record not found');

    const { rows: stuRows } = await (await import('../config/database')).query<{ id: string }>(
      'SELECT id FROM students WHERE user_id = $1 AND deleted_at IS NULL',
      [req.user!.id]
    );
    if (!stuRows[0] || feeRows[0].student_id !== stuRows[0].id) {
      throw AppError.forbidden('You can only view payment history for your own fee records');
    }
  }

  const payments = await feeService.getFeePayments(feeId);
  sendSuccess(res, { payments, total: payments.length });
});

// ── Student: own fee views ────────────────────────────────────────────────────

export const getMyFees = asyncHandler(async (req: Request, res: Response) => {
  const { academicYear, semester, feeType } = req.query as {
    academicYear?: string;
    semester?: string;
    feeType?: string;
  };
  const fees = await feeService.getStudentFees(req.user!.id, {
    academicYear,
    semester: semester !== undefined ? Number(semester) : undefined,
    feeType: feeType as FeeType | undefined,
  });
  sendSuccess(res, { fees, total: fees.length });
});

export const getMyDues = asyncHandler(async (req: Request, res: Response) => {
  const fees = await feeService.getStudentDues(req.user!.id);
  sendSuccess(res, { fees, total: fees.length });
});
