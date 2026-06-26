import { Router } from 'express';
import { z } from 'zod';
import * as materialController from '../controllers/material.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLmsFile } from '../middleware/uploadLms';
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsQuerySchema,
} from '../types/lms';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid material ID') }) };

router.use(authenticate);

// GET /api/lms/materials  — all roles can list materials (scoped by role in service)
router.get(
  '/',
  validate({ query: listMaterialsQuerySchema }),
  materialController.listMaterials
);

// GET /api/lms/materials/:id/download — static sub-route before /:id
router.get(
  '/:id/download',
  validate(uuidParam),
  materialController.downloadMaterial
);

// GET /api/lms/materials/:id
router.get(
  '/:id',
  validate(uuidParam),
  materialController.getMaterial
);

// POST /api/lms/materials — faculty only
// uploadLmsFile runs before validate so multer parses multipart fields first
router.post(
  '/',
  requireRole('faculty'),
  uploadLmsFile,
  validate({ body: createMaterialSchema }),
  materialController.createMaterial
);

// PUT /api/lms/materials/:id — faculty only; file is optional (metadata-only update allowed)
router.put(
  '/:id',
  requireRole('faculty'),
  uploadLmsFile,
  validate({ params: uuidParam.params, body: updateMaterialSchema }),
  materialController.updateMaterial
);

// DELETE /api/lms/materials/:id — faculty only
router.delete(
  '/:id',
  requireRole('faculty'),
  validate(uuidParam),
  materialController.deleteMaterial
);

export default router;
