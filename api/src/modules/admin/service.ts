import { prisma } from '../../db/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { isAdmin, type Actor } from '../../domain/policy.js';
import { clearTaxonomyCache } from '../taxonomy/service.js';
import type { ListingStatus, Prisma, ReportStatus, Role } from '../../generated/prisma/client.js';

const LISTING_DAYS_VALID = 60;

async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  data?: unknown,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entity,
      entityId,
      dataJson: (data ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function moderationQueue(status: ListingStatus, limit: number, cursor?: string) {
  const rows = await prisma.listing.findMany({
    where: { status, deletedAt: null },
    include: {
      category: { select: { slug: true, nameEn: true } },
      township: { select: { nameEn: true, city: { select: { nameEn: true } } } },
      owner: { select: { id: true, name: true, email: true, phone: true } },
      createdBy: { select: { id: true, name: true } },
      media: { select: { thumbUrl: true, url: true }, orderBy: { sortOrder: 'asc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  return {
    data: page.map((l) => ({
      ...l,
      priceAmount: l.priceAmount.toString(),
      depositAmount: l.depositAmount?.toString() ?? null,
    })),
    page: { limit, nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null },
  };
}

export async function approve(actor: Actor, listingId: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!listing) throw notFound('Listing');
  if (listing.status !== 'PENDING_REVIEW') {
    throw badRequest(
      `Only a listing awaiting review can be approved (this one is ${listing.status})`,
    );
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + LISTING_DAYS_VALID * 24 * 60 * 60 * 1000),
      rejectionReason: null,
      events: {
        create: {
          actorId: actor.id,
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'PUBLISHED',
          note: 'Approved',
        },
      },
    },
    select: { id: true, status: true, publishedAt: true, expiresAt: true },
  });
  await audit(actor, 'listing.approve', 'Listing', listingId);
  return updated;
}

export async function reject(actor: Actor, listingId: string, reason: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!listing) throw notFound('Listing');
  if (listing.status !== 'PENDING_REVIEW') {
    throw badRequest('Only a listing awaiting review can be rejected');
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      events: {
        create: {
          actorId: actor.id,
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'REJECTED',
          note: reason,
        },
      },
    },
    select: { id: true, status: true, rejectionReason: true },
  });
  await audit(actor, 'listing.reject', 'Listing', listingId, { reason });
  return updated;
}

export async function suspend(actor: Actor, listingId: string, reason: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!listing) throw notFound('Listing');
  if (listing.status !== 'PUBLISHED') throw badRequest('Only a live listing can be suspended');

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: 'SUSPENDED',
      rejectionReason: reason,
      events: {
        create: { actorId: actor.id, fromStatus: 'PUBLISHED', toStatus: 'SUSPENDED', note: reason },
      },
    },
    select: { id: true, status: true },
  });
  await audit(actor, 'listing.suspend', 'Listing', listingId, { reason });
  return updated;
}

export async function feature(actor: Actor, listingId: string, days: number) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true },
  });
  if (!listing) throw notFound('Published listing');

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      isFeatured: days > 0,
      featuredUntil: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
    },
    select: { id: true, isFeatured: true, featuredUntil: true },
  });
  await audit(actor, 'listing.feature', 'Listing', listingId, { days });
  return updated;
}

