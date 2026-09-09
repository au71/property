import { prisma } from '../../db/prisma.js';
import { decodeCursor, encodeCursor } from '../../lib/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SearchQuery } from './schema.js';

/**
 * Turns a user's words into an FTS5 MATCH expression. FTS5's query syntax is
 * powerful and hostile: an unbalanced quote or a bare `AND` is a syntax error,
 * and `-` starts a NOT clause. So rather than escaping, we discard everything
 * that is not a word character and rebuild the query ourselves.
 */
export function toFtsQuery(raw: string): string | null {
  const terms = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (terms.length === 0) return null;
  // Prefix-match each term so "condo" finds "condominium".
  return terms.map((t) => `"${t}"*`).join(' AND ');
}

const FTS_CANDIDATE_LIMIT = 1000;

async function ftsCandidateIds(raw: string): Promise<string[]> {
  const match = toFtsQuery(raw);
  if (!match) return [];
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT l."id" AS id
     FROM listing_fts f
     JOIN "Listing" l ON l."rowid" = f."rowid"
     WHERE listing_fts MATCH ?
     ORDER BY rank
     LIMIT ${FTS_CANDIDATE_LIMIT}`,
    match,
  );
  return rows.map((r) => r.id);
}

export interface BuiltWhere {
  where: Prisma.ListingWhereInput;
  /** Order of FTS relevance, for sort=relevance. */
  relevanceOrder: string[] | null;
}

export async function buildWhere(query: SearchQuery): Promise<BuiltWhere> {
  const and: Prisma.ListingWhereInput[] = [{ status: 'PUBLISHED', deletedAt: null }];
  let relevanceOrder: string[] | null = null;

  if (query.q) {
    const ids = await ftsCandidateIds(query.q);
    // An empty candidate set must yield no results, not every result.
    and.push({ id: { in: ids } });
    relevanceOrder = ids;
  }

  if (query.dealType) and.push({ dealType: query.dealType });
  if (query.categoryId?.length) and.push({ categoryId: { in: query.categoryId } });
  if (query.categorySlug?.length) {
    // A parent slug should match its children too.
    and.push({
      OR: [
        { category: { slug: { in: query.categorySlug } } },
        { category: { parent: { slug: { in: query.categorySlug } } } },
      ],
    });
  }
  if (query.townshipId?.length) and.push({ townshipId: { in: query.townshipId } });
  if (query.townshipSlug?.length) and.push({ township: { slug: { in: query.townshipSlug } } });
  if (query.cityId) and.push({ township: { cityId: query.cityId } });
  if (query.citySlug) and.push({ township: { city: { slug: query.citySlug } } });
  if (query.regionId) and.push({ township: { city: { regionId: query.regionId } } });

  if (query.amenityId?.length) {
    // Every requested amenity must be present, not just one of them.
    for (const amenityId of query.amenityId) {
      and.push({ amenities: { some: { amenityId } } });
    }
  }

  if (query.minPrice) and.push({ priceAmount: { gte: BigInt(query.minPrice) } });
  if (query.maxPrice) and.push({ priceAmount: { lte: BigInt(query.maxPrice) } });
  if (query.bedroomsMin != null) and.push({ bedrooms: { gte: query.bedroomsMin } });
  if (query.bathroomsMin != null) and.push({ bathrooms: { gte: query.bathroomsMin } });
  if (query.furnishing) and.push({ furnishing: query.furnishing });
  if (query.isFeatured === 'true') and.push({ isFeatured: true });

  // Area filters span two different columns depending on the property type.
  if (query.minAreaSqft != null || query.maxAreaSqft != null) {
    const range: Prisma.IntFilter = {};
    if (query.minAreaSqft != null) range.gte = query.minAreaSqft;
    if (query.maxAreaSqft != null) range.lte = query.maxAreaSqft;
    and.push({ OR: [{ floorAreaSqft: range }, { landAreaSqft: range }] });
  }

  if (query.postedWithinDays != null) {
    const since = new Date(Date.now() - query.postedWithinDays * 24 * 60 * 60 * 1000);
    and.push({ publishedAt: { gte: since } });
  }

  return { where: { AND: and }, relevanceOrder };
}

type OrderBy = Prisma.ListingOrderByWithRelationInput[];

export function buildOrderBy(sort: SearchQuery['sort']): OrderBy {
  switch (sort) {
    case 'priceAsc':
      return [{ priceAmount: 'asc' }, { id: 'asc' }];
    case 'priceDesc':
      return [{ priceAmount: 'desc' }, { id: 'desc' }];
    case 'areaDesc':
      return [{ floorAreaSqft: 'desc' }, { id: 'desc' }];
    case 'relevance':
      return [{ id: 'asc' }];
    case 'newest':
    default:
      // Featured listings surface first, then most recently published.
      return [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }];
  }
}

/**
 * Keyset pagination. Offset pagination on a feed where rows are inserted
 * constantly shows duplicates and skips rows; a cursor on (sortValue, id) does
 * not. The extra `id` tiebreak is what makes the key unique.
 */
export function cursorFilter(sort: SearchQuery['sort'], cursor: string): Prisma.ListingWhereInput {
  const { sortValue, id } = decodeCursor(cursor);

  switch (sort) {
    case 'priceAsc':
      return {
        OR: [
          { priceAmount: { gt: BigInt(sortValue) } },
          { priceAmount: BigInt(sortValue), id: { gt: id } },
        ],
      };
    case 'priceDesc':
      return {
        OR: [
          { priceAmount: { lt: BigInt(sortValue) } },
          { priceAmount: BigInt(sortValue), id: { lt: id } },
        ],
      };
    case 'areaDesc': {
      const area = Number(sortValue);
      return {
        OR: [{ floorAreaSqft: { lt: area } }, { floorAreaSqft: area, id: { lt: id } }],
      };
    }
    case 'relevance':
      return { id: { gt: id } };
    case 'newest':
    default: {
      // Cursor encodes "<isFeatured>:<publishedAt>" so the featured-first order
      // stays stable across pages.
      const [featuredFlag, publishedRaw] = sortValue.split('~');
      const isFeatured = featuredFlag === '1';
      const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date(0);
      return {
        OR: [
          // Once past the featured block, only non-featured rows remain.
          ...(isFeatured ? [{ isFeatured: false }] : []),
          { isFeatured, publishedAt: { lt: publishedAt } },
          { isFeatured, publishedAt, id: { lt: id } },
        ],
      };
    }
  }
}

export function cursorFor(
  sort: SearchQuery['sort'],
  row: {
    id: string;
    priceAmount: bigint;
    publishedAt: Date | null;
    isFeatured: boolean;
    floorAreaSqft: number | null;
  },
): string {
  switch (sort) {
    case 'priceAsc':
    case 'priceDesc':
      return encodeCursor(row.priceAmount.toString(), row.id);
    case 'areaDesc':
      return encodeCursor(String(row.floorAreaSqft ?? 0), row.id);
    case 'relevance':
      return encodeCursor(row.id, row.id);
    case 'newest':
    default:
      return encodeCursor(
        `${row.isFeatured ? '1' : '0'}~${(row.publishedAt ?? new Date(0)).toISOString()}`,
        row.id,
      );
  }
}
