import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config/index.js';
import { unauthenticated } from './errors.js';
import type { Role } from '../generated/prisma/enums.js';

export interface AccessTokenClaims {
  sub: string;
  roles: Role[];
  sid: string;
}

const ISSUER = 'property-api';
const AUDIENCE = 'property-clients';

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ roles: claims.roles, sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.accessTokenTtlMin}m`)
    .sign(config.auth.jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, config.auth.jwtSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (!payload.sub) throw new Error('missing subject');
    return {
      sub: payload.sub,
      roles: (payload['roles'] as Role[]) ?? [],
      sid: (payload['sid'] as string) ?? '',
    };
  } catch {
    throw unauthenticated('Invalid or expired access token');
  }
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 digest is stored,
 * so a database leak does not hand over live sessions.
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}
