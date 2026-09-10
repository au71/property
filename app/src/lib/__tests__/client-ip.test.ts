import { describe, expect, it } from 'vitest';
import { clientIp, withClientIp } from '../api/client-ip';

const requestWith = (headers: Record<string, string>) =>
  new Request('https://property.example.com/api/auth/otp/request', { headers });

describe('clientIp', () => {
  it('takes the address the proxy appended, not one the visitor supplied', () => {
    // A visitor who sets the header themselves gets their claim placed to the
    // left of the address Caddy actually saw. Reading the last entry is what
    // stops them spending someone else's rate-limit budget.
    expect(clientIp(requestWith({ 'x-forwarded-for': '10.0.0.9, 203.0.113.7' }))).toBe(
      '203.0.113.7',
    );
  });

  it('handles a single address and none at all', () => {
    expect(clientIp(requestWith({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(requestWith({}))).toBeUndefined();
    expect(clientIp(requestWith({ 'x-forwarded-for': '' }))).toBeUndefined();
  });
});

describe('withClientIp', () => {
  it('sets a single address upstream, replacing whatever chain arrived', () => {
    const headers = withClientIp(
      new Headers({ 'content-type': 'application/json' }),
      requestWith({ 'x-forwarded-for': 'spoofed, 203.0.113.7' }),
    );
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('leaves the header off when there is nothing to forward', () => {
    const headers = withClientIp(new Headers(), requestWith({}));
    expect(headers.has('x-forwarded-for')).toBe(false);
  });
});
