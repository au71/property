import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { IconPhoto } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { ModerationActions } from '@/components/admin/moderation-actions';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { formatPrice, formatRelativeDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Review queue', robots: { index: false } };

interface QueueListing {
  id: string;
  publicRef: string;
  title: string;
  description: string;
  dealType: string;
  status: string;
  priceAmount: string;
  currency: 'MMK' | 'USD';
  rentPeriod: string | null;
  updatedAt: string;
  category: { nameEn: string } | null;
  township: { nameEn: string; city: { nameEn: string } } | null;
  owner: { id: string; name: string; email: string | null; phone: string | null } | null;
  createdBy: { id: string; name: string } | null;
  media: Array<{ thumbUrl: string; url: string }>;
  events: Array<{ id: string; toStatus: string; note: string | null; createdAt: string }>;
}

export default async function QueuePage() {
  const { locale, t } = await getTranslations();
  const { data } = await apiFetch<{ data: QueueListing[] }>('/admin/listings', {
    token: await getAccessToken(),
    query: { status: 'PENDING_REVIEW', limit: 50 },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('admin.queue')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every listing is reviewed before it goes live. Oldest first.
      </p>

      {data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('admin.queueEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {data.map((listing) => (
            <li key={listing.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={listing.dealType === 'SALE' ? 'default' : 'secondary'}>
                      {listing.dealType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{listing.publicRef}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(listing.updatedAt, locale)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-medium">
                    <Link href={`/listing/${listing.publicRef}`} className="hover:underline">
                      {listing.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(
                      {
                        amount: listing.priceAmount,
                        currency: listing.currency,
                        rentPeriod: listing.rentPeriod,
                      },
                      locale,
                    )}
                    {' · '}
                    {listing.category?.nameEn}
                    {' · '}
                    {listing.township?.nameEn}, {listing.township?.city.nameEn}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Owner: {listing.owner?.name}
                    {listing.createdBy && listing.createdBy.id !== listing.owner?.id
                      ? ` · listed by ${listing.createdBy.name}`
                      : ''}
                  </p>
                </div>

                <ModerationActions listingId={listing.id} />
              </div>

              <p className="mt-3 line-clamp-3 text-sm">{listing.description}</p>

              <ul className="mt-3 flex gap-2 overflow-x-auto">
                {listing.media.length === 0 ? (
                  <li className="flex size-20 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <IconPhoto className="size-5" aria-hidden />
                  </li>
                ) : (
                  listing.media.map((m, i) => (
                    <li key={i} className="relative size-20 shrink-0 overflow-hidden rounded-md">
                      <Image src={m.thumbUrl} alt="" fill sizes="80px" className="object-cover" />
                    </li>
                  ))
                )}
              </ul>

              {listing.events.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    History ({listing.events.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {listing.events.map((event) => (
                      <li key={event.id}>
                        {formatRelativeDate(event.createdAt, locale)} — {event.toStatus}
                        {event.note ? `: ${event.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
