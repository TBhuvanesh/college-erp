import type { Request, Response } from 'express';
import * as searchService from '../services/search.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { SearchQuery } from '../types/search';

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as SearchQuery;
  const results = await searchService.search(req.user!.id, req.user!.role, q);
  sendSuccess(res, results);
});
