import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { IconPhoto, IconPlus } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListingActions } from '@/components/dashboard/listing-actions';
import { apiFetch } from '@/lib/api/client';
import { canListProperties, getAccessToken, getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { formatPrice } from '@/lib/format';
import type { ListingStatus, ListingSummary } from '@/lib/api/types';

export const metadata: Metadata = { title: 'My listings', robots: { index: false } };

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'muted' | 'secondary'> = {
  PUBLISHED: 'success',
  PENDING_REVIEW: 'warning',
  REJECTED: 'destructive',
  DRAFT: 'muted',
  EXPIRED: 'muted',
  SOLD: 'secondary',
  RENTED: 'secondary',
  SUSPENDED: 'destructive',
  ARCHIVED: 'muted',
};

export default async function MyListingsPage() {
  const { locale, t } = await getTranslations();
  const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);

  const { data, counts } = await apiFetch<{
    data: ListingSummary[];
    counts: Record<string, number>;
  }>('/me/listings', { token, query: { limit: 100 } });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t('dashboard.listings')}</h2>
        {canListProperties(user) && (
          <Button asChild size="sm">
            <Link href="/dashboard/listings/new">
              <IconPlus />
              {t('dashboard.newListing')}
            </Link>
          </Button>
        )}
      </div>

      {Object.keys(counts).length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <li key={status}>
              <Badge variant={STATUS_VARIANT[status] ?? 'muted'}>
                {t(`status.${status as ListingStatus}`)} · {count}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('dashboard.noListings')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.map((listing) => (
            <li
              key={listing.id}
              className="flex gap-4 rounded-xl border border-border bg-card p-3"
            >
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {listing.coverImage?.thumbUrl ? (
                  <Image
                    src={listing.coverImage.thumbUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <IconPhoto className="size-6" aria-hidden />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[listing.status] ?? 'muted'}>
                    {t(`status.${listing.status as ListingStatus}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{listing.publicRef}</span>
                </div>

                <h3 className="mt-1 truncate font-medium">
                  <Link href={`/listing/${listing.publicRef}`} className="hover:underline">
                    {listing.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(listing.price ?? {}, locale)}
                </p>

                <ListingActions
                  listingId={listing.id}
                  status={listing.status}
                  dealType={listing.dealType}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
