import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logFn =
      statusCode >= 500
        ? console.error
        : statusCode >= 400
          ? console.warn
          : console.info;

    logFn(`${method} ${originalUrl} ${statusCode} ${duration}ms`);
  });

  next();
}
