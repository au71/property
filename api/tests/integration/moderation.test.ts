import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import {
  type Taxonomy,
  auth,
  createListing,
  createUser,
  resetDatabase,
  seedTaxonomy,
  tokenFor,
} from '../fixtures.js';
import { expireListings, unfeatureExpired } from '../../src/jobs/index.js';

let app: Express;
let t: Taxonomy;
let ownerId: string;
let ownerToken: string;
let staffToken: string;
let adminToken: string;
let seekerToken: string;

beforeAll(() => {
  app = createApp();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  t = await seedTaxonomy();
  ownerId = (await createUser('owner@example.com', ['OWNER', 'SEEKER'])).id;
  await createUser('staff@example.com', ['STAFF', 'SEEKER']);
  await createUser('admin@example.com', ['ADMIN', 'STAFF', 'SEEKER']);
  await createUser('seeker@example.com', ['SEEKER']);
  ownerToken = await tokenFor(app, 'owner@example.com');
  staffToken = await tokenFor(app, 'staff@example.com');
  adminToken = await tokenFor(app, 'admin@example.com');
  seekerToken = await tokenFor(app, 'seeker@example.com');
});

describe('access control', () => {
  it('refuses anonymous access to the admin area', async () => {
    await request(app).get('/api/v1/admin/stats').expect(401);
  });

  it('refuses a seeker', async () => {
    await request(app).get('/api/v1/admin/stats').set(auth(seekerToken)).expect(403);
  });

  it('refuses an owner', async () => {
    await request(app).get('/api/v1/admin/listings').set(auth(ownerToken)).expect(403);
  });

  it('allows staff', async () => {
    await request(app).get('/api/v1/admin/stats').set(auth(staffToken)).expect(200);
  });
});

