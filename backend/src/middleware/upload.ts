import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

/**
 * Absolute path to the directory where uploaded PDFs are stored.
 * Resolved from UPLOAD_DIR env var (default: uploads/documents relative to CWD).
 * Created automatically on server start.
 */
export const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const multerInstance = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },   // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Processes a single PDF on the 'file' field and normalises multer errors into
 * AppErrors so the global handler returns consistent JSON responses.
 */
export function uploadPdf(req: Request, res: Response, next: NextFunction): void {
  multerInstance.single('file')(req, res, (err: unknown) => {
    if (!err) return next();

    if (err instanceof MulterError) {
      const appErr =
        err.code === 'LIMIT_FILE_SIZE'
          ? AppError.badRequest('PDF exceeds the 20 MB size limit', 'FILE_TOO_LARGE')
          : AppError.badRequest(err.message, 'UPLOAD_ERROR');
      return next(appErr);
    }

    if (err instanceof AppError) return next(err);

    if (err instanceof Error) {
      // fileFilter rejection or other non-multer errors
      const code = err.message.includes('Only PDF') ? 'INVALID_FILE_TYPE' : 'UPLOAD_ERROR';
      return next(AppError.badRequest(err.message, code));
    }

    return next(err);
  });
}
