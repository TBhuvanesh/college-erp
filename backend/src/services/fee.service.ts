import { query, withTransaction } from '../config/database';
import { auditLog } from '../utils/audit';
import { AppError } from '../errors/AppError';
import type {
  FeeDetail,
  FeeSummary,
  PaginatedFees,
  FeePaymentEntry,
  FeeType,
  PaymentStatus,
  PaymentMode,
  CreateFeeInput,
  BulkCreateFeeInput,
  UpdateFeeInput,
  RecordPaymentInput,
  ListFeesQuery,
} from '../types/fee';

// ── Row types (snake_case from PostgreSQL) ─────────────────────────────────────

interface FeeRow {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  program_name: string;
  academic_year: string;
  semester: number;
  fee_type: FeeType;
  total_amount: string;
  paid_amount: string;
  pending_amount: string;
  due_date: string;             // TO_CHAR output
  payment_status: PaymentStatus;
  remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FeeListRow extends FeeRow {
  total_count: string;
}

interface PaymentRow {
  id: string;
  fee_id: string;
  amount: string;
  payment_date: string;         // TO_CHAR output
  payment_mode: PaymentMode;
  transaction_ref: string | null;
  recorded_by_name: string;
  remarks: string | null;
  created_at: Date;
}

interface CurrentFeeRow {
  student_id: string;
  total_amount: string;
  paid_amount: string;
  pending_amount: string;
  due_date: string;
  payment_status: PaymentStatus;
}

// ── Shared query fragments ─────────────────────────────────────────────────────

const SUMMARY_COLS = `
  f.id,
  f.student_id,   st.full_name              AS student_name,  st.roll_number,
                  p.name                    AS program_name,
  f.academic_year, f.semester,  f.fee_type,
  f.total_amount,  f.paid_amount, f.pending_amount,
  TO_CHAR(f.due_date, 'YYYY-MM-DD') AS due_date,
  f.payment_status, f.remarks,
  f.created_at,    f.updated_at
`;

const SUMMARY_JOINS = `
  JOIN students st ON st.id  = f.student_id
  JOIN programs  p  ON p.id   = st.program_id
`;

const PAYMENT_COLS = `
  fp.id,  fp.fee_id,
  fp.amount,
  TO_CHAR(fp.payment_date, 'YYYY-MM-DD') AS payment_date,
  fp.payment_mode,   fp.transaction_ref,
  u.full_name        AS recorded_by_name,
  fp.remarks,        fp.created_at
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derives the correct payment status from current figures and today's date.
 * Called on every write so the DB column stays accurate without a cron job.
 */
function computePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  dueDateStr: string  // YYYY-MM-DD
): PaymentStatus {
  if (paidAmount >= totalAmount) return 'Paid';
  const today = new Date().toLocaleDateString('en-CA');
  if (dueDateStr < today) return 'Overdue';
  return paidAmount > 0 ? 'Partially Paid' : 'Pending';
}

function toSummary(r: FeeRow): FeeSummary {
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    rollNumber: r.roll_number,
    programName: r.program_name,
    academicYear: r.academic_year,
    semester: Number(r.semester),
    feeType: r.fee_type,
    totalAmount: parseFloat(r.total_amount),
    paidAmount: parseFloat(r.paid_amount),
    pendingAmount: parseFloat(r.pending_amount),
    dueDate: r.due_date,
    paymentStatus: r.payment_status,
  };
}

function toPaymentEntry(r: PaymentRow): FeePaymentEntry {
  return {
    id: r.id,
    feeId: r.fee_id,
    amount: parseFloat(r.amount),
    paymentDate: r.payment_date,
    paymentMode: r.payment_mode,
    transactionRef: r.transaction_ref,
    recordedByName: r.recorded_by_name,
    remarks: r.remarks,
    createdAt: r.created_at,
  };
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getFeeById(id: string): Promise<FeeDetail> {
  const { rows } = await query<FeeRow>(
    `SELECT ${SUMMARY_COLS} FROM fees f ${SUMMARY_JOINS}
     WHERE f.id = $1 AND f.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Fee record not found');

  const { rows: paymentRows } = await query<PaymentRow>(
    `SELECT ${PAYMENT_COLS}
     FROM fee_payments fp
     JOIN users u ON u.id = fp.recorded_by
     WHERE fp.fee_id = $1
     ORDER BY fp.payment_date ASC, fp.created_at ASC`,
    [id]
  );

  return {
    ...toSummary(rows[0]),
    remarks: rows[0].remarks,
    payments: paymentRows.map(toPaymentEntry),
    createdAt: rows[0].created_at,
    updatedAt: rows[0].updated_at,
  };
}

