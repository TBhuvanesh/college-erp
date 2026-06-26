import {
  getFeeById,
  listFees,
  getStudentFees,
  getStudentDues,
  createFee,
  bulkCreateFees,
  updateFee,
  recordPayment,
  getFeePayments,
  deleteFee,
} from '../services/fee.service';

// ── Database mock ──────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockWithTransaction = jest.fn();

jest.mock('../config/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

jest.mock('../utils/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FEE_ROW = {
  id: 'fee-uuid-1',
  student_id: 'stu-uuid-1',
  student_name: 'John Doe',
  roll_number: 'CSE2024001',
  program_name: 'B.Tech CSE',
  academic_year: '2024-2025',
  semester: 3,
  fee_type: 'Tuition Fee',
  total_amount: '50000.00',
  paid_amount: '20000.00',
  pending_amount: '30000.00',
  due_date: '2026-07-31',
  payment_status: 'Partially Paid',
  remarks: null,
  created_at: new Date('2026-06-01'),
  updated_at: new Date('2026-06-01'),
};

const FEE_LIST_ROW = { ...FEE_ROW, total_count: '5' };

const PAYMENT_ROW = {
  id: 'pmt-uuid-1',
  fee_id: 'fee-uuid-1',
  amount: '20000.00',
  payment_date: '2026-06-15',
  payment_mode: 'Cash',
  transaction_ref: null,
  recorded_by_name: 'Admin User',
  remarks: null,
  created_at: new Date('2026-06-15'),
};

const mockClient = { query: jest.fn() };

beforeEach(() => {
  mockWithTransaction.mockImplementation(
    async (fn: (client: typeof mockClient) => Promise<void>) => fn(mockClient)
  );
});

// ── getFeeById ────────────────────────────────────────────────────────────────

describe('getFeeById', () => {
  it('returns FeeDetail with embedded payments', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [FEE_ROW] })            // fee query
      .mockResolvedValueOnce({ rows: [PAYMENT_ROW] });        // payments query

    const result = await getFeeById('fee-uuid-1');

    expect(result.id).toBe('fee-uuid-1');
    expect(result.totalAmount).toBe(50000);
    expect(result.paidAmount).toBe(20000);
    expect(result.pendingAmount).toBe(30000);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].amount).toBe(20000);
  });

  it('throws 404 when fee not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getFeeById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── listFees ──────────────────────────────────────────────────────────────────

describe('listFees', () => {
  const base = { page: 1, limit: 20 };

  it('runs overdue refresh then returns paginated fees', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                    // UPDATE overdue refresh
      .mockResolvedValueOnce({ rows: [FEE_LIST_ROW] });       // main query

    const result = await listFees(base);

    expect(result.fees).toHaveLength(1);
    expect(result.pagination.total).toBe(5);

    // First call must be the overdue UPDATE
    const firstSql = mockQuery.mock.calls[0][0] as string;
    expect(firstSql).toContain("payment_status = 'Overdue'");
    expect(firstSql).toContain('due_date < CURRENT_DATE');
  });

  it('returns empty result when no fees match', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // SELECT

    const result = await listFees(base);
    expect(result.fees).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('applies studentId filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await listFees({ ...base, studentId: 'stu-uuid-1' });
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('f.student_id =');
  });

  it('applies academicYear and semester filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await listFees({ ...base, academicYear: '2024-2025', semester: 3 });
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('f.academic_year =');
    expect(sql).toContain('f.semester =');
  });

  it('applies paymentStatus filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await listFees({ ...base, paymentStatus: 'Overdue' });
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('f.payment_status =');
  });
});

// ── getStudentFees / getStudentDues ───────────────────────────────────────────

describe('getStudentFees', () => {
  it('returns all fee records for the student', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FEE_ROW] });
    const result = await getStudentFees('user-uuid-1', {});
    expect(result).toHaveLength(1);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('st.user_id = $1');
  });

  it('applies optional academicYear filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getStudentFees('user-uuid-1', { academicYear: '2024-2025' });
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('f.academic_year =');
  });
});

