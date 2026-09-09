import Link from 'next/link';
import { IconArrowRight, IconBuildingCommunity } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { ListingGrid } from '@/components/listing/listing-grid';
import { HomeSearch } from '@/components/search/home-search';
import { getCategoryTree, getLocationTree, searchListings } from '@/lib/api/queries';
import { getTranslations } from '@/lib/i18n';

export default async function HomePage() {
  const { locale, t } = await getTranslations();

  const [{ data: regions }, { data: categories }, featured, recent] = await Promise.all([
    getLocationTree(),
    getCategoryTree(),
    searchListings({ isFeatured: 'true', limit: 6 }),
    searchListings({ limit: 6, sort: 'newest' }),
  ]);

  const yangon = regions.flatMap((r) => r.cities).find((c) => c.slug === 'yangon');

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-accent/50 to-background">
        <div className="container-page py-12 md:py-20">
          <h1
            className="max-w-2xl text-3xl font-bold text-balance md:text-5xl"
            lang={locale}
          >
            {t('home.title')}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground md:text-lg" lang={locale}>
            {t('home.subtitle')}
          </p>

          <div className="mt-8 max-w-3xl">
            <HomeSearch
              regions={regions}
              categories={categories}
              locale={locale}
              labels={{
                buy: t('nav.buy'),
                rent: t('nav.rent'),
                placeholder: t('search.placeholder'),
                search: t('search.search'),
                location: t('filter.location'),
                category: t('filter.category'),
                any: t('filter.any'),
              }}
            />
          </div>
        </div>
      </section>

      {featured.data.length > 0 && (
        <section className="container-page py-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold md:text-2xl" lang={locale}>
              {t('home.featured')}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/buy">
                {t('home.viewAll')}
                <IconArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-5">
            <ListingGrid listings={featured.data} locale={locale} t={t} />
          </div>
        </section>
      )}

      {yangon && (
        <section className="container-page py-6">
          <h2 className="text-xl font-semibold md:text-2xl" lang={locale}>
            {t('home.browseByTownship')}
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {yangon.townships.slice(0, 12).map((township) => (
              <li key={township.id}>
                <Link
                  href={`/buy?townshipSlug=${township.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  <IconBuildingCommunity className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate" lang={locale}>
                    {locale === 'my' ? township.nameMy : township.nameEn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container-page py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold md:text-2xl" lang={locale}>
            {t('home.recent')}
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/buy">
              {t('home.viewAll')}
              <IconArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-5">
          <ListingGrid listings={recent.data} locale={locale} t={t} priorityCount={0} />
        </div>
      </section>
    </>
  );
}
