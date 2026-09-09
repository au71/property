import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorCode } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/** Prisma's own error shapes, mapped to something a client can act on. */
function fromPrisma(err: unknown): AppError | null {
  const code = (err as { code?: string }).code;
  if (typeof code !== 'string' || !code.startsWith('P')) return null;
  switch (code) {
    case 'P2002':
      return new AppError('CONFLICT', 'That value is already taken', {
        fields: (err as { meta?: { target?: unknown } }).meta?.target,
      });
    case 'P2025':
      return new AppError('NOT_FOUND', 'Resource not found');
    case 'P2003':
      return new AppError('VALIDATION_ERROR', 'Referenced record does not exist');
    default:
      return null;
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies error handlers by arity, so `next` must stay declared.
  _next: NextFunction,
): void {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = new AppError('VALIDATION_ERROR', 'Request validation failed', err.issues);
  } else {
    appError = fromPrisma(err) ?? new AppError('INTERNAL', 'Something went wrong');
  }

  if (appError.status >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.path }, 'Unhandled error');
  } else {
    logger.debug(
      { code: appError.code, requestId: req.requestId, path: req.path },
      'Request failed',
    );
  }

  const body: ErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      requestId: req.requestId,
    },
  };
  if (appError.details !== undefined) body.error.details = appError.details;
  // Never leak an internal stack trace to a client in production.
  if (!config.isProduction && appError.status >= 500 && err instanceof Error) {
    body.error.details = { stack: err.stack };
  }

  res.status(appError.status).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND' satisfies ErrorCode,
      message: `No route for ${req.method} ${req.path}`,
      requestId: req.requestId,
    },
  });
}