/**
 * Automatically initializes tuition fee records for any students who do not have one.
 */
export async function ensureAllStudentsHaveFees(): Promise<void> {
  const { rows: missingStudents } = await query<{ id: string; semester: number; academic_year: string }>(
    `SELECT s.id, s.semester, s.academic_year
     FROM students s
     LEFT JOIN fees f ON f.student_id = s.id AND f.fee_type = 'Tuition Fee' AND f.deleted_at IS NULL
     WHERE f.id IS NULL AND s.deleted_at IS NULL`
  );

  if (missingStudents.length === 0) return;

  const dueDate = '2026-07-15';
  const defaultTotalFee = 106000.00;
  const paymentStatus = computePaymentStatus(0, defaultTotalFee, dueDate);

  for (const stud of missingStudents) {
    await query(
      `INSERT INTO fees
         (student_id, academic_year, semester, fee_type, total_amount,
          paid_amount, pending_amount, due_date, payment_status, remarks)
       VALUES ($1, $2, $3, 'Tuition Fee', $4, 0, $4, $5, $6, 'Automatically Initialized Tuition Fee')
       ON CONFLICT DO NOTHING`,
      [
        stud.id,
        stud.academic_year || '2026-2027',
        stud.semester,
        defaultTotalFee,
        dueDate,
        paymentStatus,
      ]
    );
  }
}

/**
 * Lists fee records with optional filters.
 * Lazily refreshes overdue statuses before returning so admins always see
 * accurate status without requiring a scheduled job.
 */
export async function listFees(filters: ListFeesQuery): Promise<PaginatedFees> {
  // Ensure every student has a fee record before listing
  await ensureAllStudentsHaveFees();

  // Refresh any stale Pending/Partially Paid records whose due date has passed
  await query(
    `UPDATE fees
     SET payment_status = 'Overdue', updated_at = NOW()
     WHERE payment_status IN ('Pending', 'Partially Paid')
       AND due_date < CURRENT_DATE
       AND deleted_at IS NULL`
  );

  const conditions: string[] = ['f.deleted_at IS NULL'];
  const params: unknown[] = [];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.studentId)     push('f.student_id =',      filters.studentId);
  if (filters.academicYear)  push('f.academic_year =',   filters.academicYear);
  if (filters.semester)      push('f.semester =',         filters.semester);
  if (filters.feeType)       push('f.fee_type =',         filters.feeType);
  if (filters.paymentStatus) push('f.payment_status =',   filters.paymentStatus);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const { rows } = await query<FeeListRow>(
    `SELECT ${SUMMARY_COLS}, COUNT(*) OVER() AS total_count
     FROM fees f ${SUMMARY_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.due_date ASC, f.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  return {
    fees: rows.map(toSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

/** Returns all non-deleted fee records for the authenticated student. */
export async function getStudentFees(
  userId: string,
  filters: { academicYear?: string; semester?: number; feeType?: FeeType }
): Promise<FeeSummary[]> {
  const conditions: string[] = [
    'f.deleted_at IS NULL',
    'st.user_id = $1',
  ];
  const params: unknown[] = [userId];

  const push = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(`${condition} $${params.length}`);
  };

  if (filters.academicYear) push('f.academic_year =', filters.academicYear);
  if (filters.semester)     push('f.semester =',       filters.semester);
  if (filters.feeType)      push('f.fee_type =',       filters.feeType);

  const { rows } = await query<FeeRow>(
    `SELECT ${SUMMARY_COLS}
     FROM fees f ${SUMMARY_JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.academic_year DESC, f.semester ASC, f.due_date ASC`,
    params
  );

  return rows.map(toSummary);
}

/** Returns non-Paid fee records for the student, ordered by due date ascending. */
export async function getStudentDues(userId: string): Promise<FeeSummary[]> {
  const { rows } = await query<FeeRow>(
    `SELECT ${SUMMARY_COLS}
     FROM fees f ${SUMMARY_JOINS}
     WHERE st.user_id = $1
       AND f.payment_status != 'Paid'
       AND f.deleted_at IS NULL
     ORDER BY f.due_date ASC`,
    [userId]
  );
  return rows.map(toSummary);
}

/** Returns the payment history for a single fee record. */
export async function getFeePayments(feeId: string): Promise<FeePaymentEntry[]> {
  const { rows: feeCheck } = await query<{ id: string }>(
    'SELECT id FROM fees WHERE id = $1 AND deleted_at IS NULL',
    [feeId]
  );
  if (!feeCheck[0]) throw AppError.notFound('Fee record not found');

  const { rows } = await query<PaymentRow>(
    `SELECT ${PAYMENT_COLS}
     FROM fee_payments fp
     JOIN users u ON u.id = fp.recorded_by
     WHERE fp.fee_id = $1
     ORDER BY fp.payment_date ASC, fp.created_at ASC`,
    [feeId]
  );

  return rows.map(toPaymentEntry);
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Creates a fee record for a single student.
 */
export async function createFee(
  data: CreateFeeInput,
  userId: string
): Promise<FeeDetail> {
  const { rows: stu } = await query<{ id: string }>(
    'SELECT id FROM students WHERE id = $1 AND deleted_at IS NULL',
    [data.studentId]
  );
  if (!stu[0]) throw AppError.notFound('Student not found');

  const paymentStatus = computePaymentStatus(0, data.totalAmount, data.dueDate);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO fees
       (student_id, academic_year, semester, fee_type, total_amount,
        paid_amount, pending_amount, due_date, payment_status, remarks)
     VALUES ($1, $2, $3, $4, $5, 0, $5, $6, $7, $8)
     RETURNING id`,
    [
      data.studentId,
      data.academicYear,
      data.semester,
      data.feeType,
      data.totalAmount,
      data.dueDate,
      paymentStatus,
      data.remarks ?? null,
    ]
  );

  const fee = await getFeeById(rows[0].id);

  await auditLog({
    actorId: userId,
    action: 'CREATE_FEE',
    resource: 'fees',
    resourceId: fee.id,
    changes: {
      studentId: data.studentId,
      feeType: data.feeType,
      totalAmount: data.totalAmount,
      dueDate: data.dueDate,
      academicYear: data.academicYear,
      semester: data.semester,
    },
  });

  return fee;
}

