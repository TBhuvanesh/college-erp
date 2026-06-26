import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncMiddleware): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
