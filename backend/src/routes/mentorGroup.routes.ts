import { Router } from 'express';
import * as controller from '../controllers/mentorGroup.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeMentoringHead } from '../middleware/mentorshipAuth';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Read routes (Accessible by Admin, Mentoring Head, or Faculty)
// Declared before /:id so literal paths aren't swallowed by the param route.
router.get('/suggest', authorizeMentoringHead, controller.suggestBalancedGroups);
router.get('/candidates', authorizeMentoringHead, controller.listMentorCandidates);
router.get('/', controller.getGroups);
router.get('/:id/students', controller.resolveStudents);

// Write routes (Restricted to HOD/Mentoring Head and Admin)
router.post('/check-conflicts', authorizeMentoringHead, controller.checkConflicts);
router.post('/merge', authorizeMentoringHead, controller.mergeGroups);
router.post('/', authorizeMentoringHead, controller.createGroup);
router.put('/:id', authorizeMentoringHead, controller.updateGroup);
router.post('/:id/split', authorizeMentoringHead, controller.splitGroup);
router.delete('/:id', authorizeMentoringHead, controller.deleteGroup);

export default router;
