import type { Request, Response } from 'express';
import * as opportunityService from '../services/opportunityHub.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesQuery,
} from '../types/opportunityHub';

export const createOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateOpportunityInput;
  const opportunity = await opportunityService.createOpportunity(req.user!.id, data);
  sendCreated(res, { opportunity }, 'Opportunity created successfully');
});

export const listOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListOpportunitiesQuery;
  const result = await opportunityService.listOpportunities(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const opportunity = await opportunityService.getOpportunityById(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  sendSuccess(res, { opportunity });
});

export const updateOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateOpportunityInput;
  const opportunity = await opportunityService.updateOpportunity(
    req.user!.id,
    req.user!.role,
    req.params.id,
    data
  );
  sendSuccess(res, { opportunity }, 'Opportunity updated successfully');
});

export const deleteOpportunity = asyncHandler(async (req: Request, res: Response) => {
  await opportunityService.deleteOpportunity(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Opportunity deleted successfully');
});

export const toggleBookmark = asyncHandler(async (req: Request, res: Response) => {
  const result = await opportunityService.toggleBookmark(req.user!.id, req.params.id);
  sendSuccess(
    res,
    result,
    result.bookmarked ? 'Opportunity bookmarked' : 'Bookmark removed'
  );
});

export const listBookmarks = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as { page?: string; limit?: string };
  const result = await opportunityService.listBookmarks(req.user!.id, {
    page:  Number(page)  || 1,
    limit: Number(limit) || 20,
  });
  sendSuccess(res, result);
});
