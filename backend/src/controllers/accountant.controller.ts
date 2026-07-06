import type { Request, Response } from 'express';
import * as accountantService from '../services/accountant.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateAccountantInput,
  UpdateAccountantInput,
  ListAccountantsQuery,
} from '../types/accountant';

export const createAccountant = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateAccountantInput;
  const accountant = await accountantService.createAccountant(data, req.user!.id);
  sendCreated(res, { accountant }, 'Accountant profile created successfully');
});

export const listAccountants = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListAccountantsQuery;
  const result = await accountantService.listAccountants(filters);
  sendSuccess(res, result);
});

export const getAccountant = asyncHandler(async (req: Request, res: Response) => {
  const accountant = await accountantService.getAccountantById(req.params.id);
  sendSuccess(res, { accountant });
});

export const updateAccountant = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateAccountantInput;
  const accountant = await accountantService.updateAccountant(req.params.id, data, req.user!.id);
  sendSuccess(res, { accountant }, 'Accountant profile updated successfully');
});

export const updateAccountantStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const accountant = await accountantService.updateAccountantStatus(req.params.id, isActive, req.user!.id);
  sendSuccess(res, { accountant }, `Accountant account status updated successfully`);
});

export const deleteAccountant = asyncHandler(async (req: Request, res: Response) => {
  await accountantService.deleteAccountant(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Accountant profile deactivated successfully');
});
