import { ListingCard } from './listing-card';
import type { ListingSummary } from '@/lib/api/types';
import type { Locale } from '@/lib/format';
import type { Translate } from '@/lib/i18n';

export function ListingGrid({
  listings,
  locale,
  t,
  priorityCount = 3,
}: {
  listings: ListingSummary[];
  locale: Locale;
  t: Translate;
  priorityCount?: number;
}) {
  const labels = {
    forSale: t('listing.forSale'),
    forRent: t('listing.forRent'),
    featured: t('listing.featured'),
    negotiable: t('listing.negotiable'),
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing, index) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          locale={locale}
          labels={labels}
          // Only the images likely to be above the fold get priority; marking
          // every image priority is the same as marking none.
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