/**
 * Bulk-creates the same fee for all active students in a program+semester,
 * or for an explicit list of student IDs.
 * Returns a count of how many fee records were created.
 */
export async function bulkCreateFees(
  data: BulkCreateFeeInput,
  userId: string
): Promise<{ created: number }> {
  const paymentStatus = computePaymentStatus(0, data.totalAmount, data.dueDate);
  let created = 0;

  if (data.programId) {
    // Validate program exists
    const { rows: prog } = await query<{ id: string }>(
      'SELECT id FROM programs WHERE id = $1',
      [data.programId]
    );
    if (!prog[0]) throw AppError.notFound('Program not found');

    const { rows } = await query<{ id: string }>(
      `INSERT INTO fees
         (student_id, academic_year, semester, fee_type, total_amount,
          paid_amount, pending_amount, due_date, payment_status, remarks)
       SELECT s.id, $1, $2, $3, $4, 0, $4, $5, $6, $7
       FROM students s
       WHERE s.program_id = $8
         AND s.semester   = $2
         AND s.status     = 'active'
         AND s.deleted_at IS NULL
       RETURNING id`,
      [
        data.academicYear,
        data.semester,
        data.feeType,
        data.totalAmount,
        data.dueDate,
        paymentStatus,
        data.remarks ?? null,
        data.programId,
      ]
    );
    created = rows.length;
  } else {
    // Explicit student list
    const { rows } = await query<{ id: string }>(
      `INSERT INTO fees
         (student_id, academic_year, semester, fee_type, total_amount,
          paid_amount, pending_amount, due_date, payment_status, remarks)
       SELECT s.id, $1, $2, $3, $4, 0, $4, $5, $6, $7
       FROM students s
       WHERE s.id = ANY($8::uuid[])
         AND s.status     = 'active'
         AND s.deleted_at IS NULL
       RETURNING id`,
      [
        data.academicYear,
        data.semester,
        data.feeType,
        data.totalAmount,
        data.dueDate,
        paymentStatus,
        data.remarks ?? null,
        data.studentIds!,
      ]
    );
    created = rows.length;
  }

  if (created === 0) {
    throw AppError.badRequest(
      'No eligible active students found for the given criteria',
      'NO_STUDENTS_FOUND'
    );
  }

  await auditLog({
    actorId: userId,
    action: 'BULK_CREATE_FEES',
    resource: 'fees',
    resourceId: data.programId ?? 'explicit-list',
    changes: {
      feeType: data.feeType,
      totalAmount: data.totalAmount,
      dueDate: data.dueDate,
      academicYear: data.academicYear,
      semester: data.semester,
      created,
    },
  });

  return { created };
}

/**
 * Updates a fee record's totalAmount and/or dueDate.
 * When totalAmount changes, pending_amount and payment_status are recomputed.
 * Cannot reduce totalAmount below what has already been paid.
 */
