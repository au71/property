import { describe, expect, it } from 'vitest';
import { formatPhone, isValidPhone, normalizePhone } from '../auth/phone';

describe('normalizePhone', () => {
  it('accepts every form the number is written in', () => {
    for (const written of [
      '09987654321',
      '09 987 654 321',
      '09-987-654-321',
      '+959987654321',
      '+95 9 987 654 321',
      '959987654321',
    ]) {
      expect(normalizePhone(written)).toBe('+959987654321');
    }
  });

  it('rejects what is not a Myanmar mobile number', () => {
    // Too short, too long, a landline, and a bare subscriber number with no
    // prefix — the API refuses all four, so the form must not send them.
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('099876543210000')).toBeNull();
    expect(normalizePhone('012345678')).toBeNull();
    expect(normalizePhone('9987654321')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('is what isValidPhone answers on', () => {
    expect(isValidPhone('09987654321')).toBe(true);
    expect(isValidPhone('nonsense')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('reads a stored number back in the local form', () => {
    expect(formatPhone('+959987654321')).toBe('09 987 654 321');
  });

  it('leaves something it does not recognise alone', () => {
    expect(formatPhone('not a number')).toBe('not a number');
  });
});