describe('getStudentDues', () => {
  it('excludes Paid fees and orders by due_date', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FEE_ROW] });
    const result = await getStudentDues('user-uuid-1');
    expect(result).toHaveLength(1);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("payment_status != 'Paid'");
    expect(sql).toContain('due_date ASC');
  });
});

// ── createFee ─────────────────────────────────────────────────────────────────

describe('createFee', () => {
  const INPUT = {
    studentId: 'stu-uuid-1',
    academicYear: '2024-2025',
    semester: 3,
    feeType: 'Tuition Fee' as const,
    totalAmount: 50000,
    dueDate: '2026-07-31',
  };

  it('creates a fee with Pending status for a future due date', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'stu-uuid-1' }] })   // student check
      .mockResolvedValueOnce({ rows: [{ id: 'fee-uuid-1' }] })   // INSERT
      .mockResolvedValueOnce({ rows: [FEE_ROW] })                 // getFeeById - fee
      .mockResolvedValueOnce({ rows: [] });                        // getFeeById - payments

    const result = await createFee(INPUT, 'admin-user');
    expect(result.id).toBe('fee-uuid-1');
    expect(result.paidAmount).toBe(20000);

    // Verify status was computed and passed
    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams).toContain('Pending');
  });

  it('creates a fee with Overdue status when dueDate is in the past', async () => {
    const pastInput = { ...INPUT, dueDate: '2020-01-01' };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'stu-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'fee-uuid-1' }] })
      .mockResolvedValueOnce({ rows: [{ ...FEE_ROW, payment_status: 'Overdue', due_date: '2020-01-01' }] })
      .mockResolvedValueOnce({ rows: [] });

    await createFee(pastInput, 'admin-user');

    const insertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(insertParams).toContain('Overdue');
  });

  it('throws 404 when student is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(createFee(INPUT, 'admin-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── bulkCreateFees ────────────────────────────────────────────────────────────

describe('bulkCreateFees', () => {
  const BASE = {
    academicYear: '2024-2025',
    semester: 3,
    feeType: 'Tuition Fee' as const,
    totalAmount: 50000,
    dueDate: '2026-07-31',
  };

  it('bulk-creates fees by programId', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'prog-1' }] })       // program check
      .mockResolvedValueOnce({ rows: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] }); // INSERT SELECT

    const result = await bulkCreateFees({ ...BASE, programId: 'prog-uuid-1' }, 'admin-user');

    expect(result.created).toBe(3);
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('program_id');
  });

  it('bulk-creates fees by explicit studentIds', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'f1' }, { id: 'f2' }],
    });

    const result = await bulkCreateFees(
      { ...BASE, studentIds: ['stu-1', 'stu-2'] },
      'admin-user'
    );
    expect(result.created).toBe(2);
  });

  it('throws 400 when no eligible students found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'prog-1' }] }) // program check
      .mockResolvedValueOnce({ rows: [] });                  // INSERT SELECT returns nothing

    await expect(
      bulkCreateFees({ ...BASE, programId: 'prog-uuid-1' }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 400, code: 'NO_STUDENTS_FOUND' });
  });

  it('throws 404 when programId does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // program check fails
    await expect(
      bulkCreateFees({ ...BASE, programId: 'missing-prog' }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateFee ─────────────────────────────────────────────────────────────────

describe('updateFee', () => {
  const CURRENT = {
    student_id: 'stu-1',
    total_amount: '50000.00',
    paid_amount: '20000.00',
    pending_amount: '30000.00',
    due_date: '2026-07-31',
    payment_status: 'Partially Paid',
  };

  it('updates totalAmount and recomputes pending + status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [CURRENT] })             // fetch
      .mockResolvedValueOnce({ rows: [] })                    // UPDATE
      .mockResolvedValueOnce({ rows: [FEE_ROW] })             // getFeeById
      .mockResolvedValueOnce({ rows: [] });                    // payments

    const result = await updateFee('fee-uuid-1', { totalAmount: 55000 }, 'admin-user');
    expect(result.id).toBe('fee-uuid-1');
  });

  it('throws 400 when new totalAmount is less than already paid amount', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [CURRENT] });

    await expect(
      updateFee('fee-uuid-1', { totalAmount: 10000 }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 400, code: 'TOTAL_BELOW_PAID' });
  });

  it('throws 404 when fee not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      updateFee('missing', { totalAmount: 60000 }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── recordPayment ─────────────────────────────────────────────────────────────

describe('recordPayment', () => {
  const PAYMENT_INPUT = {
    amount: 10000,
    paymentDate: '2026-06-20',
    paymentMode: 'Cash' as const,
  };

  const PARTIAL_FEE = {
    student_id: 'stu-1',
    total_amount: '50000.00',
    paid_amount: '20000.00',
    pending_amount: '30000.00',
    due_date: '2026-07-31',
    payment_status: 'Partially Paid',
  };

  it('records payment and transitions to Partially Paid', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [PARTIAL_FEE] })         // fetch fee
      .mockResolvedValueOnce({ rows: [FEE_ROW] })             // getFeeById - fee
      .mockResolvedValueOnce({ rows: [] });                    // getFeeById - payments

    mockClient.query.mockResolvedValueOnce({ rows: [] })       // INSERT payment
                    .mockResolvedValueOnce({ rows: [] });       // UPDATE fee

    const result = await recordPayment('fee-uuid-1', PAYMENT_INPUT, 'admin-user');
    expect(result.id).toBe('fee-uuid-1');

    // Verify payment INSERT was called
    const insertSql = mockClient.query.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO fee_payments');
  });

  it('records final payment and transitions to Paid', async () => {
    // paid_amount=45000 + amount=5000 = total=50000 → Paid
    const remainingFee = { ...PARTIAL_FEE, paid_amount: '45000.00', pending_amount: '5000.00' };
    const finalPayment = { ...PAYMENT_INPUT, amount: 5000 };

    mockQuery
      .mockResolvedValueOnce({ rows: [remainingFee] })
      .mockResolvedValueOnce({ rows: [{ ...FEE_ROW, payment_status: 'Paid', pending_amount: '0.00' }] })
      .mockResolvedValueOnce({ rows: [PAYMENT_ROW] });

    mockClient.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    // Verify Paid status is computed and passed to UPDATE
    await recordPayment('fee-uuid-1', finalPayment, 'admin-user');

    const updateParams = mockClient.query.mock.calls[1][1] as unknown[];
    expect(updateParams).toContain('Paid');
    expect(updateParams).toContain(0); // newPending = 0
  });

  it('throws 400 when fee is already Paid', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...PARTIAL_FEE, payment_status: 'Paid' }],
    });

    await expect(
      recordPayment('fee-uuid-1', PAYMENT_INPUT, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 400, code: 'FEE_ALREADY_PAID' });
  });

  it('throws 400 when payment exceeds pending amount', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [PARTIAL_FEE] });

    await expect(
      recordPayment('fee-uuid-1', { ...PAYMENT_INPUT, amount: 40000 }, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 400, code: 'OVERPAYMENT' });
  });

  it('throws 404 when fee not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      recordPayment('missing', PAYMENT_INPUT, 'admin-user')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getFeePayments ────────────────────────────────────────────────────────────

describe('getFeePayments', () => {
  it('returns payment history for a fee', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'fee-uuid-1' }] }) // fee exists check
      .mockResolvedValueOnce({ rows: [PAYMENT_ROW] });           // payments query

    const payments = await getFeePayments('fee-uuid-1');
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(20000);
    expect(payments[0].paymentMode).toBe('Cash');
  });

  it('throws 404 when fee does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getFeePayments('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── deleteFee ─────────────────────────────────────────────────────────────────

describe('deleteFee', () => {
  it('soft-deletes a fee with no payments', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ paid_amount: '0.00' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteFee('fee-uuid-1', 'admin-user')).resolves.toBeUndefined();
  });

  it('throws 400 when the fee has recorded payments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ paid_amount: '20000.00' }] });

    await expect(deleteFee('fee-uuid-1', 'admin-user')).rejects.toMatchObject({
      statusCode: 400,
      code: 'FEE_HAS_PAYMENTS',
    });
  });

  it('throws 404 when fee does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(deleteFee('missing', 'admin-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});
