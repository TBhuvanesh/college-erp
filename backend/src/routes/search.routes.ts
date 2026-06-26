import { Router } from 'express';
import * as searchController from '../controllers/search.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { searchQuerySchema } from '../types/search';

const router = Router();

router.use(authenticate);

// GET /api/search?q=<term>
// Returns role-scoped categorized results: students, faculty, subjects, announcements, events.
// Admin → full access; Faculty → assigned students/subjects + scoped announcements/events;
// Student → subjects + scoped announcements/events only.
router.get(
  '/',
  validate({ query: searchQuerySchema }),
  searchController.globalSearch
);

export default router;