export async function updateFee(
  id: string,
  data: UpdateFeeInput,
  userId: string
): Promise<FeeDetail> {
  const { rows } = await query<CurrentFeeRow>(
    `SELECT student_id, total_amount, paid_amount, pending_amount, due_date, payment_status
     FROM fees WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Fee record not found');

  const current = rows[0];
  const currentPaid = parseFloat(current.paid_amount);

  const newTotal = data.totalAmount !== undefined
    ? data.totalAmount
    : parseFloat(current.total_amount);

  if (newTotal < currentPaid) {
    throw AppError.badRequest(
      `Total amount (${newTotal}) cannot be less than already paid amount (${currentPaid})`,
      'TOTAL_BELOW_PAID'
    );
  }

  const newDueDate = data.dueDate ?? current.due_date;
  const newPending = newTotal - currentPaid;
  const newStatus = computePaymentStatus(currentPaid, newTotal, newDueDate);

  const updates: string[] = [];
  const params: unknown[] = [];

  const pushUpdate = (col: string, val: unknown) => {
    params.push(val);
    updates.push(`${col} = $${params.length}`);
  };

  if (data.totalAmount !== undefined)  pushUpdate('total_amount',   newTotal);
  if (data.dueDate !== undefined)      pushUpdate('due_date',       newDueDate);
  if (data.remarks !== undefined)      pushUpdate('remarks',        data.remarks);

  // Always resync computed fields when anything changes
  pushUpdate('pending_amount',  newPending);
  pushUpdate('payment_status',  newStatus);

  params.push(id);
  await query(
    `UPDATE fees SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  await auditLog({
    actorId: userId,
    action: 'UPDATE_FEE',
    resource: 'fees',
    resourceId: id,
    changes: data,
  });

  return getFeeById(id);
}

/**
 * Records a payment event and updates the fee's paid/pending amounts and status.
 * Payment amount cannot exceed the current pending amount.
 * Fee payments are immutable once recorded.
 */
export async function recordPayment(
  feeId: string,
  data: RecordPaymentInput,
  userId: string
): Promise<FeeDetail> {
  const { rows } = await query<CurrentFeeRow>(
    `SELECT student_id, total_amount, paid_amount, pending_amount, due_date, payment_status
     FROM fees WHERE id = $1 AND deleted_at IS NULL`,
    [feeId]
  );
  if (!rows[0]) throw AppError.notFound('Fee record not found');

  const current = rows[0];

  if (current.payment_status === 'Paid') {
    throw AppError.badRequest(
      'This fee has already been paid in full',
      'FEE_ALREADY_PAID'
    );
  }

  const currentPending = parseFloat(current.pending_amount);
  if (data.amount > currentPending) {
    throw AppError.badRequest(
      `Payment amount (${data.amount}) exceeds pending amount (${currentPending})`,
      'OVERPAYMENT'
    );
  }

  const newPaid = parseFloat(current.paid_amount) + data.amount;
  const newPending = parseFloat(current.total_amount) - newPaid;
  const newStatus = computePaymentStatus(newPaid, parseFloat(current.total_amount), current.due_date);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO fee_payments
         (fee_id, amount, payment_date, payment_mode, transaction_ref, recorded_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        feeId,
        data.amount,
        data.paymentDate,
        data.paymentMode,
        data.transactionRef ?? null,
        userId,
        data.remarks ?? null,
      ]
    );

    await client.query(
      `UPDATE fees
       SET paid_amount = $1, pending_amount = $2, payment_status = $3, updated_at = NOW()
       WHERE id = $4`,
      [newPaid, newPending, newStatus, feeId]
    );

    await auditLog({
      actorId: userId,
      action: 'RECORD_FEE_PAYMENT',
      resource: 'fees',
      resourceId: feeId,
      changes: {
        amount: data.amount,
        paymentMode: data.paymentMode,
        newPaid,
        newPending,
        newStatus,
      },
    });
  });

  return getFeeById(feeId);
}

/**
 * Soft-deletes a fee record. Only allowed when no payments have been made.
 * Admin only — enforced at the route level.
 */
export async function deleteFee(id: string, userId: string): Promise<void> {
  const { rows } = await query<{ paid_amount: string }>(
    'SELECT paid_amount FROM fees WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!rows[0]) throw AppError.notFound('Fee record not found');

  if (parseFloat(rows[0].paid_amount) > 0) {
    throw AppError.badRequest(
      'Cannot delete a fee record with recorded payments. Adjust the total amount instead.',
      'FEE_HAS_PAYMENTS'
    );
  }

  await query(
    'UPDATE fees SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );

  await auditLog({
    actorId: userId,
    action: 'DELETE_FEE',
    resource: 'fees',
    resourceId: id,
    changes: {},
  });
}
