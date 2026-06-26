import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, ZodError } from 'zod';
import { AppError } from '../errors/AppError';

interface ValidateSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: ValidateSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      const zodErr = err as ZodError;
      const message = zodErr.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      next(AppError.badRequest(message, 'VALIDATION_ERROR'));
    }
  };
}
