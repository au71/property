import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function formatIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Parses and replaces req.body / req.query / req.params with the validated,
 * coerced value. Handlers read `req.body` and get the parsed type, so validation
 * cannot be skipped by accident.
 *
 * Express 5 makes req.query a getter-only property, so the parsed query is
 * stashed on res.locals and read back through `validated(req)`.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) res.locals['query'] = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError('VALIDATION_ERROR', 'Request validation failed', formatIssues(err)));
        return;
      }
      next(err);
    }
  };
}

/** Reads the validated query stashed by `validate`. */
export function validatedQuery<T>(res: Response): T {
  return res.locals['query'] as T;
}

/**
 * Reads a path parameter that `validate({ params })` has already checked.
 *
 * Express 5 types req.params as `string | string[] | undefined` per key, which
 * is honest for the router but noise at every call site once the schema has
 * guaranteed a string.
 */
export function pathParam(req: Request, name: string): string {
  const value = (req.params as Record<string, unknown>)[name];
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION_ERROR', `Missing path parameter: ${name}`);
  }
  return value;
}

/**
 * Reads the request body that `validate({ body })` has already parsed.
 *
 * Express types `req.body` as `any`, which silently disables type checking in
 * every handler. Going through here restores it, and the cast is sound because
 * `validate` replaced the body with the schema's output.
 */
export function validatedBody<T>(req: Request): T {
  return req.body as T;
}
