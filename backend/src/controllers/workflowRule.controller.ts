import type { Request, Response } from 'express';
import * as workflowRuleService from '../services/workflowRule.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateWorkflowRuleInput, UpdateWorkflowRuleInput, ListWorkflowRulesQuery } from '../types/workflow';

export const listWorkflowRules = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListWorkflowRulesQuery;
  const rules = await workflowRuleService.listWorkflowRules(filters);
  sendSuccess(res, { rules });
});

export const getWorkflowRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await workflowRuleService.getWorkflowRuleById(req.params.id);
  sendSuccess(res, { rule });
});

export const createWorkflowRule = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateWorkflowRuleInput;
  const rule = await workflowRuleService.createWorkflowRule(req.user!.id, data);
  sendCreated(res, { rule }, 'Workflow rule created successfully');
});

export const updateWorkflowRule = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateWorkflowRuleInput;
  const rule = await workflowRuleService.updateWorkflowRule(req.user!.id, req.params.id, data);
  sendSuccess(res, { rule }, 'Workflow rule updated successfully');
});

export const deleteWorkflowRule = asyncHandler(async (req: Request, res: Response) => {
  await workflowRuleService.deleteWorkflowRule(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Workflow rule deleted successfully');
});
