import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  IconArrowLeft,
  IconBed,
  IconBath,
  IconBuildingSkyscraper,
  IconCalendar,
  IconCheck,
  IconEye,
  IconMapPin,
  IconRuler2,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Gallery } from '@/components/listing/gallery';
import { ContactCard } from '@/components/listing/contact-card';
import { EnquiryForm } from '@/components/listing/enquiry-form';
import { ViewCounter } from '@/components/listing/view-counter';
import { ListingGrid } from '@/components/listing/listing-grid';
import { getListing, getSimilarListings } from '@/lib/api/queries';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import {
  formatArea,
  formatDate,
  formatExactPrice,
  formatLandDimensions,
  formatPrice,
  type Locale,
} from '@/lib/format';
import type { ListingDetail } from '@/lib/api/types';

async function load(ref: string): Promise<ListingDetail | null> {
  try {
    // The owner and staff can preview an unpublished listing, so the viewer's
    // token is forwarded rather than fetching anonymously.
    return await getListing(ref, await getAccessToken());
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata(props: PageProps<'/listing/[ref]'>): Promise<Metadata> {
  const { ref } = await props.params;
  const listing = await load(ref);
  if (!listing) return { title: 'Listing not found' };

  const price = formatPrice(listing.price ?? {}, 'en');
  const place = listing.township?.nameEn ?? '';
  const image = listing.media?.[0]?.url;

  return {
    title: listing.title,
    description: `${price} · ${place}. ${(listing.description ?? '').slice(0, 140)}`,
    alternates: { canonical: `/listing/${listing.publicRef}` },
    openGraph: {
      title: listing.title,
      description: `${price} · ${place}`,
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    // An unpublished listing is visible to its owner but must never be indexed.
    ...(listing.status === 'PUBLISHED' ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ListingPage(props: PageProps<'/listing/[ref]'>) {
  const { ref } = await props.params;
  const { locale, t } = await getTranslations();

  const listing = await load(ref);
  if (!listing) notFound();

  const { data: similar } = await getSimilarListings(ref).catch(() => ({ data: [] }));

  const price = listing.price ?? {};
  const attributes = (listing.attributes ?? {}) as Record<string, unknown>;
  const exact = formatExactPrice(price, locale);
  const isLive = listing.status === 'PUBLISHED';

  return (
    <article className="container-page py-6">
      <ViewCounter reference={listing.publicRef ?? ref} enabled={isLive} />

      <Link
        href={listing.dealType === 'SALE' ? '/buy' : '/rent'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" aria-hidden />
        {listing.dealType === 'SALE' ? t('nav.buy') : t('nav.rent')}
      </Link>

      {!isLive && (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {t(`status.${listing.status as 'DRAFT'}`)}
          {listing.rejectionReason ? ` — ${listing.rejectionReason}` : ''}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Gallery
            media={listing.media ?? []}
            title={listing.title ?? ''}
            emptyLabel={t('common.loading')}
          />

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={listing.dealType === 'SALE' ? 'default' : 'secondary'}>
                {listing.dealType === 'SALE' ? t('listing.forSale') : t('listing.forRent')}
              </Badge>
              {listing.isFeatured && <Badge variant="success">{t('listing.featured')}</Badge>}
              {price.isNegotiable && <Badge variant="outline">{t('listing.negotiable')}</Badge>}
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-balance md:text-3xl" lang={locale}>
              {listing.title}
            </h1>

            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground" lang={locale}>
              <IconMapPin className="size-4 shrink-0" aria-hidden />
              {listing.address ??
                [
                  locale === 'my' ? listing.township?.nameMy : listing.township?.nameEn,
                  locale === 'my' ? listing.township?.city?.nameMy : listing.township?.city?.nameEn,
                ]
                  .filter(Boolean)
                  .join(', ')}
            </p>
            {listing.addressHidden && (
              <p className="mt-1 text-xs text-muted-foreground">{t('listing.addressHidden')}</p>
            )}

            <div className="mt-4">
              <p className="text-3xl font-bold" lang={locale}>
                {formatPrice(price, locale)}
              </p>
              {exact && <p className="mt-0.5 text-sm text-muted-foreground">{exact}</p>}
              {price.depositAmount && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Deposit: {formatPrice({ amount: price.depositAmount, currency: price.currency }, locale)}
                  {price.advanceMonths ? ` · ${price.advanceMonths} months advance` : ''}
                </p>
              )}
            </div>
          </header>

          <KeyFacts attributes={attributes} locale={locale} t={t} />

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t('listing.overview')}</h2>
            <p className="mt-2 whitespace-pre-line text-muted-foreground" lang={locale}>
              {listing.description}
            </p>
          </section>

          <AttributeTable attributes={attributes} locale={locale} title={t('listing.details')} />

          {(listing.amenities?.length ?? 0) > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">{t('listing.amenities')}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {listing.amenities?.map((amenity) => (
                  <li key={amenity.id} className="flex items-center gap-2 text-sm" lang={locale}>
                    <IconCheck className="size-4 shrink-0 text-success" aria-hidden />
                    {locale === 'my' ? amenity.nameMy : amenity.nameEn}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Separator className="my-8" />

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('listing.reference')}</dt>
              <dd className="font-medium">{listing.publicRef}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('listing.posted')}</dt>
              <dd className="flex items-center gap-1 font-medium">
                <IconCalendar className="size-4" aria-hidden />
                {formatDate(listing.publishedAt, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('listing.views')}</dt>
              <dd className="flex items-center gap-1 font-medium">
                <IconEye className="size-4" aria-hidden />
                {(listing.viewCount ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ContactCard
            listingRef={listing.publicRef ?? ref}
            contact={listing.contact ?? { name: '' }}
            owner={listing.owner ?? null}
            labels={{
              contact: t('listing.contact'),
              showPhone: t('listing.showPhone'),
              enquire: t('listing.enquire'),
              error: t('common.error'),
            }}
          />
          {listing.propertyOwner && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="pt-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Property owner · private
                </p>
                <p className="mt-1 font-semibold">{listing.propertyOwner.name}</p>
                {listing.propertyOwner.phone && (
                  <p className="text-sm text-muted-foreground">{listing.propertyOwner.phone}</p>
                )}
                {listing.propertyOwner.note && (
                  <p className="mt-2 text-sm">{listing.propertyOwner.note}</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Only you and portal staff can see this. It is never shown to buyers.
                </p>
              </CardContent>
            </Card>
          )}

          {isLive && (
            <Card>
              <CardContent className="pt-5">
                <h2 className="text-base font-semibold" lang={locale}>
                  {t('enquiry.title')}
                </h2>
                <EnquiryForm
                  listingRef={listing.publicRef ?? ref}
                  labels={{
                    name: t('enquiry.name'),
                    phone: t('enquiry.phone'),
                    email: t('enquiry.email'),
                    message: t('enquiry.message'),
                    send: t('enquiry.send'),
                    sent: t('enquiry.sent'),
                    sentHint: t('enquiry.sentHint'),
                    error: t('common.error'),
                  }}
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold">{t('listing.similar')}</h2>
          <div className="mt-5">
            <ListingGrid listings={similar} locale={locale} t={t} priorityCount={0} />
          </div>
        </section>
      )}

      <ListingJsonLd listing={listing} />
    </article>
  );
}

function KeyFacts({
  attributes,
  locale,
  t,
}: {
  attributes: Record<string, unknown>;
  locale: Locale;
  t: (key: 'listing.bedrooms' | 'listing.bathrooms') => string;
}) {
  const facts: Array<{ icon: React.ReactNode; value: string }> = [];

  if (typeof attributes['bedrooms'] === 'number') {
    facts.push({
      icon: <IconBed className="size-5" aria-hidden />,
      value: `${attributes['bedrooms']} ${t('listing.bedrooms')}`,
    });
  }
  if (typeof attributes['bathrooms'] === 'number') {
    facts.push({
      icon: <IconBath className="size-5" aria-hidden />,
      value: `${attributes['bathrooms']} ${t('listing.bathrooms')}`,
    });
  }
  const area = attributes['floorAreaSqft'] ?? attributes['landAreaSqft'];
  if (typeof area === 'number') {
    facts.push({
      icon: <IconRuler2 className="size-5" aria-hidden />,
      value: formatArea(area, locale) ?? '',
    });
  }
  const dims = formatLandDimensions(
    attributes['landWidthFt'] as number | undefined,
    attributes['landLengthFt'] as number | undefined,
  );
  if (dims) {
    facts.push({ icon: <IconRuler2 className="size-5" aria-hidden />, value: dims });
  }
  if (typeof attributes['totalFloors'] === 'number') {
    facts.push({
      icon: <IconBuildingSkyscraper className="size-5" aria-hidden />,
      value: `${attributes['floorNumber'] ?? '?'} / ${attributes['totalFloors']}`,
    });
  }

  if (facts.length === 0) return null;

  return (
    <ul className="mt-5 flex flex-wrap gap-3">
      {facts.map((fact, i) => (
        <li
          key={i}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">{fact.icon}</span>
          {fact.value}
        </li>
      ))}
    </ul>
  );
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  floorNumber: 'Floor',
  totalFloors: 'Total floors',
  floorAreaSqft: 'Floor area',
  furnishing: 'Furnishing',
  hasLift: 'Lift',
  hasParking: 'Parking',
  buildYear: 'Year built',
  facing: 'Facing',
  landWidthFt: 'Land width',
  landLengthFt: 'Land length',
  landAreaSqft: 'Land area',
  landAreaAcre: 'Land area (acres)',
  roadWidthFt: 'Road width',
  isCornerPlot: 'Corner plot',
  landGrade: 'Land grade',
  powerPhase: 'Power',
  ceilingHeightFt: 'Ceiling height',
};

function AttributeTable({
  attributes,
  locale,
  title,
}: {
  attributes: Record<string, unknown>;
  locale: Locale;
  title: string;
}) {
  const rows = Object.entries(attributes).filter(([key]) => key in ATTRIBUTE_LABELS);
  if (rows.length === 0) return null;

  const render = (key: string, value: unknown): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key.endsWith('Sqft')) return formatArea(value as number, locale) ?? String(value);
    if (key.endsWith('Ft')) return `${String(value)} ft`;
    if (key === 'landGrade') return String(value).replace(/_/g, ' ');
    if (key === 'furnishing' || key === 'powerPhase') {
      const s = String(value).toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return String(value);
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between gap-4 border-b border-border py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{ATTRIBUTE_LABELS[key]}</dt>
            <dd className="text-right font-medium">{render(key, value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Structured data so search engines can render this as a rich property result.
 * Only emitted for a live listing — marking up a draft would be misleading.
 */
function ListingJsonLd({ listing }: { listing: ListingDetail }) {
  if (listing.status !== 'PUBLISHED') return null;

  const amount = listing.price?.amount;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    description: listing.description,
    url: `/listing/${listing.publicRef}`,
    datePosted: listing.publishedAt,
    image: listing.media?.map((m) => m.url) ?? [],
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.township?.nameEn,
      addressRegion: listing.township?.city?.nameEn,
      addressCountry: 'MM',
    },
    ...(amount
      ? {
          offers: {
            '@type': 'Offer',
            price: amount,
            priceCurrency: listing.price?.currency ?? 'MMK',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
