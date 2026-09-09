import { describe, expect, it } from 'vitest';
import {
  type Actor,
  type ListingRef,
  canEditListing,
  canTransition,
  canViewListing,
  canSeeExactAddress,
  canSeePropertyOwner,
  dailyListingQuotaFor,
  quotaWindowStart,
  nextStatusAfterEdit,
} from '../../src/domain/policy.js';

const actor = (id: string, roles: Actor['roles'], isActive = true): Actor => ({
  id,
  roles,
  isActive,
});
const listing = (over: Partial<ListingRef> = {}): ListingRef => ({
  ownerId: 'owner-1',
  createdById: 'owner-1',
  status: 'PUBLISHED',
  ...over,
});

describe('canViewListing', () => {
  it('lets anonymous visitors see published listings', () => {
    expect(canViewListing(null, listing({ status: 'PUBLISHED' }))).toBe(true);
  });

  it('hides unpublished listings from anonymous visitors', () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as const) {
      expect(canViewListing(null, listing({ status }))).toBe(false);
    }
  });

  it('lets the owner see their own draft', () => {
    expect(canViewListing(actor('owner-1', ['OWNER']), listing({ status: 'DRAFT' }))).toBe(true);
  });

  it('does not let an unrelated owner see someone else’s draft', () => {
    expect(canViewListing(actor('owner-2', ['OWNER']), listing({ status: 'DRAFT' }))).toBe(false);
  });

  it('lets staff see anything', () => {
    expect(canViewListing(actor('s', ['STAFF']), listing({ status: 'REJECTED' }))).toBe(true);
  });
});

describe('canEditListing', () => {
  it('refuses a deactivated account even when it owns the listing', () => {
    expect(canEditListing(actor('owner-1', ['OWNER'], false), listing())).toBe(false);
  });

  it('refuses editing a sold listing', () => {
    expect(canEditListing(actor('owner-1', ['OWNER']), listing({ status: 'SOLD' }))).toBe(false);
  });

  it('allows the agent who created it on an owner’s behalf', () => {
    expect(canEditListing(actor('agent-9', ['AGENT']), listing({ createdById: 'agent-9' }))).toBe(
      true,
    );
  });
});

describe('nextStatusAfterEdit', () => {
  it('sends an edited live listing back for review', () => {
    expect(nextStatusAfterEdit('PUBLISHED')).toBe('PENDING_REVIEW');
  });

  it('leaves a draft as a draft', () => {
    expect(nextStatusAfterEdit('DRAFT')).toBe('DRAFT');
  });
});

describe('canTransition', () => {
  it('does not let an owner publish their own listing', () => {
    expect(
      canTransition(
        actor('owner-1', ['OWNER']),
        listing({ status: 'PENDING_REVIEW' }),
        'PUBLISHED',
      ),
    ).toBe(false);
  });

  it('lets staff approve a pending listing', () => {
    expect(
      canTransition(actor('s', ['STAFF']), listing({ status: 'PENDING_REVIEW' }), 'PUBLISHED'),
    ).toBe(true);
  });

  it('lets an owner mark their published listing sold', () => {
    expect(canTransition(actor('owner-1', ['OWNER']), listing(), 'SOLD')).toBe(true);
  });

  it('does not let an owner suspend a listing', () => {
    expect(canTransition(actor('owner-1', ['OWNER']), listing(), 'SUSPENDED')).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(canTransition(actor('s', ['STAFF']), listing(), 'PUBLISHED')).toBe(false);
  });

  it('does not let a stranger transition anything', () => {
    expect(canTransition(actor('nobody', ['SEEKER']), listing(), 'SOLD')).toBe(false);
  });
});

describe('canSeeExactAddress', () => {
  it('is public when the owner did not hide it', () => {
    expect(canSeeExactAddress(null, { ...listing(), hideExactAddress: false })).toBe(true);
  });

  it('is hidden from anonymous visitors when flagged', () => {
    expect(canSeeExactAddress(null, { ...listing(), hideExactAddress: true })).toBe(false);
  });

  it('is visible to staff even when flagged', () => {
    expect(
      canSeeExactAddress(actor('s', ['STAFF']), { ...listing(), hideExactAddress: true }),
    ).toBe(true);
  });
});

describe('dailyListingQuotaFor', () => {
  it('gives seekers no quota', () => {
    expect(dailyListingQuotaFor(actor('u', ['SEEKER']))).toBe(0);
  });

  it('gives owners and agents the same daily allowance', () => {
    expect(dailyListingQuotaFor(actor('u', ['OWNER']))).toBe(5);
    expect(dailyListingQuotaFor(actor('u', ['AGENT']))).toBe(5);
  });

  it('is unlimited for staff', () => {
    expect(dailyListingQuotaFor(actor('u', ['STAFF']))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('quotaWindowStart', () => {
  it('is a rolling 24 hours, not a calendar day', () => {
    // A calendar boundary would let someone post five at 23:59 and five more a
    // couple of minutes later.
    const now = new Date('2026-09-09T00:05:00.000Z');
    expect(quotaWindowStart(now).toISOString()).toBe('2026-09-08T00:05:00.000Z');
  });
});

describe('canSeePropertyOwner', () => {
  it('hides the owner’s details from the public', () => {
    expect(canSeePropertyOwner(null, listing())).toBe(false);
  });

  it('hides them from an unrelated signed-in user', () => {
    expect(canSeePropertyOwner(actor('someone', ['SEEKER']), listing())).toBe(false);
    expect(canSeePropertyOwner(actor('owner-2', ['OWNER']), listing())).toBe(false);
  });

  it('shows them to the account that created the listing', () => {
    expect(
      canSeePropertyOwner(actor('agent-9', ['AGENT']), listing({ createdById: 'agent-9' })),
    ).toBe(true);
  });

  it('shows them to staff', () => {
    expect(canSeePropertyOwner(actor('s', ['STAFF']), listing())).toBe(true);
  });
});
