import { badRequest } from './errors.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface CursorPage {
  limit: number;
  cursor?: string | undefined;
  nextCursor: string | null;
  total?: number;
}

/**
 * Cursor is an opaque base64 of "<sortValue>|<id>". Offset pagination drifts when
 * rows are inserted mid-scroll, which on a listings feed happens constantly.
 */
export function encodeCursor(sortValue: string | number | Date, id: string): string {
  const raw = sortValue instanceof Date ? sortValue.toISOString() : String(sortValue);
  return Buffer.from(`${raw}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { sortValue: string; id: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw badRequest('Malformed cursor');
  }
  const separator = decoded.lastIndexOf('|');
  if (separator === -1) throw badRequest('Malformed cursor');
  const sortValue = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);
  if (!sortValue || !id) throw badRequest('Malformed cursor');
  return { sortValue, id };
}

export function clampLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT);
}
