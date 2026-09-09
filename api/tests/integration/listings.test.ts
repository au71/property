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
  listingBody,
  resetDatabase,
  seedTaxonomy,
  tokenFor,
} from '../fixtures.js';

let app: Express;
let t: Taxonomy;
let ownerToken: string;
let otherOwnerToken: string;
let seekerToken: string;
let staffToken: string;
let ownerId: string;

beforeAll(() => {
  app = createApp();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  t = await seedTaxonomy();
  const owner = await createUser('owner@example.com', ['OWNER', 'SEEKER']);
  ownerId = owner.id;
  await createUser('other@example.com', ['OWNER', 'SEEKER']);
  await createUser('seeker@example.com', ['SEEKER']);
  await createUser('staff@example.com', ['STAFF', 'SEEKER']);
  ownerToken = await tokenFor(app, 'owner@example.com');
  otherOwnerToken = await tokenFor(app, 'other@example.com');
  seekerToken = await tokenFor(app, 'seeker@example.com');
  staffToken = await tokenFor(app, 'staff@example.com');
});

describe('creating listings', () => {
  it('creates a DRAFT and assigns a public reference', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t))
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.publicRef).toMatch(/^YGN-\d{4}-\d{6}$/);
  });

  it('refuses a seeker', async () => {
    await request(app)
      .post('/api/v1/listings')
      .set(auth(seekerToken))
      .send(listingBody(t))
      .expect(403);
  });

  it('refuses an anonymous caller', async () => {
    await request(app).post('/api/v1/listings').send(listingBody(t)).expect(401);
  });

  it('refuses a category group, requiring a specific category', async () => {
    const parent = await prisma.category.findFirst({ where: { slug: 'residential' } });
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { categoryId: parent!.id }))
      .expect(400);
  });

  it('refuses an inactive township', async () => {
    await prisma.township.update({ where: { id: t.yankinId }, data: { isActive: false } });
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { townshipId: t.yankinId }))
      .expect(400);
  });

  it('rejects rent terms on a sale listing', async () => {
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { rentPeriod: 'MONTHLY' }))
      .expect(400);
  });

  it('requires a rent period on a rental listing', async () => {
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { dealType: 'RENT' }))
      .expect(400);
  });

  it('stores a price too large for a 32-bit integer', async () => {
    const huge = '5000000000';
    const res = await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { priceAmount: huge }))
      .expect(201);

    expect(res.body.price.amount).toBe(huge);
    const row = await prisma.listing.findUnique({ where: { id: res.body.id } });
    expect(row?.priceAmount).toBe(5_000_000_000n);
  });

  it('derives land area from width and length', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t, { categoryId: t.landId, landWidthFt: 40, landLengthFt: 60 }))
      .expect(201);
    expect(res.body.attributes.landAreaSqft).toBe(2400);
  });

  it('allows five listings a day and refuses the sixth', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/listings')
        .set(auth(ownerToken))
        .send(listingBody(t))
        .expect(201);
    }
    const res = await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t))
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details).toMatchObject({ quota: 5, used: 5 });
  });

  it('counts listings created yesterday against nothing', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (let i = 0; i < 8; i += 1) {
      await createListing(t, ownerId, { createdAt: twoDaysAgo });
    }
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t))
      .expect(201);
  });

  it('counts a deleted listing, so delete-and-retry does not reset the limit', async () => {
    const created: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/v1/listings')
        .set(auth(ownerToken))
        .send(listingBody(t))
        .expect(201);
      created.push(res.body.id);
    }
    for (const id of created) {
      await request(app).delete(`/api/v1/listings/${id}`).set(auth(ownerToken)).expect(204);
    }
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t))
      .expect(409);
  });

  it('does not limit staff', async () => {
    for (let i = 0; i < 7; i += 1) {
      await request(app)
        .post('/api/v1/listings')
        .set(auth(staffToken))
        .send(listingBody(t))
        .expect(201);
    }
  });

  it('charges an agent’s own allowance, not the owner’s', async () => {
    const agent = await createUser('agent@example.com', ['AGENT', 'SEEKER']);
    const agentToken = await tokenFor(app, 'agent@example.com');

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/listings')
        .set(auth(agentToken))
        .send(listingBody(t, { ownerId }))
        .expect(201);
    }
    // The agent is out of allowance...
    await request(app)
      .post('/api/v1/listings')
      .set(auth(agentToken))
      .send(listingBody(t, { ownerId }))
      .expect(409);
    // ...but the owner they were listing for is untouched.
    await request(app)
      .post('/api/v1/listings')
      .set(auth(ownerToken))
      .send(listingBody(t))
      .expect(201);
    expect(agent.id).toBeTruthy();
  });
});

