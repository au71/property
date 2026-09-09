import { prisma } from '../../db/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { deriveLandAreaSqft } from '../../domain/area.js';
import {
  QUOTA_COUNTED_STATUSES,
  canCreateListings,
  canEditListing,
  canSubmitForReview,
  canTransition,
  canViewListing,
  isStaff,
  listingQuotaFor,
  nextStatusAfterEdit,
  type Actor,
} from '../../domain/policy.js';
import { toListingDetail, toListingSummary } from './dto.js';
import { buildOrderBy, buildWhere, cursorFilter, cursorFor } from './search.js';
import type { CreateListingInput, SearchQuery, UpdateListingInput } from './schema.js';
import type { ListingStatus, Prisma } from '../../generated/prisma/client.js';

const LISTING_DAYS_VALID = 60;

const summaryInclude = {
  category: { select: { id: true, slug: true, nameEn: true, nameMy: true, fieldSet: true } },
  township: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameMy: true,
      city: { select: { id: true, slug: true, nameEn: true, nameMy: true } },
    },
  },
  media: {
    select: {
      id: true,
      kind: true,
      url: true,
      thumbUrl: true,
      width: true,
      height: true,
      sortOrder: true,
      isCover: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.ListingInclude;

const detailInclude = {
  ...summaryInclude,
  amenities: {
    select: { amenity: { select: { id: true, slug: true, nameEn: true, nameMy: true } } },
  },
  owner: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      agentProfile: { select: { agencyName: true, isVerifiedAgent: true } },
    },
  },
} satisfies Prisma.ListingInclude;

export async function search(query: SearchQuery) {
  const { where, relevanceOrder } = await buildWhere(query);
  const finalWhere: Prisma.ListingWhereInput = query.cursor
    ? { AND: [where, cursorFilter(query.sort, query.cursor)] }
    : where;

  const rows = await prisma.listing.findMany({
    where: finalWhere,
    include: summaryInclude,
    orderBy: buildOrderBy(query.sort),
    // Fetch one extra to learn whether another page exists, without a count.
    take: query.limit + 1,
  });

  let page = rows.slice(0, query.limit);

  // FTS returns rows in relevance order; Prisma cannot express that ordering,
  // so it is reapplied here over the (bounded) candidate set.
  if (query.sort === 'relevance' && relevanceOrder) {
    const rank = new Map(relevanceOrder.map((id, i) => [id, i]));
    page = page.slice().sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }

  const last = page[page.length - 1];
  const result: {
    data: ReturnType<typeof toListingSummary>[];
    page: { limit: number; nextCursor: string | null; total?: number };
    facets?: Awaited<ReturnType<typeof facetsFor>>;
  } = {
    data: page.map(toListingSummary),
    page: {
      limit: query.limit,
      nextCursor: rows.length > query.limit && last ? cursorFor(query.sort, last) : null,
    },
  };

  if (query.withFacets === 'true') {
    const [total, facets] = await Promise.all([prisma.listing.count({ where }), facetsFor(where)]);
    result.page.total = total;
    result.facets = facets;
  }

  return result;
}

/** Counts for the filter sidebar, scoped to everything except the facet itself. */
async function facetsFor(where: Prisma.ListingWhereInput) {
  const [byCategory, byTownship, byDealType] = await Promise.all([
    prisma.listing.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
    prisma.listing.groupBy({ by: ['townshipId'], where, _count: { _all: true } }),
    prisma.listing.groupBy({ by: ['dealType'], where, _count: { _all: true } }),
  ]);
  return {
    categories: byCategory.map((r) => ({ id: r.categoryId, count: r._count._all })),
    townships: byTownship.map((r) => ({ id: r.townshipId, count: r._count._all })),
    dealTypes: byDealType.map((r) => ({ dealType: r.dealType, count: r._count._all })),
  };
}

export async function getByIdOrRef(idOrRef: string, actor: Actor | null) {
  const listing = await prisma.listing.findFirst({
    where: { OR: [{ id: idOrRef }, { publicRef: idOrRef }], deletedAt: null },
    include: detailInclude,
  });
  if (!listing) throw notFound('Listing');
  if (!canViewListing(actor, listing)) throw notFound('Listing');
  return toListingDetail(listing, actor);
}

export async function similarTo(idOrRef: string, limit = 6) {
  const listing = await prisma.listing.findFirst({
    where: { OR: [{ id: idOrRef }, { publicRef: idOrRef }], deletedAt: null },
    select: { id: true, categoryId: true, townshipId: true, dealType: true, priceAmount: true },
  });
  if (!listing) throw notFound('Listing');

  // Same deal type and category, nearby price, preferring the same township.
  const low = (listing.priceAmount * 60n) / 100n;
  const high = (listing.priceAmount * 160n) / 100n;

  const rows = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: listing.id },
      dealType: listing.dealType,
      categoryId: listing.categoryId,
      priceAmount: { gte: low, lte: high },
    },
    include: summaryInclude,
    orderBy: [{ townshipId: listing.townshipId ? 'asc' : 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });

  return rows.map(toListingSummary);
}

