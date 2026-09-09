import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../../lib/tokens.js';
import {
  OTP_MAX_ATTEMPTS,
  generateOtpCode,
  hashOtpCode,
  otpExpiry,
  smsProvider,
} from '../../lib/otp.js';
import { badRequest, conflict, unauthenticated } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { Role } from '../../generated/prisma/enums.js';
import type { LoginInput, OtpVerifyInput, RegisterInput } from './schema.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: Role[];
    preferredLang: string;
    isVerified: boolean;
  };
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  preferredLang: true,
  isVerified: true,
  isActive: true,
  passwordHash: true,
  roles: { select: { role: true } },
} as const;

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLang: string;
  isVerified: boolean;
  isActive: boolean;
  passwordHash: string | null;
  roles: Array<{ role: Role }>;
};

async function issueSession(
  user: UserRow,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
  familyId: string = randomUUID(),
): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      familyId,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      expiresAt: refreshTokenExpiry(),
    },
  });

  const roles = user.roles.map((r) => r.role);
  const accessToken = await signAccessToken({ sub: user.id, roles, sid: session.id });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles,
      preferredLang: user.preferredLang,
      isVerified: user.isVerified,
    },
  };
}

export async function register(
  input: RegisterInput,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
): Promise<AuthResult> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.email ? [{ email: input.email }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw conflict('An account with that email address or phone number already exists');
  }

  // A seeker role is granted to everyone: an owner also browses.
  const roles: Role[] = input.intent === 'SEEKER' ? ['SEEKER'] : ['SEEKER', input.intent];

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: await hashPassword(input.password),
      preferredLang: input.preferredLang,
      roles: { create: roles.map((role) => ({ role })) },
      ...(input.intent === 'AGENT' ? { agentProfile: { create: {} } } : {}),
    },
    select: userSelect,
  });

  return issueSession(user, meta);
}

export async function login(
  input: LoginInput,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
): Promise<AuthResult> {
  const identifier = input.identifier.trim();
  const asEmail = identifier.toLowerCase();
  // Accept either form of a phone number without forcing the client to normalise.
  const digits = identifier.replace(/[^\d]/g, '');
  const asPhone = digits
    ? `+95${digits.startsWith('95') ? digits.slice(2) : digits.replace(/^0/, '')}`
    : null;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: asEmail }, ...(asPhone ? [{ phone: asPhone }] : [])] },
    select: userSelect,
  });

  // Same message and roughly the same work either way, so the response does not
  // reveal whether an account exists.
  const invalid = unauthenticated('Incorrect email/phone or password');
  if (!user?.passwordHash) {
    await hashPassword(input.password);
    throw invalid;
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalid;
  if (!user.isActive) throw unauthenticated('This account has been deactivated');

  return issueSession(user, meta);
}

export async function requestOtp(phone: string): Promise<void> {
  const code = generateOtpCode();
  await prisma.otpCode.create({
    data: { phone, codeHash: hashOtpCode(phone, code), expiresAt: otpExpiry() },
  });
  await smsProvider.send(phone, `Your property portal verification code is ${code}.`);
}

export async function verifyOtp(
  input: OtpVerifyInput,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
): Promise<AuthResult> {
  const record = await prisma.otpCode.findFirst({
    where: { phone: input.phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw badRequest('That code has expired. Request a new one.');
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw badRequest('Too many incorrect attempts. Request a new code.');
  }

  if (record.codeHash !== hashOtpCode(input.phone, input.code)) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw badRequest('That code is not correct');
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const existing = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: userSelect,
  });

  if (existing) {
    if (!existing.isActive) throw unauthenticated('This account has been deactivated');
    if (!existing.isVerified) {
      await prisma.user.update({ where: { id: existing.id }, data: { isVerified: true } });
    }
    return issueSession(existing, meta);
  }

  const created = await prisma.user.create({
    data: {
      name: input.name?.trim() || input.phone,
      phone: input.phone,
      isVerified: true,
      roles: { create: [{ role: 'SEEKER' }] },
    },
    select: userSelect,
  });
  return issueSession(created, meta);
}

/**
 * Refresh with rotation and reuse detection: presenting a token that has already
 * been rotated means it leaked, so the whole session family is revoked.
 */
export async function refresh(
  token: string,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
): Promise<AuthResult> {
  const hash = hashRefreshToken(token);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: { select: userSelect } },
  });

  if (!session) throw unauthenticated('Invalid refresh token');

  if (session.revokedAt) {
    logger.warn(
      { userId: session.userId, familyId: session.familyId },
      'Refresh token reuse detected; revoking session family',
    );
    await prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthenticated('Session expired. Please sign in again.');
  }

  if (session.expiresAt <= new Date())
    throw unauthenticated('Session expired. Please sign in again.');
  if (!session.user.isActive) throw unauthenticated('This account has been deactivated');

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return issueSession(session.user, meta, session.familyId);
}

export async function logout(token: string | undefined, sessionId?: string): Promise<void> {
  if (token) {
    await prisma.session.updateMany({
      where: { refreshTokenHash: hashRefreshToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }
  if (sessionId) {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function currentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      preferredLang: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
      roles: { select: { role: true } },
      agentProfile: {
        select: { agencyName: true, licenseNo: true, bio: true, isVerifiedAgent: true },
      },
    },
  });
  if (!user) throw unauthenticated();
  const { roles, ...rest } = user;
  return { ...rest, roles: roles.map((r) => r.role) };
}
