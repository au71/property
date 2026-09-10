import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api/client';
import { withClientIp } from '@/lib/api/client-ip';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/session';

/**
 * A thin server-side proxy for the auth endpoints.
 *
 * The browser never handles a token directly: it posts credentials here, this
 * handler calls the API as a "mobile" client (so the tokens come back in the
 * body), and then writes both into httpOnly cookies. A cross-site script cannot
 * read them, and the API keeps a single token contract for every client.
 */

const ALLOWED = new Set(['login', 'register', 'logout', 'refresh', 'otp/request', 'otp/verify']);

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

interface TokenResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}

export async function POST(request: Request, ctx: RouteContext<'/api/auth/[...action]'>) {
  const { action } = await ctx.params;
  const path = action.join('/');

  if (!ALLOWED.has(path)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Unknown auth action' } },
      { status: 404 },
    );
  }

  const store = await cookies();

  if (path === 'logout') {
    const refreshToken = store.get(REFRESH_COOKIE)?.value;
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'mobile' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const incoming: unknown = path === 'refresh' ? {} : await request.json().catch(() => ({}));
  const body =
    path === 'refresh'
      ? { refreshToken: store.get(REFRESH_COOKIE)?.value }
      : (incoming as Record<string, unknown>);

  const upstream = await fetch(`${API_URL}/api/v1/auth/${path}`, {
    method: 'POST',
    // The visitor's address travels with the call, or the API's per-IP limits on
    // OTP and login would count the whole site as one very busy client.
    headers: withClientIp(
      new Headers({ 'content-type': 'application/json', 'x-client': 'mobile' }),
      request,
    ),
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }

  const tokens = payload as TokenResponse;
  const response = NextResponse.json(
    { user: tokens.user ?? null },
    { status: upstream.status },
  );

  if (tokens.accessToken) {
    // Slightly longer than the token's own 15-minute life, so a request in
    // flight when it expires still reaches the refresh path rather than
    // looking like a signed-out user.
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(60 * 20));
  }
  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  }

  return response;
}