async function nextPublicRef(townshipId: string): Promise<string> {
  const township = await prisma.township.findUnique({
    where: { id: townshipId },
    select: { city: { select: { slug: true } } },
  });
  if (!township) throw badRequest('Unknown township');
  const cityCode =
    township.city.slug === 'mandalay' ? 'MDY' : township.city.slug === 'yangon' ? 'YGN' : 'MMR';
  const year = new Date().getUTCFullYear();
  const prefix = `${cityCode}-${year}-`;

  const latest = await prisma.listing.findFirst({
    where: { publicRef: { startsWith: prefix } },
    orderBy: { publicRef: 'desc' },
    select: { publicRef: true },
  });
  const nextNumber = latest ? Number(latest.publicRef.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
}

/** Fields that only make sense for one fieldSet get cleared for the others. */
function normalizeAttributes(input: Partial<CreateListingInput>) {
  const out: Record<string, unknown> = { ...input };
  if (input.landWidthFt && input.landLengthFt && input.landAreaSqft == null) {
    out['landAreaSqft'] = deriveLandAreaSqft(input.landWidthFt, input.landLengthFt);
  }
  if (input.dealType === 'SALE') {
    out['rentPeriod'] = null;
    out['depositAmount'] = null;
    out['advanceMonths'] = null;
    out['minLeaseMonths'] = null;
    out['utilitiesIncluded'] = null;
  }
  // Relation ids are set explicitly by the caller; leaving them in the spread
  // makes Prisma reject the payload for mixing scalar FKs with `connect`.
  delete out['amenityIds'];
  delete out['ownerId'];
  delete out['categoryId'];
  delete out['townshipId'];
  return out;
}

async function assertQuota(actor: Actor): Promise<void> {
  const quota = listingQuotaFor(actor);
  if (quota === Number.POSITIVE_INFINITY) return;
  const active = await prisma.listing.count({
    where: { ownerId: actor.id, status: { in: QUOTA_COUNTED_STATUSES }, deletedAt: null },
  });
  if (active >= quota) {
    throw conflict(
      `You have reached your limit of ${quota} active listings. Archive one before adding another.`,
    );
  }
}

export async function create(actor: Actor, input: CreateListingInput) {
  if (!canCreateListings(actor)) {
    throw forbidden('Your account cannot create listings. Register as an owner or agent.');
  }

  // Only agents and staff may attribute a listing to another account.
  let ownerId = actor.id;
  if (input.ownerId && input.ownerId !== actor.id) {
    if (!isStaff(actor) && !actor.roles.includes('AGENT')) {
      throw forbidden('Only agents can list on behalf of an owner');
    }
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true },
    });
    if (!owner) throw badRequest('That owner account does not exist');
    ownerId = owner.id;
  }

  await assertQuota(actor);

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, isActive: true, parentId: true },
  });
  if (!category?.isActive) throw badRequest('Unknown or inactive category');
  if (category.parentId === null) throw badRequest('Choose a specific category, not a group');

  const township = await prisma.township.findUnique({
    where: { id: input.townshipId },
    select: { id: true, isActive: true },
  });
  if (!township?.isActive) throw badRequest('Unknown or inactive township');

  const listing = await prisma.listing.create({
    data: {
      ...(normalizeAttributes(input) as Prisma.ListingUncheckedCreateInput),
      publicRef: await nextPublicRef(input.townshipId),
      titleNormalized: input.title.toLowerCase(),
      status: 'DRAFT',
      ownerId,
      createdById: actor.id,
      categoryId: input.categoryId,
      townshipId: input.townshipId,
      ...(input.amenityIds.length > 0
        ? { amenities: { create: input.amenityIds.map((amenityId) => ({ amenityId })) } }
        : {}),
      events: { create: { actorId: actor.id, toStatus: 'DRAFT', note: 'Listing created' } },
    },
    include: detailInclude,
  });

  return toListingDetail(listing, actor);
}

async function loadForWrite(id: string) {
  const listing = await prisma.listing.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      createdById: true,
      status: true,
      dealType: true,
      publicRef: true,
    },
  });
  if (!listing) throw notFound('Listing');
  return listing;
}

export async function update(actor: Actor, id: string, input: UpdateListingInput) {
  const existing = await loadForWrite(id);
  if (!canEditListing(actor, existing)) {
    throw forbidden('You cannot edit this listing in its current state');
  }

  const data: Prisma.ListingUncheckedUpdateInput = {
    ...(normalizeAttributes(input) as Prisma.ListingUncheckedUpdateInput),
    // Relation ids are allowed to move, but only via the validated values.
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.townshipId ? { townshipId: input.townshipId } : {}),
  };
  if (input.title) data.titleNormalized = input.title.toLowerCase();

  // Editing a live listing sends it back through moderation. Staff edits do not
  // unpublish, since staff are the moderators.
  const nextStatus = isStaff(actor) ? existing.status : nextStatusAfterEdit(existing.status);
  const statusChanged = nextStatus !== existing.status;
  if (statusChanged) {
    data.status = nextStatus;
    data.rejectionReason = null;
  }

  if (input.amenityIds) {
    await prisma.listingAmenity.deleteMany({ where: { listingId: id } });
    if (input.amenityIds.length > 0) {
      await prisma.listingAmenity.createMany({
        data: input.amenityIds.map((amenityId) => ({ listingId: id, amenityId })),
      });
    }
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...data,
      ...(statusChanged
        ? {
            events: {
              create: {
                actorId: actor.id,
                fromStatus: existing.status,
                toStatus: nextStatus,
                note: 'Edited, returned for review',
              },
            },
          }
        : {}),
    },
    include: detailInclude,
  });

  return toListingDetail(listing, actor);
}

