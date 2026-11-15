import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { sendError } from '../utils/api-response';
import { logger } from '../config/logger';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, [], 404);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.errors, err.statusCode);
    return;
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    sendError(res, 'Validation failed', errors, 400);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      sendError(
        res,
        `Duplicate record: a record with the same ${target} already exists`,
        [{ field: String(target), message: `Duplicate value for ${target}` }],
        409
      );
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 'Requested record not found', [], 404);
      return;
    }
    if (err.code === 'P2003') {
      sendError(
        res,
        'Operation blocked because related historical records exist',
        [],
        409
      );
      return;
    }
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled application error');
  sendError(res, 'Internal server error', [], 500);
}
