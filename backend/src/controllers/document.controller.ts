import type { Request, Response } from 'express';
import * as documentService from '../services/document.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import type { UploadDocumentInput, ListDocumentsQuery } from '../types/document';

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw AppError.badRequest('No PDF file uploaded', 'NO_FILE');

  const data = req.body as UploadDocumentInput;
  const document = await documentService.uploadDocument(
    data,
    req.file.path,
    req.file.originalname,
    req.user!.id
  );
  sendCreated(res, { document }, 'Document uploaded and processed successfully');
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListDocumentsQuery;
  const result = await documentService.listDocuments(filters);
  sendSuccess(res, result);
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await documentService.getDocumentById(req.params.id);
  sendSuccess(res, { document });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await documentService.deleteDocument(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Document deleted successfully');
});