export async function submitForReview(actor: Actor, id: string) {
  const existing = await loadForWrite(id);
  if (!canSubmitForReview(actor, existing)) {
    throw forbidden('This listing cannot be submitted for review right now');
  }

  const mediaCount = await prisma.media.count({ where: { listingId: id } });
  if (mediaCount === 0) throw badRequest('Add at least one photo before submitting');

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: 'PENDING_REVIEW',
      rejectionReason: null,
      events: {
        create: {
          actorId: actor.id,
          fromStatus: existing.status,
          toStatus: 'PENDING_REVIEW',
          note: 'Submitted for review',
        },
      },
    },
    include: detailInclude,
  });
  return toListingDetail(listing, actor);
}

export async function changeStatus(actor: Actor, id: string, to: ListingStatus) {
  const existing = await loadForWrite(id);
  if (!canTransition(actor, existing, to)) {
    throw forbidden(`Cannot move this listing from ${existing.status} to ${to}`);
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: to,
      ...(to === 'PUBLISHED'
        ? {
            publishedAt: new Date(),
            expiresAt: new Date(Date.now() + LISTING_DAYS_VALID * 24 * 60 * 60 * 1000),
          }
        : {}),
      events: {
        create: { actorId: actor.id, fromStatus: existing.status, toStatus: to },
      },
    },
    include: detailInclude,
  });
  return toListingDetail(listing, actor);
}

export async function renew(actor: Actor, id: string) {
  const existing = await loadForWrite(id);
  if (!canEditListing(actor, existing)) throw forbidden('You cannot renew this listing');
  if (existing.status !== 'PUBLISHED' && existing.status !== 'EXPIRED') {
    throw badRequest('Only a published or expired listing can be renewed');
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      publishedAt: existing.status === 'EXPIRED' ? new Date() : undefined,
      expiresAt: new Date(Date.now() + LISTING_DAYS_VALID * 24 * 60 * 60 * 1000),
      events: {
        create: {
          actorId: actor.id,
          fromStatus: existing.status,
          toStatus: 'PUBLISHED',
          note: 'Renewed',
        },
      },
    },
    include: detailInclude,
  });
  return toListingDetail(listing, actor);
}

export async function softDelete(actor: Actor, id: string): Promise<void> {
  const existing = await loadForWrite(id);
  if (!canEditListing(actor, existing)) throw forbidden('You cannot delete this listing');
  await prisma.listing.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
}

export async function listMine(actor: Actor, status: ListingStatus | undefined, limit: number) {
  const rows = await prisma.listing.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: actor.id }, { createdById: actor.id }],
      ...(status ? { status } : {}),
    },
    include: summaryInclude,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
  return rows.map(toListingSummary);
}

/**
 * View counting is fire-and-forget and deliberately not deduplicated: it feeds a
 * "popular" signal, not analytics. It must never fail a page render.
 */
export async function recordView(idOrRef: string): Promise<void> {
  await prisma.listing.updateMany({
    where: { OR: [{ id: idOrRef }, { publicRef: idOrRef }], status: 'PUBLISHED' },
    data: { viewCount: { increment: 1 } },
  });
}

/**
 * Contact details for a published listing, fetched only when a viewer asks for
 * them. Keeping them out of the page payload means harvesting every seller's
 * number costs one rate-limited request each rather than one crawl of search.
 */
export async function revealContact(idOrRef: string, actor: Actor | null) {
  const listing = await prisma.listing.findFirst({
    where: { OR: [{ id: idOrRef }, { publicRef: idOrRef }], deletedAt: null },
    select: {
      contactName: true,
      contactPhone: true,
      contactViber: true,
      ownerId: true,
      createdById: true,
      status: true,
    },
  });
  if (!listing) throw notFound('Listing');
  // Same visibility rule as the listing itself: an unpublished listing does not
  // leak its owner's number to a stranger who guessed the reference.
  if (!canViewListing(actor, listing)) throw notFound('Listing');

  return {
    name: listing.contactName,
    phone: listing.contactPhone,
    viber: listing.contactViber,
  };
}

export async function statusCounts(actor: Actor) {
  const rows = await prisma.listing.groupBy({
    by: ['status'],
    where: { deletedAt: null, OR: [{ ownerId: actor.id }, { createdById: actor.id }] },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}
