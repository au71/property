import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { hasRole } from '../domain/policy.js';
import type { Role } from '../generated/prisma/enums.js';

function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Loads the actor when a valid token is present, and does nothing when it is
 * absent. Roles come from the database rather than the token, so revoking a role
 * takes effect immediately instead of at token expiry.
 */
export async function loadActor(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const claims = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, isActive: true, roles: { select: { role: true } } },
    });
    if (!user) {
      next();
      return;
    }
    req.actor = {
      id: user.id,
      roles: user.roles.map((r) => r.role),
      isActive: user.isActive,
    };
    req.sessionId = claims.sid;
    next();
  } catch {
    // An invalid token on an optional-auth route is treated as anonymous;
    // requireAuth below is what turns that into a 401.
    next();
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.actor) {
    next(unauthenticated());
    return;
  }
  if (!req.actor.isActive) {
    next(forbidden('This account has been deactivated'));
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.actor) {
      next(unauthenticated());
      return;
    }
    if (!req.actor.isActive) {
      next(forbidden('This account has been deactivated'));
      return;
    }
    if (!hasRole(req.actor, ...roles)) {
      next(forbidden(`Requires one of: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

/** Narrowing helper for handlers that run behind requireAuth. */
export function actorOf(req: Request) {
  if (!req.actor) throw unauthenticated();
  return req.actor;
}
