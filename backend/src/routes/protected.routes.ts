/**
 * Protected route patterns — reference implementation for future business modules.
 *
 * Each handler below demonstrates one layer of the auth middleware stack.
 * Copy the relevant pattern when building Attendance, Exams, Fees, etc.
 *
 * Mounted at: /api/example
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize, requireRole } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { query } from '../config/database';
import type { Role } from '../types/roles';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 1: Public — no authentication required
// ─────────────────────────────────────────────────────────────────────────────
router.get('/public', (_req: Request, res: Response) => {
  sendSuccess(res, { message: 'This endpoint is publicly accessible.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 2: Any authenticated user (admin | faculty | student)
// Use: dashboards, shared lookups
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/private',
  authenticate,
  (req: Request, res: Response) => {
    sendSuccess(res, {
      message: `Authenticated as ${req.user!.role}.`,
      user: { id: req.user!.id, email: req.user!.email, role: req.user!.role },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 3: Single-role restriction via requireRole
// Use: admin-only configuration pages, admin CRUD operations
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/admin-only',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    interface UserSummaryRow { id: string; email: string; role: Role; is_active: boolean }
    const { rows } = await query<UserSummaryRow>(
      `SELECT id, email, role, is_active
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY role, email`
    );

    sendSuccess(res, {
      message: 'Admin view: all registered users.',
      requestedBy: req.user!.email,
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.is_active,
      })),
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 4: Multiple roles allowed via requireRole
// Use: staff portals accessible to both admins and faculty
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/staff-only',
  authenticate,
  requireRole('admin', 'faculty'),
  (req: Request, res: Response) => {
    sendSuccess(res, {
      message: 'Staff zone: accessible to admin and faculty only.',
      role: req.user!.role,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 5: Fine-grained permission check via authorize()
// Use: when a role alone is insufficient — e.g. a future 'substitute' faculty
//      role that can view but not create attendance. authorize() checks the
//      permission matrix in types/roles.ts regardless of role label.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/can-mark-attendance',
  authenticate,
  authorize('attendance:create'),
  (req: Request, res: Response) => {
    sendSuccess(res, {
      message: `Permission 'attendance:create' confirmed for role '${req.user!.role}'.`,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 6: Student-only — own-data access
// Use: student dashboards, fee views, grade views (scope enforced by service layer)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/student-only',
  authenticate,
  requireRole('student'),
  (req: Request, res: Response) => {
    sendSuccess(res, {
      message: 'Student portal: personal academic and financial data.',
      studentId: req.user!.id,
    });
  }
);

export default router;
