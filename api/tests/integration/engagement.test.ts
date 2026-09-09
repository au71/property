import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
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

let app: Express;
let t: Taxonomy;
let ownerId: string;
let ownerToken: string;
let otherToken: string;
let seekerToken: string;
let listingId: string;

const jpeg = (width = 1200, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } })
    .jpeg()
    .toBuffer();

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
  await createUser('other@example.com', ['OWNER', 'SEEKER']);
  await createUser('seeker@example.com', ['SEEKER']);
  ownerToken = await tokenFor(app, 'owner@example.com');
  otherToken = await tokenFor(app, 'other@example.com');
  seekerToken = await tokenFor(app, 'seeker@example.com');
  listingId = (await createListing(t, ownerId)).id;
});

describe('media upload', () => {
  it('re-encodes an upload to WebP and makes the first image the cover', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'photo.jpg')
      .expect(201);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].url).toMatch(/\.webp$/);
    expect(res.body.data[0].isCover).toBe(true);
  });

  it('resizes a large image down to the display width', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(4000, 3000), 'huge.jpg')
      .expect(201);
    expect(res.body.data[0].width).toBe(1600);
  });

  it('does not enlarge an image smaller than the display width', async () => {
    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(400, 300), 'small.jpg')
      .expect(201);
    expect(res.body.data[0].width).toBe(400);
  });

  it('rejects a file that is not an image, whatever it is named', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', Buffer.from('This is definitely not an image'), 'evil.jpg')
      .expect(400);
  });

  it('refuses uploads from someone who does not own the listing', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(otherToken))
      .attach('files', await jpeg(), 'photo.jpg')
      .expect(403);
  });

  it('refuses an anonymous upload', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .attach('files', await jpeg(), 'photo.jpg')
      .expect(401);
  });

  it('enforces the per-listing photo limit', async () => {
    for (let i = 0; i < 15; i += 1) {
      await prisma.media.create({
        data: {
          listingId,
          url: `http://x/${i}.webp`,
          thumbUrl: `http://x/${i}-t.webp`,
          width: 1600,
          height: 1000,
          bytes: 1,
          sortOrder: i,
        },
      });
    }
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'photo.jpg')
      .expect(400);
  });

  it('promotes the next photo when the cover is deleted', async () => {
    const upload = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'a.jpg')
      .attach('files', await jpeg(), 'b.jpg')
      .expect(201);

    const cover = upload.body.data.find((m: { isCover: boolean }) => m.isCover);
    await request(app).delete(`/api/v1/media/${cover.id}`).set(auth(ownerToken)).expect(204);

    const remaining = await prisma.media.findMany({ where: { listingId } });
    expect(remaining).toHaveLength(1);
    // A listing without a cover renders as a blank card, so one must be promoted.
    expect(remaining[0]?.isCover).toBe(true);
  });

  it('reorders photos and moves the cover with them', async () => {
    const upload = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'a.jpg')
      .attach('files', await jpeg(), 'b.jpg')
      .expect(201);

    const reversed = [upload.body.data[1].id, upload.body.data[0].id];
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/media/reorder`)
      .set(auth(ownerToken))
      .send({ orderedIds: reversed })
      .expect(200);

    expect(res.body.data[0].id).toBe(reversed[0]);
    expect(res.body.data[0].isCover).toBe(true);
  });

  it('rejects a reorder that omits a photo', async () => {
    const upload = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'a.jpg')
      .attach('files', await jpeg(), 'b.jpg')
      .expect(201);

    await request(app)
      .patch(`/api/v1/listings/${listingId}/media/reorder`)
      .set(auth(ownerToken))
      .send({ orderedIds: [upload.body.data[0].id] })
      .expect(400);
  });

  it('removes a listing’s photos when the listing row is deleted', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set(auth(ownerToken))
      .attach('files', await jpeg(), 'a.jpg')
      .expect(201);

    await prisma.listing.delete({ where: { id: listingId } });
    expect(await prisma.media.count({ where: { listingId } })).toBe(0);
  });
});

describe('enquiries', () => {
  it('accepts an enquiry from an anonymous visitor', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/enquiries`)
      .send({ name: 'Ko Test', phone: '09123456789', message: 'Is this still available to view?' })
      .expect(201);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.enquiryCount).toBe(1);
  });

  it('silently drops a bot that fills the honeypot field', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/enquiries`)
      .send({
        name: 'Bot',
        phone: '09123456789',
        message: 'Buy cheap things at this website',
        website: 'http://spam.example',
      })
      .expect(400);
    expect(await prisma.enquiry.count()).toBe(0);
  });

  it('refuses an enquiry on an unpublished listing', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app)
      .post(`/api/v1/listings/${draft.id}/enquiries`)
      .send({ name: 'Ko Test', phone: '09123456789', message: 'Can I view this draft listing?' })
      .expect(404);
  });

  it('shows an enquiry to the listing owner but not to a stranger', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/enquiries`)
      .send({ name: 'Ko Test', phone: '09123456789', message: 'Is this still available to view?' })
      .expect(201);

    const owner = await request(app)
      .get('/api/v1/me/enquiries/received')
      .set(auth(ownerToken))
      .expect(200);
    expect(owner.body.data).toHaveLength(1);

    const stranger = await request(app)
      .get('/api/v1/me/enquiries/received')
      .set(auth(otherToken))
      .expect(200);
    expect(stranger.body.data).toHaveLength(0);
  });

  it('records a signed-in seeker against their own enquiry', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/enquiries`)
      .set(auth(seekerToken))
      .send({ name: 'Ko Test', phone: '09123456789', message: 'Is this still available to view?' })
      .expect(201);

    const sent = await request(app)
      .get('/api/v1/me/enquiries/sent')
      .set(auth(seekerToken))
      .expect(200);
    expect(sent.body.data).toHaveLength(1);
  });

  it('does not let a stranger change an enquiry’s status', async () => {
    const enquiry = await prisma.enquiry.create({
      data: {
        listingId,
        name: 'Ko Test',
        phone: '09123456789',
        message: 'Is this still available to view?',
      },
    });
    await request(app)
      .patch(`/api/v1/enquiries/${enquiry.id}`)
      .set(auth(otherToken))
      .send({ status: 'CLOSED' })
      .expect(403);

    await request(app)
      .patch(`/api/v1/enquiries/${enquiry.id}`)
      .set(auth(ownerToken))
      .send({ status: 'CONTACTED' })
      .expect(200);
  });

  it('rejects a message that is too short to be useful', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/enquiries`)
      .send({ name: 'Ko Test', phone: '09123456789', message: 'hi' })
      .expect(400);
  });
});

