/**
 * Search state lives entirely in the query string, so a filtered result page is
 * a real URL: shareable, linkable, bookmarkable, and indexable. Nothing about
 * the current search is held in client state.
 */

export interface Filters {
  q?: string;
  categorySlug: string[];
  townshipSlug: string[];
  citySlug?: string;
  amenityId: string[];
  minPrice?: string;
  maxPrice?: string;
  bedroomsMin?: string;
  minAreaSqft?: string;
  maxAreaSqft?: string;
  sort: string;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const list = (value: string | string[] | undefined): string[] => {
  if (value === undefined) return [];
  const parts = Array.isArray(value) ? value : value.split(',');
  return parts.map((v) => v.trim()).filter(Boolean);
};

const SORTS = new Set(['newest', 'priceAsc', 'priceDesc', 'areaDesc']);
const digits = (value: string | undefined): string | undefined =>
  value && /^\d+$/.test(value) ? value : undefined;

export function parseSearchParams(raw: RawParams): Filters {
  const sort = first(raw['sort']);
  return {
    q: first(raw['q'])?.slice(0, 120),
    categorySlug: list(raw['categorySlug']),
    townshipSlug: list(raw['townshipSlug']),
    citySlug: first(raw['citySlug']),
    amenityId: list(raw['amenityId']),
    // Anything non-numeric is dropped rather than passed on for the API to
    // reject: a stale or hand-edited URL should still render results.
    minPrice: digits(first(raw['minPrice'])),
    maxPrice: digits(first(raw['maxPrice'])),
    bedroomsMin: digits(first(raw['bedroomsMin'])),
    minAreaSqft: digits(first(raw['minAreaSqft'])),
    maxAreaSqft: digits(first(raw['maxAreaSqft'])),
    sort: sort && SORTS.has(sort) ? sort : 'newest',
  };
}

export function toApiQuery(filters: Filters): Record<string, string | string[] | undefined> {
  const query: Record<string, string | string[] | undefined> = { sort: filters.sort };
  if (filters.q) query['q'] = filters.q;
  if (filters.categorySlug.length) query['categorySlug'] = filters.categorySlug;
  if (filters.townshipSlug.length) query['townshipSlug'] = filters.townshipSlug;
  if (filters.citySlug) query['citySlug'] = filters.citySlug;
  if (filters.amenityId.length) query['amenityId'] = filters.amenityId;
  if (filters.minPrice) query['minPrice'] = filters.minPrice;
  if (filters.maxPrice) query['maxPrice'] = filters.maxPrice;
  if (filters.bedroomsMin) query['bedroomsMin'] = filters.bedroomsMin;
  if (filters.minAreaSqft) query['minAreaSqft'] = filters.minAreaSqft;
  if (filters.maxAreaSqft) query['maxAreaSqft'] = filters.maxAreaSqft;
  return query;
}

/** Number of filters the user has actually applied, for the "Filters (3)" badge. */
export function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.q) count += 1;
  count += filters.categorySlug.length;
  count += filters.townshipSlug.length;
  count += filters.amenityId.length;
  if (filters.minPrice || filters.maxPrice) count += 1;
  if (filters.bedroomsMin) count += 1;
  if (filters.minAreaSqft || filters.maxAreaSqft) count += 1;
  return count;
}
