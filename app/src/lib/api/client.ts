import type { ApiErrorBody } from './types';

export const API_URL =
  process.env['NEXT_PUBLIC_API_URL'] ?? process.env['API_URL'] ?? 'http://localhost:4000';

/** Server components talk to the API directly; the browser goes via NEXT_PUBLIC_API_URL. */
const SERVER_API_URL = process.env['API_URL'] ?? API_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from a validation failure, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const issue of this.details as Array<{ path?: string; message?: string }>) {
      if (issue.path && issue.message) out[issue.path] ??= issue.message;
    }
    return out;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | undefined;
  /** Seconds to cache a GET for. Omit for no caching. */
  revalidate?: number;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

export function buildQuery(
  params: Record<string, string | number | boolean | string[] | undefined | null>,
): string {
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

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, revalidate, query, headers, ...rest } = options;
  const base = typeof window === 'undefined' ? SERVER_API_URL : API_URL;
  const url = `${base}/api/v1${path}${query ? buildQuery(query) : ''}`;

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    // Server components opt into caching explicitly; anything user-specific
    // must never be cached, so the default is a fresh request.
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
  });

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
      err?.requestId,
    );
  }

  return payload as T;
}
