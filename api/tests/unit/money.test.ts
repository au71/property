import { describe, expect, it } from 'vitest';
import {
  formatLakh,
  parsePrice,
  serializePrice,
  toMajorUnits,
  toMinorUnits,
} from '../../src/domain/money.js';
import { acresToSqft, deriveLandAreaSqft, sqftToAcres } from '../../src/domain/area.js';

describe('price serialization', () => {
  it('keeps a MMK price that exceeds 32-bit range intact', () => {
    // The whole reason priceAmount is BigInt rather than Int.
    const price = 5_000_000_000n;
    expect(price > BigInt(2 ** 31 - 1)).toBe(true);
    expect(parsePrice(serializePrice(price)!)).toBe(price);
  });

  it('round-trips through JSON without precision loss', () => {
    const price = 9_007_199_254_740_993n; // Number.MAX_SAFE_INTEGER + 2
    const json = JSON.stringify({ price: serializePrice(price) });
    expect(parsePrice(JSON.parse(json).price)).toBe(price);
  });

  it('serializes null as null', () => {
    expect(serializePrice(null)).toBeNull();
  });

  it('rejects a non-numeric string', () => {
    expect(() => parsePrice('12a')).toThrow();
  });

  it('rejects a fractional number of minor units', () => {
    expect(() => parsePrice(10.5)).toThrow();
  });
});

describe('minor units', () => {
  it('treats MMK as having no subunit', () => {
    expect(toMinorUnits(250_000_000, 'MMK')).toBe(250_000_000n);
    expect(toMajorUnits(250_000_000n, 'MMK')).toBe(250_000_000);
  });

  it('treats USD as cents', () => {
    expect(toMinorUnits(1500.5, 'USD')).toBe(150_050n);
    expect(toMajorUnits(150_050n, 'USD')).toBe(1500.5);
  });
});

describe('formatLakh', () => {
  it('renders a clean MMK price in lakh', () => {
    expect(formatLakh(250_000_000n, 'MMK')).toBe('2,500 သိန်း');
  });

  it('declines when the amount is not a whole number of lakh', () => {
    expect(formatLakh(250_000_001n, 'MMK')).toBeNull();
  });

  it('declines under one lakh', () => {
    expect(formatLakh(50_000n, 'MMK')).toBeNull();
  });

  it('declines for USD', () => {
    expect(formatLakh(250_000_000n, 'USD')).toBeNull();
  });
});

describe('land area', () => {
  it('derives area from a width x length quote', () => {
    expect(deriveLandAreaSqft(40, 60)).toBe(2400);
  });

  it('returns null when a dimension is missing', () => {
    expect(deriveLandAreaSqft(40, null)).toBeNull();
    expect(deriveLandAreaSqft(null, 60)).toBeNull();
  });

  it('returns null for a non-positive dimension', () => {
    expect(deriveLandAreaSqft(0, 60)).toBeNull();
    expect(deriveLandAreaSqft(-40, 60)).toBeNull();
  });

  it('converts acres to square feet and back', () => {
    expect(acresToSqft(1)).toBe(43_560);
    expect(sqftToAcres(43_560)).toBe(1);
  });
});
