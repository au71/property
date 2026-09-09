import type { ListingStatus, Role } from '../generated/prisma/enums.js';

/**
 * Authorization rules as pure functions, so they can be unit-tested without a
 * database or an HTTP request. Route middleware handles the coarse role gate;
 * these handle the row-level questions.
 */

export interface Actor {
  id: string;
  roles: Role[];
  isActive: boolean;
}

export interface ListingRef {
  ownerId: string;
  createdById: string;
  status: ListingStatus;
}

export const hasRole = (actor: Actor, ...roles: Role[]): boolean =>
  roles.some((r) => actor.roles.includes(r));

export const isStaff = (actor: Actor): boolean => hasRole(actor, 'STAFF', 'ADMIN');
export const isAdmin = (actor: Actor): boolean => hasRole(actor, 'ADMIN');

/** Owners and agents may hold listings; seekers may not. */
export const canCreateListings = (actor: Actor): boolean =>
  hasRole(actor, 'OWNER', 'AGENT', 'STAFF', 'ADMIN');

export const ownsListing = (actor: Actor, listing: ListingRef): boolean =>
  listing.ownerId === actor.id || listing.createdById === actor.id;

/**
 * A published listing is still editable by its owner, but editing it sends it
 * back through review (see nextStatusAfterEdit).
 */
const EDITABLE_STATUSES: ListingStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'EXPIRED',
];

export function canEditListing(actor: Actor, listing: ListingRef): boolean {
  if (!actor.isActive) return false;
  if (isStaff(actor)) return true;
  if (!ownsListing(actor, listing)) return false;
  return EDITABLE_STATUSES.includes(listing.status);
}

export function canViewListing(actor: Actor | null, listing: ListingRef): boolean {
  if (listing.status === 'PUBLISHED') return true;
  if (!actor) return false;
  return isStaff(actor) || ownsListing(actor, listing);
}

export function canSubmitForReview(actor: Actor, listing: ListingRef): boolean {
  if (!ownsListing(actor, listing) && !isStaff(actor)) return false;
  return ['DRAFT', 'REJECTED', 'EXPIRED'].includes(listing.status);
}

export function canModerate(actor: Actor): boolean {
  return isStaff(actor);
}

export function canSeeEnquiries(actor: Actor, listing: ListingRef): boolean {
  return isStaff(actor) || ownsListing(actor, listing);
}

/**
 * The property owner's own name and number, recorded when they have no account.
 * That is a private individual's contact details, handed to an agent so the
 * agent can sell their house — not so the portal can publish it. Only the
 * listing's own account and staff ever see them.
 */
export function canSeePropertyOwner(actor: Actor | null, listing: ListingRef): boolean {
  if (!actor) return false;
  return isStaff(actor) || ownsListing(actor, listing);
}

/** Contact details are hidden from nobody, but the exact address can be. */
export function canSeeExactAddress(
  actor: Actor | null,
  listing: ListingRef & { hideExactAddress: boolean },
): boolean {
  if (!listing.hideExactAddress) return true;
  if (!actor) return false;
  return isStaff(actor) || ownsListing(actor, listing);
}

/**
 * Every listing is reviewed before it goes live — including listings from
 * verified agents. Editing a live listing therefore pulls it back into the
 * queue rather than publishing the change straight away.
 */
export function nextStatusAfterEdit(current: ListingStatus): ListingStatus {
  switch (current) {
    case 'DRAFT':
      return 'DRAFT';
    case 'PUBLISHED':
    case 'PENDING_REVIEW':
    case 'REJECTED':
    case 'EXPIRED':
      return 'PENDING_REVIEW';
    default:
      return current;
  }
}

/**
 * The quota is a rate, not a cap: five new listings per account per day.
 *
 * A cap on *live* listings punishes a legitimate agency with real stock, while
 * doing nothing to stop someone posting the same flat five times an hour. A
 * daily rate is the other way round — it leaves genuine inventory alone and
 * limits the flooding that moderation actually has to absorb.
 *
 * The window is a rolling 24 hours rather than a calendar day, because a
 * calendar day lets someone post five at 23:59 and five more at 00:01.
 */
export const DAILY_LISTING_QUOTA = 5;
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

export function dailyListingQuotaFor(actor: Actor): number {
  if (isStaff(actor)) return Number.POSITIVE_INFINITY;
  if (hasRole(actor, 'OWNER', 'AGENT')) return DAILY_LISTING_QUOTA;
  return 0;
}

export function quotaWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - QUOTA_WINDOW_MS);
}

/** Which status transitions the owner (not staff) may drive directly. */
const OWNER_TRANSITIONS: Partial<Record<ListingStatus, ListingStatus[]>> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['DRAFT', 'ARCHIVED'],
  PUBLISHED: ['SOLD', 'RENTED', 'ARCHIVED'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  EXPIRED: ['PENDING_REVIEW', 'ARCHIVED'],
  SOLD: ['ARCHIVED'],
  RENTED: ['ARCHIVED'],
};

/** Staff may additionally suspend, approve, and reject. */
const STAFF_TRANSITIONS: Partial<Record<ListingStatus, ListingStatus[]>> = {
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['SUSPENDED', 'EXPIRED'],
  SUSPENDED: ['PUBLISHED', 'ARCHIVED'],
};

export function canTransition(actor: Actor, listing: ListingRef, to: ListingStatus): boolean {
  const from = listing.status;
  if (from === to) return false;

  if (isStaff(actor)) {
    const staffAllowed = STAFF_TRANSITIONS[from] ?? [];
    const ownerAllowed = OWNER_TRANSITIONS[from] ?? [];
    return staffAllowed.includes(to) || ownerAllowed.includes(to);
  }

  if (!ownsListing(actor, listing)) return false;
  return (OWNER_TRANSITIONS[from] ?? []).includes(to);
}

/** Statuses that appear in public search results. */
export const PUBLIC_STATUSES: ListingStatus[] = ['PUBLISHED'];
