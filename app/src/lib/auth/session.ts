import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { CurrentUser } from '@/lib/api/types';

/**
 * The refresh token lives in an httpOnly cookie the browser cannot read. The
 * access token is short-lived and kept in a second httpOnly cookie rather than
 * in JavaScript, so a script injection cannot walk off with either.
 *
 * Route handlers under /api/auth are the only place these are written.
 */
export const ACCESS_COOKIE = 'property_access';
export const REFRESH_COOKIE = 'property_refresh';

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

/**
 * Returns the signed-in user, or null. Never throws for an expired session —
 * callers treat null as "signed out" and a page that needs a session redirects.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await apiFetch<CurrentUser>('/auth/me', { token });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}

export function hasRole(user: CurrentUser | null, ...roles: string[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r as CurrentUser['roles'][number]));
}

export const isStaff = (user: CurrentUser | null) => hasRole(user, 'STAFF', 'ADMIN');
export const canListProperties = (user: CurrentUser | null) =>
  hasRole(user, 'OWNER', 'AGENT', 'STAFF', 'ADMIN');
