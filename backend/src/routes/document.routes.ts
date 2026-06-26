import { Router } from 'express';
import { z } from 'zod';
import * as documentController from '../controllers/document.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadPdf } from '../middleware/upload';
import { uploadDocumentSchema, listDocumentsQuerySchema } from '../types/document';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid document ID') }) };

// All document endpoints are admin-only
router.use(authenticate, requireRole('admin'));

// POST /api/documents/upload
// uploadPdf runs before validate so multer has parsed multipart fields before Zod sees req.body
router.post(
  '/upload',
  uploadPdf,
  validate({ body: uploadDocumentSchema }),
  documentController.uploadDocument
);

// GET /api/documents
router.get(
  '/',
  validate({ query: listDocumentsQuerySchema }),
  documentController.listDocuments
);

// GET /api/documents/:id  (with extracted text)
router.get(
  '/:id',
  validate(uuidParam),
  documentController.getDocument
);

// DELETE /api/documents/:id
router.delete(
  '/:id',
  validate(uuidParam),
  documentController.deleteDocument
);

export default router;
