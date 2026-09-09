import Image from 'next/image';
import Link from 'next/link';
import { IconBed, IconBath, IconRuler2, IconPhoto } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { formatArea, formatPrice, formatRelativeDate, type Locale } from '@/lib/format';
import type { ListingSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface Props {
  listing: ListingSummary;
  locale: Locale;
  labels: { forSale: string; forRent: string; featured: string; negotiable: string };
  priority?: boolean;
  className?: string;
}

export function ListingCard({ listing, locale, labels, priority = false, className }: Props) {
  const price = listing.price ?? {};
  const area = listing.floorAreaSqft ?? listing.landAreaSqft;

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-4/3 bg-muted">
        {listing.coverImage?.url ? (
          <Image
            src={listing.coverImage.url}
            alt=""
            fill
            // Two columns on tablet, three on desktop; tells the browser not to
            // download a 1600px file for a 300px slot on a phone.
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <IconPhoto className="size-8" aria-hidden />
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant={listing.dealType === 'SALE' ? 'default' : 'secondary'}>
            {listing.dealType === 'SALE' ? labels.forSale : labels.forRent}
          </Badge>
          {listing.isFeatured && <Badge variant="success">{labels.featured}</Badge>}
        </div>

        {(listing.imageCount ?? 0) > 1 && (
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white">
            <IconPhoto className="size-3" aria-hidden />
            {listing.imageCount}
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-lg font-semibold" lang={locale}>
          {formatPrice(price, locale)}
        </p>
        {price.isNegotiable && (
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.negotiable}</p>
        )}

        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium">
          {/* The whole card is clickable via this stretched link, so there is
              exactly one tab stop per card rather than three. */}
          <Link href={`/listing/${listing.publicRef}`} className="after:absolute after:inset-0">
            {listing.title}
          </Link>
        </h3>

        <p className="mt-1 truncate text-sm text-muted-foreground" lang={locale}>
          {locale === 'my' ? listing.township?.nameMy : listing.township?.nameEn}
          {listing.category ? ' · ' : ''}
          {locale === 'my' ? listing.category?.nameMy : listing.category?.nameEn}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-1">
              <IconBed className="size-4" aria-hidden />
              {listing.bedrooms}
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-1">
              <IconBath className="size-4" aria-hidden />
              {listing.bathrooms}
            </span>
          )}
          {area != null && (
            <span className="flex items-center gap-1">
              <IconRuler2 className="size-4" aria-hidden />
              {formatArea(area, locale)}
            </span>
          )}
          {listing.publishedAt && (
            <span className="ml-auto">{formatRelativeDate(listing.publishedAt, locale)}</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="aspect-4/3 animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
