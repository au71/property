import { describe, expect, it } from 'vitest';
import {
  dealTypePath,
  formatArea,
  formatExactPrice,
  formatLandDimensions,
  formatMmk,
  formatPrice,
  parseAmount,
  pathDealType,
  toMyanmarDigits,
} from '../format';

describe('parseAmount', () => {
  it('keeps a value beyond Number.MAX_SAFE_INTEGER exact', () => {
    expect(parseAmount('9007199254740993')).toBe(9_007_199_254_740_993n);
  });

  it('returns null for nothing or nonsense', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('formatMmk', () => {
  it('uses lakh, the unit prices are actually quoted in', () => {
    expect(formatMmk(250_000_000n)).toBe('2,500 lakh');
  });

  it('stays in lakh even for large amounts, rather than switching to crore', () => {
    // 20,000,000 MMK is 2 crore, but property here is advertised as 200 lakh.
    expect(formatMmk(20_000_000n)).toBe('200 lakh');
  });

  it('shows one decimal for an untidy lakh amount', () => {
    expect(formatMmk(15_500_000n)).toBe('155 lakh');
    expect(formatMmk(150_000n)).toBe('1.5 lakh');
  });

  it('falls back to kyat below one lakh', () => {
    expect(formatMmk(50_000n)).toBe('50,000 MMK');
  });

  it('renders Burmese numerals and units in Myanmar', () => {
    expect(formatMmk(250_000_000n, 'my')).toBe('၂,၅၀၀ သိန်း');
    expect(formatMmk(20_000_000n, 'my')).toBe('၂၀၀ သိန်း');
  });
});

describe('formatPrice', () => {
  it('appends the rent period', () => {
    expect(formatPrice({ amount: '1500000', currency: 'MMK', rentPeriod: 'MONTHLY' })).toBe(
      '15 lakh / month',
    );
  });

  it('respects price-on-request', () => {
    expect(formatPrice({ amount: '450000000', onRequest: true })).toBe('Price on request');
  });

  it('treats USD as cents', () => {
    expect(formatPrice({ amount: '150000', currency: 'USD' })).toBe('$1,500');
  });

  it('does not crash on a missing amount', () => {
    expect(formatPrice({})).toBe('Price on request');
  });

  it('formats a price too large for a 32-bit int', () => {
    expect(formatPrice({ amount: '5000000000', currency: 'MMK' })).toBe('50,000 lakh');
  });
});

describe('formatExactPrice', () => {
  it('gives the precise figure for the detail page', () => {
    expect(formatExactPrice({ amount: '250000000', currency: 'MMK' })).toBe('250,000,000 MMK');
  });
});

describe('misc formatting', () => {
  it('formats area', () => {
    expect(formatArea(1200)).toBe('1,200 sqft');
    expect(formatArea(null)).toBeNull();
  });

  it('formats land the way it is advertised', () => {
    expect(formatLandDimensions(40, 60)).toBe('40 × 60 ft');
    expect(formatLandDimensions(40, null)).toBeNull();
  });

  it('converts digits to Burmese numerals', () => {
    expect(toMyanmarDigits('2026')).toBe('၂၀၂၆');
  });

  it('maps deal types to URL segments both ways', () => {
    expect(dealTypePath('SALE')).toBe('buy');
    expect(dealTypePath('RENT')).toBe('rent');
    expect(pathDealType('buy')).toBe('SALE');
    expect(pathDealType('rent')).toBe('RENT');
    expect(pathDealType('nonsense')).toBeNull();
  });
});