describe('listing for an owner without an account', () => {
  it('records the owner as free text, with no account required', async () => {
    const agent = await createUser('agent2@example.com', ['AGENT', 'SEEKER']);
    const agentToken = await tokenFor(app, 'agent2@example.com');

    const res = await request(app)
      .post('/api/v1/listings')
      .set(auth(agentToken))
      .send(
        listingBody(t, {
          propertyOwnerName: 'U Aung Myint',
          propertyOwnerPhone: '09987654321',
          propertyOwnerNote: 'Prefers viewings at the weekend.',
        }),
      )
      .expect(201);

    // The agent's own account holds the record; no user was created for the owner.
    const row = await prisma.listing.findUnique({ where: { id: res.body.id } });
    expect(row?.ownerId).toBe(agent.id);
    expect(row?.propertyOwnerName).toBe('U Aung Myint');
    expect(await prisma.user.count({ where: { name: 'U Aung Myint' } })).toBe(0);
  });

  it('never exposes the owner’s details publicly', async () => {
    const listing = await createListing(t, ownerId, {
      propertyOwnerName: 'Daw Khin Thida',
      propertyOwnerPhone: '09111222333',
    });

    const anon = await request(app).get(`/api/v1/listings/${listing.id}`).expect(200);
    expect(JSON.stringify(anon.body)).not.toContain('Daw Khin Thida');
    expect(JSON.stringify(anon.body)).not.toContain('09111222333');
    expect(anon.body.propertyOwner).toBeUndefined();

    const stranger = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .set(auth(otherOwnerToken))
      .expect(200);
    expect(stranger.body.propertyOwner).toBeUndefined();
  });

  it('shows them to the listing’s own account and to staff', async () => {
    const listing = await createListing(t, ownerId, {
      propertyOwnerName: 'Daw Khin Thida',
      propertyOwnerPhone: '09111222333',
    });

    const owner = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .expect(200);
    expect(owner.body.propertyOwner).toMatchObject({
      name: 'Daw Khin Thida',
      phone: '09111222333',
    });

    const staff = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .set(auth(staffToken))
      .expect(200);
    expect(staff.body.propertyOwner?.name).toBe('Daw Khin Thida');
  });
});

describe('listing visibility', () => {
  it('hides a draft from the public and from other owners', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });

    await request(app).get(`/api/v1/listings/${draft.id}`).expect(404);
    await request(app).get(`/api/v1/listings/${draft.id}`).set(auth(otherOwnerToken)).expect(404);
    await request(app).get(`/api/v1/listings/${draft.id}`).set(auth(ownerToken)).expect(200);
    await request(app).get(`/api/v1/listings/${draft.id}`).set(auth(staffToken)).expect(200);
  });

  it('finds a listing by its public reference as well as its id', async () => {
    const listing = await createListing(t, ownerId);
    const byRef = await request(app).get(`/api/v1/listings/${listing.publicRef}`).expect(200);
    expect(byRef.body.id).toBe(listing.id);
  });

  it('hides the exact address when the owner asked it to be hidden', async () => {
    const listing = await createListing(t, ownerId, {
      hideExactAddress: true,
      addressLine: 'No. 12, Secret Lane',
    });

    const anon = await request(app).get(`/api/v1/listings/${listing.id}`).expect(200);
    expect(anon.body.address).toBeNull();
    expect(anon.body.addressHidden).toBe(true);

    const owner = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .expect(200);
    expect(owner.body.address).toBe('No. 12, Secret Lane');
  });

  it('excludes a soft-deleted listing', async () => {
    const listing = await createListing(t, ownerId);
    await request(app).delete(`/api/v1/listings/${listing.id}`).set(auth(ownerToken)).expect(204);
    await request(app).get(`/api/v1/listings/${listing.id}`).expect(404);

    const search = await request(app).get('/api/v1/listings').expect(200);
    expect(search.body.data.map((l: { id: string }) => l.id)).not.toContain(listing.id);
  });
});