describe('the review queue', () => {
  it('lists listings awaiting review', async () => {
    await createListing(t, ownerId, { status: 'PENDING_REVIEW', publishedAt: null });
    await createListing(t, ownerId, { status: 'PUBLISHED' });

    const res = await request(app)
      .get('/api/v1/admin/listings?status=PENDING_REVIEW')
      .set(auth(staffToken))
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    // BigInt prices must survive the queue serializer too.
    expect(typeof res.body.data[0].priceAmount).toBe('string');
  });

  it('publishes on approval and sets the expiry window', async () => {
    const listing = await createListing(t, ownerId, {
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
    const res = await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/approve`)
      .set(auth(staffToken))
      .expect(200);

    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishedAt).toBeTruthy();
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('will not approve a listing that is not awaiting review', async () => {
    const listing = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/approve`)
      .set(auth(staffToken))
      .expect(400);
  });

  it('requires a reason to reject', async () => {
    const listing = await createListing(t, ownerId, {
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
    await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/reject`)
      .set(auth(staffToken))
      .send({})
      .expect(400);
  });

  it('stores the rejection reason where the owner can read it', async () => {
    const listing = await createListing(t, ownerId, {
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
    await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/reject`)
      .set(auth(staffToken))
      .send({ reason: 'The photographs are too blurred to publish.' })
      .expect(200);

    const owner = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .expect(200);
    expect(owner.body.rejectionReason).toBe('The photographs are too blurred to publish.');
  });

  it('writes an audit log entry for a moderation action', async () => {
    const listing = await createListing(t, ownerId, {
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
    await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/approve`)
      .set(auth(staffToken))
      .expect(200);

    const log = await prisma.auditLog.findFirst({ where: { entityId: listing.id } });
    expect(log?.action).toBe('listing.approve');
  });

  it('suspends a live listing and removes it from search', async () => {
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED' });
    await request(app)
      .post(`/api/v1/admin/listings/${listing.id}/suspend`)
      .set(auth(staffToken))
      .send({ reason: 'Reported as a duplicate listing.' })
      .expect(200);

    await request(app).get(`/api/v1/listings/${listing.id}`).expect(404);
  });
});

describe('user administration', () => {
  it('lets an admin change roles', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${ownerId}/roles`)
      .set(auth(adminToken))
      .send({ roles: ['SEEKER', 'AGENT'] })
      .expect(200);
    expect(res.body.roles).toEqual(['SEEKER', 'AGENT']);
  });

  it('does not let plain staff change roles', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${ownerId}/roles`)
      .set(auth(staffToken))
      .send({ roles: ['ADMIN'] })
      .expect(403);
  });

  it('stops an admin removing their own admin role', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    await request(app)
      .patch(`/api/v1/admin/users/${admin!.id}/roles`)
      .set(auth(adminToken))
      .send({ roles: ['SEEKER'] })
      .expect(400);
  });

  it('ends live sessions when an account is deactivated', async () => {
    const before = await prisma.session.count({ where: { userId: ownerId, revokedAt: null } });
    expect(before).toBeGreaterThan(0);

    await request(app)
      .patch(`/api/v1/admin/users/${ownerId}/status`)
      .set(auth(staffToken))
      .send({ isActive: false })
      .expect(200);

    const after = await prisma.session.count({ where: { userId: ownerId, revokedAt: null } });
    expect(after).toBe(0);
    // The still-valid access token must stop working too.
    await request(app).get('/api/v1/me/listings').set(auth(ownerToken)).expect(403);
  });
});

describe('taxonomy administration', () => {
  it('lets an admin retire a township, hiding it from the public list', async () => {
    await request(app)
      .patch(`/api/v1/admin/locations/townships/${t.yankinId}`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);

    const res = await request(app).get('/api/v1/locations/townships').expect(200);
    expect(res.body.data.map((x: { id: string }) => x.id)).not.toContain(t.yankinId);
  });

  it('does not let plain staff change the taxonomy', async () => {
    await request(app)
      .patch(`/api/v1/admin/locations/townships/${t.yankinId}`)
      .set(auth(staffToken))
      .send({ isActive: false })
      .expect(403);
  });

  it('launches a city together with its townships', async () => {
    await request(app)
      .patch(`/api/v1/admin/locations/cities/${t.cityId}`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);

    const townships = await prisma.township.findMany({ where: { cityId: t.cityId } });
    expect(townships.every((x) => !x.isActive)).toBe(true);
  });
});

describe('scheduled jobs', () => {
  it('expires listings past their expiry date', async () => {
    const stale = await createListing(t, ownerId, {
      status: 'PUBLISHED',
      expiresAt: new Date(Date.now() - 1000),
    });
    const fresh = await createListing(t, ownerId, {
      status: 'PUBLISHED',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    expect(await expireListings()).toBe(1);
    expect((await prisma.listing.findUnique({ where: { id: stale.id } }))?.status).toBe('EXPIRED');
    expect((await prisma.listing.findUnique({ where: { id: fresh.id } }))?.status).toBe(
      'PUBLISHED',
    );

    const event = await prisma.listingEvent.findFirst({ where: { listingId: stale.id } });
    expect(event?.toStatus).toBe('EXPIRED');
  });

  it('drops the featured flag when the paid window ends', async () => {
    const listing = await createListing(t, ownerId, {
      status: 'PUBLISHED',
      isFeatured: true,
      featuredUntil: new Date(Date.now() - 1000),
    });
    expect(await unfeatureExpired()).toBe(1);
    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))?.isFeatured).toBe(
      false,
    );
  });
});

describe('stats', () => {
  it('summarises the portfolio', async () => {
    await createListing(t, ownerId, { status: 'PUBLISHED' });
    await createListing(t, ownerId, { status: 'PENDING_REVIEW', publishedAt: null });

    const res = await request(app).get('/api/v1/admin/stats').set(auth(staffToken)).expect(200);
    expect(res.body.listingsByStatus.PUBLISHED).toBe(1);
    expect(res.body.listingsByStatus.PENDING_REVIEW).toBe(1);
    expect(res.body.listingsByCity[0]).toMatchObject({ city: 'Yangon', count: 1 });
    // Raw SQL counts come back as BigInt and must be numbers by the time they
    // reach JSON.
    expect(typeof res.body.listingsByCity[0].count).toBe('number');
  });
});
