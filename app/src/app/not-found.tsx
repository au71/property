import Link from 'next/link';
import { IconHomeSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { getTranslations } from '@/lib/i18n';

export default async function NotFound() {
  const { t } = await getTranslations();
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <IconHomeSearch className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">{t('listing.notFound')}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('search.noResultsHint')}</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link href="/buy">{t('nav.buy')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/rent">{t('nav.rent')}</Link>
        </Button>
      </div>
    </div>
  );
}
