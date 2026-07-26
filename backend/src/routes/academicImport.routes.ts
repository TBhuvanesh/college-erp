import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/academicImport.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

// Memory storage — spreadsheets are parsed in-process and never need to
// persist to disk, same convention as subjects.routes.ts's Excel import.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — enough for 5,000+ row workbooks
});

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/entity-types', controller.listEntityTypes);
router.get('/jobs', controller.listJobs);
router.get('/jobs/:jobId', controller.getJob);
router.get('/:entityType/replace-impact', controller.replaceImpact);

router.post('/:entityType/preview', upload.single('file'), controller.preview);
router.post('/:entityType/commit', controller.commit);

export default router;
