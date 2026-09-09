import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL } from '@/lib/api/client';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/session';

/**
 * Authenticated passthrough to the API.
 *
 * Client components need to call authenticated endpoints, but must never hold a
 * token — anything JavaScript can read, injected JavaScript can steal. They call
 * this instead, and it attaches the access token from the httpOnly cookie.
 *
 * When the access token has expired it transparently refreshes once and retries,
 * so a 15-minute token never surfaces as a spurious "signed out" to the user.
 */

const FORWARDED_HEADERS = ['content-type', 'accept'];

async function forward(request: Request, path: string): Promise<Response> {
  const store = await cookies();
  const url = new URL(request.url);
  const target = `${API_URL}/api/v1/${path}${url.search}`;

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();

  const call = (token: string | undefined) => {
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('x-client', 'mobile');
    if (token) headers.set('authorization', `Bearer ${token}`);
    return fetch(target, { method: request.method, headers, body });
  };

  let response = await call(store.get(ACCESS_COOKIE)?.value);
  let refreshed: { accessToken?: string; refreshToken?: string } | null = null;

  if (response.status === 401) {
    const refreshToken = store.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const refresh = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-client': 'mobile' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refresh.ok) {
        refreshed = (await refresh.json()) as { accessToken?: string; refreshToken?: string };
        response = await call(refreshed.accessToken);
      }
    }
  }

  const text = await response.text();
  const out = text
    ? new NextResponse(text, {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
      })
    : new NextResponse(null, { status: response.status });

  // Persist the rotated tokens, or the next request refreshes all over again.
  if (refreshed?.accessToken) {
    const secure = process.env.NODE_ENV === 'production';
    out.cookies.set(ACCESS_COOKIE, refreshed.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 20,
    });
    if (refreshed.refreshToken) {
      out.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return out;
}

async function handler(request: Request, ctx: RouteContext<'/api/proxy/[...path]'>) {
  const { path } = await ctx.params;
  return forward(request, path.join('/'));
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