export async function listReports(status: ReportStatus | undefined, limit: number) {
  return prisma.report.findMany({
    where: status ? { status } : {},
    include: {
      listing: { select: { id: true, publicRef: true, title: true, status: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function updateReport(actor: Actor, id: string, status: ReportStatus) {
  const existing = await prisma.report.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Report');
  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === 'ACTIONED' || status === 'DISMISSED' ? new Date() : null,
    },
  });
  await audit(actor, 'report.update', 'Report', id, { status });
  return updated;
}

export async function listUsers(search: string | undefined, role: Role | undefined, limit: number) {
  const rows = await prisma.user.findMany({
    where: {
      ...(role ? { roles: { some: { role } } } : {}),
      ...(search
        ? {
            OR: [
              // SQLite has no case-insensitive contains, so name search is
              // matched against the value as stored.
              { name: { contains: search } },
              { email: { contains: search.toLowerCase() } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      roles: { select: { role: true } },
      agentProfile: { select: { agencyName: true, isVerifiedAgent: true } },
      _count: { select: { ownedListings: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(({ roles, ...u }) => ({ ...u, roles: roles.map((r) => r.role) }));
}

export async function setRoles(actor: Actor, userId: string, roles: Role[]) {
  if (!isAdmin(actor)) throw forbidden('Only an administrator can change roles');
  if (userId === actor.id && !roles.includes('ADMIN')) {
    // Otherwise the last administrator can lock everyone out by accident.
    throw badRequest('You cannot remove your own administrator role');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound('User');

  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({ where: { userId } }),
    prisma.userRoleAssignment.createMany({ data: roles.map((role) => ({ userId, role })) }),
  ]);
  await audit(actor, 'user.setRoles', 'User', userId, { roles });
  return { id: userId, roles };
}

export async function setUserActive(actor: Actor, userId: string, isActive: boolean) {
  if (userId === actor.id && !isActive) throw badRequest('You cannot deactivate your own account');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, isActive: true },
  });
  // Deactivating must end their sessions, not just block new logins.
  if (!isActive) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await audit(actor, 'user.setActive', 'User', userId, { isActive });
  return user;
}

export async function verifyAgent(actor: Actor, userId: string, verified: boolean) {
  const profile = await prisma.agentProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound('Agent profile');
  const updated = await prisma.agentProfile.update({
    where: { userId },
    data: { isVerifiedAgent: verified, verifiedAt: verified ? new Date() : null },
  });
  await audit(actor, 'agent.verify', 'User', userId, { verified });
  return updated;
}

export async function stats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byStatus, byCity, byCategory, byDealType, users, enquiries, openReports, recent] =
    await Promise.all([
      prisma.listing.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.$queryRawUnsafe<Array<{ city: string; count: bigint }>>(
        `SELECT c."nameEn" AS city, COUNT(*) AS count
         FROM "Listing" l
         JOIN "Township" t ON t."id" = l."townshipId"
         JOIN "City" c ON c."id" = t."cityId"
         WHERE l."deletedAt" IS NULL AND l."status" = 'PUBLISHED'
         GROUP BY c."nameEn" ORDER BY count DESC`,
      ),
      prisma.$queryRawUnsafe<Array<{ category: string; count: bigint }>>(
        `SELECT cat."nameEn" AS category, COUNT(*) AS count
         FROM "Listing" l
         JOIN "Category" cat ON cat."id" = l."categoryId"
         WHERE l."deletedAt" IS NULL AND l."status" = 'PUBLISHED'
         GROUP BY cat."nameEn" ORDER BY count DESC`,
      ),
      prisma.listing.groupBy({
        by: ['dealType'],
        where: { deletedAt: null, status: 'PUBLISHED' },
        _count: { _all: true },
      }),
      prisma.user.count(),
      prisma.enquiry.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.$queryRawUnsafe<Array<{ day: string; count: bigint }>>(
        `SELECT date("publishedAt" / 1000, 'unixepoch') AS day, COUNT(*) AS count
         FROM "Listing"
         WHERE "publishedAt" IS NOT NULL AND "publishedAt" >= ?
         GROUP BY day ORDER BY day ASC`,
        thirtyDaysAgo.getTime(),
      ),
    ]);

  const num = (v: bigint | number) => Number(v);

  return {
    listingsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    listingsByCity: byCity.map((r) => ({ city: r.city, count: num(r.count) })),
    listingsByCategory: byCategory.map((r) => ({ category: r.category, count: num(r.count) })),
    listingsByDealType: Object.fromEntries(byDealType.map((r) => [r.dealType, r._count._all])),
    totalUsers: users,
    enquiriesLast30Days: enquiries,
    openReports,
    publishedPerDay: recent.map((r) => ({ day: r.day, count: num(r.count) })),
  };
}

export async function setTownshipActive(actor: Actor, townshipId: string, isActive: boolean) {
  if (!isAdmin(actor)) throw forbidden('Only an administrator can change locations');
  const updated = await prisma.township.update({ where: { id: townshipId }, data: { isActive } });
  clearTaxonomyCache();
  await audit(actor, 'township.setActive', 'Township', townshipId, { isActive });
  return updated;
}

export async function setCityActive(actor: Actor, cityId: string, isActive: boolean) {
  if (!isAdmin(actor)) throw forbidden('Only an administrator can change locations');
  const updated = await prisma.$transaction(async (tx) => {
    const city = await tx.city.update({ where: { id: cityId }, data: { isActive } });
    // Launching a city launches its townships; there is no useful state where a
    // city is live but every township under it is hidden.
    await tx.township.updateMany({ where: { cityId }, data: { isActive } });
    return city;
  });
  clearTaxonomyCache();
  await audit(actor, 'city.setActive', 'City', cityId, { isActive });
  return updated;
}

export async function setCategoryActive(actor: Actor, categoryId: string, isActive: boolean) {
  if (!isAdmin(actor)) throw forbidden('Only an administrator can change categories');
  const updated = await prisma.category.update({ where: { id: categoryId }, data: { isActive } });
  clearTaxonomyCache();
  await audit(actor, 'category.setActive', 'Category', categoryId, { isActive });
  return updated;
}
