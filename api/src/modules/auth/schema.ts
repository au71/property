import { z } from 'zod';

/**
 * Myanmar mobile numbers: 09XXXXXXXXX locally, +959XXXXXXXXX internationally.
 * Stored normalised to the +95 form so one person cannot register twice.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?95|0)9\d{7,10}$/, 'Enter a valid Myanmar mobile number, e.g. 09123456789')
  .transform((raw) => {
    const digits = raw.replace(/[^\d]/g, '');
    const withoutCountry = digits.startsWith('95') ? digits.slice(2) : digits.replace(/^0/, '');
    return `+95${withoutCountry}`;
  });

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200)
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), {
    message: 'Password must contain at least one letter and one number',
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().toLowerCase().optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    // What the account is for. ADMIN and STAFF are never self-assigned.
    intent: z.enum(['SEEKER', 'OWNER', 'AGENT']).default('SEEKER'),
    preferredLang: z.enum(['my', 'en']).default('my'),
  })
  .refine((v) => v.email ?? v.phone, {
    message: 'Provide an email address or a phone number',
    path: ['email'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email address or phone number'),
  password: z.string().min(1, 'Enter your password'),
});

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  // Supplied on first sign-in so the account has a name.
  name: z.string().trim().min(2).max(120).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
