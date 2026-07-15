import type { Request, Response } from 'express';
import * as examInvigilationService from '../services/examInvigilation.service';
import * as resourceAvailabilityService from '../services/resourceAvailability.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  GenerateInvigilationInput,
  UpdateInvigilationDutyInput,
  ListInvigilationQuery,
  InvigilatorSuggestionQuery,
} from '../types/examSeating';

export const generateInvigilation = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as GenerateInvigilationInput;
  const duties = await examInvigilationService.generateInvigilationDuties(req.user!.id, req.user!.role, data);
  sendSuccess(res, { duties }, 'Invigilation duties assigned successfully');
});

export const listInvigilationDuties = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListInvigilationQuery;
  const result = await examInvigilationService.listInvigilationDuties(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const updateInvigilationDuty = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateInvigilationDutyInput;
  const duty = await examInvigilationService.updateInvigilationDuty(req.user!.id, req.user!.role, req.params.id, data);
  sendSuccess(res, { duty }, 'Invigilation duty updated successfully');
});

export const suggestInvigilators = asyncHandler(async (req: Request, res: Response) => {
  const { date, startTime, endTime, departmentId, count } = req.query as unknown as InvigilatorSuggestionQuery;
  const faculty = await resourceAvailabilityService.suggestInvigilators(departmentId, date, startTime, endTime, count);
  sendSuccess(res, { faculty });
});
