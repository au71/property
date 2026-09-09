import type { DealType } from './api/types';

const LAKH = 100_000n;

export type Locale = 'en' | 'my';

/**
 * Prices arrive as decimal strings because a MMK amount can exceed the range
 * where a JSON number stays exact. Parse to BigInt, never to Number.
 */
export function parseAmount(amount: string | null | undefined): bigint | null {
  if (amount == null || amount === '') return null;
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

const MY_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];

export function toMyanmarDigits(value: string): string {
  return value.replace(/\d/g, (d) => MY_DIGITS[Number(d)]!);
}

/**
 * Myanmar property prices are quoted in lakh (သိန်း), not in millions and not
 * in crore — "၂,၅၀၀ သိန်း" is how a 250,000,000 MMK asking price is actually
 * said, even though 25 ကုဋေ is the same number. Lakh is therefore the primary
 * label everywhere, with the exact figure available alongside it.
 */
export function formatMmk(amount: bigint, locale: Locale = 'en'): string {
  if (amount >= LAKH) {
    const remainder = amount % LAKH;
    const label =
      remainder === 0n
        ? (amount / LAKH).toLocaleString('en-US')
        : (Number(amount) / Number(LAKH)).toFixed(1);
    return locale === 'my' ? `${toMyanmarDigits(label)} သိန်း` : `${label} lakh`;
  }
  const plain = amount.toLocaleString('en-US');
  return locale === 'my' ? `${toMyanmarDigits(plain)} ကျပ်` : `${plain} MMK`;
}

export function formatPrice(
  price: { amount?: string | null; currency?: string; onRequest?: boolean; rentPeriod?: string | null },
  locale: Locale = 'en',
): string {
  if (price.onRequest) return locale === 'my' ? 'ဈေးနှုန်းမေးမြန်းရန်' : 'Price on request';

  const amount = parseAmount(price.amount);
  if (amount == null) return locale === 'my' ? 'ဈေးနှုန်းမေးမြန်းရန်' : 'Price on request';

  const base =
    price.currency === 'USD'
      ? `$${(Number(amount) / 100).toLocaleString('en-US')}`
      : formatMmk(amount, locale);

  if (price.rentPeriod === 'MONTHLY') return locale === 'my' ? `${base} / လ` : `${base} / month`;
  if (price.rentPeriod === 'YEARLY') return locale === 'my' ? `${base} / နှစ်` : `${base} / year`;
  return base;
}

/** The exact figure, for the detail page where precision matters. */
export function formatExactPrice(
  price: { amount?: string | null; currency?: string },
  locale: Locale = 'en',
): string | null {
  const amount = parseAmount(price.amount);
  if (amount == null) return null;
  if (price.currency === 'USD') return `$${(Number(amount) / 100).toLocaleString('en-US')}`;
  const plain = amount.toLocaleString('en-US');
  return locale === 'my' ? `${toMyanmarDigits(plain)} ကျပ်` : `${plain} MMK`;
}

export function formatArea(sqft: number | null | undefined, locale: Locale = 'en'): string | null {
  if (!sqft) return null;
  const value = sqft.toLocaleString('en-US');
  return locale === 'my' ? `${toMyanmarDigits(value)} စတုရန်းပေ` : `${value} sqft`;
}

export function formatLandDimensions(
  widthFt: number | null | undefined,
  lengthFt: number | null | undefined,
): string | null {
  if (!widthFt || !lengthFt) return null;
  // How land is actually advertised here: "40 x 60 ft".
  return `${widthFt} × ${lengthFt} ft`;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
];

export function formatRelativeDate(iso: string | null | undefined, locale: Locale = 'en'): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = then - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === 'my' ? 'my' : 'en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, 'minute');
}

export function formatDate(iso: string | null | undefined, locale: Locale = 'en'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale === 'my' ? 'my-MM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function dealTypePath(dealType: DealType): string {
  return dealType === 'SALE' ? 'buy' : 'rent';
}

export function pathDealType(segment: string): DealType | null {
  if (segment === 'buy') return 'SALE';
  if (segment === 'rent') return 'RENT';
  return null;
}
