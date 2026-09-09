'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { IconLanguage } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/dictionaries';

/**
 * Locale is a cookie, not a URL segment, so switching it re-renders the server
 * components in place without changing the address. One canonical URL per page
 * keeps links shareable and avoids two versions competing in search results.
 */
export function LanguageSwitch({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = current === 'my' ? 'en' : 'my';

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        // A year, so a returning visitor keeps their choice.
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        startTransition(() => router.refresh());
      }}
      aria-label={next === 'my' ? 'Switch to Myanmar' : 'Switch to English'}
    >
      <IconLanguage />
      <span className="text-xs font-semibold">{next === 'my' ? 'မြန်မာ' : 'EN'}</span>
    </Button>
  );
}
