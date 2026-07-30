import { Router } from 'express';
import { z } from 'zod';
import * as departmentController from '../controllers/department.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { 
  updateDepartmentColorSchema, 
  createDepartmentSchema, 
  updateDepartmentSchema, 
  createProgramSchema, 
  updateProgramSchema 
} from '../services/department.service';
const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid ID') }) };
const programsQuery = {
  query: z.object({ departmentId: z.string().uuid('Invalid department ID').optional() }),
};

// All department/program reads are accessible to any authenticated user
// (needed by admin when creating students, by faculty for context)
router.get('/', authenticate, departmentController.listDepartments);
router.get('/:id', authenticate, validate(uuidParam), departmentController.getDepartment);

// Programs — filterable by ?departmentId=uuid
router.get('/programs/list', authenticate, validate(programsQuery), departmentController.listPrograms);
router.get('/programs/:id', authenticate, validate(uuidParam), departmentController.getProgram);

// Department color (Exam Seating settings) — admin only
router.put(
  '/:id/color',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateDepartmentColorSchema }),
  departmentController.updateDepartmentColor
);

// CRUD operations — admin only
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate({ body: createDepartmentSchema }),
  departmentController.createDepartment
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateDepartmentSchema }),
  departmentController.updateDepartment
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  departmentController.archiveDepartment
);

router.post(
  '/:id/restore',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  departmentController.restoreDepartment
);

router.post(
  '/programs',
  authenticate,
  requireRole('admin'),
  validate({ body: createProgramSchema }),
  departmentController.createProgram
);

router.put(
  '/programs/:id',
  authenticate,
  requireRole('admin'),
  validate({ ...uuidParam, body: updateProgramSchema }),
  departmentController.updateProgram
);

router.delete(
  '/programs/:id',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  departmentController.archiveProgram
);

router.post(
  '/programs/:id/restore',
  authenticate,
  requireRole('admin'),
  validate(uuidParam),
  departmentController.restoreProgram
);

export default router;
