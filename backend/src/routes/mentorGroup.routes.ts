import { Router } from 'express';
import * as controller from '../controllers/mentorGroup.controller';
import { authenticate } from '../middleware/authenticate';
import { authorizeMentoringHead } from '../middleware/mentorshipAuth';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Read routes (Accessible by Admin, Mentoring Head, or Faculty)
router.get('/', controller.getGroups);
router.get('/:id/students', controller.resolveStudents);

// Write routes (Restricted to HOD/Mentoring Head and Admin)
router.post('/', authorizeMentoringHead, controller.createGroup);
router.put('/:id', authorizeMentoringHead, controller.updateGroup);
router.delete('/:id', authorizeMentoringHead, controller.deleteGroup);

export default router;
