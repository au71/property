import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchResults } from '@/components/search/search-results';
import { SortSelect } from '@/components/search/sort-select';
import { getCategories, getLocationTree, searchListings } from '@/lib/api/queries';
import { getTranslations } from '@/lib/i18n';
import { pathDealType } from '@/lib/format';
import { parseSearchParams, toApiQuery } from '@/lib/search-params';

/**
 * SEO landing pages: /buy/yangon/condo, /rent/mandalay/apartment.
 *
 * These are the queries people actually type into a search engine, so each gets
 * a real URL with its own title, description and canonical rather than being
 * hidden behind query parameters.
 */

interface Resolved {
  deal: 'SALE' | 'RENT';
  citySlug: string;
  cityName: string;
  categorySlug: string;
  categoryName: string;
}

async function resolve(
  dealType: string,
  city: string,
  category: string,
): Promise<Resolved | null> {
  const deal = pathDealType(dealType);
  if (!deal) return null;

  const [{ data: regions }, { data: categories }] = await Promise.all([
    getLocationTree(),
    getCategories(),
  ]);

  const cityRow = regions.flatMap((r) => r.cities).find((c) => c.slug === city);
  const categoryRow = categories.find((c) => c.slug === category);
  if (!cityRow || !categoryRow) return null;

  return {
    deal,
    citySlug: cityRow.slug,
    cityName: cityRow.nameEn,
    categorySlug: categoryRow.slug,
    categoryName: categoryRow.nameEn,
  };
}

export async function generateMetadata(
  props: PageProps<'/[dealType]/[city]/[category]'>,
): Promise<Metadata> {
  const { dealType, city, category } = await props.params;
  const resolved = await resolve(dealType, city, category);
  if (!resolved) return {};

  const verb = resolved.deal === 'SALE' ? 'for sale' : 'for rent';
  const title = `${resolved.categoryName} ${verb} in ${resolved.cityName}`;
  return {
    title,
    description: `Browse ${resolved.categoryName.toLowerCase()} ${verb} in ${resolved.cityName}, Myanmar. Prices, photos and contact details.`,
    alternates: { canonical: `/${dealType}/${city}/${category}` },
    openGraph: { title, type: 'website' },
  };
}

export default async function LandingPage(props: PageProps<'/[dealType]/[city]/[category]'>) {
  const [{ dealType, city, category }, rawSearchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const resolved = await resolve(dealType, city, category);
  // An unknown city or category is a 404, not an empty page — otherwise every
  // typo becomes an indexable thin page.
  if (!resolved) notFound();

  const { locale, t } = await getTranslations();
  const filters = parseSearchParams(rawSearchParams);

  const query = {
    ...toApiQuery(filters),
    dealType: resolved.deal,
    citySlug: resolved.citySlug,
    categorySlug: [resolved.categorySlug],
  };
  const results = await searchListings({ ...query, withFacets: 'true', limit: 24 });

  const verb = resolved.deal === 'SALE' ? t('listing.forSale') : t('listing.forRent');
  const total = results.page.total ?? results.data.length;

  return (
    <div className="container-page py-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/${dealType}`} className="hover:text-foreground">
              {resolved.deal === 'SALE' ? t('nav.buy') : t('nav.rent')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">
            {resolved.categoryName} · {resolved.cityName}
          </li>
        </ol>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold md:text-3xl">
        {resolved.categoryName} {verb.toLowerCase()} in {resolved.cityName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {total.toLocaleString()} {t('search.results')}
      </p>

      <div className="mt-6 flex justify-end">
        <SortSelect
          label={t('search.sort')}
          options={[
            { value: 'newest', label: t('search.sort.newest') },
            { value: 'priceAsc', label: t('search.sort.priceAsc') },
            { value: 'priceDesc', label: t('search.sort.priceDesc') },
            { value: 'areaDesc', label: t('search.sort.areaDesc') },
          ]}
        />
      </div>

      <div className="mt-4">
        <SearchResults
          // Remounts with clean state whenever the filters change.
          key={JSON.stringify(query)}
          initial={results}
          query={{ ...query, limit: 24 }}
          locale={locale}
          labels={{
            forSale: t('listing.forSale'),
            forRent: t('listing.forRent'),
            featured: t('listing.featured'),
            negotiable: t('listing.negotiable'),
            loadMore: t('search.loadMore'),
            noResults: t('search.noResults'),
            noResultsHint: t('search.noResultsHint'),
            loading: t('common.loading'),
          }}
        />
      </div>
    </div>
  );
}
