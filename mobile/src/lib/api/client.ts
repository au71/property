import Constants from 'expo-constants';
import type { ApiErrorBody } from './types';
import { getAccessToken, refreshSession } from '../auth/store';

/**
 * `localhost` is the device itself on a phone or an Android emulator, so the
 * API origin has to be configurable per environment rather than hard-coded.
 */
export const API_URL =
  process.env['EXPO_PUBLIC_API_URL'] ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const issue of this.details as Array<{ path?: string; message?: string }>) {
      if (issue.path && issue.message) out[issue.path] ??= issue.message;
    }
    return out;
  }
}

type QueryValue = string | number | boolean | string[] | undefined | null;

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Send the stored access token, refreshing once if it has expired. */
  authenticated?: boolean;
}

async function call<T>(path: string, options: RequestOptions, token?: string): Promise<Response> {
  const url = `${API_URL}/api/v1${path}${options.query ? buildQuery(options.query) : ''}`;
  return fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      // Tells the API to return tokens in the body rather than setting a
      // cookie: a React Native client has no cookie jar to speak of.
      'x-client': 'mobile',
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let token = options.authenticated ? await getAccessToken() : undefined;
  let response = await call<T>(path, options, token);

  // A 15-minute access token expires mid-session constantly; refresh once
  // rather than bouncing the user to the sign-in screen.
  if (response.status === 401 && options.authenticated) {
    token = await refreshSession();
    if (token) response = await call<T>(path, options, token);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? `Request failed with ${response.status}`,
      err?.details,
    );
  }

  return payload as T;
}
