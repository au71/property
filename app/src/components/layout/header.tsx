import Link from 'next/link';
import { IconBuildingCommunity, IconHeart, IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser, canListProperties, isStaff } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';
import { UserMenu } from './user-menu';

export async function Header() {
  const [{ t, locale }, user] = await Promise.all([getTranslations(), getCurrentUser()]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Home">
          <IconBuildingCommunity className="size-6 text-success" aria-hidden />
          <span className="hidden font-[family-name:var(--font-heading)] sm:inline">
            Property
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/buy">{t('nav.buy')}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rent">{t('nav.rent')}</Link>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch current={locale} />

          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild aria-label={t('nav.saved')}>
                <Link href="/dashboard/saved">
                  <IconHeart />
                </Link>
              </Button>
              {canListProperties(user) && (
                <Button size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/dashboard/listings/new">
                    <IconPlus />
                    {t('nav.postListing')}
                  </Link>
                </Button>
              )}
              <UserMenu
                user={user}
                isStaff={isStaff(user)}
                labels={{
                  dashboard: t('nav.dashboard'),
                  admin: t('nav.admin'),
                  signOut: t('nav.signOut'),
                  saved: t('nav.saved'),
                }}
              />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{t('nav.signIn')}</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/register">{t('nav.postListing')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
