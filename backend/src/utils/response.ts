import type { Response } from 'express';

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): void {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 201);
}
