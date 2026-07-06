import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const FEE_TYPES = [
  'Tuition Fee',
  'Examination Fee',
  'Laboratory Fee',
  'Miscellaneous Fee',
] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const PAYMENT_STATUSES = ['Pending', 'Partially Paid', 'Paid', 'Overdue'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ['Cash', 'DD', 'Cheque', 'Online'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

// ── Domain interfaces ─────────────────────────────────────────────────────────

export interface FeePaymentEntry {
  id: string;
  feeId: string;
  amount: number;
  paymentDate: string;        // YYYY-MM-DD
  paymentMode: PaymentMode;
  transactionRef: string | null;
  recordedByName: string;
  remarks: string | null;
  createdAt: Date;
}

/** Full fee record with embedded payment history — used for GET /fees/:id */
export interface FeeDetail {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  programName: string;
  academicYear: string;
  semester: number;
  feeType: FeeType;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;            // YYYY-MM-DD
  paymentStatus: PaymentStatus;
  remarks: string | null;
  payments: FeePaymentEntry[];
  createdAt: Date;
  updatedAt: Date;
}

/** Compact fee record without payment breakdown — used for list views */
export interface FeeSummary {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  programName: string;
  academicYear: string;
  semester: number;
  feeType: FeeType;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  paymentStatus: PaymentStatus;
}

export interface PaginatedFees {
  fees: FeeSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Validation schemas ────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date value' });

const academicYearField = z
  .string()
  .regex(/^\d{4}-\d{4}$/, 'Academic year must be in YYYY-YYYY format');

/** POST /api/fees — admin creates a fee record for a single student */
export const createFeeSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  academicYear: academicYearField,
  semester: z.coerce.number().int().min(1).max(12),
  feeType: z.enum(FEE_TYPES),
  totalAmount: z.coerce.number().min(1, 'Total amount must be at least 1').max(1_000_000),
  dueDate: isoDate,
  remarks: z.string().max(500).trim().optional(),
});

export type CreateFeeInput = z.infer<typeof createFeeSchema>;

/**
 * POST /api/fees/bulk — admin assigns the same fee to multiple students.
 * Exactly one of programId (all active students in program+semester) or
 * studentIds (explicit list) must be supplied.
 */
export const bulkCreateFeeSchema = z
  .object({
    academicYear: academicYearField,
    semester: z.coerce.number().int().min(1).max(12),
    feeType: z.enum(FEE_TYPES),
    totalAmount: z.coerce.number().min(1).max(1_000_000),
    dueDate: isoDate,
    programId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).min(1).optional(),
    remarks: z.string().max(500).trim().optional(),
  })
  .refine((d) => d.programId !== undefined || (d.studentIds && d.studentIds.length > 0), {
    message: 'Either programId or studentIds must be provided',
    path: ['programId'],
  });

export type BulkCreateFeeInput = z.infer<typeof bulkCreateFeeSchema>;

/** PATCH /api/fees/:id — admin updates amount or due date */
export const updateFeeSchema = z
  .object({
    totalAmount: z.coerce.number().min(1).max(1_000_000).optional(),
    dueDate: isoDate.optional(),
    remarks: z.string().max(500).trim().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

export type UpdateFeeInput = z.infer<typeof updateFeeSchema>;

/** POST /api/fees/:id/payments — admin records a payment event */
export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Payment amount must be positive'),
  paymentDate: isoDate,
  paymentMode: z.enum(PAYMENT_MODES).default('Cash'),
  transactionRef: z.string().max(100).trim().optional(),
  remarks: z.string().max(500).trim().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const listFeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
  studentId: z.string().uuid().optional(),
  academicYear: academicYearField.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  feeType: z.enum(FEE_TYPES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

export type ListFeesQuery = z.infer<typeof listFeesQuerySchema>;