describe('saved listings and searches', () => {
  it('saves and unsaves a listing', async () => {
    await request(app)
      .post('/api/v1/me/saved-listings')
      .set(auth(seekerToken))
      .send({ listingId })
      .expect(204);

    const saved = await request(app)
      .get('/api/v1/me/saved-listings')
      .set(auth(seekerToken))
      .expect(200);
    expect(saved.body.data).toHaveLength(1);

    await request(app)
      .delete(`/api/v1/me/saved-listings/${listingId}`)
      .set(auth(seekerToken))
      .expect(204);

    const after = await request(app)
      .get('/api/v1/me/saved-listings')
      .set(auth(seekerToken))
      .expect(200);
    expect(after.body.data).toHaveLength(0);
  });

  it('treats saving twice as saving once', async () => {
    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post('/api/v1/me/saved-listings')
        .set(auth(seekerToken))
        .send({ listingId })
        .expect(204);
    }
    expect(await prisma.savedListing.count()).toBe(1);
  });

  it('will not save an unpublished listing', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app)
      .post('/api/v1/me/saved-listings')
      .set(auth(seekerToken))
      .send({ listingId: draft.id })
      .expect(404);
  });

  it('keeps one user out of another’s saved searches', async () => {
    const created = await request(app)
      .post('/api/v1/me/saved-searches')
      .set(auth(seekerToken))
      .send({ name: 'Condos in Bahan', query: { dealType: 'SALE' }, alertFrequency: 'DAILY' })
      .expect(201);

    await request(app)
      .patch(`/api/v1/me/saved-searches/${created.body.id}`)
      .set(auth(ownerToken))
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app)
      .patch(`/api/v1/me/saved-searches/${created.body.id}`)
      .set(auth(seekerToken))
      .send({ name: 'Renamed search' })
      .expect(200);
  });

  it('requires a sign-in to save anything', async () => {
    await request(app).get('/api/v1/me/saved-listings').expect(401);
  });
});

describe('reports', () => {
  it('files a report that staff can then see', async () => {
    await request(app)
      .post(`/api/v1/listings/${listingId}/report`)
      .set(auth(seekerToken))
      .send({ reason: 'Suspected scam', detail: 'The price is far below market.' })
      .expect(201);

    await createUser('staff@example.com', ['STAFF']);
    const staffToken = await tokenFor(app, 'staff@example.com');
    const res = await request(app)
      .get('/api/v1/admin/reports?status=OPEN')
      .set(auth(staffToken))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('view counter', () => {
  it('counts a view of a published listing only', async () => {
    await request(app).post(`/api/v1/listings/${listingId}/view`).expect(204);
    expect((await prisma.listing.findUnique({ where: { id: listingId } }))?.viewCount).toBe(1);

    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app).post(`/api/v1/listings/${draft.id}/view`).expect(204);
    expect((await prisma.listing.findUnique({ where: { id: draft.id } }))?.viewCount).toBe(0);
  });
});

describe('contact details', () => {
  it('keeps the phone number out of the listing payload', async () => {
    const res = await request(app).get(`/api/v1/listings/${listingId}`).expect(200);
    // The whole point: a client component receiving the number as a prop would
    // serialise it straight into the server-rendered HTML.
    expect(JSON.stringify(res.body)).not.toContain('09123456789');
    expect(res.body.contact).toEqual({
      name: 'Test Contact',
      hasPhone: true,
      hasViber: false,
    });
  });

  it('returns the number from the dedicated endpoint', async () => {
    const res = await request(app).get(`/api/v1/listings/${listingId}/contact`).expect(200);
    expect(res.body.phone).toBe('09123456789');
  });

  it('does not reveal the number for an unpublished listing', async () => {
    const draft = await createListing(t, ownerId, { status: 'DRAFT', publishedAt: null });
    await request(app).get(`/api/v1/listings/${draft.id}/contact`).expect(404);
    // The owner may still see their own.
    await request(app)
      .get(`/api/v1/listings/${draft.id}/contact`)
      .set(auth(ownerToken))
      .expect(200);
  });
});
