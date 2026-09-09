import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';

function handler(req: Request, res: Response): void {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again shortly.',
      requestId: req.requestId,
    },
  });
}

const base: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  // Rate limiting a test suite just makes it flaky.
  skip: () => config.isTest,
};

export const generalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300 });

/** OTP costs money to send and is the obvious enumeration target. */
export const otpLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 5 });

export const loginLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 10 });

/** Public enquiry creation is the main spam surface. */
export const enquiryLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 5 });

export const uploadLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 30 });
