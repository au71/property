import { formatLakh, serializePrice } from '../../domain/money.js';
import { canSeeExactAddress, canSeePropertyOwner, type Actor } from '../../domain/policy.js';

/**
 * Anything leaving the API goes through here. Two jobs: turn BigInt prices into
 * strings that survive JSON, and drop fields the viewer is not allowed to see.
 */

type MediaRow = {
  id: string;
  kind: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
};

export interface ListingRecord {
  id: string;
  publicRef: string;
  ownerId: string;
  createdById: string;
  dealType: string;
  status: string;
  title: string;
  description: string;
  addressLine: string | null;
  hideExactAddress: boolean;
  priceAmount: bigint;
  currency: 'MMK' | 'USD';
  priceIsNegotiable: boolean;
  priceOnRequest: boolean;
  depositAmount: bigint | null;
  [key: string]: unknown;
}

const ATTRIBUTE_FIELDS = [
  'bedrooms',
  'bathrooms',
  'floorNumber',
  'totalFloors',
  'floorAreaSqft',
  'furnishing',
  'hasLift',
  'hasParking',
  'buildYear',
  'facing',
  'landWidthFt',
  'landLengthFt',
  'landAreaSqft',
  'landAreaAcre',
  'roadWidthFt',
  'isCornerPlot',
  'landGrade',
  'powerPhase',
  'ceilingHeightFt',
] as const;

const RENT_FIELDS = ['rentPeriod', 'advanceMonths', 'minLeaseMonths', 'utilitiesIncluded'] as const;

function pick(source: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== null && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function toListingSummary(listing: Record<string, unknown>) {
  const price = listing['priceAmount'] as bigint;
  const currency = listing['currency'] as 'MMK' | 'USD';
  const media = (listing['media'] as MediaRow[] | undefined) ?? [];
  const cover = media.find((m) => m.isCover) ?? media[0] ?? null;

  return {
    id: listing['id'],
    publicRef: listing['publicRef'],
    dealType: listing['dealType'],
    status: listing['status'],
    title: listing['title'],
    price: {
      amount: serializePrice(price),
      currency,
      lakhLabel: formatLakh(price, currency),
      isNegotiable: listing['priceIsNegotiable'],
      onRequest: listing['priceOnRequest'],
      rentPeriod: listing['rentPeriod'] ?? null,
    },
    category: listing['category'] ?? null,
    township: listing['township'] ?? null,
    coverImage: cover ? { url: cover.url, thumbUrl: cover.thumbUrl } : null,
    imageCount: media.length,
    isFeatured: listing['isFeatured'],
    publishedAt: listing['publishedAt'],
    viewCount: listing['viewCount'],
    // The seller's own dashboard needs this to say what a reviewer asked for.
    // It is safe in a shared summary because only PUBLISHED listings reach
    // public search, and approving clears the reason — asserted by a test.
    rejectionReason: listing['rejectionReason'] ?? null,
    ...pick(listing, ['bedrooms', 'bathrooms', 'floorAreaSqft', 'landAreaSqft']),
  };
}

export function toListingDetail(listing: Record<string, unknown>, actor: Actor | null) {
  const price = listing['priceAmount'] as bigint;
  const currency = listing['currency'] as 'MMK' | 'USD';
  const deposit = listing['depositAmount'] as bigint | null;
  const media = (listing['media'] as MediaRow[] | undefined) ?? [];

  const ref = {
    ownerId: listing['ownerId'] as string,
    createdById: listing['createdById'] as string,
    status: listing['status'] as never,
  };

  const addressVisible = canSeeExactAddress(actor, {
    ...ref,
    hideExactAddress: listing['hideExactAddress'] as boolean,
  });

  const ownerVisible = canSeePropertyOwner(actor, ref);

  return {
    id: listing['id'],
    publicRef: listing['publicRef'],
    dealType: listing['dealType'],
    status: listing['status'],
    title: listing['title'],
    description: listing['description'],

    // An owner who hides the address still advertises the township.
    address: addressVisible ? (listing['addressLine'] ?? null) : null,
    addressHidden: !addressVisible,

    price: {
      amount: serializePrice(price),
      currency,
      lakhLabel: formatLakh(price, currency),
      isNegotiable: listing['priceIsNegotiable'],
      onRequest: listing['priceOnRequest'],
      ...pick(listing, RENT_FIELDS),
      depositAmount: serializePrice(deposit),
      depositLakhLabel: deposit ? formatLakh(deposit, currency) : null,
      isInstallmentAvailable: listing['isInstallmentAvailable'],
      installmentNote: listing['installmentNote'] ?? null,
    },

    attributes: pick(listing, ATTRIBUTE_FIELDS),

    category: listing['category'] ?? null,
    township: listing['township'] ?? null,
    amenities:
      (listing['amenities'] as Array<{ amenity: unknown }> | undefined)?.map((a) => a.amenity) ??
      [],

    media: media
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        url: m.url,
        thumbUrl: m.thumbUrl,
        width: m.width,
        height: m.height,
        isCover: m.isCover,
      })),

    contact: {
      name: listing['contactName'],
      // No phone number for a public viewer. A client component receiving it as
      // a prop would have it serialised into the server-rendered payload, so a
      // "reveal" button would be decoration while scrapers read the number
      // straight out of the HTML. Public callers use
      // GET /listings/:id/contact instead: one rate-limited request per reveal.
      hasPhone: Boolean(listing['contactPhone']),
      hasViber: Boolean(listing['contactViber']),
      // Whoever can edit the listing gets the real values, because an edit form
      // has to prefill them — and it is their own number anyway.
      ...(ownerVisible
        ? {
            phone: listing['contactPhone'],
            viber: listing['contactViber'] ?? null,
          }
        : {}),
    },

    owner: listing['owner'] ?? null,

    // Present only for the listing's own account and for staff; absent from
    // every public response, not merely nulled out.
    ...(ownerVisible && listing['propertyOwnerName']
      ? {
          propertyOwner: {
            name: listing['propertyOwnerName'],
            phone: listing['propertyOwnerPhone'] ?? null,
            note: listing['propertyOwnerNote'] ?? null,
          },
        }
      : {}),

    isFeatured: listing['isFeatured'],
    viewCount: listing['viewCount'],
    enquiryCount: listing['enquiryCount'],
    publishedAt: listing['publishedAt'],
    expiresAt: listing['expiresAt'],
    createdAt: listing['createdAt'],
    updatedAt: listing['updatedAt'],
    rejectionReason: listing['rejectionReason'] ?? null,
  };
}
