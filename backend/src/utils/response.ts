import type { Response } from 'express';

// `metadata`/`errors` are additive and optional — every existing caller and
// every existing frontend consumer of `{ success, data, message }` keeps
// working unchanged. Use them only where a response genuinely has pagination
// metadata or a list of field-level validation errors to report.
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  metadata?: Record<string, unknown>
): void {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  if (metadata) body.metadata = metadata;
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 201);
}

/**
 * Sends a standardized error envelope. Existing error handling (the global
 * error middleware constructing ApiError objects inline) is untouched — this
 * is additive, for call sites that want to send an error response directly
 * without throwing an AppError.
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  errors?: Array<{ field?: string; message: string }>
): void {
  const body: ApiError = { success: false, code, message };
  if (errors) body.errors = errors;
  res.status(statusCode).json(body);
}
