import { Router } from 'express';
import { z } from 'zod';
import * as workflowRuleController from '../controllers/workflowRule.controller';
import { authenticate } from '../middleware/authenticate';
import { requireSuperAdmin } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createWorkflowRuleSchema, updateWorkflowRuleSchema, listWorkflowRulesQuerySchema } from '../types/workflow';

const router = Router();

const uuidParam = { params: z.object({ id: z.string().uuid('Invalid workflow rule ID') }) };

router.use(authenticate);
router.use(requireSuperAdmin());

// GET /api/workflow/rules and /:id are not in the literal spec endpoint list,
// but a mutation-only API with no way to read current configuration back is
// unusable from a UI — added for the same reason /teaching-plans/progress etc.
// were added beyond their literal spec lists in earlier modules.
router.get('/rules', validate({ query: listWorkflowRulesQuerySchema }), workflowRuleController.listWorkflowRules);
router.get('/rules/:id', validate(uuidParam), workflowRuleController.getWorkflowRule);

router.post('/rules', validate({ body: createWorkflowRuleSchema }), workflowRuleController.createWorkflowRule);
router.put(
  '/rules/:id',
  validate({ params: uuidParam.params, body: updateWorkflowRuleSchema }),
  workflowRuleController.updateWorkflowRule
);
router.delete('/rules/:id', validate(uuidParam), workflowRuleController.deleteWorkflowRule);

export default router;
