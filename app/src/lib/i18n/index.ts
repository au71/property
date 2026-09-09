import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  type MessageKey,
  dictionaries,
  isLocale,
} from './dictionaries';

export type { Locale, MessageKey };
export { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale } from './dictionaries';

export type Translate = (key: MessageKey) => string;

export function translator(locale: Locale): Translate {
  const dict = dictionaries[locale];
  // A missing key returns the key itself rather than throwing: a stray label is
  // a visible bug, a crashed page is a worse one.
  return (key) => dict[key] ?? key;
}

/** Reads the locale cookie. Server components only — `cookies()` is async in Next 16. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslations(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
