import { prisma } from '../../db/prisma.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { canSeeEnquiries, isStaff, type Actor } from '../../domain/policy.js';
import type { EnquiryStatus, PreferredContact } from '../../generated/prisma/enums.js';

export interface CreateEnquiryInput {
  name: string;
  phone: string;
  email?: string | undefined;
  message: string;
  preferredContact: PreferredContact;
}

export async function create(
  listingIdOrRef: string,
  input: CreateEnquiryInput,
  seekerId: string | null,
) {
  const listing = await prisma.listing.findFirst({
    where: {
      OR: [{ id: listingIdOrRef }, { publicRef: listingIdOrRef }],
      status: 'PUBLISHED',
      deletedAt: null,
    },
    select: { id: true, ownerId: true },
  });
  // Only published listings accept enquiries; anything else is "not found" so
  // this cannot be used to probe for drafts.
  if (!listing) throw notFound('Listing');

  const enquiry = await prisma.$transaction(async (tx) => {
    const created = await tx.enquiry.create({
      data: {
        listingId: listing.id,
        seekerId,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        message: input.message,
        preferredContact: input.preferredContact,
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: { enquiryCount: { increment: 1 } },
    });
    return created;
  });

  return { id: enquiry.id, createdAt: enquiry.createdAt };
}

const enquiryInclude = {
  listing: {
    select: {
      id: true,
      publicRef: true,
      title: true,
      dealType: true,
      status: true,
      ownerId: true,
      createdById: true,
      media: { where: { isCover: true }, select: { thumbUrl: true }, take: 1 },
    },
  },
} as const;

export async function listReceived(
  actor: Actor,
  filters: { listingId?: string | undefined; status?: EnquiryStatus | undefined },
  limit: number,
) {
  const rows = await prisma.enquiry.findMany({
    where: {
      ...(filters.listingId ? { listingId: filters.listingId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      listing: isStaff(actor) ? {} : { OR: [{ ownerId: actor.id }, { createdById: actor.id }] },
    },
    include: enquiryInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows;
}

export function listSent(actor: Actor, limit: number) {
  return prisma.enquiry.findMany({
    where: { seekerId: actor.id },
    include: enquiryInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function updateStatus(actor: Actor, id: string, status: EnquiryStatus) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    select: {
      id: true,
      listing: { select: { ownerId: true, createdById: true, status: true } },
    },
  });
  if (!enquiry) throw notFound('Enquiry');
  if (!canSeeEnquiries(actor, enquiry.listing)) throw forbidden('This enquiry is not yours');

  return prisma.enquiry.update({
    where: { id },
    data: {
      status,
      respondedAt: status === 'CONTACTED' ? new Date() : undefined,
    },
  });
}
