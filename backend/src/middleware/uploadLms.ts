import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

export const LMS_UPLOAD_DIR = path.resolve(process.cwd(), env.LMS_UPLOAD_DIR);
fs.mkdirSync(LMS_UPLOAD_DIR, { recursive: true });

const LMS_ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',                                                      // ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',          // pptx
  'application/msword',                                                                 // doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',            // docx
]);

const LMS_ALLOWED_EXTS = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LMS_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const multerInstance = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },   // 20 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!LMS_ALLOWED_MIMES.has(file.mimetype) && !LMS_ALLOWED_EXTS.has(ext)) {
      cb(new Error('Only PDF, PPT, PPTX, DOC, and DOCX files are accepted'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Processes a single LMS file on the 'file' field.
 * Accepts PDF, PPT, PPTX, DOC, DOCX up to 20 MB.
 * Normalises multer errors into AppErrors for consistent JSON responses.
 */
export function uploadLmsFile(req: Request, res: Response, next: NextFunction): void {
  multerInstance.single('file')(req, res, (err: unknown) => {
    if (!err) return next();

    if (err instanceof MulterError) {
      const appErr =
        err.code === 'LIMIT_FILE_SIZE'
          ? AppError.badRequest('File exceeds the 20 MB size limit', 'FILE_TOO_LARGE')
          : AppError.badRequest(err.message, 'UPLOAD_ERROR');
      return next(appErr);
    }

    if (err instanceof AppError) return next(err);

    if (err instanceof Error) {
      const code = err.message.includes('Only PDF') ? 'INVALID_FILE_TYPE' : 'UPLOAD_ERROR';
      return next(AppError.badRequest(err.message, code));
    }

    return next(err);
  });
}
