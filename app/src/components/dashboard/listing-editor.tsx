'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconAlertTriangle, IconExternalLink, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DealTypeAndCategory,
  DetailFields,
  LocationFields,
  PriceAndContactFields,
} from './listing-fields';
import { PhotoManager } from './photo-manager';
import {
  fieldSetFor,
  formFromListing,
  toPayload,
  validate,
  type ListingFormState,
} from '@/lib/listing/form';
import type { CategoryNode, ListingDetail, Named, RegionNode } from '@/lib/api/types';
import type { Locale } from '@/lib/format';

interface Props {
  listing: ListingDetail;
  regions: RegionNode[];
  categories: CategoryNode[];
  amenities: Named[];
  locale: Locale;
  statusLabel: string;
}

/**
 * Editing an existing listing. Unlike creating, this is one page rather than a
 * wizard: you already know which field you came to change, and stepping through
 * five screens to fix a typo would be absurd.
 *
 * Saving a published or rejected listing sends it back to the review queue —
 * that is the API's rule, and it is stated here so it is not a surprise.
 */
export function ListingEditor({
  listing,
  regions,
  categories,
  amenities,
  locale,
  statusLabel,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ListingFormState>(() => formFromListing(listing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOwner, setShowOwner] = useState(Boolean(listing.propertyOwner));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fieldSet = fieldSetFor(categories, form.categoryId);
  const fieldProps = { form, set, errors, locale };

  const wasRejected = listing.status === 'REJECTED';
  const returnsToReview = ['PUBLISHED', 'REJECTED', 'EXPIRED', 'PENDING_REVIEW'].includes(
    listing.status as string,
  );

  async function save(thenSubmit: boolean) {
    const found = validate(form, fieldSet);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Some fields still need attention.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/proxy/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPayload(form, fieldSet, { includeOwnerDetails: showOwner })),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string; details?: Array<{ path?: string; message?: string }> };
        } | null;
        const details = payload?.error?.details;
        if (Array.isArray(details)) {
          const map: Record<string, string> = {};
          for (const issue of details) {
            if (issue.path && issue.message) map[issue.path] ??= issue.message;
          }
          setErrors(map);
        }
        throw new Error(payload?.error?.message ?? 'Could not save the listing');
      }

      if (thenSubmit) {
        const submit = await fetch(`/api/proxy/listings/${listing.id}/submit`, { method: 'POST' });
        if (!submit.ok) {
          const payload = (await submit.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(payload?.error?.message ?? 'Saved, but could not submit for review');
        }
        toast.success('Saved and sent for review.');
      } else {
        toast.success(returnsToReview ? 'Saved and sent back for review.' : 'Saved.');
      }

      router.push('/dashboard/listings');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Edit listing</h2>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="muted">{statusLabel}</Badge>
            {listing.publicRef}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/listing/${listing.publicRef}`}>
            View
            <IconExternalLink />
          </Link>
        </Button>
      </div>

      {wasRejected && listing.rejectionReason && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconAlertTriangle className="size-4 text-destructive" aria-hidden />
            A reviewer asked for changes
          </p>
          <p className="mt-1.5 text-sm">{listing.rejectionReason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Fix it below, then use “Save and resubmit”.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-8">
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Type</h3>
          <DealTypeAndCategory {...fieldProps} categories={categories} />
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Location</h3>
          <LocationFields {...fieldProps} regions={regions} />
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Details</h3>
          <DetailFields {...fieldProps} fieldSet={fieldSet} amenities={amenities} />
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Price and contact</h3>
          <PriceAndContactFields
            {...fieldProps}
            showOwnerDetails={showOwner}
            onToggleOwnerDetails={setShowOwner}
          />
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Photos</h3>
          <PhotoManager
            listingId={listing.id as string}
            initial={(listing.media ?? []).map((m) => ({
              id: m.id as string,
              url: m.url as string,
              thumbUrl: m.thumbUrl as string,
              isCover: Boolean(m.isCover),
            }))}
          />
        </section>
      </div>

      <Separator className="my-6" />

      {returnsToReview && (
        <p className="mb-4 text-sm text-muted-foreground">
          Every change is reviewed before it goes live, so saving will return this listing to the
          review queue.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save(false)} disabled={saving}>
          {saving && <IconLoader2 className="animate-spin" />}
          Save changes
        </Button>
        {(wasRejected || listing.status === 'DRAFT' || listing.status === 'EXPIRED') && (
          <Button variant="success" onClick={() => void save(true)} disabled={saving}>
            Save and resubmit
          </Button>
        )}
        <Button variant="ghost" asChild>
          <Link href="/dashboard/listings">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
