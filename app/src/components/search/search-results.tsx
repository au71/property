'use client';

import { useState } from 'react';
import { IconSearchOff } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { ListingCard, ListingCardSkeleton } from '@/components/listing/listing-card';
import { apiFetch } from '@/lib/api/client';
import type { ListingSummary, Page } from '@/lib/api/types';
import type { Locale } from '@/lib/format';

interface Props {
  initial: Page<ListingSummary>;
  query: Record<string, string | string[] | number | undefined>;
  locale: Locale;
  labels: {
    forSale: string;
    forRent: string;
    featured: string;
    negotiable: string;
    loadMore: string;
    noResults: string;
    noResultsHint: string;
    loading: string;
  };
}

/**
 * The first page is server-rendered so the results are indexable and paint
 * immediately; subsequent pages are appended on the client via the same cursor
 * the API returned. Nothing is refetched when "load more" is pressed.
 *
 * When the filters change, the parent gives this component a new `key` so React
 * remounts it with fresh state. That is the idiomatic reset — syncing props into
 * state inside an effect renders the stale list first and then immediately
 * re-renders, which is both slower and briefly wrong.
 */
export function SearchResults({ initial, query, locale, labels }: Props) {
  const [items, setItems] = useState(initial.data);
  const [cursor, setCursor] = useState(initial.page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await apiFetch<Page<ListingSummary>>('/listings', {
        query: { ...query, cursor } as Record<string, string | number | string[] | undefined>,
      });
      setItems((current) => [...current, ...next.data]);
      setCursor(next.page.nextCursor);
    } catch {
      setError(labels.noResults);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <IconSearchOff className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">{labels.noResults}</p>
        <p className="mt-1 text-sm text-muted-foreground">{labels.noResultsHint}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((listing, index) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            locale={locale}
            labels={labels}
            priority={index < 3}
          />
        ))}
        {loading && (
          <>
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </>
        )}
      </div>

      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

      {cursor && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading ? labels.loading : labels.loadMore}
          </Button>
        </div>
      )}
    </>
  );
}
