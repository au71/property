import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SearchResults } from '@/components/search/search-results';
import { FilterPanel } from '@/components/search/filter-panel';
import { SortSelect } from '@/components/search/sort-select';
import { getAmenities, getCategoryTree, getLocationTree, searchListings } from '@/lib/api/queries';
import { getTranslations } from '@/lib/i18n';
import { pathDealType } from '@/lib/format';
import { parseSearchParams, toApiQuery } from '@/lib/search-params';

export async function generateMetadata(
  props: PageProps<'/[dealType]'>,
): Promise<Metadata> {
  const { dealType } = await props.params;
  const deal = pathDealType(dealType);
  if (!deal) return {};
  const verb = deal === 'SALE' ? 'for sale' : 'for rent';
  return {
    title: `Property ${verb} in Myanmar`,
    description: `Browse property ${verb} in Yangon, Mandalay and across Myanmar.`,
    alternates: { canonical: `/${dealType}` },
  };
}

export default async function SearchPage(props: PageProps<'/[dealType]'>) {
  const [{ dealType }, rawSearchParams] = await Promise.all([props.params, props.searchParams]);

  const deal = pathDealType(dealType);
  // /buy and /rent are the only two valid segments; anything else is a 404
  // rather than an empty result set.
  if (!deal) notFound();

  const { locale, t } = await getTranslations();
  const filters = parseSearchParams(rawSearchParams);

  const query = { ...toApiQuery(filters), dealType: deal, limit: 24 };

  const [{ data: regions }, { data: categories }, { data: amenities }, results] =
    await Promise.all([
      getLocationTree(),
      getCategoryTree(),
      getAmenities(),
      searchListings({ ...query, withFacets: 'true' }),
    ]);

  const total = results.page.total ?? results.data.length;

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-semibold" lang={locale}>
        {deal === 'SALE' ? t('nav.buy') : t('nav.rent')}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground" lang={locale}>
        {total.toLocaleString()} {t('search.results')}
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <FilterPanel
          regions={regions}
          categories={categories}
          amenities={amenities}
          locale={locale}
          dealType={dealType}
          labels={{
            filters: t('search.filters'),
            clear: t('search.clear'),
            apply: t('search.apply'),
            category: t('filter.category'),
            location: t('filter.location'),
            price: t('filter.price'),
            minPrice: t('filter.minPrice'),
            maxPrice: t('filter.maxPrice'),
            bedrooms: t('filter.bedrooms'),
            amenities: t('filter.amenities'),
            any: t('filter.any'),
            search: t('search.search'),
            placeholder: t('search.placeholder'),
          }}
        />

        <section className="min-w-0 flex-1">
          <div className="mb-4 flex justify-end">
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

          <SearchResults
            // Remounts with clean state whenever the filters change.
            key={JSON.stringify(query)}
            initial={results}
            query={query}
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
        </section>
      </div>
    </div>
  );
}