describe('editing', () => {
  it('sends an edited live listing back for review', async () => {
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED' });
    const res = await request(app)
      .patch(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .send({ title: 'An updated condominium title in Bahan' })
      .expect(200);

    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('lets staff edit without unpublishing', async () => {
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED' });
    const res = await request(app)
      .patch(`/api/v1/listings/${listing.id}`)
      .set(auth(staffToken))
      .send({ title: 'A staff corrected condominium title' })
      .expect(200);

    expect(res.body.status).toBe('PUBLISHED');
  });

  it('refuses an edit from an unrelated owner', async () => {
    const listing = await createListing(t, ownerId);
    await request(app)
      .patch(`/api/v1/listings/${listing.id}`)
      .set(auth(otherOwnerToken))
      .send({ title: 'A hijacked condominium title here' })
      .expect(403);
  });

  it('refuses to edit a sold listing', async () => {
    const listing = await createListing(t, ownerId, { status: 'SOLD' });
    await request(app)
      .patch(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .send({ title: 'Reviving a sold listing title' })
      .expect(403);
  });

  it('keeps titleNormalized in step with the title', async () => {
    const listing = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app)
      .patch(`/api/v1/listings/${listing.id}`)
      .set(auth(ownerToken))
      .send({ title: 'MiXeD CaSe Condominium In Bahan' })
      .expect(200);
    const row = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(row?.titleNormalized).toBe('mixed case condominium in bahan');
  });
});

describe('lifecycle', () => {
  it('will not submit a listing with no photos', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app)
      .post(`/api/v1/listings/${draft.id}/submit`)
      .set(auth(ownerToken))
      .expect(400);
  });

  it('submits once a photo exists', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await prisma.media.create({
      data: {
        listingId: draft.id,
        url: 'http://x/1.webp',
        thumbUrl: 'http://x/1-t.webp',
        width: 1600,
        height: 1000,
        bytes: 1000,
        isCover: true,
      },
    });
    const res = await request(app)
      .post(`/api/v1/listings/${draft.id}/submit`)
      .set(auth(ownerToken))
      .expect(200);
    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('does not let an owner publish their own listing', async () => {
    const pending = await createListing(t, ownerId, {
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
    // PUBLISHED is not even an option the owner endpoint accepts.
    await request(app)
      .post(`/api/v1/listings/${pending.id}/status`)
      .set(auth(ownerToken))
      .send({ status: 'PUBLISHED' })
      .expect(400);
  });

  it('lets an owner mark a published listing sold', async () => {
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED' });
    const res = await request(app)
      .post(`/api/v1/listings/${listing.id}/status`)
      .set(auth(ownerToken))
      .send({ status: 'SOLD' })
      .expect(200);
    expect(res.body.status).toBe('SOLD');
  });

  it('records an audit event for every transition', async () => {
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED' });
    await request(app)
      .post(`/api/v1/listings/${listing.id}/status`)
      .set(auth(ownerToken))
      .send({ status: 'SOLD' })
      .expect(200);

    const events = await prisma.listingEvent.findMany({ where: { listingId: listing.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fromStatus: 'PUBLISHED',
      toStatus: 'SOLD',
      actorId: ownerId,
    });
  });

  it('extends the expiry when a listing is renewed', async () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const listing = await createListing(t, ownerId, { status: 'PUBLISHED', expiresAt: soon });
    const res = await request(app)
      .post(`/api/v1/listings/${listing.id}/renew`)
      .set(auth(ownerToken))
      .expect(200);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(soon.getTime());
  });
});

describe('my listings', () => {
  it('returns the caller’s own listings with status counts', async () => {
    await createListing(t, ownerId, { status: 'PUBLISHED' });
    await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    const other = await prisma.user.findUnique({ where: { email: 'other@example.com' } });
    await createListing(t, other!.id, { status: 'PUBLISHED' });

    const res = await request(app).get('/api/v1/me/listings').set(auth(ownerToken)).expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.counts).toEqual({ PUBLISHED: 1, DRAFT: 1 });
  });
});
