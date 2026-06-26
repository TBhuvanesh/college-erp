import fs from 'fs';
import type { Request, Response } from 'express';
import * as materialService from '../services/material.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type { CreateMaterialInput, UpdateMaterialInput, ListMaterialsQuery } from '../types/lms';

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw AppError.badRequest('No file uploaded', 'NO_FILE');
  const data = req.body as CreateMaterialInput;
  const material = await materialService.createMaterial(req.user!.id, data, req.file);
  sendCreated(res, { material }, 'Material uploaded successfully');
});

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListMaterialsQuery;
  const result = await materialService.listMaterials(req.user!.id, req.user!.role, filters);
  sendSuccess(res, result);
});

export const getMaterial = asyncHandler(async (req: Request, res: Response) => {
  const material = await materialService.getMaterialById(req.user!.id, req.user!.role, req.params.id);
  sendSuccess(res, { material });
});

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as UpdateMaterialInput;
  const material = await materialService.updateMaterial(
    req.user!.id,
    req.params.id,
    data,
    req.file ?? null
  );
  sendSuccess(res, { material }, 'Material updated successfully');
});

export const deleteMaterial = asyncHandler(async (req: Request, res: Response) => {
  await materialService.deleteMaterial(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Material deleted successfully');
});

export const downloadMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { filePath, fileName } = await materialService.getMaterialFilePath(
    req.user!.id,
    req.user!.role,
    req.params.id
  );
  if (!fs.existsSync(filePath)) throw AppError.notFound('File not found on server');
  res.download(filePath, fileName);
});
