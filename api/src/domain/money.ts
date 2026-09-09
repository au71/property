import type { Currency } from '../generated/prisma/enums.js';

/**
 * Money is stored as BigInt in the smallest unit of its currency. MMK has no
 * circulating subunit, so its smallest unit is 1 kyat; USD uses cents.
 */
export const MINOR_UNITS_PER_MAJOR: Record<Currency, number> = {
  MMK: 1,
  USD: 100,
};

/** A lakh (သိန်း) is 100,000 — the unit Myanmar property prices are quoted in. */
export const LAKH = 100_000n;
/** A crore (ကုဋေ) is 10,000,000. */
export const CRORE = 10_000_000n;

export function toMinorUnits(major: number, currency: Currency): bigint {
  const factor = MINOR_UNITS_PER_MAJOR[currency];
  return BigInt(Math.round(major * factor));
}

export function toMajorUnits(minor: bigint, currency: Currency): number {
  return Number(minor) / MINOR_UNITS_PER_MAJOR[currency];
}

/**
 * JSON has no BigInt, and a MMK sale price can exceed Number.MAX_SAFE_INTEGER's
 * useful precision once you start doing arithmetic on it. Prices cross the wire
 * as decimal strings and are parsed back by the client.
 */
export function serializePrice(value: bigint | null | undefined): string | null {
  return value == null ? null : value.toString();
}

export function parsePrice(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error('Price must be a whole number of minor units');
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new Error(`Not a valid price: ${value}`);
  return BigInt(value);
}

/**
 * Formats a MMK amount the way Myanmar listings read it, e.g. 250000000 ->
 * "2,500 သိန်း". Returns null when the lakh form would be misleading (under one
 * lakh, or not a clean lakh multiple).
 */
export function formatLakh(minor: bigint, currency: Currency): string | null {
  if (currency !== 'MMK') return null;
  if (minor < LAKH) return null;
  if (minor % LAKH !== 0n) return null;
  const lakhs = minor / LAKH;
  return `${lakhs.toLocaleString('en-US')} သိန်း`;
}
