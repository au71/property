/**
 * The visitor's address, for the API's per-IP rate limits.
 *
 * Every call the route handlers make reaches the API from the web server
 * itself, so without this the API sees one client for the whole site: five OTP
 * requests a minute would be the budget shared by everyone, and one busy
 * evening would lock the rest of the country out of signing in.
 *
 * Caddy appends the address it saw to X-Forwarded-For, so the *last* entry is
 * the only one it vouches for — anything a visitor put in the header themselves
 * sits to its left and is ignored. The API runs with `trust proxy 1` and reads
 * the last entry likewise.
 */
export function clientIp(request: Request): string | undefined {
  const chain = request.headers.get('x-forwarded-for');
  const last = chain?.split(',').pop()?.trim();
  return last || undefined;
}

/** Adds the forwarding header to an upstream request when there is one to add. */
export function withClientIp(headers: Headers, request: Request): Headers {
  const ip = clientIp(request);
  if (ip) headers.set('x-forwarded-for', ip);
  return headers;
}
