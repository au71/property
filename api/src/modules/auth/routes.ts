import { Router } from 'express';
import { config } from '../../config/index.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate, validatedBody } from '../../middleware/validate.js';
import { actorOf, requireAuth } from '../../middleware/auth.js';
import { loginLimiter, otpLimiter } from '../../middleware/rateLimit.js';
import { badRequest } from '../../lib/errors.js';
import * as service from './service.js';
import type { LoginInput, OtpVerifyInput, RegisterInput } from './schema.js';
import { loginSchema, otpRequestSchema, otpVerifySchema, registerSchema } from './schema.js';
import type { Request, Response } from 'express';
import type { AuthResult } from './service.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'property_refresh';

function requestMeta(req: Request) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

/**
 * The web client keeps its refresh token in an httpOnly cookie the browser
 * manages; the mobile client has no cookie jar and keeps it in secure storage.
 * Both hit the same endpoints and say which they are via X-Client.
 */
function isWebClient(req: Request): boolean {
  return (req.get('x-client') ?? 'web').toLowerCase() !== 'mobile';
}

function sendAuth(req: Request, res: Response, result: AuthResult, status = 200): void {
  const { refreshToken, ...rest } = result;
  if (isWebClient(req)) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
    res.status(status).json(rest);
    return;
  }
  res.status(status).json(result);
}

function readRefreshToken(req: Request): string | undefined {
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  return fromBody ?? (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.register(validatedBody<RegisterInput>(req), requestMeta(req));
    sendAuth(req, res, result, 201);
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.login(validatedBody<LoginInput>(req), requestMeta(req));
    sendAuth(req, res, result);
  }),
);

authRouter.post(
  '/otp/request',
  otpLimiter,
  validate({ body: otpRequestSchema }),
  asyncHandler(async (req, res) => {
    await service.requestOtp(validatedBody<{ phone: string }>(req).phone);
    // Always the same response, so this cannot be used to test whether a number
    // is registered.
    res.status(202).json({ sent: true });
  }),
);

authRouter.post(
  '/otp/verify',
  otpLimiter,
  validate({ body: otpVerifySchema }),
  asyncHandler(async (req, res) => {
    const result = await service.verifyOtp(validatedBody<OtpVerifyInput>(req), requestMeta(req));
    sendAuth(req, res, result);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = readRefreshToken(req);
    if (!token) throw badRequest('No refresh token supplied');
    const result = await service.refresh(token, requestMeta(req));
    sendAuth(req, res, result);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await service.logout(readRefreshToken(req), req.sessionId);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.currentUser(actorOf(req).id));
  }),
);
